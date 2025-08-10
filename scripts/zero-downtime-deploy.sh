#!/bin/bash

# Blog System Zero Downtime Deployment Script
# Implements blue-green deployment strategy for the blog system

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
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../" && pwd)"
DOCKER_COMPOSE_FILE="${PROJECT_DIR}/docker-compose.yml"
DOCKER_COMPOSE_PROD_FILE="${PROJECT_DIR}/docker-compose.prod.yml"
HEALTH_CHECK_TIMEOUT=300
HEALTH_CHECK_INTERVAL=10
ROLLBACK_TIMEOUT=60
DEPLOYMENT_LOG="${PROJECT_DIR}/logs/deployment.log"

# Service configuration
declare -A SERVICES=(
    ["frontend"]="3000:/health"
    ["backend"]="5000:/health"
    ["nginx"]="80:/health"
)

# Current deployment state
CURRENT_COLOR=""
NEW_COLOR=""
DEPLOYMENT_ID="deploy-$(date +%Y%m%d-%H%M%S)"

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1" | tee -a "$DEPLOYMENT_LOG"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$DEPLOYMENT_LOG"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$DEPLOYMENT_LOG"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$DEPLOYMENT_LOG"
}

print_header() {
    echo -e "${PURPLE}=== $1 ===${NC}" | tee -a "$DEPLOYMENT_LOG"
}

# Function to log deployment events
log_event() {
    local event_type="$1"
    local message="$2"
    local timestamp=$(date -Iseconds)
    
    echo "{\"timestamp\":\"$timestamp\",\"deployment_id\":\"$DEPLOYMENT_ID\",\"event\":\"$event_type\",\"message\":\"$message\"}" >> "${PROJECT_DIR}/logs/deployment-events.log"
}

# Function to setup logging
setup_logging() {
    mkdir -p "${PROJECT_DIR}/logs"
    
    # Initialize deployment log
    echo "=== Zero Downtime Deployment Started: $(date) ===" > "$DEPLOYMENT_LOG"
    echo "Deployment ID: $DEPLOYMENT_ID" >> "$DEPLOYMENT_LOG"
    
    log_event "deployment_started" "Zero downtime deployment initiated"
}

# Function to check prerequisites
check_prerequisites() {
    print_header "Checking Prerequisites"
    
    # Check Docker
    if ! docker info >/dev/null 2>&1; then
        print_error "Docker is not running"
        log_event "prerequisite_failed" "Docker not running"
        exit 1
    fi
    print_success "Docker is running"
    
    # Check Docker Compose
    if ! command -v docker-compose >/dev/null 2>&1 && ! docker compose version >/dev/null 2>&1; then
        print_error "Docker Compose is not available"
        log_event "prerequisite_failed" "Docker Compose not available"
        exit 1
    fi
    print_success "Docker Compose is available"
    
    # Check if production compose file exists
    if [ ! -f "$DOCKER_COMPOSE_PROD_FILE" ]; then
        print_error "Production Docker Compose file not found: $DOCKER_COMPOSE_PROD_FILE"
        log_event "prerequisite_failed" "Production compose file missing"
        exit 1
    fi
    print_success "Production compose file found"
    
    # Check if required environment files exist
    if [ ! -f "${PROJECT_DIR}/.env.production" ]; then
        print_warning "Production environment file not found, using defaults"
    fi
    
    log_event "prerequisites_checked" "All prerequisites verified"
}

# Function to determine current deployment color
get_current_color() {
    print_status "Determining current deployment color..."
    
    # Check which color is currently active by looking at running containers
    if docker ps --filter "name=blog-frontend-blue" --format "{{.Names}}" | grep -q "blog-frontend-blue"; then
        CURRENT_COLOR="blue"
        NEW_COLOR="green"
    elif docker ps --filter "name=blog-frontend-green" --format "{{.Names}}" | grep -q "blog-frontend-green"; then
        CURRENT_COLOR="green"
        NEW_COLOR="blue"
    else
        # No deployment found, start with blue
        CURRENT_COLOR="none"
        NEW_COLOR="blue"
    fi
    
    print_status "Current color: ${CURRENT_COLOR}, New color: ${NEW_COLOR}"
    log_event "color_determined" "Current: $CURRENT_COLOR, New: $NEW_COLOR"
}

