#!/usr/bin/env pwsh

<#
.SYNOPSIS
    Rollback validation script for Blog System

.DESCRIPTION
    This script validates the success of a rollback operation by performing
    comprehensive checks on system state, data integrity, and functionality.

.PARAMETER Environment
    Target environment: development, staging, production

.PARAMETER RollbackVersion
    The version that was rolled back to

.PARAMETER PreviousVersion
    The version that was rolled back from

.PARAMETER BaseUrl
    Base URL for the application

.PARAMETER ValidationType
    Type of validation: quick, full, data-integrity

.PARAMETER DataBackupPath
    Path to the data backup used for rollback

.PARAMETER OutputFormat
    Output format: console, json, html

.PARAMETER ReportFile
    Path to save the validation report

.PARAMETER Verbose
    Enable verbose logging

.EXAMPLE
    .\validate-rollback.ps1 -Environment production -RollbackVersion "v1.2.0" -PreviousVersion "v1.3.0"

.EXAMPLE
    .\validate-rollback.ps1 -Environment staging -RollbackVersion "v1.1.0" -ValidationType data-integrity -DataBackupPath "./backups/20240115-120000"
#>

param(
    [Parameter(Mandatory = $true)]
    [ValidateSet("development", "staging", "production")]
    [string]$Environment,
    
    [Parameter(Mandatory = $true)]
    [string]$RollbackVersion,
    
    [Parameter(Mandatory = $false)]
    [string]$PreviousVersion,
    
    [Parameter(Mandatory = $false)]
    [string]$BaseUrl,
    
    [Parameter(Mandatory = $false)]
    [ValidateSet("quick", "full", "data-integrity")]
    [string]$ValidationType = "full",
    
    [Parameter(Mandatory = $false)]
    [string]$DataBackupPath,
    
    [Parameter(Mandatory = $false)]
    [ValidateSet("console", "json", "html")]
    [string]$OutputFormat = "console",
    
    [Parameter(Mandatory = $false)]
    [string]$ReportFile,
    
    [Parameter(Mandatory = $false)]
    [switch]$Verbose
)

# Set error action preference
$ErrorActionPreference = "Stop"

# Global variables
$script:ValidationId = (Get-Date -Format "yyyyMMdd-HHmmss")
$script:LogFile = "./logs/rollback-validation-$script:ValidationId.log"
$script:StartTime = Get-Date
$script:TestResults = @()
$script:RollbackData = @{}

# Default URLs based on environment
if (-not $BaseUrl) {
    $BaseUrl = switch ($Environment) {
        "development" { "http://localhost:3000" }
        "staging" { "https://staging.yourblog.com" }
        "production" { "https://yourblog.com" }
    }
}

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

# Test result class
class RollbackTestResult {
    [string]$Name
    [string]$Category
    [string]$Status  # Pass, Fail, Warning
    [string]$Message
    [double]$Duration
    [hashtable]$Details
    [string]$Severity  # Critical, High, Medium, Low
    
    RollbackTestResult([string]$name, [string]$category) {
        $this.Name = $name
        $this.Category = $category
        $this.Details = @{}
        $this.Severity = "Medium"
    }
}

# Execute rollback validation test
function Invoke-RollbackTest {
    param(
        [string]$TestName,
        [string]$Category,
        [scriptblock]$TestScript,
        [string]$Severity = "Medium"
    )
    
    $result = [RollbackTestResult]::new($TestName, $Category)
    $result.Severity = $Severity
    $startTime = Get-Date
    
    try {
        Write-Log "Running rollback test: $TestName" -Level DEBUG
        
        $testOutput = & $TestScript
        
        $result.Status = "Pass"
        $result.Message = "Test passed"
        if ($testOutput) {
            $result.Details["output"] = $testOutput
        }
    }
    catch {
        $errorMessage = $_.Exception.Message
        $result.Status = "Fail"
        $result.Message = $errorMessage
        $result.Details["error"] = $errorMessage
        Write-Log "Rollback test $TestName failed: $errorMessage" -Level ERROR
    }
    
    $result.Duration = ((Get-Date) - $startTime).TotalSeconds
    $script:TestResults += $result
    
    # Output result
    $statusColor = switch ($result.Status) {
        "Pass" { "Green" }
        "Fail" { "Red" }
        "Warning" { "Yellow" }
    }
    
    Write-Host "[$($result.Status.ToUpper())] $TestName ($($result.Duration.ToString('F2'))s) [$($result.Severity)]" -ForegroundColor $statusColor
    
    return $result
}

