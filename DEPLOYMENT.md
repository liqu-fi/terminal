# 部署信息

## 服务器信息
- **IP地址**: 154.36.164.246
- **用户名**: root
- **系统**: Debian 12
- **配置**: 2 vCPU, 2 GB RAM, 30+ GB 存储, 5 Mbps 带宽

## 部署状态
✅ **已成功部署**

- **访问地址**: http://154.36.164.246
- **应用目录**: `/var/www/tbt-paper-terminal`
- **构建输出**: `/var/www/tbt-paper-terminal/dist`
- **Nginx配置**: `/etc/nginx/sites-available/tbt-paper-terminal`
- **日志目录**: `/var/log/tbt-paper-terminal/`

## 已安装的软件
- Node.js v20.19.6
- npm v10.8.2
- Nginx 1.22.1

## 部署文件说明

### deploy.sh
自动部署脚本，包含以下步骤：
1. 检查并安装 Node.js
2. 检查并安装 Nginx
3. 创建应用目录
4. 上传项目文件
5. 安装依赖并构建项目
6. 配置 Nginx
7. 配置防火墙

### nginx.conf
Nginx 配置文件，包含：
- 静态文件服务
- Binance API 代理 (`/binance-api/`)
- SPA 路由支持
- Gzip 压缩
- 静态资源缓存

### deploy-manual.md
手动部署指南（如果自动部署脚本无法运行）

## 常用命令

### 查看日志
```bash
# 错误日志
ssh root@154.36.164.246 'tail -f /var/log/tbt-paper-terminal/error.log'

# 访问日志
ssh root@154.36.164.246 'tail -f /var/log/tbt-paper-terminal/access.log'
```

### 重启 Nginx
```bash
ssh root@154.36.164.246 'systemctl restart nginx'
```

### 重新部署
```bash
./deploy.sh
```

### 更新代码后重新构建
```bash
ssh root@154.36.164.246 'cd /var/www/tbt-paper-terminal && npm run build && systemctl reload nginx'
```

## 注意事项

1. **防火墙**: 服务器上可能没有安装 `ufw`，如果需要配置防火墙，请使用 `iptables` 或安装 `ufw`
2. **类型检查**: 当前构建跳过了 TypeScript 类型检查（使用 `vite build` 而不是 `tsc && vite build`）
3. **Binance API 代理**: 已配置在 Nginx 中，路径为 `/binance-api/`
4. **HTTPS**: 当前仅配置了 HTTP，如需 HTTPS，需要配置 SSL 证书

## 下一步

1. 配置域名（如需要）
2. 配置 SSL 证书（HTTPS）
3. 设置防火墙规则
4. 配置自动备份
5. 设置监控和告警


