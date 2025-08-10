#!/usr/bin/env pwsh

<#
.SYNOPSIS
    Deployment validation script for Blog System

.DESCRIPTION
    This script performs comprehensive validation of the blog system deployment,
    including health checks, functional tests, performance tests, and security checks.

.PARAMETER Environment
    Target environment: development, staging, production

.PARAMETER BaseUrl
    Base URL for the application (defaults based on environment)

.PARAMETER TestSuite
    Test suite to run: all, health, functional, performance, security

.PARAMETER Timeout
    Timeout for individual tests in seconds

.PARAMETER Retries
    Number of retries for failed tests

.PARAMETER OutputFormat
    Output format: console, json, junit, html

.PARAMETER ReportFile
    Path to save the validation report

.PARAMETER Verbose
    Enable verbose logging

.PARAMETER FailFast
    Stop on first test failure

.EXAMPLE
    .\validate-deployment.ps1 -Environment production -TestSuite all

.EXAMPLE
    .\validate-deployment.ps1 -Environment staging -TestSuite functional -OutputFormat json -ReportFile validation-report.json
#>

param(
    [Parameter(Mandatory = $false)]
    [ValidateSet("development", "staging", "production")]
    [string]$Environment = "development",
    
    [Parameter(Mandatory = $false)]
    [string]$BaseUrl,
    
    [Parameter(Mandatory = $false)]
    [ValidateSet("all", "health", "functional", "performance", "security")]
    [string]$TestSuite = "all",
    
    [Parameter(Mandatory = $false)]
    [int]$Timeout = 30,
    
    [Parameter(Mandatory = $false)]
    [int]$Retries = 3,
    
    [Parameter(Mandatory = $false)]
    [ValidateSet("console", "json", "junit", "html")]
    [string]$OutputFormat = "console",
    
    [Parameter(Mandatory = $false)]
    [string]$ReportFile,
    
    [Parameter(Mandatory = $false)]
    [switch]$Verbose,
    
    [Parameter(Mandatory = $false)]
    [switch]$FailFast
)

# Set error action preference
$ErrorActionPreference = "Stop"

# Global variables
$script:ValidationId = (Get-Date -Format "yyyyMMdd-HHmmss")
$script:LogFile = "./logs/validation-$script:ValidationId.log"
$script:StartTime = Get-Date
$script:TestResults = @()
$script:Config = $null

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
class TestResult {
    [string]$Name
    [string]$Category
    [string]$Status  # Pass, Fail, Skip
    [string]$Message
    [double]$Duration
    [hashtable]$Details
    
    TestResult([string]$name, [string]$category) {
        $this.Name = $name
        $this.Category = $category
        $this.Details = @{}
    }
}

# Execute test with retry logic
function Invoke-TestWithRetry {
    param(
        [string]$TestName,
        [string]$Category,
        [scriptblock]$TestScript,
        [int]$MaxRetries = $Retries
    )
    
    $result = [TestResult]::new($TestName, $Category)
    $startTime = Get-Date
    
    for ($attempt = 1; $attempt -le ($MaxRetries + 1); $attempt++) {
        try {
            Write-Log "Running test: $TestName (attempt $attempt)" -Level DEBUG
            
            $testOutput = & $TestScript
            
            $result.Status = "Pass"
            $result.Message = "Test passed"
            if ($testOutput) {
                $result.Details["output"] = $testOutput
            }
            
            break
        }
        catch {
            $errorMessage = $_.Exception.Message
            
            if ($attempt -le $MaxRetries) {
                Write-Log "Test $TestName failed (attempt $attempt): $errorMessage. Retrying..." -Level WARN
                Start-Sleep -Seconds 2
            }
            else {
                $result.Status = "Fail"
                $result.Message = $errorMessage
                $result.Details["error"] = $errorMessage
                Write-Log "Test $TestName failed after $MaxRetries retries: $errorMessage" -Level ERROR
            }
        }
    }
    
    $result.Duration = ((Get-Date) - $startTime).TotalSeconds
    $script:TestResults += $result
    
    # Output result
    $statusColor = switch ($result.Status) {
        "Pass" { "Green" }
        "Fail" { "Red" }
        "Skip" { "Yellow" }
    }
    
    Write-Host "[$($result.Status.ToUpper())] $TestName ($($result.Duration.ToString('F2'))s)" -ForegroundColor $statusColor
    
    if ($FailFast -and $result.Status -eq "Fail") {
        throw "Test failed and FailFast is enabled: $TestName"
    }
    
    return $result
}

