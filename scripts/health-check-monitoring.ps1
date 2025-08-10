#!/usr/bin/env pwsh

<#
.SYNOPSIS
    博客系统监控服务健康检查

.DESCRIPTION
    这个脚本用于检查监控堆栈中所有服务的健康状态，包括：
    - 服务可用性检查
    - 性能指标检查
    - 数据完整性检查
    - 告警状态检查
    - 生成健康报告

.PARAMETER Detailed
    显示详细的健康检查信息

.PARAMETER OutputFormat
    输出格式：console, json, html

.PARAMETER OutputFile
    输出文件路径（当格式为 json 或 html 时）

.PARAMETER Continuous
    持续监控模式，定期执行健康检查

.PARAMETER Interval
    持续监控的间隔时间（秒），默认60秒

.PARAMETER AlertThreshold
    告警阈值配置文件路径

.PARAMETER SendAlert
    发送告警通知（需要配置告警渠道）

.EXAMPLE
    .\health-check-monitoring.ps1
    执行基本健康检查

.EXAMPLE
    .\health-check-monitoring.ps1 -Detailed -OutputFormat json -OutputFile health-report.json
    执行详细检查并输出 JSON 报告

.EXAMPLE
    .\health-check-monitoring.ps1 -Continuous -Interval 30
    每30秒执行一次健康检查
#>

param(
    [Parameter(Mandatory = $false)]
    [switch]$Detailed,
    
    [Parameter(Mandatory = $false)]
    [ValidateSet("console", "json", "html")]
    [string]$OutputFormat = "console",
    
    [Parameter(Mandatory = $false)]
    [string]$OutputFile = "",
    
    [Parameter(Mandatory = $false)]
    [switch]$Continuous,
    
    [Parameter(Mandatory = $false)]
    [int]$Interval = 60,
    
    [Parameter(Mandatory = $false)]
    [string]$AlertThreshold = "monitoring/config/alert-thresholds.json",
    
    [Parameter(Mandatory = $false)]
    [switch]$SendAlert
)

# 设置错误处理
$ErrorActionPreference = "Stop"

# 全局变量
$script:HealthResults = @{}
$script:AlertThresholds = @{}
$script:StartTime = Get-Date

# 颜色输出函数
function Write-ColorOutput {
    param(
        [string]$Message,
        [string]$Color = "White"
    )
    
    if ($OutputFormat -eq "console") {
        $colorMap = @{
            "Red"     = [ConsoleColor]::Red
            "Green"   = [ConsoleColor]::Green
            "Yellow"  = [ConsoleColor]::Yellow
            "Blue"    = [ConsoleColor]::Blue
            "Magenta" = [ConsoleColor]::Magenta
            "Cyan"    = [ConsoleColor]::Cyan
            "White"   = [ConsoleColor]::White
        }
        
        Write-Host $Message -ForegroundColor $colorMap[$Color]
    }
}

# 加载告警阈值配置
function Import-AlertThresholds {
    if (Test-Path $AlertThreshold) {
        try {
            $script:AlertThresholds = Get-Content $AlertThreshold | ConvertFrom-Json -AsHashtable
            Write-ColorOutput "✅ 加载告警阈值配置: $AlertThreshold" "Green"
        }
        catch {
            Write-ColorOutput "⚠️ 无法加载告警阈值配置，使用默认值" "Yellow"
            Set-DefaultThresholds
        }
    }
    else {
        Write-ColorOutput "⚠️ 告警阈值配置文件不存在，使用默认值" "Yellow"
        Set-DefaultThresholds
    }
}

# 设置默认阈值
function Set-DefaultThresholds {
    $script:AlertThresholds = @{
        cpu_usage_percent = 80
        memory_usage_percent = 85
        disk_usage_percent = 90
        response_time_ms = 5000
        error_rate_percent = 5
        availability_percent = 99
    }
}

# HTTP 请求函数
function Invoke-HealthRequest {
    param(
        [string]$Url,
        [int]$TimeoutSec = 10,
        [string]$Method = "GET",
        [hashtable]$Headers = @{}
    )
    
    try {
        $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
        $response = Invoke-WebRequest -Uri $Url -Method $Method -Headers $Headers -TimeoutSec $TimeoutSec -ErrorAction Stop
        $stopwatch.Stop()
        
        return @{
            Success = $true
            StatusCode = $response.StatusCode
            ResponseTime = $stopwatch.ElapsedMilliseconds
            Content = $response.Content
            Error = $null
        }
    }
    catch {
        $stopwatch.Stop()
        return @{
            Success = $false
            StatusCode = 0
            ResponseTime = $stopwatch.ElapsedMilliseconds
            Content = ""
            Error = $_.Exception.Message
        }
    }
}

