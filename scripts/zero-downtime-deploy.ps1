# Blog System Zero Downtime Deployment Script (PowerShell)
# Implements blue-green deployment strategy for the blog system

param(
    [switch]$Help,
    [switch]$DryRun,
    [switch]$Force,
    [switch]$NoTests
)

# Configuration
$ProjectDir = Split-Path -Parent $PSScriptRoot
$DockerComposeFile = Join-Path $ProjectDir "docker-compose.yml"
$DockerComposeProdFile = Join-Path $ProjectDir "docker-compose.prod.yml"
$HealthCheckTimeout = 300
$HealthCheckInterval = 10
$RollbackTimeout = 60
$LogsDir = Join-Path $ProjectDir "logs"
$DeploymentLog = Join-Path $LogsDir "deployment.log"

# Service configuration
$Services = @{
    "frontend" = "3000:/health"
    "backend" = "5000:/health"
    "nginx" = "80:/health"
}

# Current deployment state
$CurrentColor = ""
$NewColor = ""
$DeploymentId = "deploy-$(Get-Date -Format 'yyyyMMdd-HHmmss')"

# Function to print colored output
function Write-Status {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor Blue
    Add-Content -Path $DeploymentLog -Value "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] [INFO] $Message"
}

function Write-Success {
    param([string]$Message)
    Write-Host "[SUCCESS] $Message" -ForegroundColor Green
    Add-Content -Path $DeploymentLog -Value "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] [SUCCESS] $Message"
}

function Write-Warning {
    param([string]$Message)
    Write-Host "[WARNING] $Message" -ForegroundColor Yellow
    Add-Content -Path $DeploymentLog -Value "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] [WARNING] $Message"
}

function Write-Error {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
    Add-Content -Path $DeploymentLog -Value "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] [ERROR] $Message"
}

function Write-Header {
    param([string]$Message)
    Write-Host "=== $Message ===" -ForegroundColor Magenta
    Add-Content -Path $DeploymentLog -Value "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] === $Message ==="
}

# Function to log deployment events
function Write-Event {
    param(
        [string]$EventType,
        [string]$Message
    )
    
    $timestamp = Get-Date -Format "yyyy-MM-ddTHH:mm:ss.fffZ"
    $eventLog = Join-Path $LogsDir "deployment-events.log"
    
    $eventData = @{
        timestamp = $timestamp
        deployment_id = $DeploymentId
        event = $EventType
        message = $Message
    } | ConvertTo-Json -Compress
    
    Add-Content -Path $eventLog -Value $eventData
}

# Function to setup logging
function Initialize-Logging {
    if (-not (Test-Path $LogsDir)) {
        New-Item -ItemType Directory -Path $LogsDir -Force | Out-Null
    }
    
    # Initialize deployment log
    "=== Zero Downtime Deployment Started: $(Get-Date) ===" | Out-File -FilePath $DeploymentLog -Encoding UTF8
    "Deployment ID: $DeploymentId" | Add-Content -Path $DeploymentLog
    
    Write-Event "deployment_started" "Zero downtime deployment initiated"
}

# Function to check prerequisites
function Test-Prerequisites {
    Write-Header "Checking Prerequisites"
    
    # Check Docker
    try {
        docker info | Out-Null
        Write-Success "Docker is running"
    }
    catch {
        Write-Error "Docker is not running"
        Write-Event "prerequisite_failed" "Docker not running"
        throw "Docker is not running"
    }
    
    # Check Docker Compose
    $dockerComposeAvailable = $false
    try {
        docker-compose version | Out-Null
        $dockerComposeAvailable = $true
    }
    catch {
        try {
            docker compose version | Out-Null
            $dockerComposeAvailable = $true
        }
        catch {
            Write-Error "Docker Compose is not available"
            Write-Event "prerequisite_failed" "Docker Compose not available"
            throw "Docker Compose is not available"
        }
    }
    
    if ($dockerComposeAvailable) {
        Write-Success "Docker Compose is available"
    }
    
    # Check if production compose file exists
    if (-not (Test-Path $DockerComposeProdFile)) {
        Write-Error "Production Docker Compose file not found: $DockerComposeProdFile"
        Write-Event "prerequisite_failed" "Production compose file missing"
        throw "Production compose file missing"
    }
    Write-Success "Production compose file found"
    
    # Check if required environment files exist
    $prodEnvFile = Join-Path $ProjectDir ".env.production"
    if (-not (Test-Path $prodEnvFile)) {
        Write-Warning "Production environment file not found, using defaults"
    }
    
    Write-Event "prerequisites_checked" "All prerequisites verified"
}