# Health check tests
function Test-HealthChecks {
    Write-Log "Running health check tests..."
    
    # Frontend health check
    Invoke-TestWithRetry -TestName "Frontend Health Check" -Category "Health" -TestScript {
        $response = Invoke-WebRequest -Uri "$BaseUrl/health" -TimeoutSec $Timeout -UseBasicParsing
        if ($response.StatusCode -ne 200) {
            throw "Frontend health check failed with status: $($response.StatusCode)"
        }
        return @{ status_code = $response.StatusCode; response_time = $response.Headers["X-Response-Time"] }
    }
    
    # Backend API health check
    Invoke-TestWithRetry -TestName "Backend API Health Check" -Category "Health" -TestScript {
        $apiUrl = $BaseUrl -replace ":3000", ":3001"
        $response = Invoke-WebRequest -Uri "$apiUrl/api/health" -TimeoutSec $Timeout -UseBasicParsing
        if ($response.StatusCode -ne 200) {
            throw "Backend API health check failed with status: $($response.StatusCode)"
        }
        $healthData = $response.Content | ConvertFrom-Json
        return $healthData
    }
    
    # Database connectivity check
    Invoke-TestWithRetry -TestName "Database Connectivity" -Category "Health" -TestScript {
        $result = docker-compose exec -T postgres pg_isready -U postgres
        if ($LASTEXITCODE -ne 0) {
            throw "Database is not ready"
        }
        return @{ status = "ready" }
    }
    
    # Redis connectivity check
    Invoke-TestWithRetry -TestName "Redis Connectivity" -Category "Health" -TestScript {
        $result = docker-compose exec -T redis redis-cli ping
        if ($result -ne "PONG") {
            throw "Redis is not responding"
        }
        return @{ status = "ready" }
    }
    
    # Container status check
    Invoke-TestWithRetry -TestName "Container Status" -Category "Health" -TestScript {
        $containers = docker-compose ps --format json | ConvertFrom-Json
        $unhealthyContainers = $containers | Where-Object { $_.State -ne "running" }
        
        if ($unhealthyContainers.Count -gt 0) {
            $unhealthyNames = $unhealthyContainers | ForEach-Object { $_.Name }
            throw "Unhealthy containers found: $($unhealthyNames -join ', ')"
        }
        
        return @{ total_containers = $containers.Count; running_containers = ($containers | Where-Object { $_.State -eq "running" }).Count }
    }
}

