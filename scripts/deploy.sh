#!/bin/bash

# 博客系统传统部署脚本
# 用于在Linux服务器上部署博客系统

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

# 配置变量
PROJECT_NAME="blog-system"
DEPLOY_USER="${DEPLOY_USER:-deploy}"
DEPLOY_PATH="${DEPLOY_PATH:-/var/www/blog-system}"
REPO_URL="${REPO_URL:-https://github.com/username/blog-system.git}"
BRANCH="${BRANCH:-main}"
NODE_VERSION="${NODE_VERSION:-20}"
ENVIRONMENT="${ENVIRONMENT:-production}"
BACKUP_BEFORE_DEPLOY="${BACKUP_BEFORE_DEPLOY:-true}"
RUN_MIGRATIONS="${RUN_MIGRATIONS:-true}"
RESTART_SERVICES="${RESTART_SERVICES:-true}"

# 检查系统要求
check_system_requirements() {
    log_info "检查系统要求..."
    
    # 检查操作系统
    if [[ "$(uname)" != "Linux" ]]; then
        log_error "此脚本仅支持Linux系统"
        exit 1
    fi
    
    # 检查用户权限
    if [[ $EUID -eq 0 ]]; then
        log_warning "不建议使用root用户运行部署脚本"
    fi
    
    # 检查必要的命令
    local required_commands=("git" "node" "npm" "sqlite3")
    for cmd in "${required_commands[@]}"; do
        if ! command -v "$cmd" &> /dev/null; then
            log_error "缺少必要的命令: $cmd"
            exit 1
        fi
    done
    
    # 检查Node.js版本
    local node_version=$(node --version | sed 's/v//')
    local major_version=$(echo "$node_version" | cut -d. -f1)
    if [[ $major_version -lt 18 ]]; then
        log_error "Node.js版本过低，需要18.0.0或更高版本，当前版本: $node_version"
        exit 1
    fi
    
    log_success "系统要求检查通过"
}

# 安装系统依赖
install_system_dependencies() {
    log_info "安装系统依赖..."
    
    # 检测包管理器
    if command -v apt-get &> /dev/null; then
        # Ubuntu/Debian
        sudo apt-get update
        sudo apt-get install -y curl wget git build-essential sqlite3 nginx certbot python3-certbot-nginx
    elif command -v yum &> /dev/null; then
        # CentOS/RHEL
        sudo yum update -y
        sudo yum install -y curl wget git gcc-c++ make sqlite nginx certbot python3-certbot-nginx
    elif command -v dnf &> /dev/null; then
        # Fedora
        sudo dnf update -y
        sudo dnf install -y curl wget git gcc-c++ make sqlite nginx certbot python3-certbot-nginx
    else
        log_warning "未识别的包管理器，请手动安装依赖"
    fi
    
    log_success "系统依赖安装完成"
}

# 安装Node.js和PM2
install_nodejs() {
    log_info "安装Node.js和PM2..."
    
    # 检查是否已安装正确版本的Node.js
    if command -v node &> /dev/null; then
        local current_version=$(node --version | sed 's/v//' | cut -d. -f1)
        if [[ $current_version -ge 18 ]]; then
            log_info "Node.js已安装，版本: $(node --version)"
        else
            log_info "Node.js版本过低，需要更新"
        fi
    else
        # 安装Node.js
        curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | sudo -E bash -
        sudo apt-get install -y nodejs
    fi
    
    # 安装PM2
    if ! command -v pm2 &> /dev/null; then
        sudo npm install -g pm2
        log_info "PM2已安装"
    else
        log_info "PM2已存在"
    fi
    
    # 配置PM2开机启动
    sudo pm2 startup
    
    log_success "Node.js和PM2安装完成"
}

# 创建部署用户和目录
setup_deploy_environment() {
    log_info "设置部署环境..."
    
    # 创建部署用户（如果不存在）
    if ! id "$DEPLOY_USER" &>/dev/null; then
        sudo useradd -m -s /bin/bash "$DEPLOY_USER"
        log_info "创建部署用户: $DEPLOY_USER"
    fi
    
    # 创建部署目录
    sudo mkdir -p "$DEPLOY_PATH"
    sudo chown "$DEPLOY_USER:$DEPLOY_USER" "$DEPLOY_PATH"
    
    # 创建必要的子目录
    sudo -u "$DEPLOY_USER" mkdir -p "$DEPLOY_PATH"/{data,uploads,logs,backups}
    
    log_success "部署环境设置完成"
}

