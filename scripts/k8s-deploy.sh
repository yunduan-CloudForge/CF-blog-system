#!/bin/bash

# Kubernetes 部署脚本
# 支持蓝绿部署、滚动更新和金丝雀部署

set -e

# 配置
APP_NAME="blog-system"
NAMESPACE="default"
IMAGE_REGISTRY="${DOCKER_REGISTRY:-localhost:5000}"
IMAGE_NAME="${DOCKER_IMAGE:-blog-system}"
IMAGE_TAG="${DOCKER_TAG:-latest}"
DEPLOY_STRATEGY="${DEPLOY_STRATEGY:-rolling}"  # rolling, blue-green, canary
HEALTH_CHECK_TIMEOUT="${HEALTH_CHECK_TIMEOUT:-300}"
HEALTH_CHECK_INTERVAL="${HEALTH_CHECK_INTERVAL:-10}"
CANARY_PERCENTAGE="${CANARY_PERCENTAGE:-10}"
ROLLBACK_ON_FAILURE="${ROLLBACK_ON_FAILURE:-true}"
DRY_RUN="${DRY_RUN:-false}"
VERBOSE="${VERBOSE:-false}"

# 颜色输出
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

log_debug() {
    if [[ "$VERBOSE" == "true" ]]; then
        echo -e "${BLUE}[DEBUG]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
    fi
}

# 检查依赖
check_dependencies() {
    log_info "检查依赖..."
    
    local deps=("kubectl" "docker")
    for dep in "${deps[@]}"; do
        if ! command -v "$dep" &> /dev/null; then
            log_error "$dep 未安装"
            exit 1
        fi
    done
    
    # 检查kubectl连接
    if ! kubectl cluster-info &> /dev/null; then
        log_error "无法连接到Kubernetes集群"
        exit 1
    fi
    
    log_success "依赖检查通过"
}

# 构建Docker镜像
build_image() {
    local tag="$1"
    log_info "构建Docker镜像: $tag"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "[DRY RUN] 将构建镜像: $tag"
        return 0
    fi
    
    docker build -t "$tag" .
    
    # 推送到注册表
    if [[ "$IMAGE_REGISTRY" != "localhost:5000" ]]; then
        log_info "推送镜像到注册表: $tag"
        docker push "$tag"
    fi
    
    log_success "镜像构建完成: $tag"
}

# 健康检查
health_check() {
    local service_name="$1"
    local timeout="$2"
    local interval="$3"
    
    log_info "执行健康检查: $service_name"
    
    local start_time=$(date +%s)
    local end_time=$((start_time + timeout))
    
    while [[ $(date +%s) -lt $end_time ]]; do
        # 检查Pod状态
        local ready_pods=$(kubectl get pods -l app="$APP_NAME" -n "$NAMESPACE" -o jsonpath='{.items[*].status.conditions[?(@.type=="Ready")].status}' | grep -o "True" | wc -l)
        local total_pods=$(kubectl get pods -l app="$APP_NAME" -n "$NAMESPACE" --no-headers | wc -l)
        
        if [[ "$ready_pods" -gt 0 ]] && [[ "$ready_pods" -eq "$total_pods" ]]; then
            # 检查服务端点
            local endpoints=$(kubectl get endpoints "$service_name" -n "$NAMESPACE" -o jsonpath='{.subsets[*].addresses[*].ip}' | wc -w)
            
            if [[ "$endpoints" -gt 0 ]]; then
                log_success "健康检查通过: $service_name"
                return 0
            fi
        fi
        
        log_debug "等待Pod就绪... ($ready_pods/$total_pods)"
        sleep "$interval"
    done
    
    log_error "健康检查超时: $service_name"
    return 1
}

