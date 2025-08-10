#!/usr/bin/env pwsh

<#
.SYNOPSIS
    Rollback deployment script for Blog System

.DESCRIPTION
    This script provides quick rollback capabilities for the blog system deployment.
    It supports rolling back to previous versions with minimal downtime.

.PARAMETER Version
    Specific version to rollback to (e.g., v1.2.2, commit-hash)

.PARAMETER Environment
    Target environment: development, staging, production

.PARAMETER Strategy
    Rollback strategy: immediate, gradual, or blue_green

.PARAMETER Reason
    Reason for rollback (for logging and notifications)

.PARAMETER DryRun
    Perform a dry run without actual rollback

.PARAMETER Force
    Force rollback even if current deployment seems healthy

.PARAMETER SkipValidation
    Skip post-rollback validation

.PARAMETER Verbose
    Enable verbose logging

.EXAMPLE
    .\rollback-deployment.ps1 -Version v1.2.2 -Environment production -Reason "Critical bug fix"

.EXAMPLE
    .\rollback-deployment.ps1 -Strategy gradual -Environment staging -DryRun
#>

param(
    [Parameter(Mandatory = $false)]
    [string]$Version,
    
    [Parameter(Mandatory = $false)]
    [ValidateSet("development", "staging", "production")]
    [string]$Environment = "development",
    
    [Parameter(Mandatory = $false)]
    [ValidateSet("immediate", "gradual", "blue_green")]
    [string]$Strategy = "immediate",
    
    [Parameter(Mandatory = $false)]
    [string]$Reason = "Manual rollback",
    
    [Parameter(Mandatory = $false)]
    [switch]$DryRun,
    
    [Parameter(Mandatory = $false)]
    [switch]$Force,
    
    [Parameter(Mandatory = $false)]
    [switch]$SkipValidation,
    
    [Parameter(Mandatory = $false)]
    [switch]$Verbose
)

# Set error action preference
$ErrorActionPreference = "Stop"

# Global variables
$script:RollbackId = (Get-Date -Format "yyyyMMdd-HHmmss")
$script:LogFile = "./logs/rollback-$script:RollbackId.log"
$script:StartTime = Get-Date
$script:Config = $null
$script:DeploymentHistory = @()

# Ensure logs directory exists
if (-not (Test-Path "./logs")) {
    New-Item -ItemType Directory -Path "./logs" -Force | Out-Null
}

# Logging function
function Write-Log {
    param(
        [string]$Message,
        [ValidateSet("INFO", "WARN", "ERROR", "DEBUG")]
        [string]$Level = "INFO",
        [switch]$NoConsole
    )
    
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logEntry = "[$timestamp] [$Level] $Message"
    
    # Write to log file
    Add-Content -Path $script:LogFile -Value $logEntry
    
    # Write to console unless suppressed
    if (-not $NoConsole) {
        switch ($Level) {
            "ERROR" { Write-Host $logEntry -ForegroundColor Red }
            "WARN" { Write-Host $logEntry -ForegroundColor Yellow }
            "DEBUG" { if ($Verbose) { Write-Host $logEntry -ForegroundColor Gray } }
            default { Write-Host $logEntry -ForegroundColor White }
        }
    }
}

# Load deployment history
function Get-DeploymentHistory {
    Write-Log "Loading deployment history..."
    
    $historyFile = "./logs/deployment-history.json"
    
    if (Test-Path $historyFile) {
        try {
            $script:DeploymentHistory = Get-Content $historyFile | ConvertFrom-Json
            Write-Log "Loaded $($script:DeploymentHistory.Count) deployment records"
        }
        catch {
            Write-Log "Failed to load deployment history: $($_.Exception.Message)" -Level WARN
            $script:DeploymentHistory = @()
        }
    }
    else {
        Write-Log "No deployment history found" -Level WARN
        $script:DeploymentHistory = @()
    }
}

