#!/bin/bash

# 博客系统Docker部署脚本
# 用于使用Docker和Docker Compose部署博客系统

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
DOCKER_COMPOSE_FILE="${DOCKER_COMPOSE_FILE:-docker-compose.yml}"
ENVIRONMENT="${ENVIRONMENT:-production}"
DOMAIN="${DOMAIN:-localhost}"
EMAIL="${EMAIL:-admin@example.com}"
BACKUP_BEFORE_DEPLOY="${BACKUP_BEFORE_DEPLOY:-true}"
GENERATE_SSL="${GENERATE_SSL:-true}"
PULL_IMAGES="${PULL_IMAGES:-true}"
BUILD_IMAGES="${BUILD_IMAGES:-true}"
PRUNE_SYSTEM="${PRUNE_SYSTEM:-false}"

# 检查Docker环境
check_docker_environment() {
    log_info "检查Docker环境..."
    
    # 检查Docker是否安装
    if ! command -v docker &> /dev/null; then
        log_error "Docker未安装，请先安装Docker"
        log_info "安装命令: curl -fsSL https://get.docker.com | sh"
        exit 1
    fi
    
    # 检查Docker Compose是否安装
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        log_error "Docker Compose未安装，请先安装Docker Compose"
        exit 1
    fi
    
    # 检查Docker服务是否运行
    if ! docker info &> /dev/null; then
        log_error "Docker服务未运行，请启动Docker服务"
        log_info "启动命令: sudo systemctl start docker"
        exit 1
    fi
    
    # 检查用户权限
    if ! docker ps &> /dev/null; then
        log_error "当前用户无Docker权限，请将用户添加到docker组"
        log_info "添加命令: sudo usermod -aG docker $USER"
        log_info "然后重新登录或运行: newgrp docker"
        exit 1
    fi
    
    # 显示Docker版本信息
    local docker_version=$(docker --version)
    local compose_version=$(docker-compose --version 2>/dev/null || docker compose version)
    log_success "Docker环境检查通过"
    log_info "Docker版本: $docker_version"
    log_info "Compose版本: $compose_version"
}

# 检查项目文件
check_project_files() {
    log_info "检查项目文件..."
    
    local required_files=(
        "$DOCKER_COMPOSE_FILE"
        "Dockerfile.frontend"
        "Dockerfile.backend"
        "docker/nginx.conf"
        "docker/default.conf"
    )
    
    for file in "${required_files[@]}"; do
        if [[ ! -f "$file" ]]; then
            log_error "缺少必要文件: $file"
            exit 1
        fi
    done
    
    # 检查环境配置文件
    if [[ ! -f ".env.production" ]]; then
        log_warning "未找到.env.production文件，将使用默认配置"
    fi
    
    log_success "项目文件检查通过"
}

# 创建必要目录
create_directories() {
    log_info "创建必要目录..."
    
    local directories=(
        "data"
        "uploads"
        "logs"
        "backups"
        "docker/ssl"
    )
    
    for dir in "${directories[@]}"; do
        mkdir -p "$dir"
        chmod 755 "$dir"
    done
    
    log_success "目录创建完成"
}

# 生成SSL证书
generate_ssl_certificates() {
    if [[ "$GENERATE_SSL" == "true" ]]; then
        log_info "生成SSL证书..."
        
        if [[ -f "scripts/generate-ssl.sh" ]]; then
            chmod +x scripts/generate-ssl.sh
            ./scripts/generate-ssl.sh "$DOMAIN" "$EMAIL" "$ENVIRONMENT"
        else
            log_warning "SSL生成脚本不存在，跳过SSL证书生成"
        fi
        
        log_success "SSL证书生成完成"
    fi
}

# 备份现有数据
backup_existing_data() {
    if [[ "$BACKUP_BEFORE_DEPLOY" == "true" ]]; then
        log_info "备份现有数据..."
        
        # 检查是否有运行中的容器
        if docker-compose ps | grep -q "Up"; then
            if [[ -f "scripts/backup.sh" ]]; then
                chmod +x scripts/backup.sh
                ./scripts/backup.sh
            else
                log_warning "备份脚本不存在，跳过数据备份"
            fi
        else
            log_info "没有运行中的容器，跳过备份"
        fi
        
        log_success "数据备份完成"
    fi
}

# 拉取Docker镜像
pull_docker_images() {
    if [[ "$PULL_IMAGES" == "true" ]]; then
        log_info "拉取Docker镜像..."
        
        # 拉取基础镜像
        docker pull node:20-alpine
        docker pull nginx:alpine
        docker pull alpine:latest
        
        # 拉取其他依赖镜像
        if grep -q "redis" "$DOCKER_COMPOSE_FILE"; then
            docker pull redis:alpine
        fi
        
        if grep -q "watchtower" "$DOCKER_COMPOSE_FILE"; then
            docker pull containrrr/watchtower
        fi
        
        log_success "Docker镜像拉取完成"
    fi
}