# 等待部署完成
wait_for_deployment() {
    local deployment_name="$1"
    local timeout="${2:-300}"
    
    log_info "等待部署完成: $deployment_name"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "[DRY RUN] 将等待部署: $deployment_name"
        return 0
    fi
    
    if kubectl rollout status deployment/"$deployment_name" -n "$NAMESPACE" --timeout="${timeout}s"; then
        log_success "部署完成: $deployment_name"
        return 0
    else
        log_error "部署超时: $deployment_name"
        return 1
    fi
}

# 滚动更新部署
rolling_update_deploy() {
    log_info "开始滚动更新部署"
    
    local image_tag="$IMAGE_REGISTRY/$IMAGE_NAME:$IMAGE_TAG"
    
    # 构建镜像
    build_image "$image_tag"
    
    # 更新部署
    log_info "更新部署镜像: $image_tag"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "[DRY RUN] 将更新部署镜像: $image_tag"
    else
        kubectl set image deployment/"$APP_NAME" "$APP_NAME"="$image_tag" -n "$NAMESPACE"
        
        # 等待部署完成
        if ! wait_for_deployment "$APP_NAME" "$HEALTH_CHECK_TIMEOUT"; then
            if [[ "$ROLLBACK_ON_FAILURE" == "true" ]]; then
                log_warning "部署失败，执行回滚"
                kubectl rollout undo deployment/"$APP_NAME" -n "$NAMESPACE"
                wait_for_deployment "$APP_NAME" "$HEALTH_CHECK_TIMEOUT"
            fi
            return 1
        fi
        
        # 健康检查
        if ! health_check "$APP_NAME-service" "$HEALTH_CHECK_TIMEOUT" "$HEALTH_CHECK_INTERVAL"; then
            if [[ "$ROLLBACK_ON_FAILURE" == "true" ]]; then
                log_warning "健康检查失败，执行回滚"
                kubectl rollout undo deployment/"$APP_NAME" -n "$NAMESPACE"
                wait_for_deployment "$APP_NAME" "$HEALTH_CHECK_TIMEOUT"
            fi
            return 1
        fi
    fi
    
    log_success "滚动更新部署完成"
}

# 蓝绿部署
blue_green_deploy() {
    log_info "开始蓝绿部署"
    
    # 获取当前活跃颜色
    local current_color
    current_color=$(kubectl get service "$APP_NAME-active-service" -n "$NAMESPACE" -o jsonpath='{.metadata.annotations.deployment\.kubernetes\.io/active-color}' 2>/dev/null || echo "blue")
    
    local target_color
    if [[ "$current_color" == "blue" ]]; then
        target_color="green"
    else
        target_color="blue"
    fi
    
    log_info "当前颜色: $current_color, 目标颜色: $target_color"
    
    local image_tag="$IMAGE_REGISTRY/$IMAGE_NAME:$target_color-$IMAGE_TAG"
    
    # 构建镜像
    build_image "$image_tag"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "[DRY RUN] 蓝绿部署流程"
        log_info "[DRY RUN] 1. 更新$target_color环境镜像"
        log_info "[DRY RUN] 2. 扩展$target_color环境"
        log_info "[DRY RUN] 3. 健康检查"
        log_info "[DRY RUN] 4. 切换流量"
        log_info "[DRY RUN] 5. 缩减$current_color环境"
        return 0
    fi
    
    # 1. 更新目标环境镜像
    log_info "更新$target_color环境镜像"
    kubectl set image deployment/"$APP_NAME-$target_color" "$APP_NAME"="$image_tag" -n "$NAMESPACE"
    
    # 2. 扩展目标环境
    log_info "扩展$target_color环境"
    kubectl scale deployment/"$APP_NAME-$target_color" --replicas=3 -n "$NAMESPACE"
    
    # 3. 等待目标环境就绪
    if ! wait_for_deployment "$APP_NAME-$target_color" "$HEALTH_CHECK_TIMEOUT"; then
        log_error "$target_color环境部署失败"
        kubectl scale deployment/"$APP_NAME-$target_color" --replicas=0 -n "$NAMESPACE"
        return 1
    fi
    
    # 4. 健康检查
    if ! health_check "$APP_NAME-$target_color-service" "$HEALTH_CHECK_TIMEOUT" "$HEALTH_CHECK_INTERVAL"; then
        log_error "$target_color环境健康检查失败"
        kubectl scale deployment/"$APP_NAME-$target_color" --replicas=0 -n "$NAMESPACE"
        return 1
    fi
    
    # 5. 切换流量
    log_info "切换流量到$target_color环境"
    kubectl patch service "$APP_NAME-active-service" -n "$NAMESPACE" -p '{"spec":{"selector":{"version":"'$target_color'"}}}'
    kubectl annotate service "$APP_NAME-active-service" -n "$NAMESPACE" "deployment.kubernetes.io/active-color=$target_color" --overwrite
    
    # 更新预览服务指向旧环境
    kubectl patch service "$APP_NAME-preview-service" -n "$NAMESPACE" -p '{"spec":{"selector":{"version":"'$current_color'"}}}'
    
    # 6. 等待流量切换生效
    sleep 10
    
    # 7. 最终健康检查
    if ! health_check "$APP_NAME-active-service" "60" "5"; then
        log_error "流量切换后健康检查失败，回滚"
        # 回滚流量
        kubectl patch service "$APP_NAME-active-service" -n "$NAMESPACE" -p '{"spec":{"selector":{"version":"'$current_color'"}}}'
        kubectl annotate service "$APP_NAME-active-service" -n "$NAMESPACE" "deployment.kubernetes.io/active-color=$current_color" --overwrite
        kubectl scale deployment/"$APP_NAME-$target_color" --replicas=0 -n "$NAMESPACE"
        return 1
    fi
    
    # 8. 缩减旧环境
    log_info "缩减$current_color环境"
    kubectl scale deployment/"$APP_NAME-$current_color" --replicas=0 -n "$NAMESPACE"
    
    log_success "蓝绿部署完成"
}