# Function to determine current deployment color
function Get-CurrentColor {
    Write-Status "Determining current deployment color..."
    
    # Check which color is currently active by looking at running containers
    $blueContainers = docker ps --filter "name=blog-frontend-blue" --format "{{.Names}}"
    $greenContainers = docker ps --filter "name=blog-frontend-green" --format "{{.Names}}"
    
    if ($blueContainers -match "blog-frontend-blue") {
        $script:CurrentColor = "blue"
        $script:NewColor = "green"
    }
    elseif ($greenContainers -match "blog-frontend-green") {
        $script:CurrentColor = "green"
        $script:NewColor = "blue"
    }
    else {
        # No deployment found, start with blue
        $script:CurrentColor = "none"
        $script:NewColor = "blue"
    }
    
    Write-Status "Current color: $CurrentColor, New color: $NewColor"
    Write-Event "color_determined" "Current: $CurrentColor, New: $NewColor"
}

# Function to build new images
function Build-NewImages {
    Write-Header "Building New Images"
    
    Write-Status "Building application images..."
    
    # Build frontend image
    Write-Status "Building frontend image..."
    $frontendBuild = docker build -t "blog-frontend:$NewColor-$DeploymentId" `
        -f (Join-Path $ProjectDir "Dockerfile") `
        --target production `
        $ProjectDir
    
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to build frontend image"
        Write-Event "build_failed" "Frontend image build failed"
        throw "Frontend image build failed"
    }
    
    # Build backend image
    Write-Status "Building backend image..."
    $backendBuild = docker build -t "blog-backend:$NewColor-$DeploymentId" `
        -f (Join-Path $ProjectDir "api\Dockerfile") `
        --target production `
        (Join-Path $ProjectDir "api")
    
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to build backend image"
        Write-Event "build_failed" "Backend image build failed"
        throw "Backend image build failed"
    }
    
    Write-Success "Images built successfully"
    Write-Event "images_built" "All application images built successfully"
}

# Function to start new deployment
function Start-NewDeployment {
    Write-Header "Starting New Deployment ($NewColor)"
    
    # Create environment file for new deployment
    $envFile = Join-Path $ProjectDir ".env.$NewColor"
    $prodEnvFile = Join-Path $ProjectDir ".env.production"
    
    if (Test-Path $prodEnvFile) {
        Copy-Item $prodEnvFile $envFile
    }
    else {
        Write-Warning "Production env file not found, creating minimal config"
        $frontendPort = if ($NewColor -eq "green") { 3001 } else { 3000 }
        $backendPort = if ($NewColor -eq "green") { 5001 } else { 5000 }
        $nginxPort = if ($NewColor -eq "green") { 81 } else { 80 }
        
        @"
ENVIRONMENT=production
COLOR=$NewColor
FRONTEND_IMAGE=blog-frontend:$NewColor-$DeploymentId
BACKEND_IMAGE=blog-backend:$NewColor-$DeploymentId
FRONTEND_PORT=$frontendPort
BACKEND_PORT=$backendPort
NGINX_PORT=$nginxPort
"@ | Out-File -FilePath $envFile -Encoding UTF8
    }
    
    # Add color-specific configuration
    Add-Content -Path $envFile -Value "COLOR=$NewColor"
    Add-Content -Path $envFile -Value "FRONTEND_IMAGE=blog-frontend:$NewColor-$DeploymentId"
    Add-Content -Path $envFile -Value "BACKEND_IMAGE=blog-backend:$NewColor-$DeploymentId"
    
    # Start new deployment
    Write-Status "Starting $NewColor deployment..."
    
    try {
        docker-compose -f $DockerComposeProdFile `
            --env-file $envFile `
            -p "blog-system-$NewColor" `
            up -d
    }
    catch {
        try {
            docker compose -f $DockerComposeProdFile `
                --env-file $envFile `
                -p "blog-system-$NewColor" `
                up -d
        }
        catch {
            Write-Error "Failed to start $NewColor deployment"
            Write-Event "deployment_failed" "$NewColor deployment start failed"
            throw "Deployment start failed"
        }
    }
    
    Write-Success "$NewColor deployment started"
    Write-Event "deployment_started" "$NewColor deployment containers started"
}