# 构建Docker镜像
build_docker_images() {
    if [[ "$BUILD_IMAGES" == "true" ]]; then
        log_info "构建Docker镜像..."
        
        # 构建前端镜像
        log_info "构建前端镜像..."
        docker build -f Dockerfile.frontend -t "$PROJECT_NAME-frontend:latest" .
        
        # 构建后端镜像
        log_info "构建后端镜像..."
        docker build -f Dockerfile.backend -t "$PROJECT_NAME-backend:latest" .
        
        log_success "Docker镜像构建完成"
    fi
}

# 停止现有服务
stop_existing_services() {
    log_info "停止现有服务..."
    
    # 停止Docker Compose服务
    if docker-compose ps | grep -q "Up"; then
        docker-compose down
        log_info "Docker Compose服务已停止"
    fi
    
    # 清理悬挂的容器和网络
    docker container prune -f
    docker network prune -f
    
    log_success "现有服务停止完成"
}

# 启动Docker服务
start_docker_services() {
    log_info "启动Docker服务..."
    
    # 使用Docker Compose启动服务
    if [[ "$ENVIRONMENT" == "development" ]]; then
        docker-compose -f docker-compose.dev.yml up -d
    else
        docker-compose up -d
    fi
    
    # 等待服务启动
    log_info "等待服务启动..."
    sleep 30
    
    log_success "Docker服务启动完成"
}

# 验证服务状态
verify_services() {
    log_info "验证服务状态..."
    
    local errors=0
    
    # 检查容器状态
    local containers=("blog-frontend" "blog-backend" "blog-nginx")
    for container in "${containers[@]}"; do
        if docker ps | grep -q "$container.*Up"; then
            log_success "容器 $container 运行正常"
        else
            log_error "容器 $container 未运行"
            ((errors++))
        fi
    done
    
    # 检查端口监听
    if docker ps | grep -q "0.0.0.0:80->80/tcp\|0.0.0.0:443->443/tcp"; then
        log_success "Web端口监听正常"
    else
        log_error "Web端口未监听"
        ((errors++))
    fi
    
    # 检查健康状态
    sleep 10  # 等待健康检查
    local unhealthy_containers=$(docker ps --filter "health=unhealthy" --format "table {{.Names}}" | tail -n +2)
    if [[ -z "$unhealthy_containers" ]]; then
        log_success "所有容器健康检查通过"
    else
        log_error "以下容器健康检查失败: $unhealthy_containers"
        ((errors++))
    fi
    
    # 测试HTTP连接
    if curl -f http://localhost/health &>/dev/null; then
        log_success "HTTP健康检查通过"
    else
        log_warning "HTTP健康检查失败"
    fi
    
    # 测试HTTPS连接（如果启用SSL）
    if [[ -f "docker/ssl/cert.crt" ]]; then
        if curl -k -f https://localhost/health &>/dev/null; then
            log_success "HTTPS健康检查通过"
        else
            log_warning "HTTPS健康检查失败"
        fi
    fi
    
    if [[ $errors -eq 0 ]]; then
        log_success "服务验证完成，所有服务运行正常"
        return 0
    else
        log_error "服务验证发现 $errors 个错误"
        return 1
    fi
}

# 显示服务信息
show_service_info() {
    log_info "服务信息:"
    
    # 显示容器状态
    echo ""
    log_info "容器状态:"
    docker-compose ps
    
    # 显示端口映射
    echo ""
    log_info "端口映射:"
    docker-compose port nginx 80 2>/dev/null || echo "HTTP端口: 80"
    docker-compose port nginx 443 2>/dev/null || echo "HTTPS端口: 443"
    
    # 显示访问地址
    echo ""
    log_info "访问地址:"
    local ip=$(hostname -I | awk '{print $1}' 2>/dev/null || echo "localhost")
    log_info "  - HTTP: http://$ip"
    log_info "  - HTTPS: https://$ip"
    log_info "  - 管理面板: http://$ip/admin"
    
    # 显示日志查看命令
    echo ""
    log_info "日志查看命令:"
    log_info "  - 所有服务: docker-compose logs -f"
    log_info "  - 前端服务: docker-compose logs -f frontend"
    log_info "  - 后端服务: docker-compose logs -f backend"
    log_info "  - Nginx服务: docker-compose logs -f nginx"
    
    # 显示管理命令
    echo ""
    log_info "管理命令:"
    log_info "  - 停止服务: docker-compose down"
    log_info "  - 重启服务: docker-compose restart"
    log_info "  - 更新服务: docker-compose pull && docker-compose up -d"
    log_info "  - 备份数据: ./scripts/backup.sh"
    log_info "  - 恢复数据: ./scripts/restore.sh <backup-file>"
}