# 金丝雀部署
canary_deploy() {
    log_info "开始金丝雀部署 (${CANARY_PERCENTAGE}%)"
    
    local image_tag="$IMAGE_REGISTRY/$IMAGE_NAME:canary-$IMAGE_TAG"
    
    # 构建镜像
    build_image "$image_tag"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "[DRY RUN] 金丝雀部署流程"
        return 0
    fi
    
    # 创建金丝雀部署
    log_info "创建金丝雀部署"
    
    # 计算金丝雀副本数
    local total_replicas
    total_replicas=$(kubectl get deployment "$APP_NAME" -n "$NAMESPACE" -o jsonpath='{.spec.replicas}')
    local canary_replicas
    canary_replicas=$(( (total_replicas * CANARY_PERCENTAGE + 50) / 100 ))
    canary_replicas=$((canary_replicas > 0 ? canary_replicas : 1))
    
    log_info "金丝雀副本数: $canary_replicas / $total_replicas"
    
    # 部署金丝雀版本
    kubectl create deployment "$APP_NAME-canary" --image="$image_tag" -n "$NAMESPACE" --dry-run=client -o yaml | \
    kubectl apply -f -
    
    kubectl scale deployment/"$APP_NAME-canary" --replicas="$canary_replicas" -n "$NAMESPACE"
    
    # 等待金丝雀部署就绪
    if ! wait_for_deployment "$APP_NAME-canary" "$HEALTH_CHECK_TIMEOUT"; then
        log_error "金丝雀部署失败"
        kubectl delete deployment "$APP_NAME-canary" -n "$NAMESPACE" --ignore-not-found
        return 1
    fi
    
    # 更新服务选择器以包含金丝雀
    kubectl patch service "$APP_NAME-service" -n "$NAMESPACE" -p '{"spec":{"selector":{"app":"'$APP_NAME'"}}}'
    
    log_info "金丝雀部署完成，监控中..."
    log_info "使用以下命令监控金丝雀:"
    log_info "  kubectl logs -f deployment/$APP_NAME-canary -n $NAMESPACE"
    log_info "  kubectl top pods -l app=$APP_NAME -n $NAMESPACE"
    log_info "\n使用以下命令提升或回滚:"
    log_info "  $0 promote-canary  # 提升金丝雀"
    log_info "  $0 rollback-canary # 回滚金丝雀"
}

