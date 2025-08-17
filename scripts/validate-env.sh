#!/bin/bash

# 环境变量验证脚本
# 用于检查和验证生产环境配置的完整性和安全性

set -e

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

# 配置变量
ENV_FILE="${ENV_FILE:-.env}"
ENVIRONMENT="${ENVIRONMENT:-production}"
STRICT_MODE="${STRICT_MODE:-false}"
CHECK_SECURITY="${CHECK_SECURITY:-true}"
CHECK_PATHS="${CHECK_PATHS:-true}"
CHECK_CONNECTIVITY="${CHECK_CONNECTIVITY:-true}"

# 错误计数
ERROR_COUNT=0
WARNING_COUNT=0

# 必需的环境变量
REQUIRED_VARS=(
    "NODE_ENV"
    "PORT"
    "DATABASE_PATH"
    "JWT_SECRET"
    "UPLOAD_PATH"
)

# 生产环境必需的变量
PRODUCTION_REQUIRED_VARS=(
    "CORS_ORIGIN"
    "SMTP_HOST"
    "SMTP_USER"
    "SMTP_PASS"
    "LOG_LEVEL"
    "RATE_LIMIT_MAX"
)

# 安全敏感变量
SECURE_VARS=(
    "JWT_SECRET"
    "SMTP_PASS"
    "DATABASE_PASSWORD"
    "API_KEY"
    "SECRET_KEY"
    "PRIVATE_KEY"
)

# 路径相关变量
PATH_VARS=(
    "DATABASE_PATH"
    "UPLOAD_PATH"
    "LOG_FILE_PATH"
    "SSL_CERT_PATH"
    "SSL_KEY_PATH"
)

# 网络相关变量
NETWORK_VARS=(
    "SMTP_HOST"
    "REDIS_HOST"
    "DATABASE_HOST"
    "API_ENDPOINT"
)

# 检查环境文件是否存在
check_env_file() {
    log_info "检查环境文件: $ENV_FILE"
    
    if [[ ! -f "$ENV_FILE" ]]; then
        log_error "环境文件不存在: $ENV_FILE"
        ((ERROR_COUNT++))
        return 1
    fi
    
    # 检查文件权限
    local file_perms=$(stat -c "%a" "$ENV_FILE")
    if [[ "$file_perms" != "600" && "$file_perms" != "644" ]]; then
        log_warning "环境文件权限不安全: $file_perms，建议设置为600"
        ((WARNING_COUNT++))
    fi
    
    log_success "环境文件检查通过"
}

# 加载环境变量
load_env_vars() {
    log_info "加载环境变量..."
    
    # 导出环境变量
    set -a
    source "$ENV_FILE"
    set +a
    
    log_success "环境变量加载完成"
}