# Version verification tests
function Test-VersionVerification {
    Write-Log "Verifying rollback version..."
    
    # Check application version
    Invoke-RollbackTest -TestName "Application Version Check" -Category "Version" -Severity "Critical" -TestScript {
        $apiUrl = $BaseUrl -replace ":3000", ":3001"
        $response = Invoke-RestMethod -Uri "$apiUrl/api/version" -TimeoutSec 30
        
        if ($response.version -ne $RollbackVersion) {
            throw "Application version mismatch. Expected: $RollbackVersion, Actual: $($response.version)"
        }
        
        return @{ 
            current_version = $response.version
            rollback_version = $RollbackVersion
            build_date = $response.build_date
        }
    }
    
    # Check Docker image tags
    Invoke-RollbackTest -TestName "Docker Image Version" -Category "Version" -Severity "High" -TestScript {
        $containers = docker-compose ps --format json | ConvertFrom-Json
        $versionMismatches = @()
        
        foreach ($container in $containers) {
            $imageInfo = docker inspect $container.Image --format '{{.RepoTags}}'
            if ($imageInfo -notlike "*$RollbackVersion*") {
                $versionMismatches += @{
                    container = $container.Name
                    image = $container.Image
                    expected_version = $RollbackVersion
                }
            }
        }
        
        if ($versionMismatches.Count -gt 0) {
            throw "Docker image version mismatches found: $($versionMismatches | ConvertTo-Json -Compress)"
        }
        
        return @{ containers_checked = $containers.Count; version_matches = $true }
    }
    
    # Check deployment history
    Invoke-RollbackTest -TestName "Deployment History" -Category "Version" -Severity "Medium" -TestScript {
        $historyFile = "./deployment/deployment-history.json"
        
        if (-not (Test-Path $historyFile)) {
            throw "Deployment history file not found: $historyFile"
        }
        
        $history = Get-Content $historyFile | ConvertFrom-Json
        $latestDeployment = $history | Sort-Object timestamp -Descending | Select-Object -First 1
        
        if ($latestDeployment.type -ne "rollback") {
            throw "Latest deployment is not a rollback operation"
        }
        
        if ($latestDeployment.version -ne $RollbackVersion) {
            throw "Deployment history version mismatch. Expected: $RollbackVersion, Actual: $($latestDeployment.version)"
        }
        
        return @{
            latest_deployment = $latestDeployment
            rollback_confirmed = $true
        }
    }
}