# 检查 Prometheus
function Test-PrometheusHealth {
    Write-ColorOutput "🔍 检查 Prometheus..." "Blue"
    
    $result = @{
        Service = "Prometheus"
        Status = "Unknown"
        Details = @{}
        Metrics = @{}
        Issues = @()
    }
    
    # 基本健康检查
    $healthCheck = Invoke-HealthRequest -Url "http://localhost:9090/-/healthy"
    $result.Details.HealthCheck = $healthCheck
    
    if ($healthCheck.Success) {
        $result.Status = "Healthy"
        
        # 检查配置
        $configCheck = Invoke-HealthRequest -Url "http://localhost:9090/api/v1/status/config"
        $result.Details.ConfigCheck = $configCheck
        
        # 检查目标状态
        $targetsCheck = Invoke-HealthRequest -Url "http://localhost:9090/api/v1/targets"
        if ($targetsCheck.Success) {
            $targets = ($targetsCheck.Content | ConvertFrom-Json).data.activeTargets
            $upTargets = ($targets | Where-Object { $_.health -eq "up" }).Count
            $totalTargets = $targets.Count
            
            $result.Metrics.TargetsUp = $upTargets
            $result.Metrics.TargetsTotal = $totalTargets
            $result.Metrics.TargetUpRate = if ($totalTargets -gt 0) { [math]::Round(($upTargets / $totalTargets) * 100, 2) } else { 0 }
            
            if ($result.Metrics.TargetUpRate -lt $script:AlertThresholds.availability_percent) {
                $result.Issues += "目标可用率低于阈值: $($result.Metrics.TargetUpRate)%"
            }
        }
        
        # 检查存储使用情况
        if ($Detailed) {
            $tsdbCheck = Invoke-HealthRequest -Url "http://localhost:9090/api/v1/status/tsdb"
            if ($tsdbCheck.Success) {
                $tsdbData = ($tsdbCheck.Content | ConvertFrom-Json).data
                $result.Metrics.SeriesCount = $tsdbData.seriesCountByMetricName | Measure-Object -Sum | Select-Object -ExpandProperty Sum
                $result.Metrics.ChunkCount = $tsdbData.chunkCount
            }
        }
    }
    else {
        $result.Status = "Unhealthy"
        $result.Issues += "服务不可访问: $($healthCheck.Error)"
    }
    
    $result.Metrics.ResponseTime = $healthCheck.ResponseTime
    if ($healthCheck.ResponseTime -gt $script:AlertThresholds.response_time_ms) {
        $result.Issues += "响应时间过长: $($healthCheck.ResponseTime)ms"
    }
    
    return $result
}

# 检查 Grafana
function Test-GrafanaHealth {
    Write-ColorOutput "📈 检查 Grafana..." "Blue"
    
    $result = @{
        Service = "Grafana"
        Status = "Unknown"
        Details = @{}
        Metrics = @{}
        Issues = @()
    }
    
    # 基本健康检查
    $healthCheck = Invoke-HealthRequest -Url "http://localhost:3000/api/health"
    $result.Details.HealthCheck = $healthCheck
    
    if ($healthCheck.Success) {
        $result.Status = "Healthy"
        
        # 检查数据源
        $datasourcesCheck = Invoke-HealthRequest -Url "http://localhost:3000/api/datasources" -Headers @{"Authorization" = "Basic " + [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("admin:admin"))}
        if ($datasourcesCheck.Success) {
            $datasources = $datasourcesCheck.Content | ConvertFrom-Json
            $result.Metrics.DatasourceCount = $datasources.Count
            
            # 检查数据源健康状态
            $healthyDatasources = 0
            foreach ($ds in $datasources) {
                $dsHealthCheck = Invoke-HealthRequest -Url "http://localhost:3000/api/datasources/$($ds.id)/health" -Headers @{"Authorization" = "Basic " + [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("admin:admin"))}
                if ($dsHealthCheck.Success) {
                    $healthyDatasources++
                }
            }
            
            $result.Metrics.HealthyDatasources = $healthyDatasources
            $result.Metrics.DatasourceHealthRate = if ($datasources.Count -gt 0) { [math]::Round(($healthyDatasources / $datasources.Count) * 100, 2) } else { 0 }
            
            if ($result.Metrics.DatasourceHealthRate -lt $script:AlertThresholds.availability_percent) {
                $result.Issues += "数据源健康率低于阈值: $($result.Metrics.DatasourceHealthRate)%"
            }
        }
        
        # 检查仪表板
        if ($Detailed) {
            $dashboardsCheck = Invoke-HealthRequest -Url "http://localhost:3000/api/search" -Headers @{"Authorization" = "Basic " + [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("admin:admin"))}
            if ($dashboardsCheck.Success) {
                $dashboards = $dashboardsCheck.Content | ConvertFrom-Json
                $result.Metrics.DashboardCount = $dashboards.Count
            }
        }
    }
    else {
        $result.Status = "Unhealthy"
        $result.Issues += "服务不可访问: $($healthCheck.Error)"
    }
    
    $result.Metrics.ResponseTime = $healthCheck.ResponseTime
    if ($healthCheck.ResponseTime -gt $script:AlertThresholds.response_time_ms) {
        $result.Issues += "响应时间过长: $($healthCheck.ResponseTime)ms"
    }
    
    return $result
}

