#!/bin/bash

# 部署测试脚本
# 用于测试和验证博客系统的部署流程和生产环境稳定性

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
TEST_TYPE="${TEST_TYPE:-full}"
ENVIRONMENT="${ENVIRONMENT:-production}"
BASE_URL="${BASE_URL:-http://localhost}"
SSL_URL="${SSL_URL:-https://localhost}"
API_ENDPOINT="${API_ENDPOINT:-$BASE_URL/api}"
TEST_TIMEOUT="${TEST_TIMEOUT:-30}"
LOAD_TEST_USERS="${LOAD_TEST_USERS:-10}"
LOAD_TEST_DURATION="${LOAD_TEST_DURATION:-60}"
DEPLOY_METHOD="${DEPLOY_METHOD:-docker}"
SKIP_LOAD_TEST="${SKIP_LOAD_TEST:-false}"
SKIP_SECURITY_TEST="${SKIP_SECURITY_TEST:-false}"

# 测试结果统计
TEST_PASSED=0
TEST_FAILED=0
TEST_WARNINGS=0

# 测试结果数组
declare -a TEST_RESULTS

# 添加测试结果
add_test_result() {
    local test_name="$1"
    local status="$2"
    local message="$3"
    
    TEST_RESULTS+=("$test_name|$status|$message")
    
    case $status in
        "PASS")
            ((TEST_PASSED++))
            log_success "$test_name: $message"
            ;;
        "FAIL")
            ((TEST_FAILED++))
            log_error "$test_name: $message"
            ;;
        "WARN")
            ((TEST_WARNINGS++))
            log_warning "$test_name: $message"
            ;;
    esac
}