# Function to build new images
build_new_images() {
    print_header "Building New Images"
    
    print_status "Building application images..."
    
    # Build frontend image
    print_status "Building frontend image..."
    docker build -t "blog-frontend:${NEW_COLOR}-${DEPLOYMENT_ID}" \
        -f "${PROJECT_DIR}/Dockerfile" \
        --target production \
        "${PROJECT_DIR}" || {
        print_error "Failed to build frontend image"
        log_event "build_failed" "Frontend image build failed"
        exit 1
    }
    
    # Build backend image
    print_status "Building backend image..."
    docker build -t "blog-backend:${NEW_COLOR}-${DEPLOYMENT_ID}" \
        -f "${PROJECT_DIR}/api/Dockerfile" \
        --target production \
        "${PROJECT_DIR}/api" || {
        print_error "Failed to build backend image"
        log_event "build_failed" "Backend image build failed"
        exit 1
    }
    
    print_success "Images built successfully"
    log_event "images_built" "All application images built successfully"
}

# Function to start new deployment
start_new_deployment() {
    print_header "Starting New Deployment (${NEW_COLOR})"
    
    # Create environment file for new deployment
    local env_file="${PROJECT_DIR}/.env.${NEW_COLOR}"
    cp "${PROJECT_DIR}/.env.production" "$env_file" 2>/dev/null || {
        print_warning "Production env file not found, creating minimal config"
        cat > "$env_file" << EOF
ENVIRONMENT=production
COLOR=${NEW_COLOR}
FRONTEND_IMAGE=blog-frontend:${NEW_COLOR}-${DEPLOYMENT_ID}
BACKEND_IMAGE=blog-backend:${NEW_COLOR}-${DEPLOYMENT_ID}
FRONTEND_PORT=$((3000 + (NEW_COLOR == "green" ? 1 : 0)))
BACKEND_PORT=$((5000 + (NEW_COLOR == "green" ? 1 : 0)))
NGINX_PORT=$((80 + (NEW_COLOR == "green" ? 1 : 0)))
EOF
    }
    
    # Add color-specific configuration
    echo "COLOR=${NEW_COLOR}" >> "$env_file"
    echo "FRONTEND_IMAGE=blog-frontend:${NEW_COLOR}-${DEPLOYMENT_ID}" >> "$env_file"
    echo "BACKEND_IMAGE=blog-backend:${NEW_COLOR}-${DEPLOYMENT_ID}" >> "$env_file"
    
    # Start new deployment
    print_status "Starting ${NEW_COLOR} deployment..."
    
    if command -v docker-compose >/dev/null 2>&1; then
        docker-compose -f "$DOCKER_COMPOSE_PROD_FILE" \
            --env-file "$env_file" \
            -p "blog-system-${NEW_COLOR}" \
            up -d
    else
        docker compose -f "$DOCKER_COMPOSE_PROD_FILE" \
            --env-file "$env_file" \
            -p "blog-system-${NEW_COLOR}" \
            up -d
    fi
    
    print_success "${NEW_COLOR} deployment started"
    log_event "deployment_started" "${NEW_COLOR} deployment containers started"
}