# 检查 Alertmanager
function Test-AlertmanagerHealth {
    Write-ColorOutput "🚨 检查 Alertmanager..." "Blue"
    
    $result = @{
        Service = "Alertmanager"
        Status = "Unknown"
        Details = @{}
        Metrics = @{}
        Issues = @()
    }
    
    # 基本健康检查
    $healthCheck = Invoke-HealthRequest -Url "http://localhost:9093/-/healthy"
    $result.Details.HealthCheck = $healthCheck
    
    if ($healthCheck.Success) {
        $result.Status = "Healthy"
        
        # 检查告警状态
        $alertsCheck = Invoke-HealthRequest -Url "http://localhost:9093/api/v1/alerts"
        if ($alertsCheck.Success) {
            $alerts = ($alertsCheck.Content | ConvertFrom-Json).data
            $result.Metrics.ActiveAlerts = $alerts.Count
            $result.Metrics.FiringAlerts = ($alerts | Where-Object { $_.status.state -eq "firing" }).Count
            $result.Metrics.PendingAlerts = ($alerts | Where-Object { $_.status.state -eq "pending" }).Count
            
            if ($result.Metrics.FiringAlerts -gt 0) {
                $result.Issues += "存在 $($result.Metrics.FiringAlerts) 个触发中的告警"
            }
        }
        
        # 检查配置状态
        if ($Detailed) {
            $statusCheck = Invoke-HealthRequest -Url "http://localhost:9093/api/v1/status"
            if ($statusCheck.Success) {
                $status = ($statusCheck.Content | ConvertFrom-Json).data
                $result.Metrics.ConfigHash = $status.configHash
                $result.Metrics.VersionInfo = $status.versionInfo
            }
        }
    }
    else {
        $result.Status = "Unhealthy"
        $result.Issues += "服务不可访问: $($healthCheck.Error)"
    }
    
    $result.Metrics.ResponseTime = $healthCheck.ResponseTime
    if ($healthCheck.ResponseTime -gt $script:AlertThresholds.response_time_ms) {
        $result.Issues += "响应时间过长: $($healthCheck.ResponseTime)ms"
    }
    
    return $result
}

# 检查 Loki
function Test-LokiHealth {
    Write-ColorOutput "📝 检查 Loki..." "Blue"
    
    $result = @{
        Service = "Loki"
        Status = "Unknown"
        Details = @{}
        Metrics = @{}
        Issues = @()
    }
    
    # 基本健康检查
    $healthCheck = Invoke-HealthRequest -Url "http://localhost:3100/ready"
    $result.Details.HealthCheck = $healthCheck
    
    if ($healthCheck.Success) {
        $result.Status = "Healthy"
        
        # 检查标签
        $labelsCheck = Invoke-HealthRequest -Url "http://localhost:3100/loki/api/v1/labels"
        if ($labelsCheck.Success) {
            $labels = ($labelsCheck.Content | ConvertFrom-Json).data
            $result.Metrics.LabelCount = $labels.Count
        }
        
        # 检查指标
        if ($Detailed) {
            $metricsCheck = Invoke-HealthRequest -Url "http://localhost:3100/metrics"
            if ($metricsCheck.Success) {
                # 解析 Prometheus 格式的指标
                $metrics = $metricsCheck.Content
                if ($metrics -match 'loki_ingester_streams_total\s+(\d+)') {
                    $result.Metrics.StreamsTotal = [int]$matches[1]
                }
            }
        }
    }
    else {
        $result.Status = "Unhealthy"
        $result.Issues += "服务不可访问: $($healthCheck.Error)"
    }
    
    $result.Metrics.ResponseTime = $healthCheck.ResponseTime
    if ($healthCheck.ResponseTime -gt $script:AlertThresholds.response_time_ms) {
        $result.Issues += "响应时间过长: $($healthCheck.ResponseTime)ms"
    }
    
    return $result
}