# System health verification
function Test-SystemHealth {
    Write-Log "Verifying system health after rollback..."
    
    # Container health check
    Invoke-RollbackTest -TestName "Container Health" -Category "Health" -Severity "Critical" -TestScript {
        $containers = docker-compose ps --format json | ConvertFrom-Json
        $unhealthyContainers = $containers | Where-Object { $_.State -ne "running" }
        
        if ($unhealthyContainers.Count -gt 0) {
            $unhealthyNames = $unhealthyContainers | ForEach-Object { $_.Name }
            throw "Unhealthy containers found after rollback: $($unhealthyNames -join ', ')"
        }
        
        # Check container restart counts
        $restartCounts = @()
        foreach ($container in $containers) {
            $inspectResult = docker inspect $container.Name --format '{{.RestartCount}}'
            $restartCounts += @{
                container = $container.Name
                restart_count = [int]$inspectResult
            }
        }
        
        $highRestartContainers = $restartCounts | Where-Object { $_.restart_count -gt 3 }
        if ($highRestartContainers.Count -gt 0) {
            $containerNames = $highRestartContainers | ForEach-Object { $_.container }
            Write-Log "Warning: High restart counts detected: $($containerNames -join ', ')" -Level WARN
        }
        
        return @{
            total_containers = $containers.Count
            running_containers = ($containers | Where-Object { $_.State -eq "running" }).Count
            restart_counts = $restartCounts
        }
    }
    
    # Application health endpoints
    Invoke-RollbackTest -TestName "Application Health Endpoints" -Category "Health" -Severity "Critical" -TestScript {
        $healthChecks = @()
        
        # Frontend health
        try {
            $frontendResponse = Invoke-WebRequest -Uri "$BaseUrl/health" -TimeoutSec 30 -UseBasicParsing
            $healthChecks += @{
                service = "frontend"
                status = "healthy"
                status_code = $frontendResponse.StatusCode
            }
        }
        catch {
            $healthChecks += @{
                service = "frontend"
                status = "unhealthy"
                error = $_.Exception.Message
            }
        }
        
        # Backend health
        try {
            $apiUrl = $BaseUrl -replace ":3000", ":3001"
            $backendResponse = Invoke-WebRequest -Uri "$apiUrl/api/health" -TimeoutSec 30 -UseBasicParsing
            $healthData = $backendResponse.Content | ConvertFrom-Json
            $healthChecks += @{
                service = "backend"
                status = "healthy"
                status_code = $backendResponse.StatusCode
                details = $healthData
            }
        }
        catch {
            $healthChecks += @{
                service = "backend"
                status = "unhealthy"
                error = $_.Exception.Message
            }
        }
        
        $unhealthyServices = $healthChecks | Where-Object { $_.status -eq "unhealthy" }
        if ($unhealthyServices.Count -gt 0) {
            $serviceNames = $unhealthyServices | ForEach-Object { $_.service }
            throw "Unhealthy services detected after rollback: $($serviceNames -join ', ')"
        }
        
        return $healthChecks
    }
    
    # Database connectivity
    Invoke-RollbackTest -TestName "Database Connectivity" -Category "Health" -Severity "Critical" -TestScript {
        $dbResult = docker-compose exec -T postgres pg_isready -U postgres
        if ($LASTEXITCODE -ne 0) {
            throw "Database is not ready after rollback"
        }
        
        # Check database version/schema
        $schemaVersion = docker-compose exec -T postgres psql -U postgres -d blog_db -t -c "SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1;"
        
        return @{
            database_ready = $true
            schema_version = $schemaVersion.Trim()
        }
    }
    
    # Redis connectivity
    Invoke-RollbackTest -TestName "Redis Connectivity" -Category "Health" -Severity "High" -TestScript {
        $redisResult = docker-compose exec -T redis redis-cli ping
        if ($redisResult -ne "PONG") {
            throw "Redis is not responding after rollback"
        }
        
        # Check Redis memory usage
        $memoryInfo = docker-compose exec -T redis redis-cli info memory
        
        return @{
            redis_ready = $true
            memory_info = $memoryInfo
        }
    }
}

