#!/bin/bash

# 数据库备份脚本
# 支持SQLite数据库备份、文件备份和远程存储

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
BACKUP_DIR="${BACKUP_DIR:-./backups}"
DATA_DIR="${DATA_DIR:-./data}"
UPLOADS_DIR="${UPLOADS_DIR:-./uploads}"
LOGS_DIR="${LOGS_DIR:-./logs}"
DATABASE_FILE="${DATABASE_FILE:-blog.db}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
TIMESTAMP=$(date '+%Y%m%d_%H%M%S')
BACKUP_NAME="blog_backup_${TIMESTAMP}"

# 远程备份配置（可选）
REMOTE_BACKUP_ENABLED="${REMOTE_BACKUP_ENABLED:-false}"
S3_BUCKET="${S3_BUCKET:-}"
S3_REGION="${S3_REGION:-us-east-1}"
FTP_HOST="${FTP_HOST:-}"
FTP_USER="${FTP_USER:-}"
FTP_PASS="${FTP_PASS:-}"

# 创建备份目录
create_backup_directory() {
    log_info "创建备份目录..."
    mkdir -p "$BACKUP_DIR/$BACKUP_NAME"
    chmod 755 "$BACKUP_DIR/$BACKUP_NAME"
    log_success "备份目录创建完成: $BACKUP_DIR/$BACKUP_NAME"
}

# 备份SQLite数据库
backup_database() {
    log_info "开始备份数据库..."
    
    local db_path="$DATA_DIR/$DATABASE_FILE"
    local backup_db_path="$BACKUP_DIR/$BACKUP_NAME/database.db"
    
    if [[ -f "$db_path" ]]; then
        # 使用SQLite的.backup命令进行热备份
        sqlite3 "$db_path" ".backup '$backup_db_path'"
        
        # 验证备份文件
        if sqlite3 "$backup_db_path" "PRAGMA integrity_check;" | grep -q "ok"; then
            log_success "数据库备份完成: $backup_db_path"
            
            # 创建数据库信息文件
            cat > "$BACKUP_DIR/$BACKUP_NAME/database_info.txt" << EOF
数据库备份信息
================
备份时间: $(date '+%Y-%m-%d %H:%M:%S')
原始文件: $db_path
备份文件: $backup_db_path
文件大小: $(du -h "$backup_db_path" | cut -f1)
数据库版本: $(sqlite3 "$backup_db_path" "PRAGMA user_version;")
表数量: $(sqlite3 "$backup_db_path" "SELECT COUNT(*) FROM sqlite_master WHERE type='table';")
EOF
        else
            log_error "数据库备份验证失败"
            return 1
        fi
    else
        log_warning "数据库文件不存在: $db_path"
    fi
}

# 备份上传文件
backup_uploads() {
    log_info "开始备份上传文件..."
    
    if [[ -d "$UPLOADS_DIR" ]]; then
        local upload_count=$(find "$UPLOADS_DIR" -type f | wc -l)
        
        if [[ $upload_count -gt 0 ]]; then
            tar -czf "$BACKUP_DIR/$BACKUP_NAME/uploads.tar.gz" -C "$(dirname "$UPLOADS_DIR")" "$(basename "$UPLOADS_DIR")"
            
            # 创建上传文件信息
            cat > "$BACKUP_DIR/$BACKUP_NAME/uploads_info.txt" << EOF
上传文件备份信息
==================
备份时间: $(date '+%Y-%m-%d %H:%M:%S')
原始目录: $UPLOADS_DIR
备份文件: uploads.tar.gz
文件数量: $upload_count
总大小: $(du -sh "$UPLOADS_DIR" | cut -f1)
压缩后大小: $(du -h "$BACKUP_DIR/$BACKUP_NAME/uploads.tar.gz" | cut -f1)
EOF
            
            log_success "上传文件备份完成: uploads.tar.gz"
        else
            log_info "上传目录为空，跳过备份"
        fi
    else
        log_warning "上传目录不存在: $UPLOADS_DIR"
    fi
}

# 备份日志文件
backup_logs() {
    log_info "开始备份日志文件..."
    
    if [[ -d "$LOGS_DIR" ]]; then
        # 只备份最近7天的日志
        find "$LOGS_DIR" -name "*.log" -mtime -7 -type f > /tmp/recent_logs.txt
        
        if [[ -s /tmp/recent_logs.txt ]]; then
            tar -czf "$BACKUP_DIR/$BACKUP_NAME/logs.tar.gz" -T /tmp/recent_logs.txt
            
            # 创建日志备份信息
            cat > "$BACKUP_DIR/$BACKUP_NAME/logs_info.txt" << EOF
日志文件备份信息
==================
备份时间: $(date '+%Y-%m-%d %H:%M:%S')
备份范围: 最近7天的日志文件
备份文件: logs.tar.gz
文件列表:
EOF
            cat /tmp/recent_logs.txt >> "$BACKUP_DIR/$BACKUP_NAME/logs_info.txt"
            
            log_success "日志文件备份完成: logs.tar.gz"
        else
            log_info "没有找到最近的日志文件"
        fi
        
        rm -f /tmp/recent_logs.txt
    else
        log_warning "日志目录不存在: $LOGS_DIR"
    fi
}

