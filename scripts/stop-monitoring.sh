#!/bin/bash

# Blog System Monitoring Stack Stop Script
# This script safely stops the monitoring infrastructure

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
MONITORING_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../monitoring" && pwd)"
DOCKER_COMPOSE_FILE="${MONITORING_DIR}/docker-compose.monitoring.yml"
GRACEFUL_TIMEOUT=30

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
        print_error "Docker is not running. Cannot stop monitoring services."
        exit 1
    fi
    print_success "Docker is running"
}

# Function to check if monitoring services are running
check_monitoring_services() {
    print_status "Checking monitoring services status..."
    
    local services=("prometheus" "grafana" "alertmanager" "loki" "jaeger" "elasticsearch" "promtail" "node-exporter" "cadvisor" "blackbox-exporter")
    local running_services=()
    
    for service in "${services[@]}"; do
        if docker ps --filter "name=blog-$service" --format "table {{.Names}}" | grep -q "blog-$service"; then
            running_services+=("$service")
        fi
    done
    
    if [ ${#running_services[@]} -eq 0 ]; then
        print_warning "No monitoring services are currently running"
        return 1
    else
        print_status "Found ${#running_services[@]} running monitoring services: ${running_services[*]}"
        return 0
    fi
}

# Function to backup current metrics data
backup_metrics_data() {
    print_status "Creating backup of metrics data..."
    
    local backup_dir="${MONITORING_DIR}/backups/$(date +%Y%m%d_%H%M%S)"
    mkdir -p "$backup_dir"
    
    # Backup Prometheus data
    if docker ps --filter "name=blog-prometheus" --format "table {{.Names}}" | grep -q "blog-prometheus"; then
        print_status "Backing up Prometheus data..."
        docker exec blog-prometheus tar czf /tmp/prometheus-backup.tar.gz -C /prometheus . 2>/dev/null || true
        docker cp blog-prometheus:/tmp/prometheus-backup.tar.gz "$backup_dir/prometheus-data.tar.gz" 2>/dev/null || true
    fi
    
    # Backup Grafana data
    if docker ps --filter "name=blog-grafana" --format "table {{.Names}}" | grep -q "blog-grafana"; then
        print_status "Backing up Grafana data..."
        docker exec blog-grafana tar czf /tmp/grafana-backup.tar.gz -C /var/lib/grafana . 2>/dev/null || true
        docker cp blog-grafana:/tmp/grafana-backup.tar.gz "$backup_dir/grafana-data.tar.gz" 2>/dev/null || true
    fi
    
    # Backup Alertmanager data
    if docker ps --filter "name=blog-alertmanager" --format "table {{.Names}}" | grep -q "blog-alertmanager"; then
        print_status "Backing up Alertmanager data..."
        docker exec blog-alertmanager tar czf /tmp/alertmanager-backup.tar.gz -C /alertmanager . 2>/dev/null || true
        docker cp blog-alertmanager:/tmp/alertmanager-backup.tar.gz "$backup_dir/alertmanager-data.tar.gz" 2>/dev/null || true
    fi
    
    # Backup Loki data
    if docker ps --filter "name=blog-loki" --format "table {{.Names}}" | grep -q "blog-loki"; then
        print_status "Backing up Loki data..."
        docker exec blog-loki tar czf /tmp/loki-backup.tar.gz -C /loki . 2>/dev/null || true
        docker cp blog-loki:/tmp/loki-backup.tar.gz "$backup_dir/loki-data.tar.gz" 2>/dev/null || true
    fi
    
    if [ -f "$backup_dir/prometheus-data.tar.gz" ] || [ -f "$backup_dir/grafana-data.tar.gz" ]; then
        print_success "Metrics data backed up to: $backup_dir"
    else
        print_warning "No data was backed up (services may not be running or accessible)"
        rmdir "$backup_dir" 2>/dev/null || true
    fi
}

# Function to gracefully stop services
stop_monitoring_services() {
    print_status "Stopping monitoring services gracefully..."
    
    cd "$MONITORING_DIR"
    
    # Send SIGTERM to all services first
    print_status "Sending graceful shutdown signal to services..."
    if command -v docker-compose >/dev/null 2>&1; then
        docker-compose -f docker-compose.monitoring.yml stop --timeout $GRACEFUL_TIMEOUT
    else
        docker compose -f docker-compose.monitoring.yml stop --timeout $GRACEFUL_TIMEOUT
    fi
    
    # Wait a moment for services to stop
    sleep 5
    
    # Check if any services are still running
    local still_running=$(docker ps --filter "name=blog-" --format "table {{.Names}}" | grep "blog-" | wc -l)
    
    if [ "$still_running" -gt 0 ]; then
        print_warning "Some services are still running. Forcing shutdown..."
        if command -v docker-compose >/dev/null 2>&1; then
            docker-compose -f docker-compose.monitoring.yml down --timeout 10
        else
            docker compose -f docker-compose.monitoring.yml down --timeout 10
        fi
    fi
    
    print_success "Monitoring services stopped"
}

# Function to clean up resources
cleanup_resources() {
    print_status "Cleaning up resources..."
    
    # Remove any dangling containers
    local dangling_containers=$(docker ps -a --filter "name=blog-" --filter "status=exited" --format "table {{.Names}}" | grep "blog-" | wc -l)
    
    if [ "$dangling_containers" -gt 0 ]; then
        print_status "Removing stopped monitoring containers..."
        docker ps -a --filter "name=blog-" --filter "status=exited" --format "table {{.Names}}" | grep "blog-" | xargs docker rm 2>/dev/null || true
    fi
    
    # Clean up any orphaned networks (but keep the main monitoring network)
    print_status "Cleaning up orphaned networks..."
    docker network prune -f >/dev/null 2>&1 || true
    
    # Clean up any dangling images (optional)
    if [ "${CLEANUP_IMAGES:-false}" = "true" ]; then
        print_status "Cleaning up dangling images..."
        docker image prune -f >/dev/null 2>&1 || true
    fi
    
    print_success "Resource cleanup completed"
}

# Function to show final status
show_final_status() {
    print_status "Checking final status..."
    
    local remaining_services=$(docker ps --filter "name=blog-" --format "table {{.Names}}" | grep "blog-" | wc -l)
    
    if [ "$remaining_services" -eq 0 ]; then
        print_success "All monitoring services have been stopped successfully"
    else
        print_warning "Some monitoring services may still be running:"
        docker ps --filter "name=blog-" --format "table {{.Names}}\t{{.Status}}" | grep "blog-"
    fi
    
    echo
    echo "=== Monitoring Stack Status ==="
    echo "Services stopped: $(date)"
    echo "Data preserved in Docker volumes"
    echo "Backups available in: ${MONITORING_DIR}/backups/"
    echo
    echo "=== Quick Commands ==="
    echo "Start monitoring:     ./scripts/start-monitoring.sh"
    echo "Check status:         ./scripts/monitoring-status.sh"
    echo "View logs:            docker logs blog-<service-name>"
    echo "Remove all data:      docker volume prune"
    echo
}

# Function to handle emergency stop
emergency_stop() {
    print_warning "Emergency stop requested - forcing immediate shutdown"
    
    # Kill all monitoring containers immediately
    docker ps --filter "name=blog-" --format "table {{.Names}}" | grep "blog-" | xargs docker kill 2>/dev/null || true
    
    # Remove containers
    docker ps -a --filter "name=blog-" --format "table {{.Names}}" | grep "blog-" | xargs docker rm -f 2>/dev/null || true
    
    print_success "Emergency stop completed"
}

# Main execution
main() {
    echo "=== Blog System Monitoring Stack Stop ==="
    echo
    
    check_docker
    
    if ! check_monitoring_services; then
        print_success "No monitoring services to stop"
        exit 0
    fi
    
    # Create backup unless explicitly disabled
    if [ "${SKIP_BACKUP:-false}" != "true" ]; then
        backup_metrics_data
    fi
    
    stop_monitoring_services
    cleanup_resources
    show_final_status
    
    print_success "Monitoring stack stop completed successfully!"
}

# Handle script arguments
case "${1:-}" in
    --help|-h)
        echo "Usage: $0 [OPTIONS]"
        echo
        echo "Options:"
        echo "  --help, -h         Show this help message"
        echo "  --emergency        Force immediate shutdown without graceful stop"
        echo "  --no-backup        Skip data backup before stopping"
        echo "  --cleanup-images   Also remove dangling Docker images"
        echo "  --quiet            Suppress non-error output"
        echo
        exit 0
        ;;
    --emergency)
        check_docker
        emergency_stop
        exit 0
        ;;
    --no-backup)
        SKIP_BACKUP=true
        ;;
    --cleanup-images)
        CLEANUP_IMAGES=true
        ;;
    --quiet)
        exec >/dev/null 2>&1
        ;;
esac

# Run main function
main "$@"