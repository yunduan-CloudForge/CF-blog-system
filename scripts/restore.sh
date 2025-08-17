#!/bin/bash

# 数据恢复脚本
# 从备份文件恢复博客系统数据

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
BACKUP_FILE="$1"
DATA_DIR="${DATA_DIR:-./data}"
UPLOADS_DIR="${UPLOADS_DIR:-./uploads}"
LOGS_DIR="${LOGS_DIR:-./logs}"
DATABASE_FILE="${DATABASE_FILE:-blog.db}"
RESTORE_DIR="/tmp/blog_restore_$(date +%s)"
FORCE_RESTORE="${FORCE_RESTORE:-false}"
BACKUP_CURRENT="${BACKUP_CURRENT:-true}"

# 验证备份文件
validate_backup_file() {
    log_info "验证备份文件..."
    
    if [[ -z "$BACKUP_FILE" ]]; then
        log_error "请指定备份文件路径"
        show_help
        exit 1
    fi
    
    if [[ ! -f "$BACKUP_FILE" ]]; then
        log_error "备份文件不存在: $BACKUP_FILE"
        exit 1
    fi
    
    # 检查文件格式
    if [[ "$BACKUP_FILE" == *.tar.gz ]]; then
        if ! tar -tzf "$BACKUP_FILE" &>/dev/null; then
            log_error "备份文件格式无效或已损坏"
            exit 1
        fi
    else
        log_error "不支持的备份文件格式，请使用.tar.gz文件"
        exit 1
    fi
    
    log_success "备份文件验证通过: $BACKUP_FILE"
}

# 创建当前数据备份
backup_current_data() {
    if [[ "$BACKUP_CURRENT" == "true" ]]; then
        log_info "备份当前数据..."
        
        local current_backup_dir="./backups/pre_restore_$(date +%Y%m%d_%H%M%S)"
        mkdir -p "$current_backup_dir"
        
        # 备份当前数据库
        if [[ -f "$DATA_DIR/$DATABASE_FILE" ]]; then
            cp "$DATA_DIR/$DATABASE_FILE" "$current_backup_dir/"
            log_info "当前数据库已备份到: $current_backup_dir/$DATABASE_FILE"
        fi
        
        # 备份当前上传文件
        if [[ -d "$UPLOADS_DIR" ]]; then
            tar -czf "$current_backup_dir/uploads_backup.tar.gz" -C "$(dirname "$UPLOADS_DIR")" "$(basename "$UPLOADS_DIR")"
            log_info "当前上传文件已备份到: $current_backup_dir/uploads_backup.tar.gz"
        fi
        
        log_success "当前数据备份完成: $current_backup_dir"
    fi
}

# 解压备份文件
extract_backup() {
    log_info "解压备份文件..."
    
    mkdir -p "$RESTORE_DIR"
    
    # 解压备份文件
    tar -xzf "$BACKUP_FILE" -C "$RESTORE_DIR" --strip-components=1
    
    if [[ $? -eq 0 ]]; then
        log_success "备份文件解压完成: $RESTORE_DIR"
    else
        log_error "备份文件解压失败"
        exit 1
    fi
    
    # 验证备份内容
    if [[ -f "$RESTORE_DIR/MANIFEST.txt" ]]; then
        log_info "备份清单:"
        cat "$RESTORE_DIR/MANIFEST.txt"
    else
        log_warning "未找到备份清单文件"
    fi
}

# 恢复数据库
restore_database() {
    log_info "恢复数据库..."
    
    local backup_db="$RESTORE_DIR/database.db"
    local target_db="$DATA_DIR/$DATABASE_FILE"
    
    if [[ -f "$backup_db" ]]; then
        # 验证备份数据库完整性
        if sqlite3 "$backup_db" "PRAGMA integrity_check;" | grep -q "ok"; then
            # 创建数据目录
            mkdir -p "$DATA_DIR"
            
            # 停止应用服务（如果正在运行）
            if command -v pm2 &> /dev/null; then
                pm2 stop blog-backend 2>/dev/null || true
                log_info "已停止后端服务"
            fi
            
            # 恢复数据库
            cp "$backup_db" "$target_db"
            chmod 644 "$target_db"
            
            # 验证恢复的数据库
            if sqlite3 "$target_db" "PRAGMA integrity_check;" | grep -q "ok"; then
                log_success "数据库恢复完成: $target_db"
                
                # 显示数据库信息
                local table_count=$(sqlite3 "$target_db" "SELECT COUNT(*) FROM sqlite_master WHERE type='table';")
                log_info "数据库表数量: $table_count"
            else
                log_error "恢复的数据库验证失败"
                exit 1
            fi
        else
            log_error "备份数据库完整性检查失败"
            exit 1
        fi
    else
        log_warning "备份中未找到数据库文件"
    fi
}