# 克隆或更新代码
deploy_code() {
    log_info "部署代码..."
    
    if [[ -d "$DEPLOY_PATH/.git" ]]; then
        # 更新现有代码
        log_info "更新现有代码库..."
        cd "$DEPLOY_PATH"
        sudo -u "$DEPLOY_USER" git fetch origin
        sudo -u "$DEPLOY_USER" git reset --hard "origin/$BRANCH"
    else
        # 克隆新代码
        log_info "克隆代码库..."
        sudo -u "$DEPLOY_USER" git clone -b "$BRANCH" "$REPO_URL" "$DEPLOY_PATH"
        cd "$DEPLOY_PATH"
    fi
    
    # 显示当前版本信息
    local commit_hash=$(git rev-parse --short HEAD)
    local commit_message=$(git log -1 --pretty=%B)
    log_info "当前版本: $commit_hash"
    log_info "提交信息: $commit_message"
    
    log_success "代码部署完成"
}

# 安装依赖
install_dependencies() {
    log_info "安装项目依赖..."
    
    cd "$DEPLOY_PATH"
    
    # 清理node_modules（可选）
    if [[ "$CLEAN_INSTALL" == "true" ]]; then
        sudo -u "$DEPLOY_USER" rm -rf node_modules package-lock.json
    fi
    
    # 安装依赖
    sudo -u "$DEPLOY_USER" npm ci --production
    
    log_success "依赖安装完成"
}

# 构建项目
build_project() {
    log_info "构建项目..."
    
    cd "$DEPLOY_PATH"
    
    # 构建前端
    log_info "构建前端应用..."
    sudo -u "$DEPLOY_USER" npm run build
    
    # 构建后端（如果需要）
    if [[ -f "tsconfig.json" ]]; then
        log_info "编译TypeScript..."
        sudo -u "$DEPLOY_USER" npm run build:server 2>/dev/null || true
    fi
    
    log_success "项目构建完成"
}

# 配置环境变量
setup_environment() {
    log_info "配置环境变量..."
    
    cd "$DEPLOY_PATH"
    
    # 复制生产环境配置
    if [[ -f ".env.production" ]]; then
        sudo -u "$DEPLOY_USER" cp .env.production .env
        log_info "已应用生产环境配置"
    else
        log_warning "未找到.env.production文件"
    fi
    
    # 设置文件权限
    sudo -u "$DEPLOY_USER" chmod 600 .env 2>/dev/null || true
    
    log_success "环境变量配置完成"
}

# 运行数据库迁移
run_database_migrations() {
    if [[ "$RUN_MIGRATIONS" == "true" ]]; then
        log_info "运行数据库迁移..."
        
        cd "$DEPLOY_PATH"
        
        # 检查是否有迁移脚本
        if [[ -d "migrations" ]] || [[ -f "migrate.js" ]]; then
            sudo -u "$DEPLOY_USER" npm run migrate 2>/dev/null || {
                log_warning "迁移脚本执行失败或不存在"
            }
        else
            log_info "未找到数据库迁移脚本"
        fi
        
        log_success "数据库迁移完成"
    fi
}

