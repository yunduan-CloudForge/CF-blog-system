#!/bin/bash

# 自动化部署脚本
# 支持多环境部署、回滚、健康检查等功能

set -e  # 遇到错误立即退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 默认配置
ENVIRONMENT="development"
SERVICE_NAME="blog-system"
DOCKER_REGISTRY=""
IMAGE_TAG="latest"
COMPOSE_FILE="docker-compose.yml"
HEALTH_CHECK_TIMEOUT=300
ROLLBACK_ENABLED=true
BACKUP_ENABLED=true
SMOKE_TEST_ENABLED=true

# 显示帮助信息
show_help() {
    cat << EOF
自动化部署脚本

用法: $0 [选项]

选项:
    -e, --env ENVIRONMENT       部署环境 (development|test|production)
    -t, --tag TAG              Docker镜像标签
    -r, --registry REGISTRY    Docker镜像仓库
    -f, --file FILE            Docker Compose文件
    --no-backup                禁用部署前备份
    --no-rollback              禁用自动回滚
    --no-smoke-test            禁用冒烟测试
    --timeout SECONDS          健康检查超时时间 (默认: 300)
    --rollback VERSION         回滚到指定版本
    --status                   查看部署状态
    --logs                     查看服务日志
    --cleanup                  清理旧镜像和容器
    -h, --help                 显示此帮助信息

示例:
    $0 --env production --tag v1.2.3
    $0 --rollback v1.2.2
    $0 --status
    $0 --cleanup
EOF
}

# 解析命令行参数
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            -e|--env)
                ENVIRONMENT="$2"
                shift 2
                ;;
            -t|--tag)
                IMAGE_TAG="$2"
                shift 2
                ;;
            -r|--registry)
                DOCKER_REGISTRY="$2"
                shift 2
                ;;
            -f|--file)
                COMPOSE_FILE="$2"
                shift 2
                ;;
            --no-backup)
                BACKUP_ENABLED=false
                shift
                ;;
            --no-rollback)
                ROLLBACK_ENABLED=false
                shift
                ;;
            --no-smoke-test)
                SMOKE_TEST_ENABLED=false
                shift
                ;;
            --timeout)
                HEALTH_CHECK_TIMEOUT="$2"
                shift 2
                ;;
            --rollback)
                ROLLBACK_VERSION="$2"
                ACTION="rollback"
                shift 2
                ;;
            --status)
                ACTION="status"
                shift
                ;;
            --logs)
                ACTION="logs"
                shift
                ;;
            --cleanup)
                ACTION="cleanup"
                shift
                ;;
            -h|--help)
                show_help
                exit 0
                ;;
            *)
                log_error "未知参数: $1"
                show_help
                exit 1
                ;;
        esac
    done
}

# 验证环境
validate_environment() {
    log_info "验证部署环境..."
    
    # 检查必需的命令
    local required_commands=("docker" "docker-compose" "curl" "jq")
    for cmd in "${required_commands[@]}"; do
        if ! command -v "$cmd" &> /dev/null; then
            log_error "缺少必需命令: $cmd"
            exit 1
        fi
    done
    
    # 检查Docker是否运行
    if ! docker info &> /dev/null; then
        log_error "Docker未运行或无权限访问"
        exit 1
    fi
    
    # 验证环境参数
    case $ENVIRONMENT in
        development|test|production)
            log_success "环境验证通过: $ENVIRONMENT"
            ;;
        *)
            log_error "无效的环境: $ENVIRONMENT"
            exit 1
            ;;
    esac
    
    # 设置环境特定的compose文件
    if [[ "$COMPOSE_FILE" == "docker-compose.yml" ]]; then
        case $ENVIRONMENT in
            development)
                COMPOSE_FILE="docker-compose.dev.yml"
                ;;
            production)
                COMPOSE_FILE="docker-compose.prod.yml"
                ;;
        esac
    fi
    
    # 检查compose文件是否存在
    if [[ ! -f "$COMPOSE_FILE" ]]; then
        log_error "Compose文件不存在: $COMPOSE_FILE"
        exit 1
    fi
}

# 加载环境变量
load_environment() {
    log_info "加载环境变量..."
    
    # 加载通用环境变量
    if [[ -f ".env" ]]; then
        export $(cat .env | grep -v '^#' | xargs)
        log_info "已加载 .env 文件"
    fi
    
    # 加载环境特定的变量
    local env_file=".env.${ENVIRONMENT}"
    if [[ -f "$env_file" ]]; then
        export $(cat "$env_file" | grep -v '^#' | xargs)
        log_info "已加载 $env_file 文件"
    fi
    
    # 设置镜像名称
    if [[ -n "$DOCKER_REGISTRY" ]]; then
        export IMAGE_NAME="${DOCKER_REGISTRY}/${SERVICE_NAME}:${IMAGE_TAG}"
    else
        export IMAGE_NAME="${SERVICE_NAME}:${IMAGE_TAG}"
    fi
    
    export ENVIRONMENT
    export IMAGE_TAG
}