# Data integrity verification
function Test-DataIntegrity {
    Write-Log "Verifying data integrity after rollback..."
    
    # Database data integrity
    Invoke-RollbackTest -TestName "Database Data Integrity" -Category "Data" -Severity "Critical" -TestScript {
        $apiUrl = $BaseUrl -replace ":3000", ":3001"
        
        # Check critical tables
        $tableChecks = @()
        
        # Users table
        try {
            $usersResponse = Invoke-RestMethod -Uri "$apiUrl/api/users/count" -TimeoutSec 30
            $tableChecks += @{
                table = "users"
                count = $usersResponse.count
                status = "ok"
            }
        }
        catch {
            $tableChecks += @{
                table = "users"
                status = "error"
                error = $_.Exception.Message
            }
        }
        
        # Posts table
        try {
            $postsResponse = Invoke-RestMethod -Uri "$apiUrl/api/posts/count" -TimeoutSec 30
            $tableChecks += @{
                table = "posts"
                count = $postsResponse.count
                status = "ok"
            }
        }
        catch {
            $tableChecks += @{
                table = "posts"
                status = "error"
                error = $_.Exception.Message
            }
        }
        
        $errorTables = $tableChecks | Where-Object { $_.status -eq "error" }
        if ($errorTables.Count -gt 0) {
            $tableNames = $errorTables | ForEach-Object { $_.table }
            throw "Data integrity issues in tables: $($tableNames -join ', ')"
        }
        
        return $tableChecks
    }
    
    # File system integrity
    Invoke-RollbackTest -TestName "File System Integrity" -Category "Data" -Severity "High" -TestScript {
        $uploadDir = "./uploads"
        $configDir = "./config"
        
        $integrityChecks = @()
        
        # Check uploads directory
        if (Test-Path $uploadDir) {
            $uploadFiles = Get-ChildItem $uploadDir -Recurse -File
            $integrityChecks += @{
                directory = "uploads"
                file_count = $uploadFiles.Count
                status = "ok"
            }
        }
        else {
            $integrityChecks += @{
                directory = "uploads"
                status = "missing"
            }
        }
        
        # Check config directory
        if (Test-Path $configDir) {
            $configFiles = Get-ChildItem $configDir -Recurse -File
            $integrityChecks += @{
                directory = "config"
                file_count = $configFiles.Count
                status = "ok"
            }
        }
        else {
            $integrityChecks += @{
                directory = "config"
                status = "missing"
            }
        }
        
        $missingDirectories = $integrityChecks | Where-Object { $_.status -eq "missing" }
        if ($missingDirectories.Count -gt 0) {
            $dirNames = $missingDirectories | ForEach-Object { $_.directory }
            throw "Missing critical directories: $($dirNames -join ', ')"
        }
        
        return $integrityChecks
    }
    
    # Configuration integrity
    Invoke-RollbackTest -TestName "Configuration Integrity" -Category "Data" -Severity "High" -TestScript {
        $configFiles = @(
            "./docker-compose.yml",
            "./docker-compose.override.yml",
            "./config/database.json",
            "./config/redis.json"
        )
        
        $configChecks = @()
        
        foreach ($configFile in $configFiles) {
            if (Test-Path $configFile) {
                try {
                    # Validate JSON files
                    if ($configFile -like "*.json") {
                        $content = Get-Content $configFile | ConvertFrom-Json
                    }
                    
                    $configChecks += @{
                        file = $configFile
                        status = "valid"
                        size = (Get-Item $configFile).Length
                    }
                }
                catch {
                    $configChecks += @{
                        file = $configFile
                        status = "invalid"
                        error = $_.Exception.Message
                    }
                }
            }
            else {
                $configChecks += @{
                    file = $configFile
                    status = "missing"
                }
            }
        }
        
        $invalidConfigs = $configChecks | Where-Object { $_.status -in @("invalid", "missing") }
        if ($invalidConfigs.Count -gt 0) {
            $configNames = $invalidConfigs | ForEach-Object { $_.file }
            throw "Configuration issues found: $($configNames -join ', ')"
        }
        
        return $configChecks
    }
}