# 提升金丝雀
promote_canary() {
    log_info "提升金丝雀为生产版本"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "[DRY RUN] 提升金丝雀"
        return 0
    fi
    
    # 获取金丝雀镜像
    local canary_image
    canary_image=$(kubectl get deployment "$APP_NAME-canary" -n "$NAMESPACE" -o jsonpath='{.spec.template.spec.containers[0].image}')
    
    # 更新主部署
    kubectl set image deployment/"$APP_NAME" "$APP_NAME"="$canary_image" -n "$NAMESPACE"
    
    # 等待主部署更新完成
    if ! wait_for_deployment "$APP_NAME" "$HEALTH_CHECK_TIMEOUT"; then
        log_error "主部署更新失败"
        return 1
    fi
    
    # 删除金丝雀部署
    kubectl delete deployment "$APP_NAME-canary" -n "$NAMESPACE"
    
    log_success "金丝雀提升完成"
}

# 回滚金丝雀
rollback_canary() {
    log_info "回滚金丝雀部署"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "[DRY RUN] 回滚金丝雀"
        return 0
    fi
    
    # 删除金丝雀部署
    kubectl delete deployment "$APP_NAME-canary" -n "$NAMESPACE" --ignore-not-found
    
    # 恢复服务选择器
    kubectl patch service "$APP_NAME-service" -n "$NAMESPACE" -p '{"spec":{"selector":{"app":"'$APP_NAME'","version":"stable"}}}'
    
    log_success "金丝雀回滚完成"
}

# 查看部署状态
status() {
    log_info "查看部署状态"
    
    echo "\n=== Deployments ==="
    kubectl get deployments -l app="$APP_NAME" -n "$NAMESPACE" -o wide
    
    echo "\n=== Pods ==="
    kubectl get pods -l app="$APP_NAME" -n "$NAMESPACE" -o wide
    
    echo "\n=== Services ==="
    kubectl get services -l app="$APP_NAME" -n "$NAMESPACE" -o wide
    
    echo "\n=== Ingress ==="
    kubectl get ingress -l app="$APP_NAME" -n "$NAMESPACE" -o wide
    
    echo "\n=== HPA ==="
    kubectl get hpa -l app="$APP_NAME" -n "$NAMESPACE" -o wide
    
    # 检查当前活跃颜色（如果是蓝绿部署）
    local active_color
    active_color=$(kubectl get service "$APP_NAME-active-service" -n "$NAMESPACE" -o jsonpath='{.metadata.annotations.deployment\.kubernetes\.io/active-color}' 2>/dev/null || echo "N/A")
    
    if [[ "$active_color" != "N/A" ]]; then
        echo "\n=== Blue-Green Status ==="
        echo "Active Color: $active_color"
    fi
}

# 查看日志
logs() {
    local deployment="${1:-$APP_NAME}"
    local follow="${2:-false}"
    
    log_info "查看 $deployment 日志"
    
    if [[ "$follow" == "true" ]]; then
        kubectl logs -f deployment/"$deployment" -n "$NAMESPACE"
    else
        kubectl logs deployment/"$deployment" -n "$NAMESPACE" --tail=100
    fi
}

# 回滚部署
rollback() {
    local revision="${1:-}"
    
    log_info "回滚部署"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "[DRY RUN] 回滚部署"
        return 0
    fi
    
    if [[ -n "$revision" ]]; then
        kubectl rollout undo deployment/"$APP_NAME" -n "$NAMESPACE" --to-revision="$revision"
    else
        kubectl rollout undo deployment/"$APP_NAME" -n "$NAMESPACE"
    fi
    
    wait_for_deployment "$APP_NAME" "$HEALTH_CHECK_TIMEOUT"
    
    log_success "回滚完成"
}

