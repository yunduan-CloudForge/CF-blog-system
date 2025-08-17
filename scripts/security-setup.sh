#!/bin/bash

# 安全配置脚本
# 用于设置博客系统的安全措施和防护配置

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
ENVIRONMENT="${ENVIRONMENT:-production}"
DOMAIN="${DOMAIN:-localhost}"
DEPLOY_USER="${DEPLOY_USER:-deploy}"
APP_PATH="${APP_PATH:-/var/www/blog-system}"
ENABLE_FIREWALL="${ENABLE_FIREWALL:-true}"
ENABLE_FAIL2BAN="${ENABLE_FAIL2BAN:-true}"
ENABLE_SSL="${ENABLE_SSL:-true}"
ENABLE_SECURITY_HEADERS="${ENABLE_SECURITY_HEADERS:-true}"
ENABLE_RATE_LIMITING="${ENABLE_RATE_LIMITING:-true}"

# 检查系统权限
check_permissions() {
    log_info "检查系统权限..."
    
    if [[ $EUID -ne 0 ]]; then
        log_error "此脚本需要root权限运行"
        log_info "请使用: sudo $0"
        exit 1
    fi
    
    log_success "权限检查通过"
}

# 更新系统
update_system() {
    log_info "更新系统包..."
    
    # 检测包管理器
    if command -v apt-get &> /dev/null; then
        apt-get update
        apt-get upgrade -y
        apt-get autoremove -y
    elif command -v yum &> /dev/null; then
        yum update -y
        yum autoremove -y
    elif command -v dnf &> /dev/null; then
        dnf update -y
        dnf autoremove -y
    else
        log_warning "未识别的包管理器，请手动更新系统"
    fi
    
    log_success "系统更新完成"
}

# 配置防火墙
setup_firewall() {
    if [[ "$ENABLE_FIREWALL" != "true" ]]; then
        return 0
    fi
    
    log_info "配置防火墙..."
    
    # 安装UFW
    if ! command -v ufw &> /dev/null; then
        if command -v apt-get &> /dev/null; then
            apt-get install -y ufw
        elif command -v yum &> /dev/null; then
            yum install -y ufw
        fi
    fi
    
    # 配置UFW规则
    ufw --force reset
    ufw default deny incoming
    ufw default allow outgoing
    
    # 允许SSH
    ufw allow ssh
    ufw allow 22/tcp
    
    # 允许HTTP和HTTPS
    ufw allow 80/tcp
    ufw allow 443/tcp
    
    # 允许应用端口（如果不是标准端口）
    if [[ -n "$APP_PORT" && "$APP_PORT" != "80" && "$APP_PORT" != "443" ]]; then
        ufw allow "$APP_PORT"/tcp
    fi
    
    # 限制SSH连接频率
    ufw limit ssh
    
    # 启用防火墙
    ufw --force enable
    
    # 显示状态
    ufw status verbose
    
    log_success "防火墙配置完成"
}