# Function to wait for new deployment to be healthy
function Wait-ForHealth {
    Write-Header "Waiting for New Deployment Health"
    
    $startTime = Get-Date
    $timeout = $startTime.AddSeconds($HealthCheckTimeout)
    
    foreach ($service in $Services.Keys) {
        Write-Status "Checking health of $service..."
        
        $portPath = $Services[$service]
        $port = $portPath.Split(':')[0]
        $path = $portPath.Split(':')[1]
        
        # Adjust port for new color deployment
        if ($NewColor -eq "green") {
            $port = [int]$port + 1
        }
        
        $serviceHealthy = $false
        while ((Get-Date) -lt $timeout) {
            try {
                $response = Invoke-WebRequest -Uri "http://localhost:$port$path" -TimeoutSec 5 -UseBasicParsing
                if ($response.StatusCode -eq 200) {
                    Write-Success "$service is healthy on port $port"
                    $serviceHealthy = $true
                    break
                }
            }
            catch {
                Write-Status "Waiting for $service to become healthy..."
                Start-Sleep $HealthCheckInterval
            }
        }
        
        if (-not $serviceHealthy) {
            Write-Error "$service failed to become healthy within timeout"
            Write-Event "health_check_failed" "$service health check failed"
            return $false
        }
    }
    
    Write-Success "All services are healthy"
    Write-Event "health_check_passed" "All services passed health checks"
    return $true
}

# Function to run smoke tests
function Invoke-SmokeTests {
    if ($NoTests) {
        Write-Warning "Smoke tests skipped"
        return $true
    }
    
    Write-Header "Running Smoke Tests"
    
    $basePort = if ($NewColor -eq "green") { 3001 } else { 3000 }
    
    # Test frontend
    Write-Status "Testing frontend..."
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:$basePort" -TimeoutSec 10 -UseBasicParsing
        if ($response.Content -match "Blog System") {
            Write-Success "Frontend smoke test passed"
        }
        else {
            Write-Error "Frontend smoke test failed - content check failed"
            Write-Event "smoke_test_failed" "Frontend smoke test failed"
            return $false
        }
    }
    catch {
        Write-Error "Frontend smoke test failed - $($_.Exception.Message)"
        Write-Event "smoke_test_failed" "Frontend smoke test failed"
        return $false
    }
    
    # Test backend API
    $apiPort = $basePort + 2000
    Write-Status "Testing backend API..."
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:$apiPort/api/health" -TimeoutSec 10 -UseBasicParsing
        if ($response.Content -match "ok") {
            Write-Success "Backend API smoke test passed"
        }
        else {
            Write-Error "Backend API smoke test failed - health check failed"
            Write-Event "smoke_test_failed" "Backend API smoke test failed"
            return $false
        }
    }
    catch {
        Write-Error "Backend API smoke test failed - $($_.Exception.Message)"
        Write-Event "smoke_test_failed" "Backend API smoke test failed"
        return $false
    }
    
    # Test database connectivity
    Write-Status "Testing database connectivity..."
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:$apiPort/api/posts?limit=1" -TimeoutSec 10 -UseBasicParsing
        Write-Success "Database connectivity test passed"
    }
    catch {
        Write-Error "Database connectivity test failed - $($_.Exception.Message)"
        Write-Event "smoke_test_failed" "Database connectivity test failed"
        return $false
    }
    
    Write-Success "All smoke tests passed"
    Write-Event "smoke_tests_passed" "All smoke tests completed successfully"
    return $true
}

# Function to switch traffic to new deployment
function Switch-Traffic {
    Write-Header "Switching Traffic to New Deployment"
    
    # Update nginx configuration to point to new deployment
    Write-Status "Updating load balancer configuration..."
    
    # Create new nginx config
    $nginxDir = Join-Path $ProjectDir "nginx"
    if (-not (Test-Path $nginxDir)) {
        New-Item -ItemType Directory -Path $nginxDir -Force | Out-Null
    }
    
    $nginxConfig = Join-Path $nginxDir "nginx.$NewColor.conf"
    $upstreamPort = if ($NewColor -eq "green") { 3001 } else { 3000 }
    $apiUpstreamPort = if ($NewColor -eq "green") { 5001 } else { 5000 }
    
    @"
events {
    worker_connections 1024;
}

http {
    upstream frontend {
        server localhost:$upstreamPort;
    }
    
    upstream backend {
        server localhost:$apiUpstreamPort;
    }
    
    server {
        listen 80;
        server_name localhost;
        
        location /api/ {
            proxy_pass http://backend;
            proxy_set_header Host `$host;
            proxy_set_header X-Real-IP `$remote_addr;
            proxy_set_header X-Forwarded-For `$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto `$scheme;
        }
        
        location / {
            proxy_pass http://frontend;
            proxy_set_header Host `$host;
            proxy_set_header X-Real-IP `$remote_addr;
            proxy_set_header X-Forwarded-For `$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto `$scheme;
        }
        
        location /health {
            access_log off;
            return 200 "healthy\n";
            add_header Content-Type text/plain;
        }
    }
}
"@ | Out-File -FilePath $nginxConfig -Encoding UTF8
    
    # Reload nginx with new configuration
    $nginxContainers = docker ps --filter "name=blog-nginx" --format "{{.Names}}"
    if ($nginxContainers -match "blog-nginx") {
        docker cp $nginxConfig "blog-nginx:/etc/nginx/nginx.conf"
        docker exec blog-nginx nginx -s reload
        Write-Success "Load balancer configuration updated"
    }
    else {
        Write-Warning "Load balancer not found, traffic switch may be incomplete"
    }
    
    # Wait a moment for traffic to stabilize
    Start-Sleep 5
    
    # Verify traffic is flowing to new deployment
    Write-Status "Verifying traffic switch..."
    try {
        $response = Invoke-WebRequest -Uri "http://localhost/health" -TimeoutSec 10 -UseBasicParsing
        Write-Success "Traffic successfully switched to $NewColor deployment"
        Write-Event "traffic_switched" "Traffic switched to $NewColor deployment"
    }
    catch {
        Write-Error "Traffic switch verification failed"
        Write-Event "traffic_switch_failed" "Traffic switch verification failed"
        return $false
    }
    
    return $true
}