# Get current deployment info
function Get-CurrentDeployment {
    try {
        # Get current version from running containers
        $frontendContainer = docker-compose ps -q blog-frontend
        if ($frontendContainer) {
            $version = docker inspect $frontendContainer --format '{{.Config.Labels.version}}' 2>$null
            $deployTime = docker inspect $frontendContainer --format '{{.Created}}' 2>$null
            
            return @{
                Version = $version
                DeployTime = $deployTime
                ContainerId = $frontendContainer
            }
        }
        
        return $null
    }
    catch {
        Write-Log "Could not determine current deployment info" -Level WARN
        return $null
    }
}

# Find target version for rollback
function Find-RollbackTarget {
    if ($Version) {
        Write-Log "Using specified version for rollback: $Version"
        return $Version
    }
    
    # Find previous successful deployment
    $currentDeployment = Get-CurrentDeployment
    if (-not $currentDeployment) {
        throw "Cannot determine current deployment version"
    }
    
    $currentVersion = $currentDeployment.Version
    Write-Log "Current version: $currentVersion"
    
    # Find the most recent successful deployment before current
    $previousDeployment = $script:DeploymentHistory | 
        Where-Object { $_.version -ne $currentVersion -and $_.status -eq "success" -and $_.environment -eq $Environment } | 
        Sort-Object timestamp -Descending | 
        Select-Object -First 1
    
    if ($previousDeployment) {
        Write-Log "Found previous successful deployment: $($previousDeployment.version) from $($previousDeployment.timestamp)"
        return $previousDeployment.version
    }
    
    throw "No previous successful deployment found for rollback"
}

# Check if rollback is safe
function Test-RollbackSafety {
    param([string]$TargetVersion)
    
    Write-Log "Checking rollback safety for version: $TargetVersion"
    
    if ($Force) {
        Write-Log "Force flag specified, skipping safety checks" -Level WARN
        return $true
    }
    
    # Check if target version exists in registry/repository
    try {
        $imageExists = docker manifest inspect "blog-frontend:$TargetVersion" 2>$null
        if (-not $imageExists) {
            Write-Log "Target image not found: blog-frontend:$TargetVersion" -Level ERROR
            return $false
        }
    }
    catch {
        Write-Log "Could not verify target image existence" -Level WARN
    }
    
    # Check for database migrations that might prevent rollback
    $migrationCheck = Test-DatabaseMigrationCompatibility -TargetVersion $TargetVersion
    if (-not $migrationCheck) {
        Write-Log "Database migration compatibility check failed" -Level ERROR
        return $false
    }
    
    # Check current system health
    $currentHealth = Test-SystemHealth
    if ($currentHealth -and -not $Force) {
        Write-Log "Current system appears healthy. Use -Force to proceed with rollback anyway." -Level WARN
        return $false
    }
    
    Write-Log "Rollback safety checks passed"
    return $true
}

# Test database migration compatibility
function Test-DatabaseMigrationCompatibility {
    param([string]$TargetVersion)
    
    Write-Log "Checking database migration compatibility..." -Level DEBUG
    
    try {
        # Get current database schema version
        $currentSchemaVersion = Get-DatabaseSchemaVersion
        
        # Get target schema version (this would need to be implemented based on your migration system)
        $targetSchemaVersion = Get-TargetSchemaVersion -Version $TargetVersion
        
        if ($targetSchemaVersion -gt $currentSchemaVersion) {
            Write-Log "Target version requires newer database schema. Rollback may not be safe." -Level WARN
            return $false
        }
        
        return $true
    }
    catch {
        Write-Log "Could not verify database migration compatibility: $($_.Exception.Message)" -Level WARN
        return $true  # Assume safe if we can't check
    }
}