# Functional verification
function Test-FunctionalVerification {
    Write-Log "Verifying application functionality after rollback..."
    
    # Basic functionality test
    Invoke-RollbackTest -TestName "Basic Functionality" -Category "Functional" -Severity "Critical" -TestScript {
        # Homepage load
        $homepageResponse = Invoke-WebRequest -Uri $BaseUrl -TimeoutSec 30 -UseBasicParsing
        if ($homepageResponse.StatusCode -ne 200) {
            throw "Homepage not accessible after rollback"
        }
        
        # API endpoints
        $apiUrl = $BaseUrl -replace ":3000", ":3001"
        $apiResponse = Invoke-WebRequest -Uri "$apiUrl/api/posts" -TimeoutSec 30 -UseBasicParsing
        if ($apiResponse.StatusCode -ne 200) {
            throw "API endpoints not accessible after rollback"
        }
        
        return @{
            homepage_status = $homepageResponse.StatusCode
            api_status = $apiResponse.StatusCode
        }
    }
    
    # User authentication test
    Invoke-RollbackTest -TestName "User Authentication" -Category "Functional" -Severity "High" -TestScript {
        $apiUrl = $BaseUrl -replace ":3000", ":3001"
        
        # Try to access protected endpoint without auth
        try {
            $response = Invoke-WebRequest -Uri "$apiUrl/api/posts" -Method Post -TimeoutSec 30 -UseBasicParsing
            if ($response.StatusCode -eq 200) {
                throw "Protected endpoint accessible without authentication"
            }
        }
        catch {
            if ($_.Exception.Response.StatusCode -ne 401) {
                throw "Unexpected response from protected endpoint: $($_.Exception.Message)"
            }
        }
        
        return @{ authentication_working = $true }
    }
    
    # Database operations test
    Invoke-RollbackTest -TestName "Database Operations" -Category "Functional" -Severity "High" -TestScript {
        $apiUrl = $BaseUrl -replace ":3000", ":3001"
        
        # Test read operations
        $postsResponse = Invoke-RestMethod -Uri "$apiUrl/api/posts" -TimeoutSec 30
        if (-not $postsResponse.success) {
            throw "Database read operations failing"
        }
        
        # Test user lookup
        $usersResponse = Invoke-RestMethod -Uri "$apiUrl/api/users" -TimeoutSec 30
        if (-not $usersResponse.success) {
            throw "User lookup operations failing"
        }
        
        return @{
            posts_count = $postsResponse.data.Count
            users_count = $usersResponse.data.Count
        }
    }
}

# Performance verification
function Test-PerformanceVerification {
    Write-Log "Verifying performance after rollback..."
    
    # Response time test
    Invoke-RollbackTest -TestName "Response Time" -Category "Performance" -Severity "Medium" -TestScript {
        $measurements = @()
        
        for ($i = 1; $i -le 5; $i++) {
            $startTime = Get-Date
            $response = Invoke-WebRequest -Uri $BaseUrl -TimeoutSec 30 -UseBasicParsing
            $endTime = Get-Date
            
            $responseTime = ($endTime - $startTime).TotalMilliseconds
            $measurements += $responseTime
        }
        
        $avgResponseTime = ($measurements | Measure-Object -Average).Average
        
        # Warning if response time is significantly higher than expected
        if ($avgResponseTime -gt 3000) {
            throw "Response time degraded after rollback: $($avgResponseTime.ToString('F2'))ms"
        }
        
        return @{
            average_response_time = $avgResponseTime
            measurements = $measurements
        }
    }
    
    # Resource usage test
    Invoke-RollbackTest -TestName "Resource Usage" -Category "Performance" -Severity "Medium" -TestScript {
        $containers = docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemPerc}}" | Select-Object -Skip 1
        
        $resourceData = @()
        foreach ($line in $containers) {
            if ($line -match "^(\S+)\s+([\d\.]+)%\s+([\d\.]+)%") {
                $resourceData += @{
                    container = $matches[1]
                    cpu_percent = [double]$matches[2]
                    memory_percent = [double]$matches[3]
                }
            }
        }
        
        $highResourceContainers = $resourceData | Where-Object { $_.cpu_percent -gt 80 -or $_.memory_percent -gt 80 }
        if ($highResourceContainers.Count -gt 0) {
            $containerNames = $highResourceContainers | ForEach-Object { $_.container }
            Write-Log "Warning: High resource usage after rollback: $($containerNames -join ', ')" -Level WARN
        }
        
        return $resourceData
    }
}