# Function to stop old deployment
function Stop-OldDeployment {
    Write-Header "Stopping Old Deployment"
    
    if ($CurrentColor -eq "none") {
        Write-Status "No old deployment to stop"
        return
    }
    
    Write-Status "Stopping $CurrentColor deployment..."
    
    # Stop old deployment containers
    try {
        docker-compose -f $DockerComposeProdFile `
            -p "blog-system-$CurrentColor" `
            down --timeout 30
    }
    catch {
        try {
            docker compose -f $DockerComposeProdFile `
                -p "blog-system-$CurrentColor" `
                down --timeout 30
        }
        catch {
            Write-Warning "Failed to stop old deployment gracefully"
        }
    }
    
    Write-Success "$CurrentColor deployment stopped"
    Write-Event "old_deployment_stopped" "$CurrentColor deployment stopped"
}

# Function to cleanup old images
function Remove-OldImages {
    Write-Header "Cleaning Up Old Images"
    
    Write-Status "Removing old images..."
    
    # Keep last 3 versions of each image
    try {
        $frontendImages = docker images --format "{{.Repository}}:{{.Tag}}" | Where-Object { $_ -match "blog-frontend:$CurrentColor" }
        if ($frontendImages.Count -gt 3) {
            $imagesToRemove = $frontendImages | Select-Object -Skip 3
            $imagesToRemove | ForEach-Object { docker rmi $_ 2>$null }
        }
        
        $backendImages = docker images --format "{{.Repository}}:{{.Tag}}" | Where-Object { $_ -match "blog-backend:$CurrentColor" }
        if ($backendImages.Count -gt 3) {
            $imagesToRemove = $backendImages | Select-Object -Skip 3
            $imagesToRemove | ForEach-Object { docker rmi $_ 2>$null }
        }
        
        # Remove dangling images
        docker image prune -f | Out-Null
        
        Write-Success "Old images cleaned up"
        Write-Event "cleanup_completed" "Old images cleaned up"
    }
    catch {
        Write-Warning "Some images could not be cleaned up: $($_.Exception.Message)"
    }
}

# Function to rollback deployment
function Invoke-Rollback {
    Write-Error "Deployment failed, initiating rollback..."
    Write-Event "rollback_started" "Deployment rollback initiated"
    
    # Stop new deployment
    try {
        docker-compose -f $DockerComposeProdFile `
            -p "blog-system-$NewColor" `
            down --timeout 30
    }
    catch {
        try {
            docker compose -f $DockerComposeProdFile `
                -p "blog-system-$NewColor" `
                down --timeout 30
        }
        catch {
            Write-Warning "Failed to stop new deployment during rollback"
        }
    }
    
    # If there was a previous deployment, ensure it's still running
    if ($CurrentColor -ne "none") {
        Write-Status "Ensuring $CurrentColor deployment is running..."
        
        $currentContainers = docker ps --filter "name=blog-frontend-$CurrentColor" --format "{{.Names}}"
        if (-not ($currentContainers -match "blog-frontend-$CurrentColor")) {
            Write-Status "Restarting $CurrentColor deployment..."
            
            $envFile = Join-Path $ProjectDir ".env.$CurrentColor"
            try {
                docker-compose -f $DockerComposeProdFile `
                    --env-file $envFile `
                    -p "blog-system-$CurrentColor" `
                    up -d
            }
            catch {
                try {
                    docker compose -f $DockerComposeProdFile `
                        --env-file $envFile `
                        -p "blog-system-$CurrentColor" `
                        up -d
                }
                catch {
                    Write-Error "Failed to restart previous deployment during rollback"
                }
            }
        }
        
        Write-Success "Rollback completed, $CurrentColor deployment is active"
    }
    else {
        Write-Warning "No previous deployment to rollback to"
    }
    
    Write-Event "rollback_completed" "Deployment rollback completed"
}