# Function to wait for new deployment to be healthy
wait_for_health() {
    print_header "Waiting for New Deployment Health"
    
    local start_time=$(date +%s)
    local timeout=$((start_time + HEALTH_CHECK_TIMEOUT))
    
    for service in "${!SERVICES[@]}"; do
        print_status "Checking health of ${service}..."
        
        local port_path="${SERVICES[$service]}"
        local port="${port_path%:*}"
        local path="${port_path#*:}"
        
        # Adjust port for new color deployment
        if [ "$NEW_COLOR" = "green" ]; then
            port=$((port + 1))
        fi
        
        local service_healthy=false
        while [ $(date +%s) -lt $timeout ]; do
            if curl -s -f "http://localhost:$port$path" >/dev/null 2>&1; then
                print_success "${service} is healthy on port $port"
                service_healthy=true
                break
            else
                print_status "Waiting for ${service} to become healthy..."
                sleep $HEALTH_CHECK_INTERVAL
            fi
        done
        
        if [ "$service_healthy" = false ]; then
            print_error "${service} failed to become healthy within timeout"
            log_event "health_check_failed" "${service} health check failed"
            return 1
        fi
    done
    
    print_success "All services are healthy"
    log_event "health_check_passed" "All services passed health checks"
    return 0
}

# Function to run smoke tests
run_smoke_tests() {
    print_header "Running Smoke Tests"
    
    local base_port=3000
    if [ "$NEW_COLOR" = "green" ]; then
        base_port=3001
    fi
    
    # Test frontend
    print_status "Testing frontend..."
    if curl -s -f "http://localhost:$base_port" | grep -q "Blog System"; then
        print_success "Frontend smoke test passed"
    else
        print_error "Frontend smoke test failed"
        log_event "smoke_test_failed" "Frontend smoke test failed"
        return 1
    fi
    
    # Test backend API
    local api_port=$((base_port + 2000))
    print_status "Testing backend API..."
    if curl -s -f "http://localhost:$api_port/api/health" | grep -q "ok"; then
        print_success "Backend API smoke test passed"
    else
        print_error "Backend API smoke test failed"
        log_event "smoke_test_failed" "Backend API smoke test failed"
        return 1
    fi
    
    # Test database connectivity
    print_status "Testing database connectivity..."
    if curl -s -f "http://localhost:$api_port/api/posts?limit=1" >/dev/null 2>&1; then
        print_success "Database connectivity test passed"
    else
        print_error "Database connectivity test failed"
        log_event "smoke_test_failed" "Database connectivity test failed"
        return 1
    fi
    
    print_success "All smoke tests passed"
    log_event "smoke_tests_passed" "All smoke tests completed successfully"
    return 0
}

# Function to switch traffic to new deployment
switch_traffic() {
    print_header "Switching Traffic to New Deployment"
    
    # Update nginx configuration to point to new deployment
    print_status "Updating load balancer configuration..."
    
    # Create new nginx config
    local nginx_config="${PROJECT_DIR}/nginx/nginx.${NEW_COLOR}.conf"
    local upstream_port=3000
    local api_upstream_port=5000
    
    if [ "$NEW_COLOR" = "green" ]; then
        upstream_port=3001
        api_upstream_port=5001
    fi
    
    cat > "$nginx_config" << EOF
events {
    worker_connections 1024;
}

http {
    upstream frontend {
        server localhost:$upstream_port;
    }
    
    upstream backend {
        server localhost:$api_upstream_port;
    }
    
    server {
        listen 80;
        server_name localhost;
        
        location /api/ {
            proxy_pass http://backend;
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
            proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto \$scheme;
        }
        
        location / {
            proxy_pass http://frontend;
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
            proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto \$scheme;
        }
        
        location /health {
            access_log off;
            return 200 "healthy\n";
            add_header Content-Type text/plain;
        }
    }
}
EOF
    
    # Reload nginx with new configuration
    if docker ps --filter "name=blog-nginx" --format "{{.Names}}" | grep -q "blog-nginx"; then
        docker cp "$nginx_config" blog-nginx:/etc/nginx/nginx.conf
        docker exec blog-nginx nginx -s reload
        print_success "Load balancer configuration updated"
    else
        print_warning "Load balancer not found, traffic switch may be incomplete"
    fi
    
    # Wait a moment for traffic to stabilize
    sleep 5
    
    # Verify traffic is flowing to new deployment
    print_status "Verifying traffic switch..."
    if curl -s -f "http://localhost/health" >/dev/null 2>&1; then
        print_success "Traffic successfully switched to ${NEW_COLOR} deployment"
        log_event "traffic_switched" "Traffic switched to ${NEW_COLOR} deployment"
    else
        print_error "Traffic switch verification failed"
        log_event "traffic_switch_failed" "Traffic switch verification failed"
        return 1
    fi
}

