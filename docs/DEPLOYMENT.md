# 博客系统部署指南

本文档提供了博客系统的完整部署指南，包括传统部署和Docker部署两种方式。

## 目录

- [系统要求](#系统要求)
- [部署前准备](#部署前准备)
- [传统部署](#传统部署)
- [Docker部署](#docker部署)
- [SSL证书配置](#ssl证书配置)
- [数据备份与恢复](#数据备份与恢复)
- [监控与维护](#监控与维护)
- [故障排除](#故障排除)
- [安全配置](#安全配置)

## 系统要求

### 最低配置
- **操作系统**: Ubuntu 20.04+ / CentOS 8+ / Debian 11+
- **CPU**: 1核心
- **内存**: 1GB RAM
- **存储**: 10GB 可用空间
- **网络**: 公网IP地址（可选）

### 推荐配置
- **操作系统**: Ubuntu 22.04 LTS
- **CPU**: 2核心
- **内存**: 2GB RAM
- **存储**: 20GB SSD
- **网络**: 公网IP + 域名

### 软件依赖
- **Node.js**: 18.0.0+
- **npm**: 8.0.0+
- **Git**: 2.0+
- **SQLite**: 3.0+
- **Nginx**: 1.18+
- **PM2**: 5.0+ (传统部署)
- **Docker**: 20.0+ (Docker部署)
- **Docker Compose**: 2.0+ (Docker部署)

## 部署前准备

### 1. 服务器准备

```bash
# 更新系统
sudo apt update && sudo apt upgrade -y

# 安装基础工具
sudo apt install -y curl wget git vim htop

# 配置防火墙
sudo ufw allow ssh
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable
```

### 2. 域名配置（可选）

如果您有域名，请配置DNS记录：

```
A记录: yourdomain.com -> 服务器IP
A记录: www.yourdomain.com -> 服务器IP
```

### 3. 获取源代码

```bash
# 克隆项目
git clone https://github.com/username/blog-system.git
cd blog-system

# 检查项目结构
ls -la
```

## 传统部署

传统部署使用PM2进程管理器和Nginx反向代理。

### 1. 自动部署（推荐）

```bash
# 给部署脚本执行权限
chmod +x scripts/deploy.sh

# 执行自动部署
./scripts/deploy.sh

# 或者指定参数
./scripts/deploy.sh \
  --user www-data \
  --path /var/www/blog-system \
  --repo https://github.com/username/blog-system.git \
  --branch main
```

### 2. 手动部署

#### 2.1 安装Node.js和PM2

```bash
# 安装Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# 安装PM2
sudo npm install -g pm2

# 配置PM2开机启动
sudo pm2 startup
```

#### 2.2 部署应用

```bash
# 创建部署目录
sudo mkdir -p /var/www/blog-system
sudo chown $USER:$USER /var/www/blog-system

# 复制项目文件
cp -r . /var/www/blog-system/
cd /var/www/blog-system

# 安装依赖
npm ci --production

# 构建项目
npm run build

# 配置环境变量
cp .env.production .env
vim .env  # 编辑配置

# 启动应用
pm2 start ecosystem.config.js
pm2 save
```

#### 2.3 配置Nginx

```bash
# 安装Nginx
sudo apt install -y nginx

# 创建站点配置
sudo vim /etc/nginx/sites-available/blog-system
```

添加以下配置：

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    
    # 重定向到HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;
    
    # SSL配置
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    
    # 前端静态文件
    location / {
        root /var/www/blog-system/dist;
        try_files $uri $uri/ /index.html;
        
        # 缓存静态资源
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }
    
    # API代理
    location /api {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # 文件上传
    location /uploads {
        alias /var/www/blog-system/uploads;
        expires 1d;
    }
}
```

```bash
# 启用站点
sudo ln -s /etc/nginx/sites-available/blog-system /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default

# 测试配置
sudo nginx -t

# 重启Nginx
sudo systemctl restart nginx
sudo systemctl enable nginx
```

## Docker部署

Docker部署提供了更好的隔离性和可移植性。

### 1. 自动部署（推荐）

```bash
# 给部署脚本执行权限
chmod +x scripts/docker-deploy.sh

# 执行自动部署
./scripts/docker-deploy.sh

# 或者指定参数
./scripts/docker-deploy.sh \
  --domain yourdomain.com \
  --email admin@yourdomain.com \
  --env production
```

### 2. 手动部署

#### 2.1 安装Docker和Docker Compose

```bash
# 安装Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker

# 安装Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# 验证安装
docker --version
docker-compose --version
```

#### 2.2 准备环境

```bash
# 创建必要目录
mkdir -p data uploads logs backups docker/ssl

# 配置环境变量
cp .env.production .env
vim .env  # 编辑配置

# 生成SSL证书（开发环境）
chmod +x scripts/generate-ssl.sh
./scripts/generate-ssl.sh localhost admin@example.com development
```

#### 2.3 构建和启动服务

```bash
# 构建镜像
docker-compose build

# 启动服务
docker-compose up -d

# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs -f
```

### 3. 开发环境部署

```bash
# 使用开发环境配置
docker-compose -f docker-compose.dev.yml up -d

# 查看服务
docker-compose -f docker-compose.dev.yml ps
```

## SSL证书配置

### 1. Let's Encrypt证书（生产环境）

```bash
# 安装Certbot
sudo apt install -y certbot python3-certbot-nginx

# 获取证书
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# 设置自动续期
sudo crontab -e
# 添加以下行：
# 0 12 * * * /usr/bin/certbot renew --quiet
```

### 2. 自签名证书（开发环境）

```bash
# 使用脚本生成
chmod +x scripts/generate-ssl.sh
./scripts/generate-ssl.sh yourdomain.com admin@yourdomain.com development
```

### 3. Docker环境SSL配置

```bash
# 生产环境证书
./scripts/generate-ssl.sh yourdomain.com admin@yourdomain.com production

# 重启Nginx容器
docker-compose restart nginx
```

## 数据备份与恢复

### 1. 自动备份

```bash
# 给备份脚本执行权限
chmod +x scripts/backup.sh

# 执行备份
./scripts/backup.sh

# 设置定时备份
crontab -e
# 添加以下行（每天凌晨2点备份）：
# 0 2 * * * /path/to/blog-system/scripts/backup.sh
```

### 2. 手动备份

```bash
# 备份数据库
sqlite3 data/blog.db ".backup backups/blog_$(date +%Y%m%d_%H%M%S).db"

# 备份上传文件
tar -czf backups/uploads_$(date +%Y%m%d_%H%M%S).tar.gz uploads/

# 备份配置文件
cp .env backups/env_$(date +%Y%m%d_%H%M%S).backup
```

### 3. 数据恢复

```bash
# 给恢复脚本执行权限
chmod +x scripts/restore.sh

# 从备份恢复
./scripts/restore.sh backups/blog_backup_20240116_120000.tar.gz

# 强制恢复（不提示确认）
./scripts/restore.sh backups/blog_backup_20240116_120000.tar.gz --force
```

## 监控与维护

### 1. 服务监控

```bash
# 传统部署监控
pm2 status
pm2 logs
pm2 monit

# Docker部署监控
docker-compose ps
docker-compose logs -f
docker stats
```

### 2. 系统监控

```bash
# 系统资源
htop
df -h
free -h

# 网络连接
netstat -tlnp
ss -tlnp

# 日志查看
tail -f logs/app.log
tail -f /var/log/nginx/access.log
```

### 3. 性能优化

```bash
# 数据库优化
sqlite3 data/blog.db "VACUUM;"
sqlite3 data/blog.db "ANALYZE;"

# 清理日志
find logs/ -name "*.log" -mtime +7 -delete

# 清理备份
find backups/ -name "*.tar.gz" -mtime +30 -delete
```

### 4. 更新部署

```bash
# 传统部署更新
git pull origin main
npm ci --production
npm run build
pm2 reload ecosystem.config.js

# Docker部署更新
git pull origin main
docker-compose build
docker-compose up -d
```

## 故障排除

### 1. 常见问题

#### 服务无法启动

```bash
# 检查端口占用
sudo netstat -tlnp | grep :3001

# 检查PM2状态
pm2 status
pm2 logs

# 检查Docker容器
docker-compose ps
docker-compose logs backend
```

#### 数据库连接失败

```bash
# 检查数据库文件权限
ls -la data/blog.db

# 检查数据库完整性
sqlite3 data/blog.db "PRAGMA integrity_check;"

# 修复权限
chmod 644 data/blog.db
chown $USER:$USER data/blog.db
```

#### Nginx配置错误

```bash
# 测试配置
sudo nginx -t

# 查看错误日志
sudo tail -f /var/log/nginx/error.log

# 重新加载配置
sudo nginx -s reload
```

### 2. 日志分析

```bash
# 应用日志
tail -f logs/app.log | grep ERROR

# Nginx访问日志
tail -f /var/log/nginx/access.log

# 系统日志
sudo journalctl -u nginx -f
sudo journalctl -u docker -f
```

### 3. 性能问题

```bash
# 检查系统负载
uptime
top
iostat

# 检查内存使用
free -h
ps aux --sort=-%mem | head

# 检查磁盘使用
df -h
du -sh * | sort -hr
```

## 安全配置

### 1. 防火墙配置

```bash
# UFW配置
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable

# 查看状态
sudo ufw status verbose
```

### 2. SSH安全

```bash
# 编辑SSH配置
sudo vim /etc/ssh/sshd_config

# 推荐配置：
# Port 22
# PermitRootLogin no
# PasswordAuthentication no
# PubkeyAuthentication yes
# MaxAuthTries 3

# 重启SSH服务
sudo systemctl restart ssh
```

### 3. 应用安全

```bash
# 设置文件权限
chmod 600 .env
chmod 755 scripts/*.sh
chmod -R 755 uploads/
chmod 644 data/blog.db

# 定期更新系统
sudo apt update && sudo apt upgrade -y

# 定期更新依赖
npm audit
npm audit fix
```

### 4. 备份安全

```bash
# 加密备份
tar -czf - backups/ | gpg --symmetric --cipher-algo AES256 -o backups_encrypted.tar.gz.gpg

# 远程备份
rsync -avz --delete backups/ user@backup-server:/path/to/backups/
```

## 环境变量配置

### 生产环境配置示例

```bash
# 应用配置
NODE_ENV=production
PORT=3001
HOST=0.0.0.0

# 数据库配置
DATABASE_PATH=./data/blog.db
DATABASE_BACKUP_INTERVAL=86400

# JWT配置
JWT_SECRET=your-super-secret-jwt-key-here
JWT_EXPIRES_IN=7d

# 文件上传配置
UPLOAD_PATH=./uploads
MAX_FILE_SIZE=10485760
ALLOWED_FILE_TYPES=jpg,jpeg,png,gif,pdf,doc,docx

# 邮件配置
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# 安全配置
CORS_ORIGIN=https://yourdomain.com
RATE_LIMIT_WINDOW=900000
RATE_LIMIT_MAX=100

# 日志配置
LOG_LEVEL=info
LOG_FILE_PATH=./logs
LOG_MAX_SIZE=10m
LOG_MAX_FILES=5

# 缓存配置
CACHE_TTL=3600
CACHE_MAX_SIZE=100

# 监控配置
MONITORING_ENABLED=true
METRICS_PORT=9090

# SSL配置
SSL_CERT_PATH=/etc/letsencrypt/live/yourdomain.com/fullchain.pem
SSL_KEY_PATH=/etc/letsencrypt/live/yourdomain.com/privkey.pem

# 备份配置
BACKUP_RETENTION_DAYS=30
REMOTE_BACKUP_ENABLED=false
S3_BUCKET=your-backup-bucket
S3_REGION=us-east-1

# 性能配置
CLUSTER_WORKERS=2
KEEP_ALIVE_TIMEOUT=5000
HEADERS_TIMEOUT=60000
```

## 总结

本部署指南涵盖了博客系统的完整部署流程，包括：

1. **传统部署**: 使用PM2和Nginx的经典部署方式
2. **Docker部署**: 使用容器化的现代部署方式
3. **SSL配置**: 支持HTTPS安全连接
4. **备份恢复**: 完整的数据保护方案
5. **监控维护**: 系统运维和故障排除
6. **安全配置**: 全面的安全防护措施

选择适合您需求的部署方式，并根据实际情况调整配置参数。如有问题，请参考故障排除章节或联系技术支持。

---

**注意**: 在生产环境中部署前，请务必：
1. 备份现有数据
2. 在测试环境中验证部署流程
3. 配置监控和告警
4. 制定应急响应计划
5. 定期更新和维护系统