# 检查 Jaeger
function Test-JaegerHealth {
    Write-ColorOutput "🔍 检查 Jaeger..." "Blue"
    
    $result = @{
        Service = "Jaeger"
        Status = "Unknown"
        Details = @{}
        Metrics = @{}
        Issues = @()
    }
    
    # 基本健康检查
    $healthCheck = Invoke-HealthRequest -Url "http://localhost:16686/"
    $result.Details.HealthCheck = $healthCheck
    
    if ($healthCheck.Success) {
        $result.Status = "Healthy"
        
        # 检查服务列表
        $servicesCheck = Invoke-HealthRequest -Url "http://localhost:16686/api/services"
        if ($servicesCheck.Success) {
            $services = ($servicesCheck.Content | ConvertFrom-Json).data
            $result.Metrics.ServiceCount = $services.Count
        }
        
        # 检查依赖关系
        if ($Detailed) {
            $dependenciesCheck = Invoke-HealthRequest -Url "http://localhost:16686/api/dependencies?endTs=$(([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()))"
            if ($dependenciesCheck.Success) {
                $dependencies = ($dependenciesCheck.Content | ConvertFrom-Json).data
                $result.Metrics.DependencyCount = $dependencies.Count
            }
        }
    }
    else {
        $result.Status = "Unhealthy"
        $result.Issues += "服务不可访问: $($healthCheck.Error)"
    }
    
    $result.Metrics.ResponseTime = $healthCheck.ResponseTime
    if ($healthCheck.ResponseTime -gt $script:AlertThresholds.response_time_ms) {
        $result.Issues += "响应时间过长: $($healthCheck.ResponseTime)ms"
    }
    
    return $result
}

# 检查 Elasticsearch
function Test-ElasticsearchHealth {
    Write-ColorOutput "🔍 检查 Elasticsearch..." "Blue"
    
    $result = @{
        Service = "Elasticsearch"
        Status = "Unknown"
        Details = @{}
        Metrics = @{}
        Issues = @()
    }
    
    # 基本健康检查
    $healthCheck = Invoke-HealthRequest -Url "http://localhost:9200/_cluster/health"
    $result.Details.HealthCheck = $healthCheck
    
    if ($healthCheck.Success) {
        $health = ($healthCheck.Content | ConvertFrom-Json)
        $result.Status = switch ($health.status) {
            "green" { "Healthy" }
            "yellow" { "Warning" }
            "red" { "Unhealthy" }
            default { "Unknown" }
        }
        
        $result.Metrics.ClusterStatus = $health.status
        $result.Metrics.NodeCount = $health.number_of_nodes
        $result.Metrics.DataNodeCount = $health.number_of_data_nodes
        $result.Metrics.ActiveShards = $health.active_shards
        $result.Metrics.RelocatingShards = $health.relocating_shards
        $result.Metrics.InitializingShards = $health.initializing_shards
        $result.Metrics.UnassignedShards = $health.unassigned_shards
        
        if ($health.status -eq "red") {
            $result.Issues += "集群状态为红色"
        }
        if ($health.unassigned_shards -gt 0) {
            $result.Issues += "存在 $($health.unassigned_shards) 个未分配的分片"
        }
        
        # 检查索引状态
        if ($Detailed) {
            $indicesCheck = Invoke-HealthRequest -Url "http://localhost:9200/_cat/indices?format=json"
            if ($indicesCheck.Success) {
                $indices = $indicesCheck.Content | ConvertFrom-Json
                $result.Metrics.IndexCount = $indices.Count
                $result.Metrics.TotalDocs = ($indices | Measure-Object -Property "docs.count" -Sum).Sum
                $result.Metrics.TotalSize = ($indices | Measure-Object -Property "store.size" -Sum).Sum
            }
        }
    }
    else {
        $result.Status = "Unhealthy"
        $result.Issues += "服务不可访问: $($healthCheck.Error)"
    }
    
    $result.Metrics.ResponseTime = $healthCheck.ResponseTime
    if ($healthCheck.ResponseTime -gt $script:AlertThresholds.response_time_ms) {
        $result.Issues += "响应时间过长: $($healthCheck.ResponseTime)ms"
    }
    
    return $result
}