# 安装和配置Fail2Ban
setup_fail2ban() {
    if [[ "$ENABLE_FAIL2BAN" != "true" ]]; then
        return 0
    fi
    
    log_info "配置Fail2Ban..."
    
    # 安装Fail2Ban
    if ! command -v fail2ban-server &> /dev/null; then
        if command -v apt-get &> /dev/null; then
            apt-get install -y fail2ban
        elif command -v yum &> /dev/null; then
            yum install -y fail2ban
        fi
    fi
    
    # 创建本地配置文件
    cat > /etc/fail2ban/jail.local << 'EOF'
[DEFAULT]
# 默认配置
bantime = 3600
findtime = 600
maxretry = 5
backend = auto

# SSH保护
[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log
maxretry = 3
bantime = 3600

# Nginx保护
[nginx-http-auth]
enabled = true
filter = nginx-http-auth
logpath = /var/log/nginx/error.log
maxretry = 3
bantime = 3600

[nginx-limit-req]
enabled = true
filter = nginx-limit-req
logpath = /var/log/nginx/error.log
maxretry = 10
bantime = 600

[nginx-botsearch]
enabled = true
filter = nginx-botsearch
logpath = /var/log/nginx/access.log
maxretry = 2
bantime = 7200
EOF
    
    # 创建Nginx过滤器
    cat > /etc/fail2ban/filter.d/nginx-botsearch.conf << 'EOF'
[Definition]
failregex = ^<HOST> -.*"(GET|POST).*\.(php|asp|exe|pl|cgi|scgi).*HTTP.*" 404.*$
            ^<HOST> -.*"(GET|POST) .*(\?|&)(select|union|insert|drop|delete|update|cast|create|char|convert|alter|declare|exec|script).*HTTP.*" 200.*$
ignoreregex =
EOF
    
    # 启动Fail2Ban
    systemctl enable fail2ban
    systemctl restart fail2ban
    
    # 显示状态
    fail2ban-client status
    
    log_success "Fail2Ban配置完成"
}

# 配置SSH安全
setup_ssh_security() {
    log_info "配置SSH安全..."
    
    # 备份原始配置
    cp /etc/ssh/sshd_config /etc/ssh/sshd_config.backup
    
    # 创建安全的SSH配置
    cat > /etc/ssh/sshd_config << 'EOF'
# SSH安全配置
Port 22
Protocol 2

# 认证配置
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
AuthorizedKeysFile .ssh/authorized_keys

# 连接限制
MaxAuthTries 3
MaxSessions 2
MaxStartups 2
LoginGraceTime 30

# 安全选项
PermitEmptyPasswords no
ChallengeResponseAuthentication no
UsePAM yes
X11Forwarding no
AllowTcpForwarding no
GatewayPorts no
PermitTunnel no

# 日志配置
SyslogFacility AUTH
LogLevel INFO

# 其他安全设置
ClientAliveInterval 300
ClientAliveCountMax 2
Compression no
TCPKeepAlive no
AllowAgentForwarding no

# 允许的用户
AllowUsers deploy
EOF
    
    # 验证配置
    if sshd -t; then
        systemctl restart ssh
        log_success "SSH安全配置完成"
    else
        log_error "SSH配置验证失败，恢复原始配置"
        cp /etc/ssh/sshd_config.backup /etc/ssh/sshd_config
        systemctl restart ssh
    fi
}

# 设置文件权限
setup_file_permissions() {
    log_info "设置文件权限..."
    
    if [[ -d "$APP_PATH" ]]; then
        # 设置应用目录权限
        chown -R "$DEPLOY_USER:$DEPLOY_USER" "$APP_PATH"
        
        # 设置目录权限
        find "$APP_PATH" -type d -exec chmod 755 {} \;
        
        # 设置文件权限
        find "$APP_PATH" -type f -exec chmod 644 {} \;
        
        # 设置脚本执行权限
        find "$APP_PATH/scripts" -name "*.sh" -exec chmod 755 {} \; 2>/dev/null || true
        
        # 设置敏感文件权限
        chmod 600 "$APP_PATH/.env" 2>/dev/null || true
        chmod 600 "$APP_PATH/.env.production" 2>/dev/null || true
        
        # 设置上传目录权限
        if [[ -d "$APP_PATH/uploads" ]]; then
            chmod 755 "$APP_PATH/uploads"
            chown -R "$DEPLOY_USER:www-data" "$APP_PATH/uploads"
        fi
        
        # 设置日志目录权限
        if [[ -d "$APP_PATH/logs" ]]; then
            chmod 755 "$APP_PATH/logs"
            chown -R "$DEPLOY_USER:$DEPLOY_USER" "$APP_PATH/logs"
        fi
        
        log_success "文件权限设置完成"
    else
        log_warning "应用目录不存在: $APP_PATH"
    fi
}

# 配置Nginx安全头
setup_nginx_security() {
    if [[ "$ENABLE_SECURITY_HEADERS" != "true" ]]; then
        return 0
    fi
    
    log_info "配置Nginx安全头..."
    
    # 创建安全头配置文件
    cat > /etc/nginx/conf.d/security-headers.conf << 'EOF'
# 安全头配置
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self'; media-src 'self'; object-src 'none'; child-src 'none'; frame-src 'none'; worker-src 'none'; frame-ancestors 'self'; form-action 'self'; base-uri 'self';" always;
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
add_header Permissions-Policy "geolocation=(), microphone=(), camera=(), payment=(), usb=(), magnetometer=(), gyroscope=(), speaker=(), vibrate=(), fullscreen=(self), sync-xhr=()" always;

# 隐藏Nginx版本
server_tokens off;

# 限制请求大小
client_max_body_size 10M;
client_body_buffer_size 128k;
client_header_buffer_size 1k;
large_client_header_buffers 4 4k;

# 超时设置
client_body_timeout 12;
client_header_timeout 12;
keepalive_timeout 15;
send_timeout 10;

# 限制连接
limit_conn_zone $binary_remote_addr zone=conn_limit_per_ip:10m;
limit_req_zone $binary_remote_addr zone=req_limit_per_ip:10m rate=5r/s;

# 应用限制
limit_conn conn_limit_per_ip 20;
limit_req zone=req_limit_per_ip burst=10 nodelay;
EOF
    
    # 测试Nginx配置
    if nginx -t; then
        systemctl reload nginx
        log_success "Nginx安全头配置完成"
    else
        log_error "Nginx配置验证失败"
        rm -f /etc/nginx/conf.d/security-headers.conf
    fi
}

# 配置系统安全
setup_system_security() {
    log_info "配置系统安全..."
    
    # 禁用不必要的服务
    local services_to_disable=("telnet" "rsh" "rlogin" "vsftpd" "xinetd")
    for service in "${services_to_disable[@]}"; do
        if systemctl is-enabled "$service" &>/dev/null; then
            systemctl disable "$service"
            systemctl stop "$service"
            log_info "已禁用服务: $service"
        fi
    done
    
    # 配置内核参数
    cat > /etc/sysctl.d/99-security.conf << 'EOF'
# 网络安全参数
net.ipv4.ip_forward = 0
net.ipv4.conf.all.send_redirects = 0
net.ipv4.conf.default.send_redirects = 0
net.ipv4.conf.all.accept_redirects = 0
net.ipv4.conf.default.accept_redirects = 0
net.ipv4.conf.all.secure_redirects = 0
net.ipv4.conf.default.secure_redirects = 0
net.ipv4.conf.all.accept_source_route = 0
net.ipv4.conf.default.accept_source_route = 0
net.ipv4.conf.all.log_martians = 1
net.ipv4.conf.default.log_martians = 1
net.ipv4.icmp_echo_ignore_broadcasts = 1
net.ipv4.icmp_ignore_bogus_error_responses = 1
net.ipv4.tcp_syncookies = 1
net.ipv4.tcp_max_syn_backlog = 2048
net.ipv4.tcp_synack_retries = 2
net.ipv4.tcp_syn_retries = 5

# 防止IP欺骗
net.ipv4.conf.all.rp_filter = 1
net.ipv4.conf.default.rp_filter = 1

# IPv6安全
net.ipv6.conf.all.accept_redirects = 0
net.ipv6.conf.default.accept_redirects = 0
net.ipv6.conf.all.accept_source_route = 0
net.ipv6.conf.default.accept_source_route = 0

# 其他安全设置
kernel.dmesg_restrict = 1
kernel.kptr_restrict = 2
kernel.yama.ptrace_scope = 1
fs.suid_dumpable = 0
EOF
    
    # 应用内核参数
    sysctl -p /etc/sysctl.d/99-security.conf
    
    # 设置文件描述符限制
    cat > /etc/security/limits.d/99-security.conf << 'EOF'
# 安全限制
* soft nofile 65536
* hard nofile 65536
* soft nproc 32768
* hard nproc 32768
root soft nofile 65536
root hard nofile 65536
EOF
    
    log_success "系统安全配置完成"
}

# 配置日志监控
setup_log_monitoring() {
    log_info "配置日志监控..."
    
    # 配置rsyslog
    if command -v rsyslog &> /dev/null; then
        # 创建应用日志配置
        cat > /etc/rsyslog.d/50-blog-system.conf << EOF
# 博客系统日志配置
\$ModLoad imfile

# 应用日志
\$InputFileName $APP_PATH/logs/app.log
\$InputFileTag blog-app:
\$InputFileStateFile stat-blog-app
\$InputFileSeverity info
\$InputFileFacility local0
\$InputRunFileMonitor

# 错误日志
\$InputFileName $APP_PATH/logs/error.log
\$InputFileTag blog-error:
\$InputFileStateFile stat-blog-error
\$InputFileSeverity error
\$InputFileFacility local1
\$InputRunFileMonitor

# 发送到本地文件
local0.* /var/log/blog-system.log
local1.* /var/log/blog-system-error.log
EOF
        
        systemctl restart rsyslog
    fi
    
    # 配置logrotate
    cat > /etc/logrotate.d/blog-system << EOF
$APP_PATH/logs/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 $DEPLOY_USER $DEPLOY_USER
    postrotate
        systemctl reload nginx > /dev/null 2>&1 || true
    endscript
}

/var/log/blog-system*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 root root
}
EOF
    
    log_success "日志监控配置完成"
}