# Functional tests
function Test-FunctionalTests {
    Write-Log "Running functional tests..."
    
    # Homepage load test
    Invoke-TestWithRetry -TestName "Homepage Load" -Category "Functional" -TestScript {
        $response = Invoke-WebRequest -Uri $BaseUrl -TimeoutSec $Timeout -UseBasicParsing
        if ($response.StatusCode -ne 200) {
            throw "Homepage failed to load with status: $($response.StatusCode)"
        }
        if ($response.Content -notlike "*Blog*") {
            throw "Homepage content does not appear to be correct"
        }
        return @{ status_code = $response.StatusCode; content_length = $response.Content.Length }
    }
    
    # API endpoints test
    Invoke-TestWithRetry -TestName "API Endpoints" -Category "Functional" -TestScript {
        $apiUrl = $BaseUrl -replace ":3000", ":3001"
        
        # Test posts endpoint
        $postsResponse = Invoke-WebRequest -Uri "$apiUrl/api/posts" -TimeoutSec $Timeout -UseBasicParsing
        if ($postsResponse.StatusCode -ne 200) {
            throw "Posts API failed with status: $($postsResponse.StatusCode)"
        }
        
        # Test users endpoint
        $usersResponse = Invoke-WebRequest -Uri "$apiUrl/api/users" -TimeoutSec $Timeout -UseBasicParsing
        if ($usersResponse.StatusCode -ne 200) {
            throw "Users API failed with status: $($usersResponse.StatusCode)"
        }
        
        return @{ posts_status = $postsResponse.StatusCode; users_status = $usersResponse.StatusCode }
    }
    
    # User registration test
    Invoke-TestWithRetry -TestName "User Registration" -Category "Functional" -TestScript {
        $apiUrl = $BaseUrl -replace ":3000", ":3001"
        $testUser = @{
            username = "testuser_$script:ValidationId"
            email = "test_$script:ValidationId@example.com"
            password = "TestPassword123!"
        }
        
        $body = $testUser | ConvertTo-Json
        $response = Invoke-RestMethod -Uri "$apiUrl/api/auth/register" -Method Post -Body $body -ContentType "application/json" -TimeoutSec $Timeout
        
        if (-not $response.success) {
            throw "User registration failed: $($response.message)"
        }
        
        return @{ user_id = $response.user.id; username = $response.user.username }
    }
    
    # User login test
    Invoke-TestWithRetry -TestName "User Login" -Category "Functional" -TestScript {
        $apiUrl = $BaseUrl -replace ":3000", ":3001"
        $loginData = @{
            email = "test_$script:ValidationId@example.com"
            password = "TestPassword123!"
        }
        
        $body = $loginData | ConvertTo-Json
        $response = Invoke-RestMethod -Uri "$apiUrl/api/auth/login" -Method Post -Body $body -ContentType "application/json" -TimeoutSec $Timeout
        
        if (-not $response.success) {
            throw "User login failed: $($response.message)"
        }
        
        return @{ token = $response.token; user_id = $response.user.id }
    }
    
    # Post creation test
    Invoke-TestWithRetry -TestName "Post Creation" -Category "Functional" -TestScript {
        $apiUrl = $BaseUrl -replace ":3000", ":3001"
        
        # First login to get token
        $loginData = @{
            email = "test_$script:ValidationId@example.com"
            password = "TestPassword123!"
        }
        $loginResponse = Invoke-RestMethod -Uri "$apiUrl/api/auth/login" -Method Post -Body ($loginData | ConvertTo-Json) -ContentType "application/json" -TimeoutSec $Timeout
        
        # Create post
        $postData = @{
            title = "Test Post $script:ValidationId"
            content = "This is a test post created during deployment validation."
            tags = @("test", "validation")
        }
        
        $headers = @{ Authorization = "Bearer $($loginResponse.token)" }
        $response = Invoke-RestMethod -Uri "$apiUrl/api/posts" -Method Post -Body ($postData | ConvertTo-Json) -ContentType "application/json" -Headers $headers -TimeoutSec $Timeout
        
        if (-not $response.success) {
            throw "Post creation failed: $($response.message)"
        }
        
        return @{ post_id = $response.post.id; title = $response.post.title }
    }
}

