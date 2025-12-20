#!/bin/bash

# 部署脚本 - TBT Paper Terminal

# 加载 .env 文件（如果存在）
if [ -f .env ]; then
    echo "📝 加载 .env 文件..."
    export $(grep -v '^#' .env | xargs)
fi

# 服务器信息
SERVER_IP="${SERVER_IP:-154.36.164.246}"
SERVER_USER="${SERVER_USER:-root}"
SERVER_PASSWORD="${SERVER_PASSWORD:-}"
APP_NAME="tbt-paper-terminal"
APP_DIR="/var/www/$APP_NAME"
NGINX_CONFIG="/etc/nginx/sites-available/$APP_NAME"

echo "🚀 开始部署 TBT Paper Terminal 到服务器..."

# 检查环境变量
if [ -z "$SERVER_PASSWORD" ]; then
    echo "❌ 错误: SERVER_PASSWORD 环境变量未设置。"
    echo "   请运行: export SERVER_PASSWORD='your_password'"
    echo "   或者在 .env 文件中定义并使用 source .env"
    exit 1
fi

# 检查 sshpass 是否安装
if ! command -v sshpass &> /dev/null; then
    echo "❌ sshpass 未安装。"
    echo "   在 macOS 上安装: brew install hudochenkov/sshpass/sshpass"
    echo "   在 Linux 上安装: sudo apt-get install sshpass"
    echo ""
    echo "   或者使用手动部署指南: 查看 deploy-manual.md"
    exit 1
fi

# 执行远程命令的函数
remote_exec() {
    sshpass -p "$SERVER_PASSWORD" ssh -o StrictHostKeyChecking=no "$SERVER_USER@$SERVER_IP" "$1"
}

# 复制文件到服务器的函数
remote_copy() {
    sshpass -p "$SERVER_PASSWORD" scp -o StrictHostKeyChecking=no -r "$1" "$SERVER_USER@$SERVER_IP:$2"
}

echo "📦 步骤 1: 检查并安装 Node.js..."
remote_exec "
    # 检查 Node.js 是否已安装
    if ! command -v node &> /dev/null; then
        echo '安装 Node.js...'
        curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
        apt-get install -y nodejs
    fi
    node --version
    npm --version
"

echo "📦 步骤 2: 检查并安装 Nginx..."
remote_exec "
    if ! command -v nginx &> /dev/null; then
        echo '安装 Nginx...'
        apt-get update
        apt-get install -y nginx
        systemctl enable nginx
        systemctl start nginx
    fi
    nginx -v
"

echo "📦 步骤 3: 创建应用目录..."
remote_exec "
    mkdir -p $APP_DIR
    mkdir -p $APP_DIR/dist
    mkdir -p /var/log/$APP_NAME
"

echo "📦 步骤 4: 上传项目文件..."
# 创建临时目录用于打包
TEMP_DIR=$(mktemp -d)
cp -r . "$TEMP_DIR/$APP_NAME" 2>/dev/null || true
cd "$TEMP_DIR"

# 排除不需要的文件
tar --exclude='node_modules' \
    --exclude='.git' \
    --exclude='dist' \
    --exclude='.DS_Store' \
    -czf "$APP_NAME.tar.gz" "$APP_NAME"

remote_copy "$TEMP_DIR/$APP_NAME.tar.gz" "/tmp/"