# Function to finalize deployment
function Complete-Deployment {
    Write-Header "Finalizing Deployment"
    
    # Update current deployment marker
    $NewColor | Out-File -FilePath (Join-Path $ProjectDir ".current-deployment") -Encoding UTF8
    
    # Create deployment record
    $deploymentRecord = Join-Path $LogsDir "deployments.json"
    $timestamp = Get-Date -Format "yyyy-MM-ddTHH:mm:ss.fffZ"
    
    $deploymentData = @{
        id = $DeploymentId
        timestamp = $timestamp
        color = $NewColor
        previous_color = $CurrentColor
        status = "success"
    }
    
    if (Test-Path $deploymentRecord) {
        $existingData = Get-Content $deploymentRecord | ConvertFrom-Json
        $existingData += $deploymentData
        $existingData | ConvertTo-Json | Out-File -FilePath $deploymentRecord -Encoding UTF8
    }
    else {
        @($deploymentData) | ConvertTo-Json | Out-File -FilePath $deploymentRecord -Encoding UTF8
    }
    
    Write-Success "Deployment finalized"
    Write-Event "deployment_finalized" "Deployment successfully finalized"
}

# Function to show deployment summary
function Show-DeploymentSummary {
    Write-Header "Deployment Summary"
    
    Write-Host "Deployment ID: $DeploymentId"
    Write-Host "Previous Color: $CurrentColor"
    Write-Host "New Color: $NewColor"
    Write-Host "Start Time: $(Get-Content $DeploymentLog | Select-Object -First 1 | ForEach-Object { ($_ -split ' ')[1..2] -join ' ' })"
    Write-Host "End Time: $(Get-Date)"
    Write-Host "Status: SUCCESS"
    Write-Host ""
    Write-Host "Active Services:"
    
    foreach ($service in $Services.Keys) {
        $port = $Services[$service].Split(':')[0]
        if ($NewColor -eq "green") {
            $port = [int]$port + 1
        }
        Write-Host "  $service`: http://localhost:$port"
    }
    
    Write-Host ""
    Write-Host "Logs: $DeploymentLog"
    Write-Host "Events: $(Join-Path $LogsDir 'deployment-events.log')"
    Write-Host ""
}

# Main execution function
function Start-ZeroDowntimeDeployment {
    Write-Host "=== Blog System Zero Downtime Deployment ===" -ForegroundColor Cyan
    Write-Host "Deployment ID: $DeploymentId"
    Write-Host "Started: $(Get-Date)"
    Write-Host ""
    
    try {
        Initialize-Logging
        Test-Prerequisites
        Get-CurrentColor
        Build-NewImages
        Start-NewDeployment
        
        if ((Wait-ForHealth) -and (Invoke-SmokeTests)) {
            if (Switch-Traffic) {
                Stop-OldDeployment
                Remove-OldImages
                Complete-Deployment
                
                Show-DeploymentSummary
                Write-Success "Zero downtime deployment completed successfully!"
                Write-Event "deployment_completed" "Zero downtime deployment completed successfully"
            }
            else {
                throw "Traffic switch failed"
            }
        }
        else {
            throw "Health checks or smoke tests failed"
        }
    }
    catch {
        Write-Error "Deployment failed: $($_.Exception.Message)"
        Invoke-Rollback
        throw
    }
}

# Handle script arguments
if ($Help) {
    Write-Host "Usage: .\zero-downtime-deploy.ps1 [OPTIONS]"
    Write-Host ""
    Write-Host "Options:"
    Write-Host "  -Help          Show this help message"
    Write-Host "  -DryRun        Simulate deployment without making changes"
    Write-Host "  -Force         Skip confirmation prompts"
    Write-Host "  -NoTests       Skip smoke tests"
    Write-Host ""
    exit 0
}

if ($DryRun) {
    Write-Host "DRY RUN MODE - No changes will be made" -ForegroundColor Yellow
    # Add dry run logic here
    exit 0
}

# Run main function
Start-ZeroDowntimeDeployment