# 配置Nginx
setup_nginx() {
    log_info "配置Nginx..."
    
    # 创建Nginx配置文件
    cat > /tmp/blog-nginx.conf << EOF
server {
    listen 80;
    server_name _;
    
    # 重定向到HTTPS
    return 301 https://\$server_name\$request_uri;
}

server {
    listen 443 ssl http2;
    server_name _;
    
    # SSL配置（需要先获取证书）
    # ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    # ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    
    # 前端静态文件
    location / {
        root $DEPLOY_PATH/dist;
        try_files \$uri \$uri/ /index.html;
        
        # 缓存静态资源
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)\$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }
    
    # API代理
    location /api {
        proxy_pass http://localhost:3001;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
    
    # 文件上传
    location /uploads {
        alias $DEPLOY_PATH/uploads;
        expires 1d;
    }
    
    # 健康检查
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }
}
EOF
    
    # 安装Nginx配置
    sudo mv /tmp/blog-nginx.conf /etc/nginx/sites-available/blog-system
    sudo ln -sf /etc/nginx/sites-available/blog-system /etc/nginx/sites-enabled/
    
    # 删除默认配置
    sudo rm -f /etc/nginx/sites-enabled/default
    
    # 测试Nginx配置
    sudo nginx -t
    
    log_success "Nginx配置完成"
}

# 启动服务
start_services() {
    if [[ "$RESTART_SERVICES" == "true" ]]; then
        log_info "启动服务..."
        
        cd "$DEPLOY_PATH"
        
        # 停止现有服务
        sudo -u "$DEPLOY_USER" pm2 stop blog-backend 2>/dev/null || true
        
        # 启动后端服务
        sudo -u "$DEPLOY_USER" pm2 start ecosystem.config.js
        
        # 保存PM2配置
        sudo -u "$DEPLOY_USER" pm2 save
        
        # 重启Nginx
        sudo systemctl restart nginx
        sudo systemctl enable nginx
        
        log_success "服务启动完成"
    fi
}

# 验证部署
verify_deployment() {
    log_info "验证部署..."
    
    local errors=0
    
    # 检查PM2服务
    if sudo -u "$DEPLOY_USER" pm2 list | grep -q "blog-backend.*online"; then
        log_success "后端服务运行正常"
    else
        log_error "后端服务未运行"
        ((errors++))
    fi
    
    # 检查Nginx服务
    if systemctl is-active --quiet nginx; then
        log_success "Nginx服务运行正常"
    else
        log_error "Nginx服务未运行"
        ((errors++))
    fi
    
    # 检查端口监听
    if netstat -tlnp | grep -q ":3001.*LISTEN"; then
        log_success "后端端口3001监听正常"
    else
        log_error "后端端口3001未监听"
        ((errors++))
    fi
    
    if netstat -tlnp | grep -q ":80.*LISTEN\|:443.*LISTEN"; then
        log_success "Web端口监听正常"
    else
        log_error "Web端口未监听"
        ((errors++))
    fi
    
    # 检查健康状态
    if curl -f http://localhost/health &>/dev/null; then
        log_success "应用健康检查通过"
    else
        log_warning "应用健康检查失败"
    fi
    
    if [[ $errors -eq 0 ]]; then
        log_success "部署验证完成，系统运行正常"
        return 0
    else
        log_error "部署验证发现 $errors 个错误"
        return 1
    fi
}

# 部署后清理
post_deploy_cleanup() {
    log_info "执行部署后清理..."
    
    cd "$DEPLOY_PATH"
    
    # 清理构建缓存
    sudo -u "$DEPLOY_USER" npm cache clean --force 2>/dev/null || true
    
    # 清理旧的日志文件
    find "$DEPLOY_PATH/logs" -name "*.log" -mtime +7 -delete 2>/dev/null || true
    
    # 清理旧的备份文件
    find "$DEPLOY_PATH/backups" -name "*.tar.gz" -mtime +30 -delete 2>/dev/null || true
    
    log_success "部署后清理完成"
}