# 备份当前部署
backup_current_deployment() {
    if [[ "$BACKUP_ENABLED" != "true" ]]; then
        log_info "跳过备份（已禁用）"
        return 0
    fi
    
    log_info "备份当前部署..."
    
    local backup_dir="backups/$(date +%Y%m%d_%H%M%S)"
    mkdir -p "$backup_dir"
    
    # 备份数据库
    if docker-compose -f "$COMPOSE_FILE" ps | grep -q postgres; then
        log_info "备份数据库..."
        docker-compose -f "$COMPOSE_FILE" exec -T postgres pg_dump -U "$DB_USERNAME" "$DB_NAME" > "$backup_dir/database.sql"
        log_success "数据库备份完成"
    fi
    
    # 备份上传文件
    if [[ -d "uploads" ]]; then
        log_info "备份上传文件..."
        tar -czf "$backup_dir/uploads.tar.gz" uploads/
        log_success "上传文件备份完成"
    fi
    
    # 保存当前镜像信息
    docker-compose -f "$COMPOSE_FILE" images > "$backup_dir/images.txt"
    
    # 保存备份信息
    echo "BACKUP_DATE=$(date)" > "$backup_dir/backup.info"
    echo "ENVIRONMENT=$ENVIRONMENT" >> "$backup_dir/backup.info"
    echo "IMAGE_TAG=$IMAGE_TAG" >> "$backup_dir/backup.info"
    
    log_success "备份完成: $backup_dir"
    echo "$backup_dir" > .last_backup
}

# 拉取最新镜像
pull_images() {
    log_info "拉取Docker镜像..."
    
    if [[ -n "$DOCKER_REGISTRY" ]]; then
        log_info "从仓库拉取镜像: $IMAGE_NAME"
        docker pull "$IMAGE_NAME"
    else
        log_info "构建本地镜像..."
        docker-compose -f "$COMPOSE_FILE" build
    fi
    
    log_success "镜像准备完成"
}

# 部署服务
deploy_services() {
    log_info "部署服务..."
    
    # 停止旧服务（保持数据库运行）
    log_info "停止应用服务..."
    docker-compose -f "$COMPOSE_FILE" stop app
    
    # 启动新服务
    log_info "启动新服务..."
    docker-compose -f "$COMPOSE_FILE" up -d
    
    log_success "服务部署完成"
}

# 健康检查
health_check() {
    log_info "执行健康检查..."
    
    local app_url="http://localhost:${APP_PORT:-3000}"
    local health_endpoint="${app_url}/health"
    local start_time=$(date +%s)
    local timeout=$HEALTH_CHECK_TIMEOUT
    
    log_info "等待服务启动... (超时: ${timeout}秒)"
    
    while true; do
        local current_time=$(date +%s)
        local elapsed=$((current_time - start_time))
        
        if [[ $elapsed -gt $timeout ]]; then
            log_error "健康检查超时"
            return 1
        fi
        
        # 检查容器状态
        if ! docker-compose -f "$COMPOSE_FILE" ps app | grep -q "Up"; then
            log_error "应用容器未运行"
            return 1
        fi
        
        # 检查健康端点
        if curl -f -s "$health_endpoint" > /dev/null 2>&1; then
            log_success "健康检查通过"
            return 0
        fi
        
        echo -n "."
        sleep 5
    done
}

# 冒烟测试
smoke_test() {
    if [[ "$SMOKE_TEST_ENABLED" != "true" ]]; then
        log_info "跳过冒烟测试（已禁用）"
        return 0
    fi
    
    log_info "执行冒烟测试..."
    
    local app_url="http://localhost:${APP_PORT:-3000}"
    local tests_passed=0
    local tests_total=0
    
    # 测试主页
    ((tests_total++))
    if curl -f -s "$app_url" > /dev/null; then
        log_success "✓ 主页访问正常"
        ((tests_passed++))
    else
        log_error "✗ 主页访问失败"
    fi
    
    # 测试API端点
    ((tests_total++))
    if curl -f -s "${app_url}/api/health" > /dev/null; then
        log_success "✓ API健康检查正常"
        ((tests_passed++))
    else
        log_error "✗ API健康检查失败"
    fi
    
    # 测试数据库连接
    ((tests_total++))
    if curl -f -s "${app_url}/api/health/db" > /dev/null; then
        log_success "✓ 数据库连接正常"
        ((tests_passed++))
    else
        log_error "✗ 数据库连接失败"
    fi
    
    # 测试Redis连接
    ((tests_total++))
    if curl -f -s "${app_url}/api/health/redis" > /dev/null; then
        log_success "✓ Redis连接正常"
        ((tests_passed++))
    else
        log_error "✗ Redis连接失败"
    fi
    
    log_info "冒烟测试结果: $tests_passed/$tests_total 通过"
    
    if [[ $tests_passed -eq $tests_total ]]; then
        log_success "所有冒烟测试通过"
        return 0
    else
        log_error "部分冒烟测试失败"
        return 1
    fi
}