# Function to stop old deployment
stop_old_deployment() {
    print_header "Stopping Old Deployment"
    
    if [ "$CURRENT_COLOR" = "none" ]; then
        print_status "No old deployment to stop"
        return 0
    fi
    
    print_status "Stopping ${CURRENT_COLOR} deployment..."
    
    # Stop old deployment containers
    if command -v docker-compose >/dev/null 2>&1; then
        docker-compose -f "$DOCKER_COMPOSE_PROD_FILE" \
            -p "blog-system-${CURRENT_COLOR}" \
            down --timeout 30
    else
        docker compose -f "$DOCKER_COMPOSE_PROD_FILE" \
            -p "blog-system-${CURRENT_COLOR}" \
            down --timeout 30
    fi
    
    print_success "${CURRENT_COLOR} deployment stopped"
    log_event "old_deployment_stopped" "${CURRENT_COLOR} deployment stopped"
}

# Function to cleanup old images
cleanup_old_images() {
    print_header "Cleaning Up Old Images"
    
    print_status "Removing old images..."
    
    # Keep last 3 versions of each image
    docker images --format "table {{.Repository}}:{{.Tag}}" | grep "blog-frontend:${CURRENT_COLOR}" | tail -n +4 | xargs docker rmi 2>/dev/null || true
    docker images --format "table {{.Repository}}:{{.Tag}}" | grep "blog-backend:${CURRENT_COLOR}" | tail -n +4 | xargs docker rmi 2>/dev/null || true
    
    # Remove dangling images
    docker image prune -f >/dev/null 2>&1 || true
    
    print_success "Old images cleaned up"
    log_event "cleanup_completed" "Old images cleaned up"
}

# Function to rollback deployment
rollback_deployment() {
    print_error "Deployment failed, initiating rollback..."
    log_event "rollback_started" "Deployment rollback initiated"
    
    # Stop new deployment
    if command -v docker-compose >/dev/null 2>&1; then
        docker-compose -f "$DOCKER_COMPOSE_PROD_FILE" \
            -p "blog-system-${NEW_COLOR}" \
            down --timeout 30
    else
        docker compose -f "$DOCKER_COMPOSE_PROD_FILE" \
            -p "blog-system-${NEW_COLOR}" \
            down --timeout 30
    fi
    
    # If there was a previous deployment, ensure it's still running
    if [ "$CURRENT_COLOR" != "none" ]; then
        print_status "Ensuring ${CURRENT_COLOR} deployment is running..."
        
        if ! docker ps --filter "name=blog-frontend-${CURRENT_COLOR}" --format "{{.Names}}" | grep -q "blog-frontend-${CURRENT_COLOR}"; then
            print_status "Restarting ${CURRENT_COLOR} deployment..."
            
            if command -v docker-compose >/dev/null 2>&1; then
                docker-compose -f "$DOCKER_COMPOSE_PROD_FILE" \
                    --env-file "${PROJECT_DIR}/.env.${CURRENT_COLOR}" \
                    -p "blog-system-${CURRENT_COLOR}" \
                    up -d
            else
                docker compose -f "$DOCKER_COMPOSE_PROD_FILE" \
                    --env-file "${PROJECT_DIR}/.env.${CURRENT_COLOR}" \
                    -p "blog-system-${CURRENT_COLOR}" \
                    up -d
            fi
        fi
        
        print_success "Rollback completed, ${CURRENT_COLOR} deployment is active"
    else
        print_warning "No previous deployment to rollback to"
    fi
    
    log_event "rollback_completed" "Deployment rollback completed"
}