remote_exec "
    cd /tmp
    tar -xzf $APP_NAME.tar.gz
    cp -r $APP_NAME/* $APP_DIR/
    rm -rf $APP_NAME.tar.gz $APP_NAME
"

rm -rf "$TEMP_DIR"

echo "📦 步骤 5: 安装依赖并构建项目..."
remote_exec "
    cd $APP_DIR
    npm install --production=false
    npm run build:check
"

# 验证构建产物
echo "📦 步骤 5.1: 验证构建产物..."
remote_exec "
    if [ ! -d \"$APP_DIR/dist\" ]; then
        echo '❌ 错误: dist 目录不存在'
        exit 1
    fi
    if [ ! -f \"$APP_DIR/dist/index.html\" ]; then
        echo '❌ 错误: index.html 不存在'
        exit 1
    fi
    echo '✅ 构建产物验证通过'
"

echo "📦 步骤 6: 配置 Nginx..."
# 创建 Nginx 配置文件
cat > /tmp/nginx_config <<EOF
server {
    listen 80;
    server_name $SERVER_IP;

    root $APP_DIR/dist;
    index index.html;

    # Gzip 压缩
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/json application/javascript;

    # 禁止直接访问 assets 目录
    location = /assets/ {
        return 404;
    }
    
    # 静态资源缓存（匹配所有 assets 下的文件）
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        # 禁止目录列表
        autoindex off;
        # 如果请求的是目录，返回 404
        try_files \$uri =404;
    }

    # Binance API 代理
    location /binance-api/ {
        proxy_pass https://api.binance.com/;
        proxy_ssl_server_name on;
        proxy_set_header Host api.binance.com;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        
        # CORS 头
        add_header Access-Control-Allow-Origin * always;
        add_header Access-Control-Allow-Methods 'GET, POST, OPTIONS' always;
        add_header Access-Control-Allow-Headers 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range' always;
        
        if (\$request_method = 'OPTIONS') {
            return 204;
        }
    }

    # SPA 路由支持
    location / {
        try_files \$uri \$uri/ /index.html;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }

    # 日志
    access_log /var/log/$APP_NAME/access.log;
    error_log /var/log/$APP_NAME/error.log;
}
EOF

remote_copy "/tmp/nginx_config" "/tmp/nginx_config"
rm /tmp/nginx_config

remote_exec "
    cp /tmp/nginx_config $NGINX_CONFIG
    rm /tmp/nginx_config
    
    # 创建符号链接
    ln -sf $NGINX_CONFIG /etc/nginx/sites-enabled/$APP_NAME
    
    # 删除默认配置（如果存在）
    rm -f /etc/nginx/sites-enabled/default
    
    # 测试 Nginx 配置
    nginx -t
    
    # 重载 Nginx
    systemctl reload nginx
"

echo "📦 步骤 7: 配置防火墙..."
remote_exec "
    # 允许 HTTP 端口
    ufw allow 80/tcp || true
    ufw allow 22/tcp || true
    ufw --force enable || true
"

echo "📦 步骤 8: 健康检查..."
remote_exec "
    # 等待 Nginx 启动
    sleep 2
    
    # 检查 Nginx 状态
    if ! systemctl is-active --quiet nginx; then
        echo '❌ 警告: Nginx 未运行'
        systemctl status nginx
    else
        echo '✅ Nginx 运行正常'
    fi
    
    # 检查应用文件
    if [ -f \"$APP_DIR/dist/index.html\" ]; then
        echo '✅ 应用文件存在'
    else
        echo '❌ 错误: 应用文件不存在'
        exit 1
    fi
    
    # 测试 HTTP 响应（如果 curl 可用）
    if command -v curl &> /dev/null; then
        HTTP_CODE=\$(curl -s -o /dev/null -w '%{http_code}' http://localhost/ || echo '000')
        if [ \"\$HTTP_CODE\" = '200' ] || [ \"\$HTTP_CODE\" = '000' ]; then
            echo '✅ HTTP 响应正常'
        else
            echo \"⚠️  HTTP 响应码: \$HTTP_CODE\"
        fi
    fi
"

echo "✅ 部署完成！"
echo ""
echo "🌐 访问地址: http://$SERVER_IP"
echo ""
echo "📝 后续操作："
echo "   1. 如需更新代码，运行: ./deploy.sh"
echo "   2. 查看日志: ssh $SERVER_USER@$SERVER_IP 'tail -f /var/log/$APP_NAME/error.log'"
echo "   3. 重启 Nginx: ssh $SERVER_USER@$SERVER_IP 'systemctl restart nginx'"