# Test current system health
function Test-SystemHealth {
    Write-Log "Checking current system health..." -Level DEBUG
    
    try {
        # Check if main services are responding
        $frontendHealth = Test-ServiceHealth -Service "blog-frontend" -Port 3000
        $backendHealth = Test-ServiceHealth -Service "blog-backend" -Port 3001
        
        # Check error rates (simplified)
        $errorRate = Get-CurrentErrorRate
        
        if ($frontendHealth -and $backendHealth -and $errorRate -lt 5) {
            Write-Log "System appears healthy (error rate: $errorRate%)" -Level DEBUG
            return $true
        }
        
        Write-Log "System health issues detected (error rate: $errorRate%)" -Level DEBUG
        return $false
    }
    catch {
        Write-Log "Could not determine system health: $($_.Exception.Message)" -Level DEBUG
        return $false
    }
}

# Test service health
function Test-ServiceHealth {
    param([string]$Service, [int]$Port)
    
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:$Port/health" -TimeoutSec 5 -UseBasicParsing
        return $response.StatusCode -eq 200
    }
    catch {
        return $false
    }
}

# Get current error rate (simplified)
function Get-CurrentErrorRate {
    # This would integrate with your monitoring system
    # For now, return a mock value
    return 2
}

# Get database schema version
function Get-DatabaseSchemaVersion {
    # This would query your database migration table
    # For now, return a mock value
    return 10
}

# Get target schema version
function Get-TargetSchemaVersion {
    param([string]$Version)
    # This would look up the schema version for the target application version
    # For now, return a mock value
    return 9
}

# Create backup before rollback
function New-PreRollbackBackup {
    Write-Log "Creating pre-rollback backup..."
    
    $backupDir = "./backups/pre-rollback-$script:RollbackId"
    
    if (-not $DryRun) {
        try {
            New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
            
            # Backup database
            Write-Log "Backing up database..." -Level DEBUG
            $dbBackupFile = "$backupDir/database-backup.sql"
            docker-compose exec -T postgres pg_dump -U postgres blog_db > $dbBackupFile
            
            # Backup uploaded files
            Write-Log "Backing up uploaded files..." -Level DEBUG
            $uploadsBackupDir = "$backupDir/uploads"
            if (Test-Path "./uploads") {
                Copy-Item -Path "./uploads" -Destination $uploadsBackupDir -Recurse
            }
            
            # Backup configuration
            Write-Log "Backing up configuration..." -Level DEBUG
            $configBackupDir = "$backupDir/config"
            New-Item -ItemType Directory -Path $configBackupDir -Force | Out-Null
            
            if (Test-Path ".env") {
                Copy-Item -Path ".env" -Destination "$configBackupDir/.env"
            }
            
            if (Test-Path "docker-compose.yml") {
                Copy-Item -Path "docker-compose.yml" -Destination "$configBackupDir/docker-compose.yml"
            }
            
            Write-Log "Pre-rollback backup created at: $backupDir"
        }
        catch {
            Write-Log "Failed to create pre-rollback backup: $($_.Exception.Message)" -Level ERROR
            throw
        }
    }
    else {
        Write-Log "[DRY RUN] Would create pre-rollback backup at: $backupDir"
    }
}

# Execute immediate rollback
function Invoke-ImmediateRollback {
    param([string]$TargetVersion)
    
    Write-Log "Executing immediate rollback to version: $TargetVersion"
    
    if (-not $DryRun) {
        try {
            # Update environment variable
            $env:VERSION = $TargetVersion
            
            # Pull target images
            Write-Log "Pulling target images..." -Level DEBUG
            docker-compose pull
            
            # Stop current services
            Write-Log "Stopping current services..." -Level DEBUG
            docker-compose down
            
            # Start services with target version
            Write-Log "Starting services with target version..." -Level DEBUG
            docker-compose up -d
            
            # Wait for services to be ready
            Wait-ForServicesReady
            
            Write-Log "Immediate rollback completed"
        }
        catch {
            Write-Log "Immediate rollback failed: $($_.Exception.Message)" -Level ERROR
            throw
        }
    }
    else {
        Write-Log "[DRY RUN] Would execute immediate rollback to version: $TargetVersion"
    }
}