# 清理资源
cleanup() {
    log_info "清理部署资源"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "[DRY RUN] 清理资源"
        return 0
    fi
    
    # 删除部署
    kubectl delete deployment -l app="$APP_NAME" -n "$NAMESPACE" --ignore-not-found
    
    # 删除服务
    kubectl delete service -l app="$APP_NAME" -n "$NAMESPACE" --ignore-not-found
    
    # 删除Ingress
    kubectl delete ingress -l app="$APP_NAME" -n "$NAMESPACE" --ignore-not-found
    
    # 删除HPA
    kubectl delete hpa -l app="$APP_NAME" -n "$NAMESPACE" --ignore-not-found
    
    # 删除PDB
    kubectl delete pdb -l app="$APP_NAME" -n "$NAMESPACE" --ignore-not-found
    
    log_success "清理完成"
}

# 显示帮助
show_help() {
    cat << EOF
Kubernetes 部署脚本

用法:
  $0 <command> [options]

命令:
  deploy              执行部署（根据DEPLOY_STRATEGY）
  rolling-update      执行滚动更新
  blue-green          执行蓝绿部署
  canary              执行金丝雀部署
  promote-canary      提升金丝雀为生产版本
  rollback-canary     回滚金丝雀部署
  status              查看部署状态
  logs [deployment]   查看日志
  rollback [revision] 回滚部署
  cleanup             清理资源
  help                显示帮助

环境变量:
  DEPLOY_STRATEGY     部署策略 (rolling|blue-green|canary)
  DOCKER_REGISTRY     Docker注册表地址
  DOCKER_IMAGE        Docker镜像名称
  DOCKER_TAG          Docker镜像标签
  HEALTH_CHECK_TIMEOUT 健康检查超时时间（秒）
  CANARY_PERCENTAGE   金丝雀流量百分比
  ROLLBACK_ON_FAILURE 失败时是否自动回滚
  DRY_RUN             是否为演练模式
  VERBOSE             是否显示详细日志

示例:
  # 滚动更新部署
  DEPLOY_STRATEGY=rolling $0 deploy
  
  # 蓝绿部署
  DEPLOY_STRATEGY=blue-green DOCKER_TAG=v1.2.0 $0 deploy
  
  # 金丝雀部署（10%流量）
  DEPLOY_STRATEGY=canary CANARY_PERCENTAGE=10 $0 deploy
  
  # 演练模式
  DRY_RUN=true $0 blue-green
EOF
}

# 主函数
main() {
    local command="${1:-help}"
    
    case "$command" in
        "deploy")
            check_dependencies
            case "$DEPLOY_STRATEGY" in
                "rolling")
                    rolling_update_deploy
                    ;;
                "blue-green")
                    blue_green_deploy
                    ;;
                "canary")
                    canary_deploy
                    ;;
                *)
                    log_error "不支持的部署策略: $DEPLOY_STRATEGY"
                    exit 1
                    ;;
            esac
            ;;
        "rolling-update")
            check_dependencies
            rolling_update_deploy
            ;;
        "blue-green")
            check_dependencies
            blue_green_deploy
            ;;
        "canary")
            check_dependencies
            canary_deploy
            ;;
        "promote-canary")
            check_dependencies
            promote_canary
            ;;
        "rollback-canary")
            check_dependencies
            rollback_canary
            ;;
        "status")
            check_dependencies
            status
            ;;
        "logs")
            check_dependencies
            logs "$2" "$3"
            ;;
        "rollback")
            check_dependencies
            rollback "$2"
            ;;
        "cleanup")
            check_dependencies
            cleanup
            ;;
        "help" | "--help" | "-h")
            show_help
            ;;
        *)
            log_error "未知命令: $command"
            show_help
            exit 1
            ;;
    esac
}

# 执行主函数
main "$@"