# 检查 Kibana
function Test-KibanaHealth {
    Write-ColorOutput "📊 检查 Kibana..." "Blue"
    
    $result = @{
        Service = "Kibana"
        Status = "Unknown"
        Details = @{}
        Metrics = @{}
        Issues = @()
    }
    
    # 基本健康检查
    $healthCheck = Invoke-HealthRequest -Url "http://localhost:5601/api/status"
    $result.Details.HealthCheck = $healthCheck
    
    if ($healthCheck.Success) {
        $status = ($healthCheck.Content | ConvertFrom-Json)
        $result.Status = switch ($status.status.overall.state) {
            "green" { "Healthy" }
            "yellow" { "Warning" }
            "red" { "Unhealthy" }
            default { "Unknown" }
        }
        
        $result.Metrics.OverallStatus = $status.status.overall.state
        $result.Metrics.Version = $status.version.number
        
        # 检查各个服务状态
        if ($Detailed -and $status.status.statuses) {
            $unhealthyServices = $status.status.statuses | Where-Object { $_.state -ne "green" }
            if ($unhealthyServices) {
                foreach ($service in $unhealthyServices) {
                    $result.Issues += "服务 $($service.id) 状态异常: $($service.state)"
                }
            }
        }
    }
    else {
        $result.Status = "Unhealthy"
        $result.Issues += "服务不可访问: $($healthCheck.Error)"
    }
    
    $result.Metrics.ResponseTime = $healthCheck.ResponseTime
    if ($healthCheck.ResponseTime -gt $script:AlertThresholds.response_time_ms) {
        $result.Issues += "响应时间过长: $($healthCheck.ResponseTime)ms"
    }
    
    return $result
}

# 执行所有健康检查
function Invoke-AllHealthChecks {
    $script:HealthResults = @{}
    
    $services = @(
        { Test-PrometheusHealth },
        { Test-GrafanaHealth },
        { Test-AlertmanagerHealth },
        { Test-LokiHealth },
        { Test-JaegerHealth },
        { Test-ElasticsearchHealth },
        { Test-KibanaHealth }
    )
    
    foreach ($serviceCheck in $services) {
        try {
            $result = & $serviceCheck
            $script:HealthResults[$result.Service] = $result
        }
        catch {
            Write-ColorOutput "❌ 检查失败: $($_.Exception.Message)" "Red"
        }
    }
    
    # 计算总体健康状态
    $healthyCount = ($script:HealthResults.Values | Where-Object { $_.Status -eq "Healthy" }).Count
    $totalCount = $script:HealthResults.Count
    $overallHealthRate = if ($totalCount -gt 0) { [math]::Round(($healthyCount / $totalCount) * 100, 2) } else { 0 }
    
    $script:HealthResults["Overall"] = @{
        Service = "Overall"
        Status = if ($overallHealthRate -eq 100) { "Healthy" } elseif ($overallHealthRate -ge 80) { "Warning" } else { "Unhealthy" }
        HealthyServices = $healthyCount
        TotalServices = $totalCount
        HealthRate = $overallHealthRate
        CheckTime = Get-Date
        Duration = (Get-Date) - $script:StartTime
    }
}