# Function to finalize deployment
finalize_deployment() {
    print_header "Finalizing Deployment"
    
    # Update current deployment marker
    echo "$NEW_COLOR" > "${PROJECT_DIR}/.current-deployment"
    
    # Create deployment record
    local deployment_record="${PROJECT_DIR}/logs/deployments.json"
    local timestamp=$(date -Iseconds)
    
    if [ ! -f "$deployment_record" ]; then
        echo "[]" > "$deployment_record"
    fi
    
    # Add deployment record
    local temp_file=$(mktemp)
    jq ". += [{\"id\": \"$DEPLOYMENT_ID\", \"timestamp\": \"$timestamp\", \"color\": \"$NEW_COLOR\", \"previous_color\": \"$CURRENT_COLOR\", \"status\": \"success\"}]" "$deployment_record" > "$temp_file" && mv "$temp_file" "$deployment_record" 2>/dev/null || {
        # Fallback if jq is not available
        echo "{\"id\": \"$DEPLOYMENT_ID\", \"timestamp\": \"$timestamp\", \"color\": \"$NEW_COLOR\", \"previous_color\": \"$CURRENT_COLOR\", \"status\": \"success\"}" >> "$deployment_record"
    }
    
    print_success "Deployment finalized"
    log_event "deployment_finalized" "Deployment successfully finalized"
}

# Function to show deployment summary
show_deployment_summary() {
    print_header "Deployment Summary"
    
    echo "Deployment ID: $DEPLOYMENT_ID"
    echo "Previous Color: $CURRENT_COLOR"
    echo "New Color: $NEW_COLOR"
    echo "Start Time: $(head -n 1 "$DEPLOYMENT_LOG" | grep -o '[0-9]\{4\}-[0-9]\{2\}-[0-9]\{2\} [0-9]\{2\}:[0-9]\{2\}:[0-9]\{2\}')"
    echo "End Time: $(date)"
    echo "Status: SUCCESS"
    echo
    echo "Active Services:"
    for service in "${!SERVICES[@]}"; do
        local port="${SERVICES[$service]%:*}"
        if [ "$NEW_COLOR" = "green" ]; then
            port=$((port + 1))
        fi
        echo "  $service: http://localhost:$port"
    done
    echo
    echo "Logs: $DEPLOYMENT_LOG"
    echo "Events: ${PROJECT_DIR}/logs/deployment-events.log"
    echo
}

# Main execution
main() {
    echo "=== Blog System Zero Downtime Deployment ==="
    echo "Deployment ID: $DEPLOYMENT_ID"
    echo "Started: $(date)"
    echo
    
    setup_logging
    
    # Set trap for cleanup on failure
    trap 'rollback_deployment; exit 1' ERR
    
    check_prerequisites
    get_current_color
    build_new_images
    start_new_deployment
    
    if wait_for_health && run_smoke_tests; then
        switch_traffic
        stop_old_deployment
        cleanup_old_images
        finalize_deployment
        
        # Remove trap since we succeeded
        trap - ERR
        
        show_deployment_summary
        print_success "Zero downtime deployment completed successfully!"
        log_event "deployment_completed" "Zero downtime deployment completed successfully"
    else
        # This will trigger the rollback trap
        exit 1
    fi
}

# Handle script arguments
case "${1:-}" in
    --help|-h)
        echo "Usage: $0 [OPTIONS]"
        echo
        echo "Options:"
        echo "  --help, -h     Show this help message"
        echo "  --dry-run      Simulate deployment without making changes"
        echo "  --force        Skip confirmation prompts"
        echo "  --no-tests     Skip smoke tests"
        echo
        exit 0
        ;;
    --dry-run)
        echo "DRY RUN MODE - No changes will be made"
        # Add dry run logic here
        exit 0
        ;;
    --force)
        # Skip confirmation prompts
        ;;
    --no-tests)
        # Override smoke test function
        run_smoke_tests() {
            print_warning "Smoke tests skipped"
            return 0
        }
        ;;
esac

# Run main function
main "$@"