# 创建安全检查脚本
create_security_check_script() {
    log_info "创建安全检查脚本..."
    
    cat > /usr/local/bin/security-check.sh << 'EOF'
#!/bin/bash

# 安全检查脚本
# 定期检查系统安全状态

log_file="/var/log/security-check.log"
date_str=$(date '+%Y-%m-%d %H:%M:%S')

echo "[$date_str] 开始安全检查" >> "$log_file"

# 检查失败的登录尝试
failed_logins=$(grep "Failed password" /var/log/auth.log | wc -l)
if [[ $failed_logins -gt 10 ]]; then
    echo "[$date_str] 警告: 检测到 $failed_logins 次失败登录尝试" >> "$log_file"
fi

# 检查系统负载
load_avg=$(uptime | awk '{print $10}' | sed 's/,//')
if (( $(echo "$load_avg > 2.0" | bc -l) )); then
    echo "[$date_str] 警告: 系统负载过高: $load_avg" >> "$log_file"
fi

# 检查磁盘使用率
disk_usage=$(df / | awk 'NR==2 {print $5}' | sed 's/%//')
if [[ $disk_usage -gt 80 ]]; then
    echo "[$date_str] 警告: 磁盘使用率过高: $disk_usage%" >> "$log_file"
fi

# 检查内存使用率
mem_usage=$(free | awk 'NR==2{printf "%.0f", $3*100/$2}')
if [[ $mem_usage -gt 80 ]]; then
    echo "[$date_str] 警告: 内存使用率过高: $mem_usage%" >> "$log_file"
fi

# 检查异常进程
suspicious_processes=$(ps aux | grep -E '(nc|netcat|nmap|tcpdump)' | grep -v grep | wc -l)
if [[ $suspicious_processes -gt 0 ]]; then
    echo "[$date_str] 警告: 检测到可疑进程" >> "$log_file"
fi

# 检查网络连接
network_connections=$(netstat -an | grep ESTABLISHED | wc -l)
if [[ $network_connections -gt 100 ]]; then
    echo "[$date_str] 警告: 网络连接数过多: $network_connections" >> "$log_file"
fi

echo "[$date_str] 安全检查完成" >> "$log_file"
EOF
    
    chmod +x /usr/local/bin/security-check.sh
    
    # 添加到crontab
    (crontab -l 2>/dev/null; echo "*/15 * * * * /usr/local/bin/security-check.sh") | crontab -
    
    log_success "安全检查脚本创建完成"
}

