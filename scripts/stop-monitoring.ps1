#!/usr/bin/env pwsh

<#
.SYNOPSIS
    停止博客系统监控服务

.DESCRIPTION
    这个脚本用于安全地停止监控堆栈中的所有服务，包括：
    - 优雅停止所有容器
    - 清理临时数据（可选）
    - 备份重要数据（可选）
    - 显示停止状态

.PARAMETER Services
    要停止的服务列表，用逗号分隔。如果不指定，将停止所有服务

.PARAMETER RemoveVolumes
    停止服务时删除数据卷

.PARAMETER RemoveImages
    停止服务时删除镜像

.PARAMETER Backup
    停止前备份重要数据

.PARAMETER Force
    强制停止服务（不等待优雅关闭）

.PARAMETER Timeout
    等待服务停止的超时时间（秒），默认30秒

.EXAMPLE
    .\stop-monitoring.ps1
    停止所有监控服务

.EXAMPLE
    .\stop-monitoring.ps1 -Services "prometheus,grafana"
    只停止 Prometheus 和 Grafana

.EXAMPLE
    .\stop-monitoring.ps1 -RemoveVolumes -Backup
    停止服务、删除数据卷并备份数据

.EXAMPLE
    .\stop-monitoring.ps1 -Force -Timeout 10
    强制停止服务，超时时间10秒
#>

