#!/bin/bash

# Blog System Monitoring Stack Status Script
# This script checks the status and health of all monitoring services

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
MONITORING_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../monitoring" && pwd)"
DOCKER_COMPOSE_FILE="${MONITORING_DIR}/docker-compose.monitoring.yml"

# Service definitions
declare -A SERVICES=(
    ["prometheus"]="9090:/metrics"
    ["grafana"]="3000:/api/health"
    ["alertmanager"]="9093:/-/healthy"
    ["loki"]="3100:/ready"
    ["jaeger"]="16686:/"
    ["elasticsearch"]="9200:/_cluster/health"
    ["promtail"]="9080:/ready"
    ["node-exporter"]="9100:/metrics"
    ["cadvisor"]="8080:/healthz"
    ["blackbox-exporter"]="9115:/"
)

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

print_header() {
    echo -e "${PURPLE}=== $1 ===${NC}"
}

print_subheader() {
    echo -e "${CYAN}--- $1 ---${NC}"
}

# Function to check if Docker is running
check_docker() {
    if ! docker info >/dev/null 2>&1; then
        print_error "Docker is not running"
        return 1
    fi
    return 0
}

# Function to get container status
get_container_status() {
    local service_name="$1"
    local container_name="blog-$service_name"
    
    if docker ps --filter "name=$container_name" --format "table {{.Names}}" | grep -q "$container_name"; then
        echo "running"
    elif docker ps -a --filter "name=$container_name" --format "table {{.Names}}" | grep -q "$container_name"; then
        echo "stopped"
    else
        echo "not_found"
    fi
}

# Function to get container health
get_container_health() {
    local service_name="$1"
    local container_name="blog-$service_name"
    
    local health=$(docker inspect --format='{{.State.Health.Status}}' "$container_name" 2>/dev/null || echo "none")
    echo "$health"
}

# Function to check service endpoint
check_service_endpoint() {
    local service_name="$1"
    local port_path="${SERVICES[$service_name]}"
    local port="${port_path%:*}"
    local path="${port_path#*:}"
    
    if curl -s -f "http://localhost:$port$path" >/dev/null 2>&1; then
        echo "healthy"
    else
        echo "unhealthy"
    fi
}

# Function to get container resource usage
get_container_resources() {
    local service_name="$1"
    local container_name="blog-$service_name"
    
    if docker ps --filter "name=$container_name" --format "table {{.Names}}" | grep -q "$container_name"; then
        local stats=$(docker stats --no-stream --format "table {{.CPUPerc}}\t{{.MemUsage}}" "$container_name" 2>/dev/null | tail -n 1)
        echo "$stats"
    else
        echo "N/A\tN/A"
    fi
}

# Function to get container uptime
get_container_uptime() {
    local service_name="$1"
    local container_name="blog-$service_name"
    
    if docker ps --filter "name=$container_name" --format "table {{.Names}}" | grep -q "$container_name"; then
        local created=$(docker inspect --format='{{.State.StartedAt}}' "$container_name" 2>/dev/null)
        if [ -n "$created" ]; then
            local start_time=$(date -d "$created" +%s 2>/dev/null || echo "0")
            local current_time=$(date +%s)
            local uptime=$((current_time - start_time))
            
            if [ $uptime -gt 86400 ]; then
                echo "$((uptime / 86400))d $((uptime % 86400 / 3600))h"
            elif [ $uptime -gt 3600 ]; then
                echo "$((uptime / 3600))h $((uptime % 3600 / 60))m"
            else
                echo "$((uptime / 60))m $((uptime % 60))s"
            fi
        else
            echo "unknown"
        fi
    else
        echo "N/A"
    fi
}