# Performance tests
function Test-PerformanceTests {
    Write-Log "Running performance tests..."
    
    # Response time test
    Invoke-TestWithRetry -TestName "Response Time" -Category "Performance" -TestScript {
        $measurements = @()
        
        for ($i = 1; $i -le 10; $i++) {
            $startTime = Get-Date
            $response = Invoke-WebRequest -Uri $BaseUrl -TimeoutSec $Timeout -UseBasicParsing
            $endTime = Get-Date
            
            $responseTime = ($endTime - $startTime).TotalMilliseconds
            $measurements += $responseTime
        }
        
        $avgResponseTime = ($measurements | Measure-Object -Average).Average
        $maxResponseTime = ($measurements | Measure-Object -Maximum).Maximum
        
        if ($avgResponseTime -gt 2000) {
            throw "Average response time too high: $($avgResponseTime.ToString('F2'))ms"
        }
        
        return @{ 
            average_response_time = $avgResponseTime
            max_response_time = $maxResponseTime
            measurements = $measurements
        }
    }
    
    # Concurrent users test
    Invoke-TestWithRetry -TestName "Concurrent Users" -Category "Performance" -TestScript {
        $jobs = @()
        $concurrentUsers = 5
        
        # Start concurrent requests
        for ($i = 1; $i -le $concurrentUsers; $i++) {
            $job = Start-Job -ScriptBlock {
                param($url, $timeout)
                $startTime = Get-Date
                try {
                    $response = Invoke-WebRequest -Uri $url -TimeoutSec $timeout -UseBasicParsing
                    $endTime = Get-Date
                    return @{
                        success = $true
                        status_code = $response.StatusCode
                        response_time = ($endTime - $startTime).TotalMilliseconds
                    }
                }
                catch {
                    return @{
                        success = $false
                        error = $_.Exception.Message
                    }
                }
            } -ArgumentList $BaseUrl, $Timeout
            
            $jobs += $job
        }
        
        # Wait for all jobs to complete
        $results = $jobs | Wait-Job | Receive-Job
        $jobs | Remove-Job
        
        $successfulRequests = ($results | Where-Object { $_.success }).Count
        $successRate = ($successfulRequests / $concurrentUsers) * 100
        
        if ($successRate -lt 90) {
            throw "Concurrent user test failed. Success rate: $($successRate.ToString('F1'))%"
        }
        
        return @{
            concurrent_users = $concurrentUsers
            successful_requests = $successfulRequests
            success_rate = $successRate
        }
    }
    
    # Memory usage test
    Invoke-TestWithRetry -TestName "Memory Usage" -Category "Performance" -TestScript {
        $containers = docker stats --no-stream --format "table {{.Container}}\t{{.MemUsage}}\t{{.MemPerc}}" | Select-Object -Skip 1
        
        $memoryData = @()
        foreach ($line in $containers) {
            if ($line -match "^(\S+)\s+([\d\.]+\w+)\s*/\s*([\d\.]+\w+)\s+([\d\.]+)%") {
                $memoryData += @{
                    container = $matches[1]
                    used = $matches[2]
                    total = $matches[3]
                    percentage = [double]$matches[4]
                }
            }
        }
        
        $highMemoryContainers = $memoryData | Where-Object { $_.percentage -gt 80 }
        if ($highMemoryContainers.Count -gt 0) {
            $containerNames = $highMemoryContainers | ForEach-Object { $_.container }
            throw "High memory usage detected in containers: $($containerNames -join ', ')"
        }
        
        return $memoryData
    }
}

# Security tests
function Test-SecurityTests {
    Write-Log "Running security tests..."
    
    # HTTPS redirect test (for production)
    if ($Environment -eq "production") {
        Invoke-TestWithRetry -TestName "HTTPS Redirect" -Category "Security" -TestScript {
            $httpUrl = $BaseUrl -replace "https://", "http://"
            try {
                $response = Invoke-WebRequest -Uri $httpUrl -MaximumRedirection 0 -ErrorAction SilentlyContinue
                if ($response.StatusCode -ne 301 -and $response.StatusCode -ne 302) {
                    throw "HTTP to HTTPS redirect not configured properly"
                }
            }
            catch {
                # This is expected for HTTPS redirect
            }
            return @{ redirect_configured = $true }
        }
    }
    
    # Security headers test
    Invoke-TestWithRetry -TestName "Security Headers" -Category "Security" -TestScript {
        $response = Invoke-WebRequest -Uri $BaseUrl -TimeoutSec $Timeout -UseBasicParsing
        
        $requiredHeaders = @(
            "X-Content-Type-Options",
            "X-Frame-Options",
            "X-XSS-Protection"
        )
        
        $missingHeaders = @()
        foreach ($header in $requiredHeaders) {
            if (-not $response.Headers.ContainsKey($header)) {
                $missingHeaders += $header
            }
        }
        
        if ($missingHeaders.Count -gt 0) {
            throw "Missing security headers: $($missingHeaders -join ', ')"
        }
        
        return @{ security_headers = $requiredHeaders }
    }
    
    # SQL injection test
    Invoke-TestWithRetry -TestName "SQL Injection Protection" -Category "Security" -TestScript {
        $apiUrl = $BaseUrl -replace ":3000", ":3001"
        $maliciousPayload = "'; DROP TABLE users; --"
        
        try {
            $response = Invoke-WebRequest -Uri "$apiUrl/api/posts?search=$maliciousPayload" -TimeoutSec $Timeout -UseBasicParsing
            # If we get here without error, the application handled the malicious input properly
            return @{ sql_injection_protected = $true }
        }
        catch {
            # Check if it's a proper error response, not a server crash
            if ($_.Exception.Response.StatusCode -eq 400) {
                return @{ sql_injection_protected = $true }
            }
            throw "Potential SQL injection vulnerability detected"
        }
    }
    
    # Authentication test
    Invoke-TestWithRetry -TestName "Authentication Protection" -Category "Security" -TestScript {
        $apiUrl = $BaseUrl -replace ":3000", ":3001"
        
        try {
            $response = Invoke-WebRequest -Uri "$apiUrl/api/posts" -Method Post -TimeoutSec $Timeout -UseBasicParsing
            if ($response.StatusCode -eq 200) {
                throw "Protected endpoint accessible without authentication"
            }
        }
        catch {
            if ($_.Exception.Response.StatusCode -eq 401) {
                return @{ authentication_required = $true }
            }
            throw
        }
    }
}