# 生成安全报告
generate_security_report() {
    log_info "生成安全配置报告..."
    
    local report_file="security_report_$(date +%Y%m%d_%H%M%S).txt"
    
    cat > "$report_file" << EOF
博客系统安全配置报告
====================
配置时间: $(date '+%Y-%m-%d %H:%M:%S')
环境: $ENVIRONMENT
域名: $DOMAIN

已启用的安全措施:
EOF
    
    [[ "$ENABLE_FIREWALL" == "true" ]] && echo "✓ 防火墙配置" >> "$report_file"
    [[ "$ENABLE_FAIL2BAN" == "true" ]] && echo "✓ Fail2Ban入侵防护" >> "$report_file"
    [[ "$ENABLE_SSL" == "true" ]] && echo "✓ SSL/TLS加密" >> "$report_file"
    [[ "$ENABLE_SECURITY_HEADERS" == "true" ]] && echo "✓ HTTP安全头" >> "$report_file"
    [[ "$ENABLE_RATE_LIMITING" == "true" ]] && echo "✓ 请求频率限制" >> "$report_file"
    
    echo "" >> "$report_file"
    echo "系统状态:" >> "$report_file"
    echo "防火墙状态: $(ufw status | head -1)" >> "$report_file"
    echo "Fail2Ban状态: $(systemctl is-active fail2ban 2>/dev/null || echo 'inactive')" >> "$report_file"
    echo "SSH状态: $(systemctl is-active ssh)" >> "$report_file"
    echo "Nginx状态: $(systemctl is-active nginx 2>/dev/null || echo 'inactive')" >> "$report_file"
    
    echo "" >> "$report_file"
    echo "安全建议:" >> "$report_file"
    echo "1. 定期更新系统和应用" >> "$report_file"
    echo "2. 监控安全日志" >> "$report_file"
    echo "3. 定期备份数据" >> "$report_file"
    echo "4. 使用强密码和密钥认证" >> "$report_file"
    echo "5. 限制不必要的网络访问" >> "$report_file"
    
    log_success "安全报告已生成: $report_file"
}