# Function to display service status table
show_service_status() {
    print_header "Service Status Overview"
    
    printf "%-18s %-10s %-12s %-12s %-15s %-12s %s\n" "SERVICE" "STATUS" "HEALTH" "ENDPOINT" "CPU/MEM" "UPTIME" "PORT"
    printf "%-18s %-10s %-12s %-12s %-15s %-12s %s\n" "-------" "------" "------" "--------" "-------" "------" "----"
    
    for service in "${!SERVICES[@]}"; do
        local status=$(get_container_status "$service")
        local health=$(get_container_health "$service")
        local endpoint=$(check_service_endpoint "$service")
        local resources=$(get_container_resources "$service")
        local uptime=$(get_container_uptime "$service")
        local port="${SERVICES[$service]%:*}"
        
        # Color coding for status
        case $status in
            "running")
                status="${GREEN}running${NC}"
                ;;
            "stopped")
                status="${RED}stopped${NC}"
                ;;
            "not_found")
                status="${YELLOW}missing${NC}"
                ;;
        esac
        
        # Color coding for health
        case $health in
            "healthy")
                health="${GREEN}healthy${NC}"
                ;;
            "unhealthy")
                health="${RED}unhealthy${NC}"
                ;;
            "starting")
                health="${YELLOW}starting${NC}"
                ;;
            "none")
                health="${YELLOW}no-check${NC}"
                ;;
        esac
        
        # Color coding for endpoint
        case $endpoint in
            "healthy")
                endpoint="${GREEN}healthy${NC}"
                ;;
            "unhealthy")
                endpoint="${RED}unhealthy${NC}"
                ;;
        esac
        
        printf "%-28s %-20s %-22s %-22s %-15s %-12s %s\n" "$service" "$status" "$health" "$endpoint" "$resources" "$uptime" "$port"
    done
    
    echo
}

# Function to show detailed service information
show_service_details() {
    print_header "Detailed Service Information"
    
    for service in "${!SERVICES[@]}"; do
        print_subheader "$service"
        
        local container_name="blog-$service"
        local status=$(get_container_status "$service")
        
        if [ "$status" = "running" ]; then
            echo "Container ID: $(docker ps --filter "name=$container_name" --format "{{.ID}}")"
            echo "Image: $(docker inspect --format='{{.Config.Image}}' "$container_name" 2>/dev/null)"
            echo "Started: $(docker inspect --format='{{.State.StartedAt}}' "$container_name" 2>/dev/null | cut -d'T' -f1,2 | tr 'T' ' ')"
            echo "Ports: $(docker port "$container_name" 2>/dev/null | tr '\n' ' ')"
            
            # Show recent logs (last 5 lines)
            echo "Recent logs:"
            docker logs --tail 5 "$container_name" 2>/dev/null | sed 's/^/  /'
        elif [ "$status" = "stopped" ]; then
            echo "Container is stopped"
            echo "Exit code: $(docker inspect --format='{{.State.ExitCode}}' "$container_name" 2>/dev/null)"
            echo "Finished: $(docker inspect --format='{{.State.FinishedAt}}' "$container_name" 2>/dev/null | cut -d'T' -f1,2 | tr 'T' ' ')"
        else
            echo "Container not found"
        fi
        
        echo
    done
}

# Function to show network information
show_network_info() {
    print_header "Network Information"
    
    # Check monitoring network
    if docker network ls | grep -q "blog-monitoring"; then
        print_success "Monitoring network (blog-monitoring) exists"
        echo "Network details:"
        docker network inspect blog-monitoring --format '  Subnet: {{range .IPAM.Config}}{{.Subnet}}{{end}}' 2>/dev/null
        echo "  Connected containers:"
        docker network inspect blog-monitoring --format '{{range $k, $v := .Containers}}  - {{$v.Name}} ({{$v.IPv4Address}}){{"\n"}}{{end}}' 2>/dev/null
    else
        print_warning "Monitoring network (blog-monitoring) not found"
    fi
    
    # Check blog network
    if docker network ls | grep -q "blog-system_blog-network"; then
        print_success "Blog network (blog-system_blog-network) exists"
    else
        print_warning "Blog network (blog-system_blog-network) not found"
    fi
    
    echo
}

# Function to show volume information
show_volume_info() {
    print_header "Volume Information"
    
    local volumes=("prometheus_data" "grafana_data" "alertmanager_data" "elasticsearch_data" "loki_data")
    
    for volume in "${volumes[@]}"; do
        local full_volume_name="monitoring_$volume"
        if docker volume ls | grep -q "$full_volume_name"; then
            local size=$(docker system df -v | grep "$full_volume_name" | awk '{print $3}' || echo "unknown")
            print_success "$volume: $size"
        else
            print_warning "$volume: not found"
        fi
    done
    
    echo
}