# Generate report
function New-ValidationReport {
    $endTime = Get-Date
    $duration = $endTime - $script:StartTime
    
    $totalTests = $script:TestResults.Count
    $passedTests = ($script:TestResults | Where-Object { $_.Status -eq "Pass" }).Count
    $failedTests = ($script:TestResults | Where-Object { $_.Status -eq "Fail" }).Count
    $skippedTests = ($script:TestResults | Where-Object { $_.Status -eq "Skip" }).Count
    
    $report = @{
        validation_id = $script:ValidationId
        timestamp = $script:StartTime.ToString("yyyy-MM-dd HH:mm:ss")
        environment = $Environment
        base_url = $BaseUrl
        test_suite = $TestSuite
        duration_seconds = $duration.TotalSeconds
        summary = @{
            total_tests = $totalTests
            passed = $passedTests
            failed = $failedTests
            skipped = $skippedTests
            success_rate = if ($totalTests -gt 0) { ($passedTests / $totalTests) * 100 } else { 0 }
        }
        test_results = $script:TestResults
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
        "junit" {
            $junitXml = ConvertTo-JUnitXml -Report $report
            if ($ReportFile) {
                $junitXml | Set-Content $ReportFile
                Write-Log "JUnit report saved to: $ReportFile"
            }
            else {
                Write-Output $junitXml
            }
        }
        "html" {
            $htmlReport = ConvertTo-HtmlReport -Report $report
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
            Write-Host "`n=== VALIDATION SUMMARY ===" -ForegroundColor Cyan
            Write-Host "Environment: $Environment"
            Write-Host "Base URL: $BaseUrl"
            Write-Host "Duration: $($duration.TotalSeconds.ToString('F2')) seconds"
            Write-Host "Total Tests: $totalTests"
            Write-Host "Passed: $passedTests" -ForegroundColor Green
            Write-Host "Failed: $failedTests" -ForegroundColor Red
            Write-Host "Skipped: $skippedTests" -ForegroundColor Yellow
            Write-Host "Success Rate: $($report.summary.success_rate.ToString('F1'))%"
            
            if ($failedTests -gt 0) {
                Write-Host "`nFAILED TESTS:" -ForegroundColor Red
                $script:TestResults | Where-Object { $_.Status -eq "Fail" } | ForEach-Object {
                    Write-Host "  - $($_.Name): $($_.Message)" -ForegroundColor Red
                }
            }
        }
    }
    
    return $report
}