# 主部署函数
main_deploy() {
    log_info "开始部署博客系统..."
    
    local start_time=$(date +%s)
    
    # 执行部署步骤
    check_system_requirements
    install_system_dependencies
    install_nodejs
    setup_deploy_environment
    
    # 备份现有数据
    if [[ "$BACKUP_BEFORE_DEPLOY" == "true" && -d "$DEPLOY_PATH" ]]; then
        log_info "备份现有数据..."
        "$DEPLOY_PATH/scripts/backup.sh" 2>/dev/null || log_warning "备份脚本执行失败"
    fi
    
    deploy_code
    install_dependencies
    build_project
    setup_environment
    run_database_migrations
    setup_nginx
    start_services
    verify_deployment
    post_deploy_cleanup
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    log_success "博客系统部署完成！"
    log_info "部署路径: $DEPLOY_PATH"
    log_info "耗时: ${duration}秒"
    
    # 显示访问信息
    echo ""
    log_info "访问信息:"
    log_info "  - HTTP: http://$(hostname -I | awk '{print $1}')"
    log_info "  - HTTPS: https://$(hostname -I | awk '{print $1}') (需要配置SSL证书)"
    log_info "  - 管理面板: http://$(hostname -I | awk '{print $1}')/admin"
    echo ""
    log_info "后续步骤:"
    log_info "  1. 配置域名DNS解析"
    log_info "  2. 获取SSL证书: sudo certbot --nginx -d yourdomain.com"
    log_info "  3. 配置防火墙规则"
    log_info "  4. 设置定时备份任务"
}

# 错误处理
error_handler() {
    local exit_code=$?
    log_error "部署过程中发生错误，退出码: $exit_code"
    
    # 显示错误日志
    if [[ -f "$DEPLOY_PATH/logs/error.log" ]]; then
        log_info "最近的错误日志:"
        tail -20 "$DEPLOY_PATH/logs/error.log"
    fi
    
    log_error "部署失败，请检查错误信息并重试"
    exit $exit_code
}

# 显示帮助信息
show_help() {
    echo "博客系统传统部署脚本"
    echo ""
    echo "用法: $0 [选项]"
    echo ""
    echo "选项:"
    echo "  -h, --help              显示帮助信息"
    echo "  -u, --user USER         部署用户 (默认: deploy)"
    echo "  -p, --path PATH         部署路径 (默认: /var/www/blog-system)"
    echo "  -r, --repo URL          Git仓库URL"
    echo "  -b, --branch BRANCH     Git分支 (默认: main)"
    echo "  -e, --env ENV           环境 (默认: production)"
    echo "  --no-backup             部署前不备份数据"
    echo "  --no-migrations         不运行数据库迁移"
    echo "  --no-restart            不重启服务"
    echo "  --clean-install         清理安装（删除node_modules）"
    echo "  -v, --verbose           详细输出"
    echo ""
    echo "环境变量:"
    echo "  DEPLOY_USER             部署用户"
    echo "  DEPLOY_PATH             部署路径"
    echo "  REPO_URL                Git仓库URL"
    echo "  BRANCH                  Git分支"
    echo "  NODE_VERSION            Node.js版本"
    echo "  ENVIRONMENT             环境"
    echo "  BACKUP_BEFORE_DEPLOY    部署前备份"
    echo "  RUN_MIGRATIONS          运行迁移"
    echo "  RESTART_SERVICES        重启服务"
    echo ""
    echo "示例:"
    echo "  $0                                    # 使用默认配置部署"
    echo "  $0 -u www-data -p /opt/blog           # 指定用户和路径"
    echo "  $0 -r https://github.com/user/repo.git # 指定仓库"
    echo "  $0 --no-backup --clean-install        # 清理安装，不备份"
    echo ""
}

# 设置错误处理
trap error_handler ERR

# 解析命令行参数
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_help
            exit 0
            ;;
        -u|--user)
            DEPLOY_USER="$2"
            shift 2
            ;;
        -p|--path)
            DEPLOY_PATH="$2"
            shift 2
            ;;
        -r|--repo)
            REPO_URL="$2"
            shift 2
            ;;
        -b|--branch)
            BRANCH="$2"
            shift 2
            ;;
        -e|--env)
            ENVIRONMENT="$2"
            shift 2
            ;;
        --no-backup)
            BACKUP_BEFORE_DEPLOY="false"
            shift
            ;;
        --no-migrations)
            RUN_MIGRATIONS="false"
            shift
            ;;
        --no-restart)
            RESTART_SERVICES="false"
            shift
            ;;
        --clean-install)
            CLEAN_INSTALL="true"
            shift
            ;;
        -v|--verbose)
            set -x
            shift
            ;;
        *)
            log_error "未知选项: $1"
            show_help
            exit 1
            ;;
    esac
done

# 执行主部署函数
main_deploy