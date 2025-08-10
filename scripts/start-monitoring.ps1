#!/usr/bin/env pwsh

<#
.SYNOPSIS
    启动博客系统监控服务

.DESCRIPTION
    这个脚本用于启动完整的监控堆栈，包括：
    - Prometheus (指标收集)
    - Grafana (可视化)
    - Alertmanager (告警)
    - Loki (日志聚合)
    - Jaeger (分布式追踪)
    - Elasticsearch (日志存储)
    - Kibana (日志可视化)
    - 各种 Exporters 和 Beats

.PARAMETER Environment
    部署环境 (development, staging, production)

.PARAMETER Services
    要启动的服务列表，用逗号分隔。如果不指定，将启动所有服务

.PARAMETER SkipHealthCheck
    跳过健康检查

.PARAMETER Detached
    后台运行服务

.PARAMETER Recreate
    重新创建容器

.PARAMETER Pull
    启动前拉取最新镜像

.EXAMPLE
    .\start-monitoring.ps1
    启动所有监控服务

.EXAMPLE
    .\start-monitoring.ps1 -Environment production -Services "prometheus,grafana"
    在生产环境启动 Prometheus 和 Grafana

.EXAMPLE
    .\start-monitoring.ps1 -Detached -Pull
    后台启动所有服务并拉取最新镜像
#>

param(
    [Parameter(Mandatory = $false)]
    [ValidateSet("development", "staging", "production")]
    [string]$Environment = "development",
    
    [Parameter(Mandatory = $false)]
    [string]$Services = "",
    
    [Parameter(Mandatory = $false)]
    [switch]$SkipHealthCheck,
    
    [Parameter(Mandatory = $false)]
    [switch]$Detached,
    
    [Parameter(Mandatory = $false)]
    [switch]$Recreate,
    
    [Parameter(Mandatory = $false)]
    [switch]$Pull
)

# 设置错误处理
$ErrorActionPreference = "Stop"