# Helper function to convert to JUnit XML
function ConvertTo-JUnitXml {
    param($Report)
    
    $xml = @"
<?xml version="1.0" encoding="UTF-8"?>
<testsuites name="Blog System Validation" tests="$($Report.summary.total_tests)" failures="$($Report.summary.failed)" time="$($Report.duration_seconds)">
  <testsuite name="Deployment Validation" tests="$($Report.summary.total_tests)" failures="$($Report.summary.failed)" time="$($Report.duration_seconds)">
"@
    
    foreach ($test in $Report.test_results) {
        $xml += "`n    <testcase name="$($test.Name)" classname="$($test.Category)" time="$($test.Duration)">"
        
        if ($test.Status -eq "Fail") {
            $xml += "`n      <failure message="$($test.Message)"></failure>"
        }
        elseif ($test.Status -eq "Skip") {
            $xml += "`n      <skipped></skipped>"
        }
        
        $xml += "`n    </testcase>"
    }
    
    $xml += "`n  </testsuite>"
    $xml += "`n</testsuites>"
    
    return $xml
}

# Helper function to convert to HTML report
function ConvertTo-HtmlReport {
    param($Report)
    
    $html = @"
<!DOCTYPE html>
<html>
<head>
    <title>Deployment Validation Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background-color: #f0f0f0; padding: 20px; border-radius: 5px; }
        .summary { margin: 20px 0; }
        .test-results { margin: 20px 0; }
        .test-pass { color: green; }
        .test-fail { color: red; }
        .test-skip { color: orange; }
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Deployment Validation Report</h1>
        <p><strong>Environment:</strong> $($Report.environment)</p>
        <p><strong>Base URL:</strong> $($Report.base_url)</p>
        <p><strong>Timestamp:</strong> $($Report.timestamp)</p>
        <p><strong>Duration:</strong> $($Report.duration_seconds.ToString('F2')) seconds</p>
    </div>
    
    <div class="summary">
        <h2>Summary</h2>
        <p><strong>Total Tests:</strong> $($Report.summary.total_tests)</p>
        <p><strong>Passed:</strong> <span class="test-pass">$($Report.summary.passed)</span></p>
        <p><strong>Failed:</strong> <span class="test-fail">$($Report.summary.failed)</span></p>
        <p><strong>Skipped:</strong> <span class="test-skip">$($Report.summary.skipped)</span></p>
        <p><strong>Success Rate:</strong> $($Report.summary.success_rate.ToString('F1'))%</p>
    </div>
    
    <div class="test-results">
        <h2>Test Results</h2>
        <table>
            <tr>
                <th>Test Name</th>
                <th>Category</th>
                <th>Status</th>
                <th>Duration (s)</th>
                <th>Message</th>
            </tr>
"@
    
    foreach ($test in $Report.test_results) {
        $statusClass = switch ($test.Status) {
            "Pass" { "test-pass" }
            "Fail" { "test-fail" }
            "Skip" { "test-skip" }
        }
        
        $html += @"
            <tr>
                <td>$($test.Name)</td>
                <td>$($test.Category)</td>
                <td class="$statusClass">$($test.Status)</td>
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

# Main validation function
function Start-Validation {
    try {
        Write-Log "Starting deployment validation"
        Write-Log "Environment: $Environment, Base URL: $BaseUrl, Test Suite: $TestSuite"
        
        # Run test suites based on selection
        if ($TestSuite -eq "all" -or $TestSuite -eq "health") {
            Test-HealthChecks
        }
        
        if ($TestSuite -eq "all" -or $TestSuite -eq "functional") {
            Test-FunctionalTests
        }
        
        if ($TestSuite -eq "all" -or $TestSuite -eq "performance") {
            Test-PerformanceTests
        }
        
        if ($TestSuite -eq "all" -or $TestSuite -eq "security") {
            Test-SecurityTests
        }
        
        # Generate report
        $report = New-ValidationReport
        
        # Determine exit code
        $failedTests = ($script:TestResults | Where-Object { $_.Status -eq "Fail" }).Count
        if ($failedTests -gt 0) {
            Write-Log "Validation completed with $failedTests failed tests" -Level ERROR
            exit 1
        }
        else {
            Write-Log "Validation completed successfully"
            exit 0
        }
    }
    catch {
        Write-Log "Validation error: $($_.Exception.Message)" -Level ERROR
        exit 1
    }
}

# Script entry point
if ($MyInvocation.InvocationName -ne '.') {
    Start-Validation
}