# Execute gradual rollback
function Invoke-GradualRollback {
    param([string]$TargetVersion)
    
    Write-Log "Executing gradual rollback to version: $TargetVersion"
    
    $services = @("blog-frontend", "blog-backend")
    
    foreach ($service in $services) {
        Write-Log "Rolling back service: $service"
        
        if (-not $DryRun) {
            try {
                # Update service with target version
                $env:VERSION = $TargetVersion
                docker-compose up -d --no-deps $service
                
                # Wait for service to be healthy
                Wait-ForServiceReady -Service $service
                
                # Wait between service rollbacks
                Start-Sleep -Seconds 30
            }
            catch {
                Write-Log "Failed to rollback service $service`: $($_.Exception.Message)" -Level ERROR
                throw
            }
        }
        else {
            Write-Log "[DRY RUN] Would rollback service: $service"
        }
    }
    
    Write-Log "Gradual rollback completed"
}

# Execute blue-green rollback
function Invoke-BlueGreenRollback {
    param([string]$TargetVersion)
    
    Write-Log "Executing blue-green rollback to version: $TargetVersion"
    
    # This would implement blue-green rollback logic
    # For now, fall back to immediate rollback
    Invoke-ImmediateRollback -TargetVersion $TargetVersion
}

# Wait for services to be ready
function Wait-ForServicesReady {
    $timeout = 300  # 5 minutes
    $elapsed = 0
    
    Write-Log "Waiting for services to be ready..."
    
    while ($elapsed -lt $timeout) {
        $frontendReady = Test-ServiceHealth -Service "blog-frontend" -Port 3000
        $backendReady = Test-ServiceHealth -Service "blog-backend" -Port 3001
        
        if ($frontendReady -and $backendReady) {
            Write-Log "All services are ready"
            return $true
        }
        
        Start-Sleep -Seconds 10
        $elapsed += 10
    }
    
    Write-Log "Timeout waiting for services to be ready" -Level ERROR
    return $false
}

# Wait for specific service to be ready
function Wait-ForServiceReady {
    param([string]$Service)
    
    $timeout = 120  # 2 minutes
    $elapsed = 0
    $port = if ($Service -eq "blog-frontend") { 3000 } else { 3001 }
    
    Write-Log "Waiting for $Service to be ready..."
    
    while ($elapsed -lt $timeout) {
        if (Test-ServiceHealth -Service $Service -Port $port) {
            Write-Log "$Service is ready"
            return $true
        }
        
        Start-Sleep -Seconds 5
        $elapsed += 5
    }
    
    Write-Log "Timeout waiting for $Service to be ready" -Level ERROR
    return $false
}

# Validate rollback
function Test-RollbackValidation {
    param([string]$TargetVersion)
    
    Write-Log "Validating rollback to version: $TargetVersion"
    
    if ($SkipValidation) {
        Write-Log "Skipping rollback validation" -Level WARN
        return $true
    }
    
    try {
        # Test frontend
        $frontendResponse = Invoke-WebRequest -Uri "http://localhost:3000" -TimeoutSec 10 -UseBasicParsing
        if ($frontendResponse.StatusCode -ne 200) {
            throw "Frontend health check failed"
        }
        
        # Test backend API
        $backendResponse = Invoke-WebRequest -Uri "http://localhost:3001/api/health" -TimeoutSec 10 -UseBasicParsing
        if ($backendResponse.StatusCode -ne 200) {
            throw "Backend health check failed"
        }
        
        # Test database connectivity
        $dbTest = docker-compose exec -T postgres pg_isready -U postgres
        if ($LASTEXITCODE -ne 0) {
            throw "Database connectivity check failed"
        }
        
        # Verify version
        $currentDeployment = Get-CurrentDeployment
        if ($currentDeployment.Version -ne $TargetVersion) {
            Write-Log "Warning: Deployed version ($($currentDeployment.Version)) does not match target ($TargetVersion)" -Level WARN
        }
        
        Write-Log "Rollback validation passed"
        return $true
    }
    catch {
        Write-Log "Rollback validation failed: $($_.Exception.Message)" -Level ERROR
        return $false
    }
}