# Generate rollback validation report
function New-RollbackValidationReport {
    $endTime = Get-Date
    $duration = $endTime - $script:StartTime
    
    $totalTests = $script:TestResults.Count
    $passedTests = ($script:TestResults | Where-Object { $_.Status -eq "Pass" }).Count
    $failedTests = ($script:TestResults | Where-Object { $_.Status -eq "Fail" }).Count
    $warningTests = ($script:TestResults | Where-Object { $_.Status -eq "Warning" }).Count
    
    $criticalFailures = ($script:TestResults | Where-Object { $_.Status -eq "Fail" -and $_.Severity -eq "Critical" }).Count
    $highFailures = ($script:TestResults | Where-Object { $_.Status -eq "Fail" -and $_.Severity -eq "High" }).Count
    
    $report = @{
        validation_id = $script:ValidationId
        timestamp = $script:StartTime.ToString("yyyy-MM-dd HH:mm:ss")
        environment = $Environment
        rollback_version = $RollbackVersion
        previous_version = $PreviousVersion
        base_url = $BaseUrl
        validation_type = $ValidationType
        duration_seconds = $duration.TotalSeconds
        summary = @{
            total_tests = $totalTests
            passed = $passedTests
            failed = $failedTests
            warnings = $warningTests
            critical_failures = $criticalFailures
            high_failures = $highFailures
            success_rate = if ($totalTests -gt 0) { ($passedTests / $totalTests) * 100 } else { 0 }
            rollback_success = ($criticalFailures -eq 0)
        }
        test_results = $script:TestResults
        rollback_data = $script:RollbackData
    }
    
    # Output based on format
    switch ($OutputFormat) {
        "json" {
            $jsonReport = $report | ConvertTo-Json -Depth 10
            if ($ReportFile) {
                $jsonReport | Set-Content $ReportFile
                Write-Log "JSON report saved to: $ReportFile"
            }
            else {
                Write-Output $jsonReport
            }
        }
        "html" {
            $htmlReport = ConvertTo-RollbackHtmlReport -Report $report
            if ($ReportFile) {
                $htmlReport | Set-Content $ReportFile
                Write-Log "HTML report saved to: $ReportFile"
            }
            else {
                Write-Output $htmlReport
            }
        }
        default {
            # Console output
            Write-Host "`n=== ROLLBACK VALIDATION SUMMARY ===" -ForegroundColor Cyan
            Write-Host "Environment: $Environment"
            Write-Host "Rollback Version: $RollbackVersion"
            if ($PreviousVersion) {
                Write-Host "Previous Version: $PreviousVersion"
            }
            Write-Host "Duration: $($duration.TotalSeconds.ToString('F2')) seconds"
            Write-Host "Total Tests: $totalTests"
            Write-Host "Passed: $passedTests" -ForegroundColor Green
            Write-Host "Failed: $failedTests" -ForegroundColor Red
            Write-Host "Warnings: $warningTests" -ForegroundColor Yellow
            Write-Host "Success Rate: $($report.summary.success_rate.ToString('F1'))%"
            
            if ($report.summary.rollback_success) {
                Write-Host "`nROLLBACK VALIDATION: SUCCESS" -ForegroundColor Green
            }
            else {
                Write-Host "`nROLLBACK VALIDATION: FAILED" -ForegroundColor Red
                Write-Host "Critical Failures: $criticalFailures" -ForegroundColor Red
                Write-Host "High Priority Failures: $highFailures" -ForegroundColor Red
            }
            
            if ($failedTests -gt 0) {
                Write-Host "`nFAILED TESTS:" -ForegroundColor Red
                $script:TestResults | Where-Object { $_.Status -eq "Fail" } | ForEach-Object {
                    Write-Host "  - [$($_.Severity)] $($_.Name): $($_.Message)" -ForegroundColor Red
                }
            }
        }
    }
    
    return $report
}