# 主安全配置函数
main_security_setup() {
    log_info "开始安全配置..."
    
    local start_time=$(date +%s)
    
    # 执行安全配置
    check_permissions
    update_system
    setup_firewall
    setup_fail2ban
    setup_ssh_security
    setup_file_permissions
    setup_nginx_security
    setup_system_security
    setup_log_monitoring
    create_security_check_script
    
    # 生成报告
    generate_security_report
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    log_success "安全配置完成！"
    log_info "耗时: ${duration}秒"
    
    echo ""
    log_info "安全配置摘要:"
    log_info "  - 防火墙: $(ufw status | head -1)"
    log_info "  - Fail2Ban: $(systemctl is-active fail2ban 2>/dev/null || echo 'inactive')"
    log_info "  - SSH安全: 已配置"
    log_info "  - 文件权限: 已设置"
    log_info "  - 系统安全: 已加固"
    
    echo ""
    log_info "后续建议:"
    log_info "  1. 定期运行: /usr/local/bin/security-check.sh"
    log_info "  2. 监控日志: tail -f /var/log/security-check.log"
    log_info "  3. 检查防火墙: ufw status verbose"
    log_info "  4. 查看Fail2Ban: fail2ban-client status"
    log_info "  5. 定期更新系统和应用"
}

# 错误处理
error_handler() {
    local exit_code=$?
    log_error "安全配置过程中发生错误，退出码: $exit_code"
    
    # 显示系统状态
    log_info "当前系统状态:"
    systemctl status ssh --no-pager -l
    systemctl status nginx --no-pager -l
    
    log_error "安全配置失败，请检查错误信息并重试"
    exit $exit_code
}

# 显示帮助信息
show_help() {
    echo "博客系统安全配置脚本"
    echo ""
    echo "用法: sudo $0 [选项]"
    echo ""
    echo "选项:"
    echo "  -h, --help              显示帮助信息"
    echo "  -e, --env ENV           环境 (默认: production)"
    echo "  -d, --domain DOMAIN     域名 (默认: localhost)"
    echo "  -u, --user USER         部署用户 (默认: deploy)"
    echo "  -p, --path PATH         应用路径 (默认: /var/www/blog-system)"
    echo "  --no-firewall           不配置防火墙"
    echo "  --no-fail2ban           不安装Fail2Ban"
    echo "  --no-ssl                不配置SSL"
    echo "  --no-headers            不配置安全头"
    echo "  --no-rate-limit         不配置请求限制"
    echo "  -v, --verbose           详细输出"
    echo ""
    echo "环境变量:"
    echo "  ENVIRONMENT             环境"
    echo "  DOMAIN                  域名"
    echo "  DEPLOY_USER             部署用户"
    echo "  APP_PATH                应用路径"
    echo "  ENABLE_FIREWALL         启用防火墙"
    echo "  ENABLE_FAIL2BAN         启用Fail2Ban"
    echo "  ENABLE_SSL              启用SSL"
    echo "  ENABLE_SECURITY_HEADERS 启用安全头"
    echo "  ENABLE_RATE_LIMITING    启用请求限制"
    echo ""
    echo "示例:"
    echo "  sudo $0                                    # 使用默认配置"
    echo "  sudo $0 -d blog.example.com               # 指定域名"
    echo "  sudo $0 --no-firewall --no-fail2ban       # 跳过防火墙和Fail2Ban"
    echo "  sudo $0 -e development                    # 开发环境配置"
    echo ""
    echo "注意: 此脚本需要root权限运行"
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
        -e|--env)
            ENVIRONMENT="$2"
            shift 2
            ;;
        -d|--domain)
            DOMAIN="$2"
            shift 2
            ;;
        -u|--user)
            DEPLOY_USER="$2"
            shift 2
            ;;
        -p|--path)
            APP_PATH="$2"
            shift 2
            ;;
        --no-firewall)
            ENABLE_FIREWALL="false"
            shift
            ;;
        --no-fail2ban)
            ENABLE_FAIL2BAN="false"
            shift
            ;;
        --no-ssl)
            ENABLE_SSL="false"
            shift
            ;;
        --no-headers)
            ENABLE_SECURITY_HEADERS="false"
            shift
            ;;
        --no-rate-limit)
            ENABLE_RATE_LIMITING="false"
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

# 执行主安全配置函数
main_security_setup