# 系统清理
cleanup_system() {
    if [[ "$PRUNE_SYSTEM" == "true" ]]; then
        log_info "清理Docker系统..."
        
        # 清理未使用的镜像
        docker image prune -f
        
        # 清理未使用的卷
        docker volume prune -f
        
        # 清理未使用的网络
        docker network prune -f
        
        log_success "系统清理完成"
    fi
}

# 主部署函数
main_deploy() {
    log_info "开始Docker部署博客系统..."
    
    local start_time=$(date +%s)
    
    # 执行部署步骤
    check_docker_environment
    check_project_files
    create_directories
    generate_ssl_certificates
    backup_existing_data
    pull_docker_images
    build_docker_images
    stop_existing_services
    start_docker_services
    verify_services
    cleanup_system
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    log_success "Docker部署完成！"
    log_info "耗时: ${duration}秒"
    
    # 显示服务信息
    show_service_info
    
    echo ""
    log_info "后续步骤:"
    log_info "  1. 配置域名DNS解析指向服务器IP"
    log_info "  2. 如果使用生产环境，请配置真实的SSL证书"
    log_info "  3. 配置防火墙规则开放80和443端口"
    log_info "  4. 设置定时备份任务"
    log_info "  5. 配置监控和日志收集"
}

# 错误处理
error_handler() {
    local exit_code=$?
    log_error "Docker部署过程中发生错误，退出码: $exit_code"
    
    # 显示容器日志
    if docker-compose ps | grep -q "blog"; then
        log_info "容器日志:"
        docker-compose logs --tail=50
    fi
    
    # 显示系统资源
    log_info "系统资源:"
    docker system df
    
    log_error "Docker部署失败，请检查错误信息并重试"
    exit $exit_code
}

# 显示帮助信息
show_help() {
    echo "博客系统Docker部署脚本"
    echo ""
    echo "用法: $0 [选项]"
    echo ""
    echo "选项:"
    echo "  -h, --help              显示帮助信息"
    echo "  -f, --file FILE         Docker Compose文件 (默认: docker-compose.yml)"
    echo "  -e, --env ENV           环境 (默认: production)"
    echo "  -d, --domain DOMAIN     域名 (默认: localhost)"
    echo "  --email EMAIL           邮箱地址 (用于SSL证书)"
    echo "  --no-backup             部署前不备份数据"
    echo "  --no-ssl                不生成SSL证书"
    echo "  --no-pull               不拉取Docker镜像"
    echo "  --no-build              不构建Docker镜像"
    echo "  --prune                 清理Docker系统"
    echo "  -v, --verbose           详细输出"
    echo ""
    echo "环境变量:"
    echo "  DOCKER_COMPOSE_FILE     Docker Compose文件"
    echo "  ENVIRONMENT             环境"
    echo "  DOMAIN                  域名"
    echo "  EMAIL                   邮箱地址"
    echo "  BACKUP_BEFORE_DEPLOY    部署前备份"
    echo "  GENERATE_SSL            生成SSL证书"
    echo "  PULL_IMAGES             拉取镜像"
    echo "  BUILD_IMAGES            构建镜像"
    echo "  PRUNE_SYSTEM            清理系统"
    echo ""
    echo "示例:"
    echo "  $0                                    # 使用默认配置部署"
    echo "  $0 -e development                     # 部署开发环境"
    echo "  $0 -d blog.example.com --email admin@example.com  # 指定域名和邮箱"
    echo "  $0 --no-backup --prune                # 不备份，清理系统"
    echo "  $0 -f docker-compose.dev.yml          # 使用开发环境配置"
    echo ""
    echo "管理命令:"
    echo "  docker-compose logs -f                # 查看日志"
    echo "  docker-compose restart                # 重启服务"
    echo "  docker-compose down                   # 停止服务"
    echo "  docker-compose exec backend sh       # 进入后端容器"
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
        -f|--file)
            DOCKER_COMPOSE_FILE="$2"
            shift 2
            ;;
        -e|--env)
            ENVIRONMENT="$2"
            shift 2
            ;;
        -d|--domain)
            DOMAIN="$2"
            shift 2
            ;;
        --email)
            EMAIL="$2"
            shift 2
            ;;
        --no-backup)
            BACKUP_BEFORE_DEPLOY="false"
            shift
            ;;
        --no-ssl)
            GENERATE_SSL="false"
            shift
            ;;
        --no-pull)
            PULL_IMAGES="false"
            shift
            ;;
        --no-build)
            BUILD_IMAGES="false"
            shift
            ;;
        --prune)
            PRUNE_SYSTEM="true"
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