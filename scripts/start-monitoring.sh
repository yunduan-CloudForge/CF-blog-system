#!/bin/bash

# Blog System Monitoring Stack Startup Script
# This script starts the complete monitoring infrastructure

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
MONITORING_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../monitoring" && pwd)"
ENV_FILE="${MONITORING_DIR}/.env"
DOCKER_COMPOSE_FILE="${MONITORING_DIR}/docker-compose.monitoring.yml"
HEALTH_CHECK_TIMEOUT=300
HEALTH_CHECK_INTERVAL=10

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if Docker is running
check_docker() {
    print_status "Checking Docker status..."
    if ! docker info >/dev/null 2>&1; then
        print_error "Docker is not running. Please start Docker and try again."
        exit 1
    fi
    print_success "Docker is running"
}

# Function to check if Docker Compose is available
check_docker_compose() {
    print_status "Checking Docker Compose availability..."
    if ! command -v docker-compose >/dev/null 2>&1 && ! docker compose version >/dev/null 2>&1; then
        print_error "Docker Compose is not available. Please install Docker Compose."
        exit 1
    fi
    print_success "Docker Compose is available"
}

# Function to create environment file if it doesn't exist
setup_environment() {
    print_status "Setting up environment configuration..."
    
    if [ ! -f "$ENV_FILE" ]; then
        print_status "Creating environment file..."
        cat > "$ENV_FILE" << EOF
# Monitoring Environment Configuration
ENVIRONMENT=development

# Grafana Configuration
GRAFANA_ADMIN_USER=admin
GRAFANA_ADMIN_PASSWORD=admin123

# Elasticsearch Configuration (for Jaeger)
ES_USERNAME=
ES_PASSWORD=

# Alert Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=
SMTP_PASSWORD=
ALERT_EMAIL_TO=admin@example.com
ALERT_EMAIL_FROM=monitoring@example.com

# Slack Configuration (optional)
SLACK_WEBHOOK_URL=
SLACK_CHANNEL=#alerts

# PagerDuty Configuration (optional)
PAGERDUTY_INTEGRATION_KEY=

# External URLs
EXTERNAL_URL_GRAFANA=http://localhost:3000
EXTERNAL_URL_PROMETHEUS=http://localhost:9090
EXTERNAL_URL_ALERTMANAGER=http://localhost:9093
EXTERNAL_URL_JAEGER=http://localhost:16686
EXTERNAL_URL_LOKI=http://localhost:3100
EOF
        print_success "Environment file created at $ENV_FILE"
        print_warning "Please review and update the environment variables in $ENV_FILE"
    else
        print_success "Environment file already exists"
    fi
}

# Function to create necessary directories
setup_directories() {
    print_status "Creating necessary directories..."
    
    local dirs=(
        "${MONITORING_DIR}/prometheus/data"
        "${MONITORING_DIR}/grafana/data"
        "${MONITORING_DIR}/alertmanager/data"
        "${MONITORING_DIR}/loki/data"
        "${MONITORING_DIR}/elasticsearch/data"
        "/var/log/blog-frontend"
        "/var/log/blog-backend"
        "/var/log/metrics"
        "/var/log/security"
        "/var/log/audit"
    )
    
    for dir in "${dirs[@]}"; do
        if [ ! -d "$dir" ]; then
            mkdir -p "$dir"
            print_status "Created directory: $dir"
        fi
    done
    
    # Set proper permissions for log directories
    sudo chown -R $(id -u):$(id -g) /var/log/blog-* /var/log/metrics /var/log/security /var/log/audit 2>/dev/null || true
    
    print_success "Directories setup completed"
}

# Function to check if blog network exists
check_blog_network() {
    print_status "Checking blog network..."
    
    if ! docker network ls | grep -q "blog-system_blog-network"; then
        print_warning "Blog network not found. Creating blog-system_blog-network..."
        docker network create blog-system_blog-network || true
    fi
    
    print_success "Blog network is available"
}

# Function to start monitoring services
start_monitoring() {
    print_status "Starting monitoring services..."
    
    cd "$MONITORING_DIR"
    
    # Pull latest images
    print_status "Pulling latest Docker images..."
    if command -v docker-compose >/dev/null 2>&1; then
        docker-compose -f docker-compose.monitoring.yml pull
    else
        docker compose -f docker-compose.monitoring.yml pull
    fi
    
    # Start services
    print_status "Starting monitoring stack..."
    if command -v docker-compose >/dev/null 2>&1; then
        docker-compose -f docker-compose.monitoring.yml up -d
    else
        docker compose -f docker-compose.monitoring.yml up -d
    fi
    
    print_success "Monitoring services started"
}