# 回滚部署
rollback_deployment() {
    local version="$1"
    
    log_warning "开始回滚到版本: $version"
    
    # 检查备份是否存在
    if [[ ! -f ".last_backup" ]]; then
        log_error "未找到备份信息，无法回滚"
        return 1
    fi
    
    local backup_dir=$(cat .last_backup)
    if [[ ! -d "$backup_dir" ]]; then
        log_error "备份目录不存在: $backup_dir"
        return 1
    fi
    
    # 停止当前服务
    log_info "停止当前服务..."
    docker-compose -f "$COMPOSE_FILE" down
    
    # 恢复数据库
    if [[ -f "$backup_dir/database.sql" ]]; then
        log_info "恢复数据库..."
        docker-compose -f "$COMPOSE_FILE" up -d postgres
        sleep 10
        docker-compose -f "$COMPOSE_FILE" exec -T postgres psql -U "$DB_USERNAME" -d "$DB_NAME" < "$backup_dir/database.sql"
    fi
    
    # 恢复上传文件
    if [[ -f "$backup_dir/uploads.tar.gz" ]]; then
        log_info "恢复上传文件..."
        rm -rf uploads/
        tar -xzf "$backup_dir/uploads.tar.gz"
    fi
    
    # 使用旧版本镜像
    export IMAGE_TAG="$version"
    if [[ -n "$DOCKER_REGISTRY" ]]; then
        export IMAGE_NAME="${DOCKER_REGISTRY}/${SERVICE_NAME}:${version}"
    else
        export IMAGE_NAME="${SERVICE_NAME}:${version}"
    fi
    
    # 启动服务
    log_info "启动回滚版本..."
    docker-compose -f "$COMPOSE_FILE" up -d
    
    # 健康检查
    if health_check; then
        log_success "回滚成功"
        return 0
    else
        log_error "回滚后健康检查失败"
        return 1
    fi
}

# 查看部署状态
show_status() {
    log_info "部署状态:"
    echo
    
    # 显示服务状态
    log_info "服务状态:"
    docker-compose -f "$COMPOSE_FILE" ps
    echo
    
    # 显示镜像信息
    log_info "镜像信息:"
    docker-compose -f "$COMPOSE_FILE" images
    echo
    
    # 显示资源使用情况
    log_info "资源使用情况:"
    docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}\t{{.BlockIO}}"
    echo
    
    # 显示健康状态
    local app_url="http://localhost:${APP_PORT:-3000}"
    log_info "健康状态:"
    if curl -f -s "${app_url}/health" | jq . 2>/dev/null; then
        log_success "应用健康状态正常"
    else
        log_warning "无法获取健康状态"
    fi
}

# 查看日志
show_logs() {
    log_info "服务日志:"
    docker-compose -f "$COMPOSE_FILE" logs --tail=100 -f
}

# 清理旧镜像和容器
cleanup() {
    log_info "清理旧镜像和容器..."
    
    # 清理停止的容器
    log_info "清理停止的容器..."
    docker container prune -f
    
    # 清理未使用的镜像
    log_info "清理未使用的镜像..."
    docker image prune -f
    
    # 清理未使用的网络
    log_info "清理未使用的网络..."
    docker network prune -f
    
    # 清理未使用的卷（谨慎操作）
    read -p "是否清理未使用的卷？这可能会删除数据 (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        log_warning "清理未使用的卷..."
        docker volume prune -f
    fi
    
    log_success "清理完成"
}

# 主部署流程
main_deploy() {
    log_info "开始部署 $SERVICE_NAME 到 $ENVIRONMENT 环境"
    log_info "镜像标签: $IMAGE_TAG"
    log_info "Compose文件: $COMPOSE_FILE"
    echo
    
    # 验证环境
    validate_environment
    
    # 加载环境变量
    load_environment
    
    # 备份当前部署
    backup_current_deployment
    
    # 拉取镜像
    pull_images
    
    # 部署服务
    deploy_services
    
    # 健康检查
    if ! health_check; then
        if [[ "$ROLLBACK_ENABLED" == "true" ]]; then
            log_warning "健康检查失败，开始自动回滚..."
            rollback_deployment "$IMAGE_TAG"
        else
            log_error "健康检查失败，自动回滚已禁用"
            exit 1
        fi
    fi
    
    # 冒烟测试
    if ! smoke_test; then
        if [[ "$ROLLBACK_ENABLED" == "true" ]]; then
            log_warning "冒烟测试失败，开始自动回滚..."
            rollback_deployment "$IMAGE_TAG"
        else
            log_error "冒烟测试失败，自动回滚已禁用"
            exit 1
        fi
    fi
    
    log_success "部署成功完成！"
    log_info "应用访问地址: http://localhost:${APP_PORT:-3000}"
}

# 主函数
main() {
    # 解析命令行参数
    parse_args "$@"
    
    # 根据操作执行相应功能
    case "${ACTION:-deploy}" in
        deploy)
            main_deploy
            ;;
        rollback)
            validate_environment
            load_environment
            rollback_deployment "$ROLLBACK_VERSION"
            ;;
        status)
            validate_environment
            load_environment
            show_status
            ;;
        logs)
            validate_environment
            load_environment
            show_logs
            ;;
        cleanup)
            cleanup
            ;;
        *)
            log_error "未知操作: $ACTION"
            show_help
            exit 1
            ;;
    esac
}

# 执行主函数
main "$@"