# 恢复上传文件
restore_uploads() {
    log_info "恢复上传文件..."
    
    local backup_uploads="$RESTORE_DIR/uploads.tar.gz"
    
    if [[ -f "$backup_uploads" ]]; then
        # 清空现有上传目录（如果强制恢复）
        if [[ "$FORCE_RESTORE" == "true" && -d "$UPLOADS_DIR" ]]; then
            rm -rf "$UPLOADS_DIR"
            log_info "已清空现有上传目录"
        fi
        
        # 创建上传目录
        mkdir -p "$(dirname "$UPLOADS_DIR")"
        
        # 解压上传文件
        tar -xzf "$backup_uploads" -C "$(dirname "$UPLOADS_DIR")"
        
        if [[ $? -eq 0 ]]; then
            # 设置权限
            chmod -R 755 "$UPLOADS_DIR"
            
            local file_count=$(find "$UPLOADS_DIR" -type f | wc -l)
            log_success "上传文件恢复完成，共 $file_count 个文件"
        else
            log_error "上传文件恢复失败"
            exit 1
        fi
    else
        log_warning "备份中未找到上传文件"
    fi
}

# 恢复日志文件
restore_logs() {
    log_info "恢复日志文件..."
    
    local backup_logs="$RESTORE_DIR/logs.tar.gz"
    
    if [[ -f "$backup_logs" ]]; then
        # 创建日志目录
        mkdir -p "$LOGS_DIR"
        
        # 解压日志文件
        tar -xzf "$backup_logs" -C "$LOGS_DIR"
        
        if [[ $? -eq 0 ]]; then
            chmod -R 644 "$LOGS_DIR"/*.log 2>/dev/null || true
            log_success "日志文件恢复完成"
        else
            log_warning "日志文件恢复失败，但不影响系统运行"
        fi
    else
        log_info "备份中未找到日志文件"
    fi
}

# 重启服务
restart_services() {
    log_info "重启应用服务..."
    
    # 重启PM2服务
    if command -v pm2 &> /dev/null; then
        pm2 start ecosystem.config.js 2>/dev/null || pm2 restart blog-backend 2>/dev/null || true
        log_info "PM2服务已重启"
    fi
    
    # 重启Docker服务
    if command -v docker-compose &> /dev/null && [[ -f "docker-compose.yml" ]]; then
        docker-compose restart backend
        log_info "Docker服务已重启"
    fi
    
    log_success "服务重启完成"
}

# 验证恢复结果
verify_restore() {
    log_info "验证恢复结果..."
    
    local errors=0
    
    # 检查数据库
    if [[ -f "$DATA_DIR/$DATABASE_FILE" ]]; then
        if sqlite3 "$DATA_DIR/$DATABASE_FILE" "PRAGMA integrity_check;" | grep -q "ok"; then
            log_success "数据库验证通过"
        else
            log_error "数据库验证失败"
            ((errors++))
        fi
    else
        log_error "数据库文件不存在"
        ((errors++))
    fi
    
    # 检查上传目录
    if [[ -d "$UPLOADS_DIR" ]]; then
        local upload_count=$(find "$UPLOADS_DIR" -type f | wc -l)
        log_success "上传目录验证通过，包含 $upload_count 个文件"
    else
        log_warning "上传目录不存在"
    fi
    
    # 检查应用服务
    if command -v pm2 &> /dev/null; then
        if pm2 list | grep -q "blog-backend.*online"; then
            log_success "后端服务运行正常"
        else
            log_warning "后端服务未运行"
        fi
    fi
    
    if [[ $errors -eq 0 ]]; then
        log_success "恢复验证完成，系统状态正常"
        return 0
    else
        log_error "恢复验证发现 $errors 个错误"
        return 1
    fi
}

# 清理临时文件
cleanup() {
    log_info "清理临时文件..."
    
    if [[ -d "$RESTORE_DIR" ]]; then
        rm -rf "$RESTORE_DIR"
        log_success "临时文件清理完成"
    fi
}

# 主恢复函数
main_restore() {
    log_info "开始数据恢复..."
    
    local start_time=$(date +%s)
    
    # 验证备份文件
    validate_backup_file
    
    # 确认恢复操作
    if [[ "$FORCE_RESTORE" != "true" ]]; then
        echo -n "确认要恢复数据吗？这将覆盖现有数据 [y/N]: "
        read -r confirmation
        if [[ "$confirmation" != "y" && "$confirmation" != "Y" ]]; then
            log_info "恢复操作已取消"
            exit 0
        fi
    fi
    
    # 备份当前数据
    backup_current_data
    
    # 解压备份文件
    extract_backup
    
    # 执行恢复
    restore_database
    restore_uploads
    restore_logs
    
    # 重启服务
    restart_services
    
    # 验证恢复结果
    verify_restore
    
    # 清理临时文件
    cleanup
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    log_success "数据恢复完成！"
    log_info "恢复文件: $BACKUP_FILE"
    log_info "耗时: ${duration}秒"
}

# 错误处理
error_handler() {
    local exit_code=$?
    log_error "恢复过程中发生错误，退出码: $exit_code"
    
    # 清理临时文件
    cleanup
    
    log_error "数据恢复失败，请检查错误信息并重试"
    exit $exit_code
}

# 显示帮助信息
show_help() {
    echo "博客系统数据恢复脚本"
    echo ""
    echo "用法: $0 <备份文件> [选项]"
    echo ""
    echo "参数:"
    echo "  备份文件               要恢复的备份文件路径 (.tar.gz格式)"
    echo ""
    echo "选项:"
    echo "  -h, --help            显示帮助信息"
    echo "  -f, --force           强制恢复，不提示确认"
    echo "  --no-backup           不备份当前数据"
    echo "  --no-restart          恢复后不重启服务"
    echo "  -v, --verbose         详细输出"
    echo ""
    echo "环境变量:"
    echo "  DATA_DIR              数据目录 (默认: ./data)"
    echo "  UPLOADS_DIR           上传目录 (默认: ./uploads)"
    echo "  LOGS_DIR              日志目录 (默认: ./logs)"
    echo "  DATABASE_FILE         数据库文件名 (默认: blog.db)"
    echo "  FORCE_RESTORE         强制恢复 (默认: false)"
    echo "  BACKUP_CURRENT        备份当前数据 (默认: true)"
    echo ""
    echo "示例:"
    echo "  $0 ./backups/blog_backup_20240116_120000.tar.gz"
    echo "  $0 ./backups/blog_backup_20240116_120000.tar.gz --force"
    echo "  FORCE_RESTORE=true $0 ./backups/blog_backup_20240116_120000.tar.gz"
    echo ""
}

# 设置错误处理
trap error_handler ERR

# 解析命令行参数
RESTART_SERVICES=true

while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_help
            exit 0
            ;;
        -f|--force)
            FORCE_RESTORE="true"
            shift
            ;;
        --no-backup)
            BACKUP_CURRENT="false"
            shift
            ;;
        --no-restart)
            RESTART_SERVICES=false
            shift
            ;;
        -v|--verbose)
            set -x
            shift
            ;;
        -*)
            log_error "未知选项: $1"
            show_help
            exit 1
            ;;
        *)
            if [[ -z "$BACKUP_FILE" ]]; then
                BACKUP_FILE="$1"
            else
                log_error "多余的参数: $1"
                show_help
                exit 1
            fi
            shift
            ;;
    esac
done

# 检查必要的命令
for cmd in sqlite3 tar gzip; do
    if ! command -v $cmd &> /dev/null; then
        log_error "缺少必要的命令: $cmd"
        exit 1
    fi
done

# 执行主恢复函数
main_restore