# 检查必要工具
check_prerequisites() {
    log_info "检查测试工具..."
    
    local required_tools=("curl" "jq")
    local missing_tools=()
    
    for tool in "${required_tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            missing_tools+=("$tool")
        fi
    done
    
    if [[ ${#missing_tools[@]} -gt 0 ]]; then
        log_error "缺少必要工具: ${missing_tools[*]}"
        log_info "请安装缺少的工具后重试"
        exit 1
    fi
    
    # 检查可选工具
    local optional_tools=("ab" "wrk" "nmap" "sqlmap")
    for tool in "${optional_tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            log_warning "可选工具未安装: $tool（某些测试可能跳过）"
        fi
    done
    
    log_success "工具检查完成"
}

# 测试服务可用性
test_service_availability() {
    log_info "测试服务可用性..."
    
    # 测试HTTP连接
    if curl -f -s --max-time "$TEST_TIMEOUT" "$BASE_URL/health" > /dev/null; then
        add_test_result "HTTP连接" "PASS" "服务响应正常"
    else
        add_test_result "HTTP连接" "FAIL" "无法连接到 $BASE_URL"
    fi
    
    # 测试HTTPS连接（如果启用）
    if [[ "$SSL_URL" != "$BASE_URL" ]]; then
        if curl -f -s -k --max-time "$TEST_TIMEOUT" "$SSL_URL/health" > /dev/null; then
            add_test_result "HTTPS连接" "PASS" "SSL服务响应正常"
        else
            add_test_result "HTTPS连接" "FAIL" "无法连接到 $SSL_URL"
        fi
    fi
    
    # 测试API端点
    if curl -f -s --max-time "$TEST_TIMEOUT" "$API_ENDPOINT/health" > /dev/null; then
        add_test_result "API端点" "PASS" "API服务响应正常"
    else
        add_test_result "API端点" "FAIL" "API端点无响应"
    fi
}

# 测试API功能
test_api_functionality() {
    log_info "测试API功能..."
    
    # 测试获取文章列表
    local articles_response=$(curl -s --max-time "$TEST_TIMEOUT" "$API_ENDPOINT/articles")
    if [[ $? -eq 0 ]] && echo "$articles_response" | jq . > /dev/null 2>&1; then
        add_test_result "文章列表API" "PASS" "返回有效JSON数据"
    else
        add_test_result "文章列表API" "FAIL" "API响应无效"
    fi
    
    # 测试获取分类列表
    local categories_response=$(curl -s --max-time "$TEST_TIMEOUT" "$API_ENDPOINT/categories")
    if [[ $? -eq 0 ]] && echo "$categories_response" | jq . > /dev/null 2>&1; then
        add_test_result "分类列表API" "PASS" "返回有效JSON数据"
    else
        add_test_result "分类列表API" "FAIL" "API响应无效"
    fi
    
    # 测试搜索功能
    local search_response=$(curl -s --max-time "$TEST_TIMEOUT" "$API_ENDPOINT/articles/search?q=test")
    if [[ $? -eq 0 ]] && echo "$search_response" | jq . > /dev/null 2>&1; then
        add_test_result "搜索API" "PASS" "搜索功能正常"
    else
        add_test_result "搜索API" "WARN" "搜索功能可能有问题"
    fi
    
    # 测试管理员登录（如果有测试账号）
    if [[ -n "$TEST_ADMIN_EMAIL" && -n "$TEST_ADMIN_PASSWORD" ]]; then
        local login_data='{"email":"'$TEST_ADMIN_EMAIL'","password":"'$TEST_ADMIN_PASSWORD'"}'
        local login_response=$(curl -s -X POST \
            -H "Content-Type: application/json" \
            -d "$login_data" \
            --max-time "$TEST_TIMEOUT" \
            "$API_ENDPOINT/auth/login")
        
        if [[ $? -eq 0 ]] && echo "$login_response" | jq -r '.token' > /dev/null 2>&1; then
            add_test_result "管理员登录" "PASS" "登录功能正常"
        else
            add_test_result "管理员登录" "WARN" "无法测试登录功能（可能是测试账号问题）"
        fi
    else
        add_test_result "管理员登录" "WARN" "跳过登录测试（未配置测试账号）"
    fi
}

# 测试前端页面
test_frontend_pages() {
    log_info "测试前端页面..."
    
    local pages=("" "articles" "categories" "about" "admin")
    
    for page in "${pages[@]}"; do
        local url="$BASE_URL/$page"
        local response=$(curl -s -w "%{http_code}" --max-time "$TEST_TIMEOUT" "$url")
        local http_code=${response: -3}
        
        if [[ "$http_code" == "200" ]]; then
            add_test_result "页面-$page" "PASS" "页面加载正常 (HTTP $http_code)"
        elif [[ "$http_code" == "404" && "$page" == "admin" ]]; then
            add_test_result "页面-$page" "WARN" "管理页面可能需要认证"
        else
            add_test_result "页面-$page" "FAIL" "页面加载失败 (HTTP $http_code)"
        fi
    done
}

# 测试数据库连接
test_database_connection() {
    log_info "测试数据库连接..."
    
    # 检查数据库文件
    local db_paths=("./data/blog.db" "/var/www/blog-system/data/blog.db")
    local db_found=false
    
    for db_path in "${db_paths[@]}"; do
        if [[ -f "$db_path" ]]; then
            db_found=true
            
            # 测试数据库完整性
            if sqlite3 "$db_path" "PRAGMA integrity_check;" | grep -q "ok"; then
                add_test_result "数据库完整性" "PASS" "数据库文件完整"
            else
                add_test_result "数据库完整性" "FAIL" "数据库文件损坏"
            fi
            
            # 检查表结构
            local table_count=$(sqlite3 "$db_path" "SELECT COUNT(*) FROM sqlite_master WHERE type='table';")
            if [[ $table_count -gt 0 ]]; then
                add_test_result "数据库表" "PASS" "发现 $table_count 个表"
            else
                add_test_result "数据库表" "FAIL" "数据库中没有表"
            fi
            
            break
        fi
    done
    
    if [[ "$db_found" == "false" ]]; then
        add_test_result "数据库文件" "FAIL" "未找到数据库文件"
    fi
}

# 测试文件上传功能
test_file_upload() {
    log_info "测试文件上传功能..."
    
    # 检查上传目录
    local upload_paths=("./uploads" "/var/www/blog-system/uploads")
    local upload_found=false
    
    for upload_path in "${upload_paths[@]}"; do
        if [[ -d "$upload_path" ]]; then
            upload_found=true
            
            # 检查目录权限
            if [[ -w "$upload_path" ]]; then
                add_test_result "上传目录权限" "PASS" "上传目录可写"
            else
                add_test_result "上传目录权限" "FAIL" "上传目录不可写"
            fi
            
            # 检查磁盘空间
            local available_space=$(df "$upload_path" | awk 'NR==2 {print $4}')
            if [[ $available_space -gt 1048576 ]]; then  # 1GB
                add_test_result "磁盘空间" "PASS" "可用空间充足"
            else
                add_test_result "磁盘空间" "WARN" "可用空间不足1GB"
            fi
            
            break
        fi
    done
    
    if [[ "$upload_found" == "false" ]]; then
        add_test_result "上传目录" "FAIL" "未找到上传目录"
    fi
}

# 测试SSL证书
test_ssl_certificate() {
    if [[ "$SSL_URL" == "$BASE_URL" ]]; then
        add_test_result "SSL证书" "WARN" "未启用HTTPS"
        return
    fi
    
    log_info "测试SSL证书..."
    
    # 检查证书有效性
    local cert_info=$(echo | openssl s_client -servername "$(echo "$SSL_URL" | sed 's|https://||')" -connect "$(echo "$SSL_URL" | sed 's|https://||'):443" 2>/dev/null | openssl x509 -noout -dates 2>/dev/null)
    
    if [[ $? -eq 0 ]]; then
        # 检查证书过期时间
        local not_after=$(echo "$cert_info" | grep "notAfter" | cut -d= -f2)
        local expire_date=$(date -d "$not_after" +%s 2>/dev/null || echo "0")
        local current_date=$(date +%s)
        local days_until_expire=$(( (expire_date - current_date) / 86400 ))
        
        if [[ $days_until_expire -gt 30 ]]; then
            add_test_result "SSL证书" "PASS" "证书有效，$days_until_expire 天后过期"
        elif [[ $days_until_expire -gt 0 ]]; then
            add_test_result "SSL证书" "WARN" "证书即将过期，$days_until_expire 天后过期"
        else
            add_test_result "SSL证书" "FAIL" "证书已过期"
        fi
    else
        add_test_result "SSL证书" "FAIL" "无法获取证书信息"
    fi
}

# 性能测试
test_performance() {
    log_info "测试系统性能..."
    
    # 测试响应时间
    local response_time=$(curl -o /dev/null -s -w "%{time_total}" --max-time "$TEST_TIMEOUT" "$BASE_URL")
    local response_ms=$(echo "$response_time * 1000" | bc -l | cut -d. -f1)
    
    if [[ $response_ms -lt 1000 ]]; then
        add_test_result "响应时间" "PASS" "${response_ms}ms (优秀)"
    elif [[ $response_ms -lt 3000 ]]; then
        add_test_result "响应时间" "PASS" "${response_ms}ms (良好)"
    elif [[ $response_ms -lt 5000 ]]; then
        add_test_result "响应时间" "WARN" "${response_ms}ms (一般)"
    else
        add_test_result "响应时间" "FAIL" "${response_ms}ms (过慢)"
    fi
    
    # 测试并发性能（如果有ab工具）
    if command -v ab &> /dev/null && [[ "$SKIP_LOAD_TEST" != "true" ]]; then
        log_info "执行负载测试..."
        
        local ab_result=$(ab -n 100 -c 10 -q "$BASE_URL/" 2>/dev/null)
        local requests_per_sec=$(echo "$ab_result" | grep "Requests per second" | awk '{print $4}')
        
        if [[ -n "$requests_per_sec" ]]; then
            local rps_int=$(echo "$requests_per_sec" | cut -d. -f1)
            if [[ $rps_int -gt 100 ]]; then
                add_test_result "并发性能" "PASS" "${requests_per_sec} req/s (优秀)"
            elif [[ $rps_int -gt 50 ]]; then
                add_test_result "并发性能" "PASS" "${requests_per_sec} req/s (良好)"
            elif [[ $rps_int -gt 20 ]]; then
                add_test_result "并发性能" "WARN" "${requests_per_sec} req/s (一般)"
            else
                add_test_result "并发性能" "FAIL" "${requests_per_sec} req/s (过低)"
            fi
        else
            add_test_result "并发性能" "WARN" "无法获取性能数据"
        fi
    else
        add_test_result "并发性能" "WARN" "跳过负载测试"
    fi
}

# 安全测试
test_security() {
    if [[ "$SKIP_SECURITY_TEST" == "true" ]]; then
        add_test_result "安全测试" "WARN" "跳过安全测试"
        return
    fi
    
    log_info "测试安全配置..."
    
    # 测试HTTP安全头
    local headers=$(curl -s -I --max-time "$TEST_TIMEOUT" "$BASE_URL")
    
    if echo "$headers" | grep -qi "X-Frame-Options"; then
        add_test_result "X-Frame-Options" "PASS" "已设置防点击劫持头"
    else
        add_test_result "X-Frame-Options" "WARN" "缺少X-Frame-Options头"
    fi
    
    if echo "$headers" | grep -qi "X-Content-Type-Options"; then
        add_test_result "X-Content-Type-Options" "PASS" "已设置MIME类型保护"
    else
        add_test_result "X-Content-Type-Options" "WARN" "缺少X-Content-Type-Options头"
    fi
    
    if echo "$headers" | grep -qi "X-XSS-Protection"; then
        add_test_result "X-XSS-Protection" "PASS" "已设置XSS保护"
    else
        add_test_result "X-XSS-Protection" "WARN" "缺少X-XSS-Protection头"
    fi
    
    # 测试HTTPS重定向
    if [[ "$SSL_URL" != "$BASE_URL" ]]; then
        local redirect_response=$(curl -s -I --max-time "$TEST_TIMEOUT" "$BASE_URL")
        if echo "$redirect_response" | grep -q "301\|302"; then
            add_test_result "HTTPS重定向" "PASS" "HTTP自动重定向到HTTPS"
        else
            add_test_result "HTTPS重定向" "WARN" "未配置HTTPS重定向"
        fi
    fi
    
    # 测试敏感文件访问
    local sensitive_files=(".env" "config.json" "package.json" "docker-compose.yml")
    for file in "${sensitive_files[@]}"; do
        local file_response=$(curl -s -w "%{http_code}" --max-time "$TEST_TIMEOUT" "$BASE_URL/$file")
        local file_code=${file_response: -3}
        
        if [[ "$file_code" == "404" || "$file_code" == "403" ]]; then
            add_test_result "敏感文件-$file" "PASS" "文件受保护 (HTTP $file_code)"
        else
            add_test_result "敏感文件-$file" "FAIL" "文件可访问 (HTTP $file_code)"
        fi
    done
}

# 测试容器状态（Docker部署）
test_docker_containers() {
    if [[ "$DEPLOY_METHOD" != "docker" ]]; then
        return
    fi
    
    log_info "测试Docker容器状态..."
    
    if ! command -v docker &> /dev/null; then
        add_test_result "Docker" "WARN" "Docker未安装或不可用"
        return
    fi
    
    # 检查容器状态
    local containers=("blog-frontend" "blog-backend" "blog-nginx")
    for container in "${containers[@]}"; do
        if docker ps | grep -q "$container.*Up"; then
            add_test_result "容器-$container" "PASS" "容器运行正常"
        else
            add_test_result "容器-$container" "FAIL" "容器未运行"
        fi
    done
    
    # 检查容器健康状态
    local unhealthy=$(docker ps --filter "health=unhealthy" --format "table {{.Names}}" | tail -n +2)
    if [[ -z "$unhealthy" ]]; then
        add_test_result "容器健康" "PASS" "所有容器健康检查通过"
    else
        add_test_result "容器健康" "FAIL" "发现不健康容器: $unhealthy"
    fi
    
    # 检查容器资源使用
    local high_cpu_containers=$(docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}" | awk 'NR>1 && $2+0 > 80 {print $1}')
    if [[ -z "$high_cpu_containers" ]]; then
        add_test_result "容器CPU" "PASS" "CPU使用率正常"
    else
        add_test_result "容器CPU" "WARN" "高CPU使用率容器: $high_cpu_containers"
    fi
}

# 测试PM2进程（传统部署）
test_pm2_processes() {
    if [[ "$DEPLOY_METHOD" != "traditional" ]]; then
        return
    fi
    
    log_info "测试PM2进程状态..."
    
    if ! command -v pm2 &> /dev/null; then
        add_test_result "PM2" "WARN" "PM2未安装或不可用"
        return
    fi
    
    # 检查PM2进程
    if pm2 list | grep -q "blog-backend.*online"; then
        add_test_result "PM2进程" "PASS" "后端进程运行正常"
    else
        add_test_result "PM2进程" "FAIL" "后端进程未运行"
    fi
    
    # 检查进程重启次数
    local restart_count=$(pm2 jlist | jq -r '.[] | select(.name=="blog-backend") | .pm2_env.restart_time' 2>/dev/null || echo "0")
    if [[ $restart_count -lt 5 ]]; then
        add_test_result "进程稳定性" "PASS" "重启次数: $restart_count"
    else
        add_test_result "进程稳定性" "WARN" "重启次数较多: $restart_count"
    fi
}

# 测试备份功能
test_backup_functionality() {
    log_info "测试备份功能..."
    
    # 检查备份脚本
    if [[ -f "scripts/backup.sh" ]]; then
        add_test_result "备份脚本" "PASS" "备份脚本存在"
        
        # 测试备份脚本语法
        if bash -n scripts/backup.sh; then
            add_test_result "备份脚本语法" "PASS" "脚本语法正确"
        else
            add_test_result "备份脚本语法" "FAIL" "脚本语法错误"
        fi
    else
        add_test_result "备份脚本" "FAIL" "备份脚本不存在"
    fi
    
    # 检查备份目录
    local backup_paths=("./backups" "/var/www/blog-system/backups")
    local backup_found=false
    
    for backup_path in "${backup_paths[@]}"; do
        if [[ -d "$backup_path" ]]; then
            backup_found=true
            
            # 检查备份文件
            local backup_count=$(find "$backup_path" -name "*.tar.gz" -mtime -7 | wc -l)
            if [[ $backup_count -gt 0 ]]; then
                add_test_result "备份文件" "PASS" "发现 $backup_count 个最近备份"
            else
                add_test_result "备份文件" "WARN" "没有最近的备份文件"
            fi
            
            break
        fi
    done
    
    if [[ "$backup_found" == "false" ]]; then
        add_test_result "备份目录" "FAIL" "未找到备份目录"
    fi
}

# 生成测试报告
generate_test_report() {
    log_info "生成测试报告..."
    
    local report_file="deployment_test_report_$(date +%Y%m%d_%H%M%S).html"
    
    cat > "$report_file" << EOF
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>博客系统部署测试报告</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background-color: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 30px; }
        .summary { display: flex; justify-content: space-around; margin-bottom: 30px; }
        .summary-item { text-align: center; padding: 20px; border-radius: 8px; }
        .pass { background-color: #d4edda; color: #155724; }
        .fail { background-color: #f8d7da; color: #721c24; }
        .warn { background-color: #fff3cd; color: #856404; }
        .test-results { margin-top: 20px; }
        .test-item { padding: 10px; margin: 5px 0; border-radius: 4px; display: flex; justify-content: space-between; }
        .test-name { font-weight: bold; }
        .test-message { color: #666; }
        .footer { margin-top: 30px; text-align: center; color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>博客系统部署测试报告</h1>
            <p>测试时间: $(date '+%Y-%m-%d %H:%M:%S')</p>
            <p>测试环境: $ENVIRONMENT</p>
            <p>部署方式: $DEPLOY_METHOD</p>
            <p>测试URL: $BASE_URL</p>
        </div>
        
        <div class="summary">
            <div class="summary-item pass">
                <h3>$TEST_PASSED</h3>
                <p>通过</p>
            </div>
            <div class="summary-item fail">
                <h3>$TEST_FAILED</h3>
                <p>失败</p>
            </div>
            <div class="summary-item warn">
                <h3>$TEST_WARNINGS</h3>
                <p>警告</p>
            </div>
        </div>
        
        <div class="test-results">
            <h2>测试结果详情</h2>
EOF
    
    # 添加测试结果
    for result in "${TEST_RESULTS[@]}"; do
        IFS='|' read -r test_name status message <<< "$result"
        local css_class=""
        case $status in
            "PASS") css_class="pass" ;;
            "FAIL") css_class="fail" ;;
            "WARN") css_class="warn" ;;
        esac
        
        cat >> "$report_file" << EOF
            <div class="test-item $css_class">
                <span class="test-name">$test_name</span>
                <span class="test-status">$status</span>
            </div>
            <div class="test-message">$message</div>
EOF
    done
    
    cat >> "$report_file" << EOF
        </div>
        
        <div class="footer">
            <p>报告生成时间: $(date '+%Y-%m-%d %H:%M:%S')</p>
            <p>总测试项: $((TEST_PASSED + TEST_FAILED + TEST_WARNINGS))</p>
        </div>
    </div>
</body>
</html>
EOF
    
    log_success "测试报告已生成: $report_file"
}

# 主测试函数
main_test() {
    log_info "开始部署测试..."
    
    local start_time=$(date +%s)
    
    # 执行测试
    check_prerequisites
    
    case $TEST_TYPE in
        "quick")
            test_service_availability
            test_api_functionality
            ;;
        "security")
            test_service_availability
            test_ssl_certificate
            test_security
            ;;
        "performance")
            test_service_availability
            test_performance
            ;;
        "full")
            test_service_availability
            test_api_functionality
            test_frontend_pages
            test_database_connection
            test_file_upload
            test_ssl_certificate
            test_performance
            test_security
            test_docker_containers
            test_pm2_processes
            test_backup_functionality
            ;;
        *)
            log_error "未知的测试类型: $TEST_TYPE"
            exit 1
            ;;
    esac
    
    # 生成报告
    generate_test_report
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    # 输出结果摘要
    echo ""
    log_info "测试完成！"
    log_info "耗时: ${duration}秒"
    log_info "总测试项: $((TEST_PASSED + TEST_FAILED + TEST_WARNINGS))"
    log_success "通过: $TEST_PASSED"
    
    if [[ $TEST_WARNINGS -gt 0 ]]; then
        log_warning "警告: $TEST_WARNINGS"
    fi
    
    if [[ $TEST_FAILED -gt 0 ]]; then
        log_error "失败: $TEST_FAILED"
        echo ""
        log_error "部署测试发现问题，请检查失败项并修复"
        return 1
    else
        echo ""
        log_success "所有关键测试通过，部署验证成功！"
        return 0
    fi
}