# 输出控制台报告
function Write-ConsoleReport {
    Write-ColorOutput "📊 监控服务健康检查报告" "Cyan"
    Write-ColorOutput "============================" "Cyan"
    Write-ColorOutput "检查时间: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" "White"
    Write-ColorOutput "检查耗时: $([math]::Round($script:HealthResults.Overall.Duration.TotalSeconds, 2)) 秒" "White"
    Write-ColorOutput "" "White"
    
    # 总体状态
    $overall = $script:HealthResults.Overall
    $statusColor = switch ($overall.Status) {
        "Healthy" { "Green" }
        "Warning" { "Yellow" }
        "Unhealthy" { "Red" }
        default { "White" }
    }
    
    Write-ColorOutput "🎯 总体状态: $($overall.Status) ($($overall.HealthyServices)/$($overall.TotalServices) 服务健康)" $statusColor
    Write-ColorOutput "" "White"
    
    # 各服务状态
    foreach ($service in $script:HealthResults.Keys | Where-Object { $_ -ne "Overall" } | Sort-Object) {
        $result = $script:HealthResults[$service]
        $statusIcon = switch ($result.Status) {
            "Healthy" { "✅" }
            "Warning" { "⚠️" }
            "Unhealthy" { "❌" }
            default { "❓" }
        }
        
        $statusColor = switch ($result.Status) {
            "Healthy" { "Green" }
            "Warning" { "Yellow" }
            "Unhealthy" { "Red" }
            default { "White" }
        }
        
        Write-ColorOutput "$statusIcon $($result.Service): $($result.Status) ($($result.Metrics.ResponseTime)ms)" $statusColor
        
        if ($result.Issues.Count -gt 0) {
            foreach ($issue in $result.Issues) {
                Write-ColorOutput "   ⚠️ $issue" "Yellow"
            }
        }
        
        if ($Detailed -and $result.Metrics.Count -gt 1) {
            Write-ColorOutput "   📊 指标:" "Cyan"
            foreach ($metric in $result.Metrics.Keys | Where-Object { $_ -ne "ResponseTime" }) {
                Write-ColorOutput "      $metric: $($result.Metrics[$metric])" "White"
            }
        }
        
        Write-ColorOutput "" "White"
    }
}

# 输出 JSON 报告
function Write-JsonReport {
    $report = @{
        timestamp = Get-Date -Format "yyyy-MM-ddTHH:mm:ss.fffZ"
        duration_seconds = [math]::Round($script:HealthResults.Overall.Duration.TotalSeconds, 2)
        overall_status = $script:HealthResults.Overall.Status
        overall_health_rate = $script:HealthResults.Overall.HealthRate
        services = @{}
    }
    
    foreach ($service in $script:HealthResults.Keys | Where-Object { $_ -ne "Overall" }) {
        $report.services[$service] = $script:HealthResults[$service]
    }
    
    $jsonOutput = $report | ConvertTo-Json -Depth 10
    
    if ($OutputFile) {
        $jsonOutput | Out-File -FilePath $OutputFile -Encoding UTF8
        Write-ColorOutput "📄 JSON 报告已保存到: $OutputFile" "Green"
    }
    else {
        Write-Output $jsonOutput
    }
}