# 颜色输出函数
function Write-ColorOutput {
    param(
        [string]$Message,
        [string]$Color = "White"
    )
    
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

# 检查依赖
function Test-Dependencies {
    Write-ColorOutput "🔍 检查依赖..." "Blue"
    
    # 检查 Docker
    try {
        $dockerVersion = docker --version
        Write-ColorOutput "✅ Docker: $dockerVersion" "Green"
    }
    catch {
        Write-ColorOutput "❌ Docker 未安装或不可用" "Red"
        exit 1
    }
    
    # 检查 Docker Compose
    try {
        $composeVersion = docker compose version
        Write-ColorOutput "✅ Docker Compose: $composeVersion" "Green"
    }
    catch {
        Write-ColorOutput "❌ Docker Compose 未安装或不可用" "Red"
        exit 1
    }
    
    # 检查配置文件
    $configFiles = @(
        "docker-compose.monitoring.yml",
        "monitoring/prometheus/prometheus.yml",
        "monitoring/grafana/grafana.ini",
        "monitoring/alertmanager/alertmanager.yml",
        "monitoring/loki/loki.yml",
        "monitoring/jaeger/jaeger.yml"
    )
    
    foreach ($file in $configFiles) {
        if (Test-Path $file) {
            Write-ColorOutput "✅ 配置文件: $file" "Green"
        }
        else {
            Write-ColorOutput "❌ 配置文件缺失: $file" "Red"
            exit 1
        }
    }
}

# 设置环境变量
function Set-EnvironmentVariables {
    Write-ColorOutput "🔧 设置环境变量..." "Blue"
    
    $env:ENVIRONMENT = $Environment
    $env:COMPOSE_PROJECT_NAME = "blog-system-monitoring"
    $env:COMPOSE_FILE = "docker-compose.monitoring.yml"
    
    # 根据环境设置不同的配置
    switch ($Environment) {
        "development" {
            $env:LOG_LEVEL = "debug"
            $env:RETENTION_DAYS = "7"
            $env:SCRAPE_INTERVAL = "15s"
        }
        "staging" {
            $env:LOG_LEVEL = "info"
            $env:RETENTION_DAYS = "30"
            $env:SCRAPE_INTERVAL = "30s"
        }
        "production" {
            $env:LOG_LEVEL = "warn"
            $env:RETENTION_DAYS = "90"
            $env:SCRAPE_INTERVAL = "60s"
        }
    }
    
    Write-ColorOutput "✅ 环境: $Environment" "Green"
    Write-ColorOutput "✅ 日志级别: $($env:LOG_LEVEL)" "Green"
    Write-ColorOutput "✅ 数据保留: $($env:RETENTION_DAYS) 天" "Green"
}

# 创建必要的目录
function New-RequiredDirectories {
    Write-ColorOutput "📁 创建必要的目录..." "Blue"
    
    $directories = @(
        "monitoring/prometheus/data",
        "monitoring/grafana/data",
        "monitoring/grafana/logs",
        "monitoring/alertmanager/data",
        "monitoring/loki/data",
        "monitoring/elasticsearch/data",
        "monitoring/elasticsearch/logs",
        "monitoring/kibana/data",
        "monitoring/jaeger/data",
        "logs"
    )
    
    foreach ($dir in $directories) {
        if (-not (Test-Path $dir)) {
            New-Item -ItemType Directory -Path $dir -Force | Out-Null
            Write-ColorOutput "✅ 创建目录: $dir" "Green"
        }
    }
    
    # 设置权限 (Linux/macOS)
    if ($IsLinux -or $IsMacOS) {
        chmod -R 755 monitoring/
        chown -R 1000:1000 monitoring/elasticsearch/data
        chown -R 472:472 monitoring/grafana/data
    }
}

# 拉取镜像
function Update-Images {
    if ($Pull) {
        Write-ColorOutput "📥 拉取最新镜像..." "Blue"
        docker compose -f docker-compose.monitoring.yml pull
        Write-ColorOutput "✅ 镜像更新完成" "Green"
    }
}

# 启动服务
function Start-MonitoringServices {
    Write-ColorOutput "🚀 启动监控服务..." "Blue"
    
    $composeArgs = @(
        "compose",
        "-f", "docker-compose.monitoring.yml",
        "up"
    )
    
    if ($Detached) {
        $composeArgs += "--detach"
    }
    
    if ($Recreate) {
        $composeArgs += "--force-recreate"
    }
    
    if ($Services) {
        $serviceList = $Services -split "," | ForEach-Object { $_.Trim() }
        $composeArgs += $serviceList
        Write-ColorOutput "🎯 启动指定服务: $($serviceList -join ', ')" "Yellow"
    }
    else {
        Write-ColorOutput "🎯 启动所有监控服务" "Yellow"
    }
    
    try {
        & docker @composeArgs
        Write-ColorOutput "✅ 服务启动成功" "Green"
    }
    catch {
        Write-ColorOutput "❌ 服务启动失败: $($_.Exception.Message)" "Red"
        exit 1
    }
}

# 健康检查
function Test-ServiceHealth {
    if ($SkipHealthCheck) {
        Write-ColorOutput "⏭️ 跳过健康检查" "Yellow"
        return
    }
    
    Write-ColorOutput "🏥 执行健康检查..." "Blue"
    
    $services = @(
        @{ Name = "Prometheus"; Url = "http://localhost:9090/-/healthy"; Port = 9090 },
        @{ Name = "Grafana"; Url = "http://localhost:3000/api/health"; Port = 3000 },
        @{ Name = "Alertmanager"; Url = "http://localhost:9093/-/healthy"; Port = 9093 },
        @{ Name = "Loki"; Url = "http://localhost:3100/ready"; Port = 3100 },
        @{ Name = "Jaeger"; Url = "http://localhost:16686/"; Port = 16686 },
        @{ Name = "Elasticsearch"; Url = "http://localhost:9200/_cluster/health"; Port = 9200 },
        @{ Name = "Kibana"; Url = "http://localhost:5601/api/status"; Port = 5601 }
    )
    
    $maxRetries = 30
    $retryInterval = 10
    
    foreach ($service in $services) {
        Write-ColorOutput "🔍 检查 $($service.Name)..." "Yellow"
        
        $retries = 0
        $healthy = $false
        
        while ($retries -lt $maxRetries -and -not $healthy) {
            try {
                # 检查端口是否开放
                $tcpClient = New-Object System.Net.Sockets.TcpClient
                $tcpClient.ConnectAsync("localhost", $service.Port).Wait(1000)
                
                if ($tcpClient.Connected) {
                    # 尝试 HTTP 请求
                    $response = Invoke-WebRequest -Uri $service.Url -Method GET -TimeoutSec 5 -ErrorAction SilentlyContinue
                    if ($response.StatusCode -eq 200) {
                        Write-ColorOutput "✅ $($service.Name) 健康" "Green"
                        $healthy = $true
                    }
                }
                
                $tcpClient.Close()
            }
            catch {
                # 忽略错误，继续重试
            }
            
            if (-not $healthy) {
                $retries++
                if ($retries -lt $maxRetries) {
                    Write-ColorOutput "⏳ $($service.Name) 未就绪，等待 $retryInterval 秒... ($retries/$maxRetries)" "Yellow"
                    Start-Sleep -Seconds $retryInterval
                }
            }
        }
        
        if (-not $healthy) {
            Write-ColorOutput "❌ $($service.Name) 健康检查失败" "Red"
        }
    }
}

# 显示服务信息
function Show-ServiceInfo {
    Write-ColorOutput "📊 监控服务信息" "Cyan"
    Write-ColorOutput "===================" "Cyan"
    Write-ColorOutput "🔍 Prometheus:     http://localhost:9090" "White"
    Write-ColorOutput "📈 Grafana:        http://localhost:3000 (admin/admin)" "White"
    Write-ColorOutput "🚨 Alertmanager:   http://localhost:9093" "White"
    Write-ColorOutput "📝 Loki:           http://localhost:3100" "White"
    Write-ColorOutput "🔍 Jaeger:         http://localhost:16686" "White"
    Write-ColorOutput "🔍 Elasticsearch:  http://localhost:9200" "White"
    Write-ColorOutput "📊 Kibana:         http://localhost:5601" "White"
    Write-ColorOutput "📊 Node Exporter:  http://localhost:9100" "White"
    Write-ColorOutput "📊 cAdvisor:       http://localhost:8080" "White"
    Write-ColorOutput "🌐 Traefik:        http://localhost:8080" "White"
    Write-ColorOutput "===================" "Cyan"
    
    Write-ColorOutput "📋 有用的命令:" "Cyan"
    Write-ColorOutput "  查看服务状态: docker compose -f docker-compose.monitoring.yml ps" "White"
    Write-ColorOutput "  查看日志:     docker compose -f docker-compose.monitoring.yml logs -f [service]" "White"
    Write-ColorOutput "  停止服务:     docker compose -f docker-compose.monitoring.yml down" "White"
    Write-ColorOutput "  重启服务:     docker compose -f docker-compose.monitoring.yml restart [service]" "White"
}

# 主函数
function Main {
    try {
        Write-ColorOutput "🚀 博客系统监控服务启动器" "Cyan"
        Write-ColorOutput "================================" "Cyan"
        
        Test-Dependencies
        Set-EnvironmentVariables
        New-RequiredDirectories
        Update-Images
        Start-MonitoringServices
        
        if ($Detached) {
            Start-Sleep -Seconds 5  # 等待服务启动
            Test-ServiceHealth
        }
        
        Show-ServiceInfo
        
        Write-ColorOutput "✅ 监控服务启动完成!" "Green"
        
        if (-not $Detached) {
            Write-ColorOutput "💡 按 Ctrl+C 停止服务" "Yellow"
        }
    }
    catch {
        Write-ColorOutput "❌ 启动失败: $($_.Exception.Message)" "Red"
        Write-ColorOutput "📋 错误详情: $($_.ScriptStackTrace)" "Red"
        exit 1
    }
}

# 执行主函数
Main