# 创建备份清单
create_backup_manifest() {
    log_info "创建备份清单..."
    
    cat > "$BACKUP_DIR/$BACKUP_NAME/MANIFEST.txt" << EOF
博客系统备份清单
==================
备份名称: $BACKUP_NAME
备份时间: $(date '+%Y-%m-%d %H:%M:%S')
备份类型: 完整备份
系统信息: $(uname -a)

备份内容:
EOF
    
    # 列出备份文件
    find "$BACKUP_DIR/$BACKUP_NAME" -type f -exec basename {} \; | sort >> "$BACKUP_DIR/$BACKUP_NAME/MANIFEST.txt"
    
    # 计算备份大小
    echo "" >> "$BACKUP_DIR/$BACKUP_NAME/MANIFEST.txt"
    echo "备份统计:" >> "$BACKUP_DIR/$BACKUP_NAME/MANIFEST.txt"
    echo "总大小: $(du -sh "$BACKUP_DIR/$BACKUP_NAME" | cut -f1)" >> "$BACKUP_DIR/$BACKUP_NAME/MANIFEST.txt"
    echo "文件数量: $(find "$BACKUP_DIR/$BACKUP_NAME" -type f | wc -l)" >> "$BACKUP_DIR/$BACKUP_NAME/MANIFEST.txt"
    
    log_success "备份清单创建完成"
}

# 压缩备份
compress_backup() {
    log_info "压缩备份文件..."
    
    cd "$BACKUP_DIR"
    tar -czf "${BACKUP_NAME}.tar.gz" "$BACKUP_NAME"
    
    if [[ $? -eq 0 ]]; then
        # 删除原始备份目录
        rm -rf "$BACKUP_NAME"
        
        log_success "备份压缩完成: ${BACKUP_NAME}.tar.gz"
        log_info "压缩后大小: $(du -h "${BACKUP_NAME}.tar.gz" | cut -f1)"
    else
        log_error "备份压缩失败"
        return 1
    fi
}

# 上传到S3
upload_to_s3() {
    if [[ "$REMOTE_BACKUP_ENABLED" == "true" && -n "$S3_BUCKET" ]]; then
        log_info "上传备份到S3..."
        
        if command -v aws &> /dev/null; then
            aws s3 cp "$BACKUP_DIR/${BACKUP_NAME}.tar.gz" "s3://$S3_BUCKET/backups/" --region "$S3_REGION"
            
            if [[ $? -eq 0 ]]; then
                log_success "备份已上传到S3: s3://$S3_BUCKET/backups/${BACKUP_NAME}.tar.gz"
            else
                log_error "S3上传失败"
            fi
        else
            log_warning "AWS CLI未安装，跳过S3上传"
        fi
    fi
}

# 上传到FTP
upload_to_ftp() {
    if [[ "$REMOTE_BACKUP_ENABLED" == "true" && -n "$FTP_HOST" ]]; then
        log_info "上传备份到FTP..."
        
        if command -v lftp &> /dev/null; then
            lftp -c "open -u $FTP_USER,$FTP_PASS $FTP_HOST; cd backups; put $BACKUP_DIR/${BACKUP_NAME}.tar.gz; quit"
            
            if [[ $? -eq 0 ]]; then
                log_success "备份已上传到FTP: $FTP_HOST/backups/${BACKUP_NAME}.tar.gz"
            else
                log_error "FTP上传失败"
            fi
        else
            log_warning "lftp未安装，跳过FTP上传"
        fi
    fi
}

