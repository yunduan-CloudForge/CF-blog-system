#!/bin/bash

# SSL证书生成脚本
# 支持自签名证书和Let's Encrypt证书

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
SSL_DIR="./docker/ssl"
CONFIG_FILE="./docker/ssl-config.conf"
DOMAIN="${1:-localhost}"
EMAIL="${2:-admin@example.com}"
ENVIRONMENT="${3:-development}"

# 创建SSL目录
create_ssl_directory() {
    log_info "创建SSL证书目录..."
    mkdir -p "$SSL_DIR"
    chmod 755 "$SSL_DIR"
    log_success "SSL目录创建完成: $SSL_DIR"
}

# 生成自签名证书（开发环境）
generate_self_signed_cert() {
    log_info "生成自签名SSL证书..."
    
    # 生成私钥
    openssl genrsa -out "$SSL_DIR/private.key" 2048
    chmod 600 "$SSL_DIR/private.key"
    
    # 生成证书签名请求
    openssl req -new -key "$SSL_DIR/private.key" -out "$SSL_DIR/cert.csr" -config "$CONFIG_FILE"
    
    # 生成自签名证书
    openssl x509 -req -in "$SSL_DIR/cert.csr" -signkey "$SSL_DIR/private.key" -out "$SSL_DIR/cert.crt" -days 365 -extensions v3_req -extfile "$CONFIG_FILE"
    
    # 创建证书链文件
    cp "$SSL_DIR/cert.crt" "$SSL_DIR/fullchain.pem"
    cp "$SSL_DIR/private.key" "$SSL_DIR/privkey.pem"
    
    # 设置权限
    chmod 644 "$SSL_DIR/cert.crt" "$SSL_DIR/fullchain.pem"
    chmod 600 "$SSL_DIR/private.key" "$SSL_DIR/privkey.pem"
    
    # 清理临时文件
    rm -f "$SSL_DIR/cert.csr"
    
    log_success "自签名证书生成完成"
    log_info "证书文件位置:"
    log_info "  - 证书: $SSL_DIR/cert.crt"
    log_info "  - 私钥: $SSL_DIR/private.key"
    log_info "  - 证书链: $SSL_DIR/fullchain.pem"
}

# 生成Let's Encrypt证书（生产环境）
generate_letsencrypt_cert() {
    log_info "使用Let's Encrypt生成SSL证书..."
    
    # 检查certbot是否安装
    if ! command -v certbot &> /dev/null; then
        log_error "certbot未安装，请先安装certbot"
        log_info "Ubuntu/Debian: sudo apt-get install certbot"
        log_info "CentOS/RHEL: sudo yum install certbot"
        log_info "macOS: brew install certbot"
        exit 1
    fi
    
    # 生成证书
    certbot certonly \
        --standalone \
        --non-interactive \
        --agree-tos \
        --email "$EMAIL" \
        -d "$DOMAIN" \
        --cert-path "$SSL_DIR/cert.crt" \
        --key-path "$SSL_DIR/private.key" \
        --fullchain-path "$SSL_DIR/fullchain.pem" \
        --chain-path "$SSL_DIR/chain.pem"
    
    # 复制证书到SSL目录
    cp "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" "$SSL_DIR/"
    cp "/etc/letsencrypt/live/$DOMAIN/privkey.pem" "$SSL_DIR/"
    cp "/etc/letsencrypt/live/$DOMAIN/cert.pem" "$SSL_DIR/cert.crt"
    cp "/etc/letsencrypt/live/$DOMAIN/privkey.pem" "$SSL_DIR/private.key"
    
    # 设置权限
    chmod 644 "$SSL_DIR/fullchain.pem" "$SSL_DIR/cert.crt"
    chmod 600 "$SSL_DIR/privkey.pem" "$SSL_DIR/private.key"
    
    log_success "Let's Encrypt证书生成完成"
}

# 验证证书
verify_certificate() {
    log_info "验证SSL证书..."
    
    if [[ -f "$SSL_DIR/cert.crt" && -f "$SSL_DIR/private.key" ]]; then
        # 检查证书有效性
        openssl x509 -in "$SSL_DIR/cert.crt" -text -noout > /dev/null 2>&1
        if [[ $? -eq 0 ]]; then
            log_success "证书验证通过"
            
            # 显示证书信息
            log_info "证书信息:"
            openssl x509 -in "$SSL_DIR/cert.crt" -subject -dates -noout
        else
            log_error "证书验证失败"
            exit 1
        fi
    else
        log_error "证书文件不存在"
        exit 1
    fi
}

# 创建证书更新脚本
create_renewal_script() {
    log_info "创建证书更新脚本..."
    
    cat > "./scripts/renew-ssl.sh" << 'EOF'
#!/bin/bash

# SSL证书更新脚本

set -e

# 更新Let's Encrypt证书
if [[ "$ENVIRONMENT" == "production" ]]; then
    certbot renew --quiet
    
    # 重启Nginx
    docker-compose exec nginx nginx -s reload
    
    echo "SSL证书更新完成"
else
    echo "开发环境使用自签名证书，无需更新"
fi
EOF
    
    chmod +x "./scripts/renew-ssl.sh"
    log_success "证书更新脚本创建完成"
}

# 主函数
main() {
    log_info "开始生成SSL证书..."
    log_info "域名: $DOMAIN"
    log_info "邮箱: $EMAIL"
    log_info "环境: $ENVIRONMENT"
    
    # 创建SSL目录
    create_ssl_directory
    
    # 根据环境生成证书
    if [[ "$ENVIRONMENT" == "production" ]]; then
        generate_letsencrypt_cert
    else
        generate_self_signed_cert
    fi
    
    # 验证证书
    verify_certificate
    
    # 创建更新脚本
    create_renewal_script
    
    log_success "SSL证书配置完成！"
    
    if [[ "$ENVIRONMENT" == "development" ]]; then
        log_warning "开发环境使用自签名证书，浏览器可能显示安全警告"
        log_info "可以在浏览器中添加安全例外来继续访问"
    fi
}

# 显示帮助信息
show_help() {
    echo "SSL证书生成脚本"
    echo ""
    echo "用法: $0 [域名] [邮箱] [环境]"
    echo ""
    echo "参数:"
    echo "  域名     - SSL证书的域名 (默认: localhost)"
    echo "  邮箱     - Let's Encrypt注册邮箱 (默认: admin@example.com)"
    echo "  环境     - development 或 production (默认: development)"
    echo ""
    echo "示例:"
    echo "  $0                                    # 生成localhost的自签名证书"
    echo "  $0 blog.example.com                   # 生成指定域名的自签名证书"
    echo "  $0 blog.example.com admin@example.com production  # 生成生产环境Let's Encrypt证书"
    echo ""
}

# 检查参数
if [[ "$1" == "-h" || "$1" == "--help" ]]; then
    show_help
    exit 0
fi

# 执行主函数
main