param(
    [Parameter(Mandatory = $false)]
    [string]$Services = "",
    
    [Parameter(Mandatory = $false)]
    [switch]$RemoveVolumes,
    
    [Parameter(Mandatory = $false)]
    [switch]$RemoveImages,
    
    [Parameter(Mandatory = $false)]
    [switch]$Backup,
    
    [Parameter(Mandatory = $false)]
    [switch]$Force,
    
    [Parameter(Mandatory = $false)]
    [int]$Timeout = 30
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

# 检查服务状态
function Get-ServiceStatus {
    Write-ColorOutput "🔍 检查服务状态..." "Blue"
    
    try {
        $runningServices = docker compose -f docker-compose.monitoring.yml ps --services --filter "status=running"
        if ($runningServices) {
            Write-ColorOutput "📊 运行中的服务:" "Yellow"
            $runningServices | ForEach-Object {
                Write-ColorOutput "  - $_" "White"
            }
            return $runningServices
        }
        else {
            Write-ColorOutput "ℹ️ 没有运行中的监控服务" "Yellow"
            return @()
        }
    }
    catch {
        Write-ColorOutput "❌ 无法获取服务状态: $($_.Exception.Message)" "Red"
        return @()
    }
}

# 备份数据
function Backup-MonitoringData {
    if (-not $Backup) {
        return
    }
    
    Write-ColorOutput "💾 备份监控数据..." "Blue"
    
    $backupDir = "backups/monitoring/$(Get-Date -Format 'yyyy-MM-dd_HH-mm-ss')"
    
    try {
        # 创建备份目录
        New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
        
        # 备份 Prometheus 数据
        if (Test-Path "monitoring/prometheus/data") {
            Write-ColorOutput "📊 备份 Prometheus 数据..." "Yellow"
            Copy-Item -Path "monitoring/prometheus/data" -Destination "$backupDir/prometheus" -Recurse -Force
        }
        
        # 备份 Grafana 数据
        if (Test-Path "monitoring/grafana/data") {
            Write-ColorOutput "📈 备份 Grafana 数据..." "Yellow"
            Copy-Item -Path "monitoring/grafana/data" -Destination "$backupDir/grafana" -Recurse -Force
        }
        
        # 备份 Alertmanager 数据
        if (Test-Path "monitoring/alertmanager/data") {
            Write-ColorOutput "🚨 备份 Alertmanager 数据..." "Yellow"
            Copy-Item -Path "monitoring/alertmanager/data" -Destination "$backupDir/alertmanager" -Recurse -Force
        }
        
        # 备份 Loki 数据
        if (Test-Path "monitoring/loki/data") {
            Write-ColorOutput "📝 备份 Loki 数据..." "Yellow"
            Copy-Item -Path "monitoring/loki/data" -Destination "$backupDir/loki" -Recurse -Force
        }
        
        # 备份 Elasticsearch 数据
        if (Test-Path "monitoring/elasticsearch/data") {
            Write-ColorOutput "🔍 备份 Elasticsearch 数据..." "Yellow"
            Copy-Item -Path "monitoring/elasticsearch/data" -Destination "$backupDir/elasticsearch" -Recurse -Force
        }
        
        # 备份配置文件
        Write-ColorOutput "⚙️ 备份配置文件..." "Yellow"
        $configFiles = @(
            "docker-compose.monitoring.yml",
            "monitoring/prometheus/prometheus.yml",
            "monitoring/grafana/grafana.ini",
            "monitoring/alertmanager/alertmanager.yml",
            "monitoring/loki/loki.yml",
            "monitoring/jaeger/jaeger.yml"
        )
        
        New-Item -ItemType Directory -Path "$backupDir/config" -Force | Out-Null
        foreach ($file in $configFiles) {
            if (Test-Path $file) {
                $fileName = Split-Path $file -Leaf
                Copy-Item -Path $file -Destination "$backupDir/config/$fileName" -Force
            }
        }
        
        # 创建备份信息文件
        $backupInfo = @{
            timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
            services = $runningServices
            backup_size = (Get-ChildItem -Path $backupDir -Recurse | Measure-Object -Property Length -Sum).Sum
        }
        
        $backupInfo | ConvertTo-Json | Out-File -FilePath "$backupDir/backup-info.json" -Encoding UTF8
        
        Write-ColorOutput "✅ 数据备份完成: $backupDir" "Green"
        
        # 显示备份大小
        $backupSize = (Get-ChildItem -Path $backupDir -Recurse | Measure-Object -Property Length -Sum).Sum
        $backupSizeMB = [math]::Round($backupSize / 1MB, 2)
        Write-ColorOutput "📦 备份大小: $backupSizeMB MB" "Cyan"
    }
    catch {
        Write-ColorOutput "❌ 备份失败: $($_.Exception.Message)" "Red"
    }
}

# 停止服务
function Stop-MonitoringServices {
    param(
        [array]$RunningServices
    )
    
    if ($RunningServices.Count -eq 0) {
        Write-ColorOutput "ℹ️ 没有需要停止的服务" "Yellow"
        return
    }
    
    Write-ColorOutput "🛑 停止监控服务..." "Blue"
    
    $composeArgs = @(
        "compose",
        "-f", "docker-compose.monitoring.yml",
        "down"
    )
    
    if ($Force) {
        $composeArgs += "--timeout", "0"
        Write-ColorOutput "⚡ 强制停止模式" "Yellow"
    }
    else {
        $composeArgs += "--timeout", $Timeout.ToString()
        Write-ColorOutput "⏱️ 优雅停止模式 (超时: $Timeout 秒)" "Yellow"
    }
    
    if ($RemoveVolumes) {
        $composeArgs += "--volumes"
        Write-ColorOutput "🗑️ 将删除数据卷" "Yellow"
    }
    
    if ($RemoveImages) {
        $composeArgs += "--rmi", "all"
        Write-ColorOutput "🗑️ 将删除镜像" "Yellow"
    }
    
    if ($Services) {
        $serviceList = $Services -split "," | ForEach-Object { $_.Trim() }
        # 对于指定服务，使用 stop 命令而不是 down
        $composeArgs = @(
            "compose",
            "-f", "docker-compose.monitoring.yml",
            "stop"
        )
        
        if ($Force) {
            $composeArgs += "--timeout", "0"
        }
        else {
            $composeArgs += "--timeout", $Timeout.ToString()
        }
        
        $composeArgs += $serviceList
        Write-ColorOutput "🎯 停止指定服务: $($serviceList -join ', ')" "Yellow"
    }
    
    try {
        Write-ColorOutput "⏳ 正在停止服务..." "Yellow"
        & docker @composeArgs
        
        if ($Services) {
            Write-ColorOutput "✅ 指定服务停止成功" "Green"
        }
        else {
            Write-ColorOutput "✅ 所有服务停止成功" "Green"
        }
    }
    catch {
        Write-ColorOutput "❌ 服务停止失败: $($_.Exception.Message)" "Red"
        
        # 尝试强制停止
        if (-not $Force) {
            Write-ColorOutput "🔄 尝试强制停止..." "Yellow"
            try {
                docker compose -f docker-compose.monitoring.yml kill
                docker compose -f docker-compose.monitoring.yml rm -f
                Write-ColorOutput "✅ 强制停止成功" "Green"
            }
            catch {
                Write-ColorOutput "❌ 强制停止也失败: $($_.Exception.Message)" "Red"
                exit 1
            }
        }
        else {
            exit 1
        }
    }
}

# 清理资源
function Clear-Resources {
    Write-ColorOutput "🧹 清理资源..." "Blue"
    
    try {
        # 清理未使用的网络
        Write-ColorOutput "🌐 清理未使用的网络..." "Yellow"
        docker network prune -f | Out-Null
        
        # 清理未使用的卷（如果指定）
        if ($RemoveVolumes) {
            Write-ColorOutput "💾 清理未使用的数据卷..." "Yellow"
            docker volume prune -f | Out-Null
        }
        
        # 清理未使用的镜像（如果指定）
        if ($RemoveImages) {
            Write-ColorOutput "🖼️ 清理未使用的镜像..." "Yellow"
            docker image prune -f | Out-Null
        }
        
        Write-ColorOutput "✅ 资源清理完成" "Green"
    }
    catch {
        Write-ColorOutput "⚠️ 资源清理部分失败: $($_.Exception.Message)" "Yellow"
    }
}

# 显示停止后状态
function Show-StopStatus {
    Write-ColorOutput "📊 停止后状态" "Cyan"
    Write-ColorOutput "===============" "Cyan"
    
    try {
        $remainingServices = docker compose -f docker-compose.monitoring.yml ps --services --filter "status=running"
        if ($remainingServices) {
            Write-ColorOutput "⚠️ 仍在运行的服务:" "Yellow"
            $remainingServices | ForEach-Object {
                Write-ColorOutput "  - $_" "White"
            }
        }
        else {
            Write-ColorOutput "✅ 所有监控服务已停止" "Green"
        }
        
        # 显示磁盘使用情况
        if (Test-Path "monitoring") {
            $monitoringSize = (Get-ChildItem -Path "monitoring" -Recurse -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum
            $monitoringSizeMB = [math]::Round($monitoringSize / 1MB, 2)
            Write-ColorOutput "💾 监控数据大小: $monitoringSizeMB MB" "Cyan"
        }
        
        # 显示 Docker 资源使用
        Write-ColorOutput "🐳 Docker 资源使用:" "Cyan"
        docker system df
        
    }
    catch {
        Write-ColorOutput "⚠️ 无法获取状态信息: $($_.Exception.Message)" "Yellow"
    }
    
    Write-ColorOutput "===============" "Cyan"
    
    Write-ColorOutput "📋 有用的命令:" "Cyan"
    Write-ColorOutput "  重新启动:     .\scripts\start-monitoring.ps1" "White"
    Write-ColorOutput "  查看日志:     docker compose -f docker-compose.monitoring.yml logs [service]" "White"
    Write-ColorOutput "  清理系统:     docker system prune -a" "White"
    Write-ColorOutput "  查看镜像:     docker images | grep -E '(prometheus|grafana|loki|jaeger)'" "White"
}

# 确认操作
function Confirm-Operation {
    if ($Force) {
        return $true
    }
    
    $message = "确定要停止监控服务吗?"
    if ($RemoveVolumes) {
        $message += " (将删除数据卷)"
    }
    if ($RemoveImages) {
        $message += " (将删除镜像)"
    }
    
    $confirmation = Read-Host "$message [y/N]"
    return $confirmation -eq "y" -or $confirmation -eq "Y" -or $confirmation -eq "yes"
}

# 主函数
function Main {
    try {
        Write-ColorOutput "🛑 博客系统监控服务停止器" "Cyan"
        Write-ColorOutput "================================" "Cyan"
        
        # 检查当前服务状态
        $runningServices = Get-ServiceStatus
        
        if ($runningServices.Count -eq 0) {
            Write-ColorOutput "ℹ️ 没有运行中的监控服务需要停止" "Yellow"
            return
        }
        
        # 确认操作
        if (-not (Confirm-Operation)) {
            Write-ColorOutput "❌ 操作已取消" "Yellow"
            return
        }
        
        # 备份数据
        Backup-MonitoringData
        
        # 停止服务
        Stop-MonitoringServices -RunningServices $runningServices
        
        # 清理资源
        Clear-Resources
        
        # 显示停止后状态
        Show-StopStatus
        
        Write-ColorOutput "✅ 监控服务停止完成!" "Green"
        
        if ($Backup) {
            Write-ColorOutput "💾 数据已备份到 backups/monitoring/ 目录" "Cyan"
        }
    }
    catch {
        Write-ColorOutput "❌ 停止失败: $($_.Exception.Message)" "Red"
        Write-ColorOutput "📋 错误详情: $($_.ScriptStackTrace)" "Red"
        exit 1
    }
}

# 执行主函数
Main