# Function to wait for services to be healthy
wait_for_services() {
    print_status "Waiting for services to become healthy..."
    
    local services=("prometheus" "grafana" "alertmanager" "loki" "elasticsearch" "jaeger")
    local start_time=$(date +%s)
    
    for service in "${services[@]}"; do
        print_status "Checking health of $service..."
        
        local timeout=$((start_time + HEALTH_CHECK_TIMEOUT))
        while [ $(date +%s) -lt $timeout ]; do
            if docker ps --filter "name=blog-$service" --filter "health=healthy" | grep -q "blog-$service"; then
                print_success "$service is healthy"
                break
            elif docker ps --filter "name=blog-$service" --filter "health=unhealthy" | grep -q "blog-$service"; then
                print_error "$service is unhealthy"
                docker logs "blog-$service" --tail 20
                return 1
            else
                print_status "Waiting for $service to become healthy..."
                sleep $HEALTH_CHECK_INTERVAL
            fi
        done
        
        if [ $(date +%s) -ge $timeout ]; then
            print_error "Timeout waiting for $service to become healthy"
            docker logs "blog-$service" --tail 20
            return 1
        fi
    done
    
    print_success "All services are healthy"
}

# Function to display service URLs
show_service_urls() {
    print_success "Monitoring stack is ready!"
    echo
    echo "=== Service URLs ==="
    echo "Grafana Dashboard:    http://localhost:3000 (admin/admin123)"
    echo "Prometheus:           http://localhost:9090"
    echo "Alertmanager:         http://localhost:9093"
    echo "Jaeger Tracing:       http://localhost:16686"
    echo "Loki Logs:            http://localhost:3100"
    echo "Elasticsearch:        http://localhost:9200"
    echo "Node Exporter:        http://localhost:9100"
    echo "cAdvisor:             http://localhost:8080"
    echo "Blackbox Exporter:    http://localhost:9115"
    echo "Promtail:             http://localhost:9080"
    echo
    echo "=== Quick Commands ==="
    echo "View logs:            docker logs blog-<service-name>"
    echo "Stop monitoring:      ./scripts/stop-monitoring.sh"
    echo "Restart monitoring:   ./scripts/restart-monitoring.sh"
    echo "Check status:         ./scripts/monitoring-status.sh"
    echo
}

# Function to create sample log entries
create_sample_logs() {
    print_status "Creating sample log entries for testing..."
    
    # Frontend logs
    cat > /var/log/blog-frontend/access.log << EOF
{"timestamp":"$(date -Iseconds)","level":"info","message":"Page view","method":"GET","url":"/","status":200,"response_time":45,"user_agent":"Mozilla/5.0","ip":"127.0.0.1","user_id":null}
{"timestamp":"$(date -Iseconds)","level":"info","message":"Page view","method":"GET","url":"/posts","status":200,"response_time":32,"user_agent":"Mozilla/5.0","ip":"127.0.0.1","user_id":"user123"}
EOF
    
    # Backend logs
    cat > /var/log/blog-backend/app.log << EOF
{"timestamp":"$(date -Iseconds)","level":"info","message":"API request processed","method":"GET","route":"/api/posts","status_code":200,"response_time":25,"user_id":"user123","request_id":"req-$(date +%s)"}
{"timestamp":"$(date -Iseconds)","level":"info","message":"Database query executed","method":"POST","route":"/api/posts","status_code":201,"response_time":150,"user_id":"user123","request_id":"req-$(date +%s)"}
EOF
    
    # Metrics logs
    cat > /var/log/metrics/app-metrics.log << EOF
{"timestamp":"$(date -Iseconds)","level":"info","metric_name":"http_requests_total","metric_value":1,"labels":{"method":"GET","route":"/api/posts","status":"200"},"message":"HTTP request metric"}
{"timestamp":"$(date -Iseconds)","level":"info","metric_name":"response_time_seconds","metric_value":0.025,"labels":{"method":"GET","route":"/api/posts"},"message":"Response time metric"}
EOF
    
    print_success "Sample log entries created"
}

# Main execution
main() {
    echo "=== Blog System Monitoring Stack Startup ==="
    echo
    
    check_docker
    check_docker_compose
    setup_environment
    setup_directories
    check_blog_network
    start_monitoring
    
    # Wait a bit for services to start
    sleep 10
    
    wait_for_services
    create_sample_logs
    show_service_urls
    
    print_success "Monitoring stack startup completed successfully!"
}

# Handle script arguments
case "${1:-}" in
    --help|-h)
        echo "Usage: $0 [OPTIONS]"
        echo
        echo "Options:"
        echo "  --help, -h     Show this help message"
        echo "  --no-wait      Start services without waiting for health checks"
        echo "  --quiet        Suppress non-error output"
        echo
        exit 0
        ;;
    --no-wait)
        HEALTH_CHECK_TIMEOUT=0
        ;;
    --quiet)
        exec >/dev/null 2>&1
        ;;
esac

# Run main function
main "$@"