# Helper function to convert to HTML report
function ConvertTo-RollbackHtmlReport {
    param($Report)
    
    $html = @"
<!DOCTYPE html>
<html>
<head>
    <title>Rollback Validation Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background-color: #f0f0f0; padding: 20px; border-radius: 5px; }
        .summary { margin: 20px 0; }
        .success { color: green; font-weight: bold; }
        .failure { color: red; font-weight: bold; }
        .warning { color: orange; font-weight: bold; }
        .test-results { margin: 20px 0; }
        .test-pass { color: green; }
        .test-fail { color: red; }
        .test-warning { color: orange; }
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
        .critical { background-color: #ffebee; }
        .high { background-color: #fff3e0; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Rollback Validation Report</h1>
        <p><strong>Environment:</strong> $($Report.environment)</p>
        <p><strong>Rollback Version:</strong> $($Report.rollback_version)</p>
"@
    
    if ($Report.previous_version) {
        $html += "        <p><strong>Previous Version:</strong> $($Report.previous_version)</p>`n"
    }
    
    $html += @"
        <p><strong>Timestamp:</strong> $($Report.timestamp)</p>
        <p><strong>Duration:</strong> $($Report.duration_seconds.ToString('F2')) seconds</p>
    </div>
    
    <div class="summary">
        <h2>Summary</h2>
        <p><strong>Total Tests:</strong> $($Report.summary.total_tests)</p>
        <p><strong>Passed:</strong> <span class="success">$($Report.summary.passed)</span></p>
        <p><strong>Failed:</strong> <span class="failure">$($Report.summary.failed)</span></p>
        <p><strong>Warnings:</strong> <span class="warning">$($Report.summary.warnings)</span></p>
        <p><strong>Success Rate:</strong> $($Report.summary.success_rate.ToString('F1'))%</p>
        <p><strong>Rollback Status:</strong> 
"@
    
    if ($Report.summary.rollback_success) {
        $html += "<span class=\"success\">SUCCESS</span></p>`n"
    }
    else {
        $html += "<span class=\"failure\">FAILED</span></p>`n"
    }
    
    $html += @"
    </div>
    
    <div class="test-results">
        <h2>Test Results</h2>
        <table>
            <tr>
                <th>Test Name</th>
                <th>Category</th>
                <th>Status</th>
                <th>Severity</th>
                <th>Duration (s)</th>
                <th>Message</th>
            </tr>
"@
    
    foreach ($test in $Report.test_results) {
        $statusClass = switch ($test.Status) {
            "Pass" { "test-pass" }
            "Fail" { "test-fail" }
            "Warning" { "test-warning" }
        }
        
        $rowClass = switch ($test.Severity) {
            "Critical" { "critical" }
            "High" { "high" }
            default { "" }
        }
        
        $html += @"
            <tr class="$rowClass">
                <td>$($test.Name)</td>
                <td>$($test.Category)</td>
                <td class="$statusClass">$($test.Status)</td>
                <td>$($test.Severity)</td>
                <td>$($test.Duration.ToString('F2'))</td>
                <td>$($test.Message)</td>
            </tr>
"@
    }
    
    $html += @"
        </table>
    </div>
</body>
</html>
"@
    
    return $html
}

# Main rollback validation function
function Start-RollbackValidation {
    try {
        Write-Log "Starting rollback validation"
        Write-Log "Environment: $Environment, Rollback Version: $RollbackVersion, Validation Type: $ValidationType"
        
        # Always run version verification
        Test-VersionVerification
        
        # Always run system health
        Test-SystemHealth
        
        # Run additional tests based on validation type
        switch ($ValidationType) {
            "quick" {
                # Only basic functionality
                Test-FunctionalVerification
            }
            "data-integrity" {
                # Focus on data integrity
                Test-DataIntegrity
                Test-FunctionalVerification
            }
            "full" {
                # Run all tests
                Test-DataIntegrity
                Test-FunctionalVerification
                Test-PerformanceVerification
            }
        }
        
        # Generate report
        $report = New-RollbackValidationReport
        
        # Determine exit code
        $criticalFailures = ($script:TestResults | Where-Object { $_.Status -eq "Fail" -and $_.Severity -eq "Critical" }).Count
        if ($criticalFailures -gt 0) {
            Write-Log "Rollback validation failed with $criticalFailures critical failures" -Level ERROR
            exit 1
        }
        else {
            Write-Log "Rollback validation completed successfully"
            exit 0
        }
    }
    catch {
        Write-Log "Rollback validation error: $($_.Exception.Message)" -Level ERROR
        exit 1
    }
}

# Script entry point
if ($MyInvocation.InvocationName -ne '.') {
    Start-RollbackValidation
}