# 检查必需的环境变量
check_required_vars() {
    log_info "检查必需的环境变量..."
    
    local missing_vars=()
    
    # 检查基本必需变量
    for var in "${REQUIRED_VARS[@]}"; do
        if [[ -z "${!var}" ]]; then
            missing_vars+=("$var")
        fi
    done
    
    # 生产环境额外检查
    if [[ "$ENVIRONMENT" == "production" ]]; then
        for var in "${PRODUCTION_REQUIRED_VARS[@]}"; do
            if [[ -z "${!var}" ]]; then
                missing_vars+=("$var")
            fi
        done
    fi
    
    if [[ ${#missing_vars[@]} -gt 0 ]]; then
        log_error "缺少必需的环境变量:"
        for var in "${missing_vars[@]}"; do
            log_error "  - $var"
        done
        ERROR_COUNT=$((ERROR_COUNT + ${#missing_vars[@]}))
    else
        log_success "所有必需的环境变量都已设置"
    fi
}

# 检查安全配置
check_security_config() {
    if [[ "$CHECK_SECURITY" != "true" ]]; then
        return 0
    fi
    
    log_info "检查安全配置..."
    
    # 检查JWT密钥强度
    if [[ -n "$JWT_SECRET" ]]; then
        local jwt_length=${#JWT_SECRET}
        if [[ $jwt_length -lt 32 ]]; then
            log_error "JWT_SECRET长度不足，建议至少32个字符，当前: $jwt_length"
            ((ERROR_COUNT++))
        elif [[ $jwt_length -lt 64 ]]; then
            log_warning "JWT_SECRET长度较短，建议至少64个字符，当前: $jwt_length"
            ((WARNING_COUNT++))
        fi
        
        # 检查JWT密钥复杂度
        if [[ "$JWT_SECRET" =~ ^[a-zA-Z0-9]+$ ]]; then
            log_warning "JWT_SECRET建议包含特殊字符以增强安全性"
            ((WARNING_COUNT++))
        fi
    fi
    
    # 检查默认密码
    local default_passwords=("password" "123456" "admin" "secret" "default")
    for var in "${SECURE_VARS[@]}"; do
        if [[ -n "${!var}" ]]; then
            for default_pwd in "${default_passwords[@]}"; do
                if [[ "${!var}" == *"$default_pwd"* ]]; then
                    log_error "$var 包含默认密码，存在安全风险"
                    ((ERROR_COUNT++))
                fi
            done
        fi
    done
    
    # 检查生产环境配置
    if [[ "$ENVIRONMENT" == "production" ]]; then
        if [[ "$NODE_ENV" != "production" ]]; then
            log_error "生产环境NODE_ENV应设置为production，当前: $NODE_ENV"
            ((ERROR_COUNT++))
        fi
        
        if [[ "$LOG_LEVEL" == "debug" ]]; then
            log_warning "生产环境不建议使用debug日志级别"
            ((WARNING_COUNT++))
        fi
        
        # 检查CORS配置
        if [[ "$CORS_ORIGIN" == "*" ]]; then
            log_error "生产环境CORS_ORIGIN不应设置为*，存在安全风险"
            ((ERROR_COUNT++))
        fi
    fi
    
    # 检查端口配置
    if [[ -n "$PORT" ]]; then
        if [[ ! "$PORT" =~ ^[0-9]+$ ]] || [[ $PORT -lt 1 ]] || [[ $PORT -gt 65535 ]]; then
            log_error "PORT配置无效: $PORT"
            ((ERROR_COUNT++))
        elif [[ $PORT -lt 1024 ]] && [[ $PORT -ne 80 ]] && [[ $PORT -ne 443 ]]; then
            log_warning "使用特权端口 $PORT，确保有足够权限"
            ((WARNING_COUNT++))
        fi
    fi
    
    log_success "安全配置检查完成"
}

# 检查路径配置
check_path_config() {
    if [[ "$CHECK_PATHS" != "true" ]]; then
        return 0
    fi
    
    log_info "检查路径配置..."
    
    for var in "${PATH_VARS[@]}"; do
        if [[ -n "${!var}" ]]; then
            local path_value="${!var}"
            
            # 检查路径是否存在
            if [[ "$var" == *"FILE_PATH" ]] || [[ "$var" == *"CERT_PATH" ]] || [[ "$var" == *"KEY_PATH" ]]; then
                # 文件路径检查
                local dir_path=$(dirname "$path_value")
                if [[ ! -d "$dir_path" ]]; then
                    log_warning "$var 的目录不存在: $dir_path"
                    ((WARNING_COUNT++))
                fi
            else
                # 目录路径检查
                if [[ ! -d "$path_value" ]]; then
                    log_warning "$var 指向的目录不存在: $path_value"
                    ((WARNING_COUNT++))
                    
                    # 尝试创建目录
                    if mkdir -p "$path_value" 2>/dev/null; then
                        log_info "已创建目录: $path_value"
                    else
                        log_error "无法创建目录: $path_value"
                        ((ERROR_COUNT++))
                    fi
                fi
                
                # 检查目录权限
                if [[ -d "$path_value" ]]; then
                    if [[ ! -w "$path_value" ]]; then
                        log_error "$var 目录不可写: $path_value"
                        ((ERROR_COUNT++))
                    fi
                fi
            fi
            
            # 检查路径安全性
            if [[ "$path_value" == /* ]]; then
                # 绝对路径
                if [[ "$path_value" == "/tmp/"* ]] && [[ "$ENVIRONMENT" == "production" ]]; then
                    log_warning "生产环境不建议使用/tmp目录: $var=$path_value"
                    ((WARNING_COUNT++))
                fi
            else
                # 相对路径
                if [[ "$path_value" == *".."* ]]; then
                    log_warning "$var 包含相对路径，可能存在安全风险: $path_value"
                    ((WARNING_COUNT++))
                fi
            fi
        fi
    done
    
    log_success "路径配置检查完成"
}

# 检查网络连接
check_network_connectivity() {
    if [[ "$CHECK_CONNECTIVITY" != "true" ]]; then
        return 0
    fi
    
    log_info "检查网络连接..."
    
    # 检查SMTP连接
    if [[ -n "$SMTP_HOST" && -n "$SMTP_PORT" ]]; then
        log_info "测试SMTP连接: $SMTP_HOST:$SMTP_PORT"
        if timeout 5 bash -c "</dev/tcp/$SMTP_HOST/$SMTP_PORT" 2>/dev/null; then
            log_success "SMTP连接正常"
        else
            log_warning "SMTP连接失败: $SMTP_HOST:$SMTP_PORT"
            ((WARNING_COUNT++))
        fi
    fi
    
    # 检查Redis连接
    if [[ -n "$REDIS_HOST" && -n "$REDIS_PORT" ]]; then
        log_info "测试Redis连接: $REDIS_HOST:$REDIS_PORT"
        if timeout 5 bash -c "</dev/tcp/$REDIS_HOST/$REDIS_PORT" 2>/dev/null; then
            log_success "Redis连接正常"
        else
            log_warning "Redis连接失败: $REDIS_HOST:$REDIS_PORT"
            ((WARNING_COUNT++))
        fi
    fi
    
    # 检查数据库连接
    if [[ -n "$DATABASE_HOST" && -n "$DATABASE_PORT" ]]; then
        log_info "测试数据库连接: $DATABASE_HOST:$DATABASE_PORT"
        if timeout 5 bash -c "</dev/tcp/$DATABASE_HOST/$DATABASE_PORT" 2>/dev/null; then
            log_success "数据库连接正常"
        else
            log_warning "数据库连接失败: $DATABASE_HOST:$DATABASE_PORT"
            ((WARNING_COUNT++))
        fi
    fi
    
    log_success "网络连接检查完成"
}

# 检查配置一致性
check_config_consistency() {
    log_info "检查配置一致性..."
    
    # 检查环境一致性
    if [[ "$NODE_ENV" != "$ENVIRONMENT" ]]; then
        log_warning "NODE_ENV ($NODE_ENV) 与 ENVIRONMENT ($ENVIRONMENT) 不一致"
        ((WARNING_COUNT++))
    fi
    
    # 检查端口冲突
    local ports=()
    [[ -n "$PORT" ]] && ports+=("$PORT")
    [[ -n "$METRICS_PORT" ]] && ports+=("$METRICS_PORT")
    [[ -n "$DEBUG_PORT" ]] && ports+=("$DEBUG_PORT")
    
    local unique_ports=($(printf "%s\n" "${ports[@]}" | sort -u))
    if [[ ${#ports[@]} -ne ${#unique_ports[@]} ]]; then
        log_error "检测到端口冲突: ${ports[*]}"
        ((ERROR_COUNT++))
    fi
    
    # 检查SSL配置一致性
    if [[ -n "$SSL_CERT_PATH" && -z "$SSL_KEY_PATH" ]] || [[ -z "$SSL_CERT_PATH" && -n "$SSL_KEY_PATH" ]]; then
        log_error "SSL证书和私钥配置不完整"
        ((ERROR_COUNT++))
    fi
    
    log_success "配置一致性检查完成"
}

# 生成配置报告
generate_report() {
    log_info "生成配置报告..."
    
    local report_file="config_validation_$(date +%Y%m%d_%H%M%S).txt"
    
    cat > "$report_file" << EOF
环境配置验证报告
==================
验证时间: $(date '+%Y-%m-%d %H:%M:%S')
环境文件: $ENV_FILE
环境类型: $ENVIRONMENT

验证结果:
错误数量: $ERROR_COUNT
警告数量: $WARNING_COUNT

环境变量列表:
EOF
    
    # 添加环境变量列表（隐藏敏感信息）
    while IFS='=' read -r key value; do
        if [[ "$key" =~ ^[A-Z_]+$ ]]; then
            local is_secure=false
            for secure_var in "${SECURE_VARS[@]}"; do
                if [[ "$key" == *"$secure_var"* ]]; then
                    is_secure=true
                    break
                fi
            done
            
            if [[ "$is_secure" == "true" ]]; then
                echo "$key=***HIDDEN***" >> "$report_file"
            else
                echo "$key=$value" >> "$report_file"
            fi
        fi
    done < "$ENV_FILE"
    
    log_success "配置报告已生成: $report_file"
}

# 修复常见问题
fix_common_issues() {
    log_info "修复常见配置问题..."
    
    local fixed_count=0
    
    # 修复文件权限
    if [[ -f "$ENV_FILE" ]]; then
        local current_perms=$(stat -c "%a" "$ENV_FILE")
        if [[ "$current_perms" != "600" ]]; then
            chmod 600 "$ENV_FILE"
            log_info "已修复环境文件权限: $current_perms -> 600"
            ((fixed_count++))
        fi
    fi
    
    # 创建缺失的目录
    for var in "${PATH_VARS[@]}"; do
        if [[ -n "${!var}" ]]; then
            local path_value="${!var}"
            if [[ "$var" != *"FILE_PATH" && "$var" != *"CERT_PATH" && "$var" != *"KEY_PATH" ]]; then
                if [[ ! -d "$path_value" ]]; then
                    if mkdir -p "$path_value" 2>/dev/null; then
                        log_info "已创建目录: $path_value"
                        ((fixed_count++))
                    fi
                fi
            fi
        fi
    done
    
    if [[ $fixed_count -gt 0 ]]; then
        log_success "已修复 $fixed_count 个配置问题"
    else
        log_info "没有发现可自动修复的问题"
    fi
}

# 主验证函数
main_validation() {
    log_info "开始环境配置验证..."
    
    # 执行各项检查
    check_env_file || return 1
    load_env_vars
    check_required_vars
    check_security_config
    check_path_config
    check_network_connectivity
    check_config_consistency
    
    # 生成报告
    generate_report
    
    # 修复问题（如果启用）
    if [[ "$AUTO_FIX" == "true" ]]; then
        fix_common_issues
    fi
    
    # 输出结果
    echo ""
    log_info "验证完成！"
    
    if [[ $ERROR_COUNT -eq 0 && $WARNING_COUNT -eq 0 ]]; then
        log_success "配置验证通过，没有发现问题"
        return 0
    elif [[ $ERROR_COUNT -eq 0 ]]; then
        log_warning "配置验证完成，发现 $WARNING_COUNT 个警告"
        return 0
    else
        log_error "配置验证失败，发现 $ERROR_COUNT 个错误和 $WARNING_COUNT 个警告"
        
        if [[ "$STRICT_MODE" == "true" ]]; then
            return 1
        else
            return 0
        fi
    fi
}

# 显示帮助信息
show_help() {
    echo "环境变量验证脚本"
    echo ""
    echo "用法: $0 [选项]"
    echo ""
    echo "选项:"
    echo "  -h, --help              显示帮助信息"
    echo "  -f, --file FILE         环境文件路径 (默认: .env)"
    echo "  -e, --env ENV           环境类型 (默认: production)"
    echo "  --strict                严格模式，有错误时退出"
    echo "  --no-security           跳过安全检查"
    echo "  --no-paths              跳过路径检查"
    echo "  --no-connectivity       跳过网络连接检查"
    echo "  --auto-fix              自动修复常见问题"
    echo "  -v, --verbose           详细输出"
    echo ""
    echo "环境变量:"
    echo "  ENV_FILE                环境文件路径"
    echo "  ENVIRONMENT             环境类型"
    echo "  STRICT_MODE             严格模式"
    echo "  CHECK_SECURITY          检查安全配置"
    echo "  CHECK_PATHS             检查路径配置"
    echo "  CHECK_CONNECTIVITY      检查网络连接"
    echo "  AUTO_FIX                自动修复问题"
    echo ""
    echo "示例:"
    echo "  $0                                    # 验证默认配置"
    echo "  $0 -f .env.production                 # 验证指定文件"
    echo "  $0 -e development --no-security       # 开发环境，跳过安全检查"
    echo "  $0 --strict --auto-fix                # 严格模式，自动修复"
    echo ""
}

# 解析命令行参数
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_help
            exit 0
            ;;
        -f|--file)
            ENV_FILE="$2"
            shift 2
            ;;
        -e|--env)
            ENVIRONMENT="$2"
            shift 2
            ;;
        --strict)
            STRICT_MODE="true"
            shift
            ;;
        --no-security)
            CHECK_SECURITY="false"
            shift
            ;;
        --no-paths)
            CHECK_PATHS="false"
            shift
            ;;
        --no-connectivity)
            CHECK_CONNECTIVITY="false"
            shift
            ;;
        --auto-fix)
            AUTO_FIX="true"
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

# 执行主验证函数
main_validation