# 清理旧备份
cleanup_old_backups() {
    log_info "清理旧备份文件..."
    
    local deleted_count=0
    
    # 删除超过保留期的本地备份
    while IFS= read -r -d '' file; do
        rm -f "$file"
        ((deleted_count++))
    done < <(find "$BACKUP_DIR" -name "blog_backup_*.tar.gz" -mtime +"$RETENTION_DAYS" -print0)
    
    if [[ $deleted_count -gt 0 ]]; then
        log_success "已删除 $deleted_count 个旧备份文件"
    else
        log_info "没有需要清理的旧备份文件"
    fi
    
    # 清理S3旧备份（如果启用）
    if [[ "$REMOTE_BACKUP_ENABLED" == "true" && -n "$S3_BUCKET" ]] && command -v aws &> /dev/null; then
        log_info "清理S3旧备份..."
        
        local cutoff_date=$(date -d "$RETENTION_DAYS days ago" '+%Y-%m-%d')
        aws s3 ls "s3://$S3_BUCKET/backups/" --region "$S3_REGION" | \
            awk -v cutoff="$cutoff_date" '$1 < cutoff {print $4}' | \
            while read -r file; do
                aws s3 rm "s3://$S3_BUCKET/backups/$file" --region "$S3_REGION"
                log_info "已删除S3备份: $file"
            done
    fi
}

# 发送备份通知
send_notification() {
    local status="$1"
    local message="$2"
    
    if [[ -n "$NOTIFICATION_EMAIL" ]] && command -v mail &> /dev/null; then
        echo "$message" | mail -s "博客系统备份通知 - $status" "$NOTIFICATION_EMAIL"
        log_info "备份通知已发送到: $NOTIFICATION_EMAIL"
    fi
    
    # Webhook通知（可选）
    if [[ -n "$WEBHOOK_URL" ]]; then
        curl -X POST "$WEBHOOK_URL" \
            -H "Content-Type: application/json" \
            -d "{\"text\": \"$message\", \"status\": \"$status\"}" \
            --silent --output /dev/null
        log_info "Webhook通知已发送"
    fi
}

# 主备份函数
main_backup() {
    log_info "开始执行备份任务..."
    
    local start_time=$(date +%s)
    
    # 创建备份目录
    create_backup_directory
    
    # 执行各项备份
    backup_database
    backup_uploads
    backup_logs
    
    # 创建备份清单
    create_backup_manifest
    
    # 压缩备份
    compress_backup
    
    # 远程备份
    upload_to_s3
    upload_to_ftp
    
    # 清理旧备份
    cleanup_old_backups
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    log_success "备份任务完成！"
    log_info "备份文件: $BACKUP_DIR/${BACKUP_NAME}.tar.gz"
    log_info "耗时: ${duration}秒"
    
    # 发送成功通知
    send_notification "成功" "博客系统备份已成功完成。备份文件: ${BACKUP_NAME}.tar.gz，耗时: ${duration}秒"
}

# 错误处理
error_handler() {
    local exit_code=$?
    log_error "备份过程中发生错误，退出码: $exit_code"
    
    # 清理失败的备份
    if [[ -d "$BACKUP_DIR/$BACKUP_NAME" ]]; then
        rm -rf "$BACKUP_DIR/$BACKUP_NAME"
        log_info "已清理失败的备份目录"
    fi
    
    # 发送失败通知
    send_notification "失败" "博客系统备份失败，错误码: $exit_code。请检查日志获取详细信息。"
    
    exit $exit_code
}

# 显示帮助信息
show_help() {
    echo "博客系统备份脚本"
    echo ""
    echo "用法: $0 [选项]"
    echo ""
    echo "选项:"
    echo "  -h, --help          显示帮助信息"
    echo "  -v, --verbose       详细输出"
    echo "  --dry-run          模拟运行（不执行实际备份）"
    echo ""
    echo "环境变量:"
    echo "  BACKUP_DIR              备份目录 (默认: ./backups)"
    echo "  DATA_DIR                数据目录 (默认: ./data)"
    echo "  UPLOADS_DIR             上传目录 (默认: ./uploads)"
    echo "  LOGS_DIR                日志目录 (默认: ./logs)"
    echo "  DATABASE_FILE           数据库文件名 (默认: blog.db)"
    echo "  BACKUP_RETENTION_DAYS   备份保留天数 (默认: 30)"
    echo "  REMOTE_BACKUP_ENABLED   启用远程备份 (默认: false)"
    echo "  S3_BUCKET               S3存储桶名称"
    echo "  S3_REGION               S3区域 (默认: us-east-1)"
    echo "  FTP_HOST                FTP主机地址"
    echo "  FTP_USER                FTP用户名"
    echo "  FTP_PASS                FTP密码"
    echo "  NOTIFICATION_EMAIL      通知邮箱"
    echo "  WEBHOOK_URL             Webhook通知URL"
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
        -v|--verbose)
            set -x
            shift
            ;;
        --dry-run)
            log_info "模拟运行模式，不执行实际备份"
            exit 0
            ;;
        *)
            log_error "未知选项: $1"
            show_help
            exit 1
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

# 执行主备份函数
main_backup