# Record rollback in history
function Add-RollbackRecord {
    param([string]$TargetVersion, [bool]$Success)
    
    $record = @{
        id = $script:RollbackId
        timestamp = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
        type = "rollback"
        target_version = $TargetVersion
        environment = $Environment
        strategy = $Strategy
        reason = $Reason
        success = $Success
        duration_minutes = ((Get-Date) - $script:StartTime).TotalMinutes
    }
    
    $historyFile = "./logs/deployment-history.json"
    
    try {
        if (Test-Path $historyFile) {
            $history = Get-Content $historyFile | ConvertFrom-Json
            $history = @($history) + $record
        }
        else {
            $history = @($record)
        }
        
        $history | ConvertTo-Json -Depth 10 | Set-Content $historyFile
        Write-Log "Rollback record added to history"
    }
    catch {
        Write-Log "Failed to record rollback in history: $($_.Exception.Message)" -Level WARN
    }
}

# Send notification
function Send-Notification {
    param([string]$Event, [string]$Message, [string]$Status = "info")
    
    # This would integrate with your notification system
    Write-Log "Notification [$Event]: $Message" -Level DEBUG
}

# Main rollback function
function Start-Rollback {
    try {
        Write-Log "Starting rollback process"
        Write-Log "Strategy: $Strategy, Environment: $Environment, Reason: $Reason"
        
        if ($DryRun) {
            Write-Log "DRY RUN MODE - No actual changes will be made" -Level WARN
        }
        
        # Load deployment history
        Get-DeploymentHistory
        
        # Find target version
        $targetVersion = Find-RollbackTarget
        Write-Log "Target rollback version: $targetVersion"
        
        # Check rollback safety
        if (-not (Test-RollbackSafety -TargetVersion $targetVersion)) {
            throw "Rollback safety checks failed"
        }
        
        # Send start notification
        Send-Notification -Event "rollback_started" -Message "Rollback started to version $targetVersion. Reason: $Reason"
        
        # Create backup
        New-PreRollbackBackup
        
        # Execute rollback based on strategy
        switch ($Strategy) {
            "immediate" { Invoke-ImmediateRollback -TargetVersion $targetVersion }
            "gradual" { Invoke-GradualRollback -TargetVersion $targetVersion }
            "blue_green" { Invoke-BlueGreenRollback -TargetVersion $targetVersion }
        }
        
        # Validate rollback
        $validationSuccess = Test-RollbackValidation -TargetVersion $targetVersion
        
        if ($validationSuccess) {
            $duration = (Get-Date) - $script:StartTime
            Write-Log "Rollback completed successfully in $($duration.TotalMinutes.ToString('F2')) minutes"
            Send-Notification -Event "rollback_completed" -Message "Rollback completed successfully to version $targetVersion in $($duration.TotalMinutes.ToString('F2')) minutes"
            
            # Record success
            Add-RollbackRecord -TargetVersion $targetVersion -Success $true
            
            exit 0
        }
        else {
            Write-Log "Rollback validation failed" -Level ERROR
            Send-Notification -Event "rollback_failed" -Message "Rollback validation failed for version $targetVersion" -Status "error"
            
            # Record failure
            Add-RollbackRecord -TargetVersion $targetVersion -Success $false
            
            exit 1
        }
    }
    catch {
        Write-Log "Rollback error: $($_.Exception.Message)" -Level ERROR
        Send-Notification -Event "rollback_failed" -Message "Rollback failed: $($_.Exception.Message)" -Status "error"
        
        # Record failure
        if ($targetVersion) {
            Add-RollbackRecord -TargetVersion $targetVersion -Success $false
        }
        
        exit 1
    }
}

# Script entry point
if ($MyInvocation.InvocationName -ne '.') {
    Start-Rollback
}