# 显示帮助信息
show_help() {
    echo "博客系统部署测试脚本"
    echo ""
    echo "用法: $0 [选项]"
    echo ""
    echo "选项:"
    echo "  -h, --help              显示帮助信息"
    echo "  -t, --type TYPE         测试类型 (quick|security|performance|full)"
    echo "  -e, --env ENV           环境 (默认: production)"
    echo "  -u, --url URL           基础URL (默认: http://localhost)"
    echo "  -s, --ssl-url URL       SSL URL (默认: https://localhost)"
    echo "  -m, --method METHOD     部署方式 (docker|traditional)"
    echo "  --timeout SECONDS       请求超时时间 (默认: 30)"
    echo "  --skip-load             跳过负载测试"
    echo "  --skip-security         跳过安全测试"
    echo "  -v, --verbose           详细输出"
    echo ""
    echo "测试类型:"
    echo "  quick                   快速测试（基本功能）"
    echo "  security                安全测试"
    echo "  performance             性能测试"
    echo "  full                    完整测试（默认）"
    echo ""
    echo "环境变量:"
    echo "  TEST_TYPE               测试类型"
    echo "  ENVIRONMENT             环境"
    echo "  BASE_URL                基础URL"
    echo "  SSL_URL                 SSL URL"
    echo "  DEPLOY_METHOD           部署方式"
    echo "  TEST_TIMEOUT            超时时间"
    echo "  SKIP_LOAD_TEST          跳过负载测试"
    echo "  SKIP_SECURITY_TEST      跳过安全测试"
    echo "  TEST_ADMIN_EMAIL        测试管理员邮箱"
    echo "  TEST_ADMIN_PASSWORD     测试管理员密码"
    echo ""
    echo "示例:"
    echo "  $0                                    # 完整测试"
    echo "  $0 -t quick                           # 快速测试"
    echo "  $0 -u http://blog.example.com         # 指定URL"
    echo "  $0 -m docker --skip-load              # Docker部署，跳过负载测试"
    echo "  $0 -t security -s https://blog.example.com  # 安全测试"
    echo ""
}

# 解析命令行参数
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_help
            exit 0
            ;;
        -t|--type)
            TEST_TYPE="$2"
            shift 2
            ;;
        -e|--env)
            ENVIRONMENT="$2"
            shift 2
            ;;
        -u|--url)
            BASE_URL="$2"
            API_ENDPOINT="$2/api"
            shift 2
            ;;
        -s|--ssl-url)
            SSL_URL="$2"
            shift 2
            ;;
        -m|--method)
            DEPLOY_METHOD="$2"
            shift 2
            ;;
        --timeout)
            TEST_TIMEOUT="$2"
            shift 2
            ;;
        --skip-load)
            SKIP_LOAD_TEST="true"
            shift
            ;;
        --skip-security)
            SKIP_SECURITY_TEST="true"
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

# 执行主测试函数
main_test