# Function to show resource usage summary
show_resource_summary() {
    print_header "Resource Usage Summary"
    
    local total_cpu=0
    local total_mem_mb=0
    local running_services=0
    
    for service in "${!SERVICES[@]}"; do
        local status=$(get_container_status "$service")
        if [ "$status" = "running" ]; then
            running_services=$((running_services + 1))
            
            local container_name="blog-$service"
            local stats=$(docker stats --no-stream --format "{{.CPUPerc}} {{.MemUsage}}" "$container_name" 2>/dev/null || echo "0.00% 0MiB / 0MiB")
            
            if [ -n "$stats" ]; then
                local cpu=$(echo "$stats" | awk '{print $1}' | sed 's/%//')
                local mem=$(echo "$stats" | awk '{print $2}' | sed 's/MiB//')
                
                total_cpu=$(echo "$total_cpu + $cpu" | bc -l 2>/dev/null || echo "$total_cpu")
                total_mem_mb=$(echo "$total_mem_mb + $mem" | bc -l 2>/dev/null || echo "$total_mem_mb")
            fi
        fi
    done
    
    echo "Running services: $running_services/${#SERVICES[@]}"
    echo "Total CPU usage: ${total_cpu}%"
    echo "Total memory usage: ${total_mem_mb}MiB"
    
    # Show Docker system info
    echo
    echo "Docker system usage:"
    docker system df 2>/dev/null | grep -E "(TYPE|Images|Containers|Local Volumes)" || echo "Unable to get Docker system info"
    
    echo
}

# Function to show service URLs
show_service_urls() {
    print_header "Service URLs"
    
    echo "Web Interfaces:"
    echo "  Grafana Dashboard:    http://localhost:3000"
    echo "  Prometheus:           http://localhost:9090"
    echo "  Alertmanager:         http://localhost:9093"
    echo "  Jaeger Tracing:       http://localhost:16686"
    echo "  Elasticsearch:        http://localhost:9200"
    echo "  cAdvisor:             http://localhost:8080"
    echo
    echo "API Endpoints:"
    echo "  Loki:                 http://localhost:3100"
    echo "  Node Exporter:        http://localhost:9100"
    echo "  Blackbox Exporter:    http://localhost:9115"
    echo "  Promtail:             http://localhost:9080"
    echo
}

# Function to run health checks
run_health_checks() {
    print_header "Health Check Results"
    
    local healthy_count=0
    local total_count=0
    
    for service in "${!SERVICES[@]}"; do
        total_count=$((total_count + 1))
        local status=$(get_container_status "$service")
        local endpoint=$(check_service_endpoint "$service")
        
        if [ "$status" = "running" ] && [ "$endpoint" = "healthy" ]; then
            print_success "$service: All checks passed"
            healthy_count=$((healthy_count + 1))
        elif [ "$status" = "running" ]; then
            print_warning "$service: Container running but endpoint unhealthy"
        else
            print_error "$service: Container not running"
        fi
    done
    
    echo
    if [ $healthy_count -eq $total_count ]; then
        print_success "All services are healthy ($healthy_count/$total_count)"
    else
        print_warning "$healthy_count/$total_count services are healthy"
    fi
    
    echo
}

# Main execution
main() {
    echo "=== Blog System Monitoring Stack Status ==="
    echo "Generated: $(date)"
    echo
    
    if ! check_docker; then
        exit 1
    fi
    
    case "${1:-overview}" in
        "overview")
            show_service_status
            run_health_checks
            show_service_urls
            ;;
        "detailed")
            show_service_status
            show_service_details
            show_network_info
            show_volume_info
            ;;
        "resources")
            show_service_status
            show_resource_summary
            ;;
        "health")
            run_health_checks
            ;;
        "urls")
            show_service_urls
            ;;
        "all")
            show_service_status
            run_health_checks
            show_service_details
            show_network_info
            show_volume_info
            show_resource_summary
            show_service_urls
            ;;
        *)
            echo "Usage: $0 [overview|detailed|resources|health|urls|all]"
            echo
            echo "Options:"
            echo "  overview   - Service status and health checks (default)"
            echo "  detailed   - Detailed service information"
            echo "  resources  - Resource usage summary"
            echo "  health     - Health checks only"
            echo "  urls       - Service URLs only"
            echo "  all        - All information"
            echo
            exit 1
            ;;
    esac
}

# Run main function
main "$@"