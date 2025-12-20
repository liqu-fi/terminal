# 手动部署指南

如果自动部署脚本无法运行，请按照以下步骤手动部署：

## 1. 连接到服务器

```bash
ssh root@154.36.164.246
# 密码: 请参考您的安全凭据
```

## 2. 安装 Node.js

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs
node --version
npm --version
```

## 3. 安装 Nginx

```bash
apt-get update
apt-get install -y nginx
systemctl enable nginx
systemctl start nginx
```

## 4. 创建应用目录

```bash
mkdir -p /var/www/tbt-paper-terminal
mkdir -p /var/log/tbt-paper-terminal
```

## 5. 上传项目文件

在本地机器上执行：

```bash
# 打包项目（排除 node_modules 和 .git）
tar --exclude='node_modules' \
    --exclude='.git' \
    --exclude='dist' \
    --exclude='.DS_Store' \
    -czf tbt-paper-terminal.tar.gz .

# 上传到服务器
scp tbt-paper-terminal.tar.gz root@154.36.164.246:/tmp/
```

在服务器上执行：

```bash
cd /tmp
tar -xzf tbt-paper-terminal.tar.gz -C /var/www/tbt-paper-terminal/
cd /var/www/tbt-paper-terminal
```

## 6. 安装依赖并构建

```bash
cd /var/www/tbt-paper-terminal
npm install
npm run build
```

## 7. 配置 Nginx

将 `nginx.conf` 文件上传到服务器：

```bash
# 在本地执行
scp nginx.conf root@154.36.164.246:/tmp/nginx.conf
```

在服务器上执行：

```bash
cp /tmp/nginx.conf /etc/nginx/sites-available/tbt-paper-terminal
ln -sf /etc/nginx/sites-available/tbt-paper-terminal /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx
```

## 8. 配置防火墙

```bash
ufw allow 80/tcp
ufw allow 22/tcp
ufw --force enable
```

## 9. 验证部署

访问: http://154.36.164.246

查看日志：
```bash
tail -f /var/log/tbt-paper-terminal/error.log
```