# 输出 HTML 报告
function Write-HtmlReport {
    $html = @"
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>监控服务健康检查报告</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background-color: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 30px; }
        .status-healthy { color: #28a745; }
        .status-warning { color: #ffc107; }
        .status-unhealthy { color: #dc3545; }
        .service-card { border: 1px solid #ddd; border-radius: 6px; margin: 10px 0; padding: 15px; }
        .service-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
        .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; margin-top: 10px; }
        .metric { background: #f8f9fa; padding: 8px; border-radius: 4px; }
        .issues { margin-top: 10px; }
        .issue { background: #fff3cd; border: 1px solid #ffeaa7; padding: 8px; margin: 5px 0; border-radius: 4px; }
        .overall-status { text-align: center; font-size: 24px; margin: 20px 0; padding: 20px; border-radius: 8px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📊 监控服务健康检查报告</h1>
            <p>检查时间: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')</p>
            <p>检查耗时: $([math]::Round($script:HealthResults.Overall.Duration.TotalSeconds, 2)) 秒</p>
        </div>
        
        <div class="overall-status status-$($script:HealthResults.Overall.Status.ToLower())">
            <h2>🎯 总体状态: $($script:HealthResults.Overall.Status)</h2>
            <p>$($script:HealthResults.Overall.HealthyServices)/$($script:HealthResults.Overall.TotalServices) 服务健康 ($($script:HealthResults.Overall.HealthRate)%)</p>
        </div>
"@
    
    foreach ($service in $script:HealthResults.Keys | Where-Object { $_ -ne "Overall" } | Sort-Object) {
        $result = $script:HealthResults[$service]
        $statusClass = "status-$($result.Status.ToLower())"
        
        $html += @"
        <div class="service-card">
            <div class="service-header">
                <h3>$($result.Service)</h3>
                <span class="$statusClass"><strong>$($result.Status)</strong></span>
            </div>
            <p>响应时间: $($result.Metrics.ResponseTime)ms</p>
"@
        
        if ($result.Issues.Count -gt 0) {
            $html += "<div class='issues'><h4>⚠️ 问题:</h4>"
            foreach ($issue in $result.Issues) {
                $html += "<div class='issue'>$issue</div>"
            }
            $html += "</div>"
        }
        
        if ($Detailed -and $result.Metrics.Count -gt 1) {
            $html += "<div class='metrics'><h4>📊 详细指标:</h4>"
            foreach ($metric in $result.Metrics.Keys | Where-Object { $_ -ne "ResponseTime" }) {
                $html += "<div class='metric'><strong>$metric:</strong> $($result.Metrics[$metric])</div>"
            }
            $html += "</div>"
        }
        
        $html += "</div>"
    }
    
    $html += @"
    </div>
</body>
</html>
"@
    
    if ($OutputFile) {
        $html | Out-File -FilePath $OutputFile -Encoding UTF8
        Write-ColorOutput "📄 HTML 报告已保存到: $OutputFile" "Green"
    }
    else {
        Write-Output $html
    }
}

# 发送告警
function Send-AlertNotification {
    if (-not $SendAlert) {
        return
    }
    
    $unhealthyServices = $script:HealthResults.Values | Where-Object { $_.Status -eq "Unhealthy" }
    $warningServices = $script:HealthResults.Values | Where-Object { $_.Status -eq "Warning" }
    
    if ($unhealthyServices.Count -gt 0 -or $warningServices.Count -gt 0) {
        $alertMessage = "监控服务健康检查告警`n`n"
        $alertMessage += "检查时间: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')`n"
        $alertMessage += "总体状态: $($script:HealthResults.Overall.Status)`n`n"
        
        if ($unhealthyServices.Count -gt 0) {
            $alertMessage += "❌ 不健康的服务:`n"
            foreach ($service in $unhealthyServices) {
                $alertMessage += "  - $($service.Service): $($service.Status)`n"
                foreach ($issue in $service.Issues) {
                    $alertMessage += "    * $issue`n"
                }
            }
            $alertMessage += "`n"
        }
        
        if ($warningServices.Count -gt 0) {
            $alertMessage += "⚠️ 警告状态的服务:`n"
            foreach ($service in $warningServices) {
                $alertMessage += "  - $($service.Service): $($service.Status)`n"
                foreach ($issue in $service.Issues) {
                    $alertMessage += "    * $issue`n"
                }
            }
        }
        
        # 这里可以集成实际的告警通知系统
        # 例如：发送邮件、Slack、钉钉、企业微信等
        Write-ColorOutput "🚨 告警通知:" "Red"
        Write-ColorOutput $alertMessage "Yellow"
        
        # 示例：写入告警日志文件
        $alertLogFile = "logs/health-check-alerts.log"
        if (-not (Test-Path (Split-Path $alertLogFile))) {
            New-Item -ItemType Directory -Path (Split-Path $alertLogFile) -Force | Out-Null
        }
        "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') - $alertMessage" | Add-Content -Path $alertLogFile
    }
}

# 主函数
function Main {
    try {
        Write-ColorOutput "🏥 博客系统监控服务健康检查" "Cyan"
        Write-ColorOutput "===================================" "Cyan"
        
        # 加载配置
        Import-AlertThresholds
        
        do {
            $script:StartTime = Get-Date
            
            # 执行健康检查
            Invoke-AllHealthChecks
            
            # 输出报告
            switch ($OutputFormat) {
                "console" { Write-ConsoleReport }
                "json" { Write-JsonReport }
                "html" { Write-HtmlReport }
            }
            
            # 发送告警
            Send-AlertNotification
            
            if ($Continuous) {
                Write-ColorOutput "⏳ 等待 $Interval 秒后进行下次检查..." "Yellow"
                Start-Sleep -Seconds $Interval
            }
        } while ($Continuous)
        
        Write-ColorOutput "✅ 健康检查完成!" "Green"
    }
    catch {
        Write-ColorOutput "❌ 健康检查失败: $($_.Exception.Message)" "Red"
        Write-ColorOutput "📋 错误详情: $($_.ScriptStackTrace)" "Red"
        exit 1
    }
}

# 执行主函数
Main