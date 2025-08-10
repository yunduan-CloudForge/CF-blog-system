# 自动化部署脚本 (PowerShell版本)
# 支持多环境部署、健康检查、回滚等功能

param(
    [string]$Environment = "development",
    [string]$ImageTag = "latest",
    [string]$Registry = "",
    [string]$ComposeFile = "",
    [switch]$NoBackup,
    [switch]$NoRollback,
    [switch]$NoSmokeTest,
    [int]$Timeout = 300,
    [string]$RollbackVersion = "",
    [switch]$Status,
    [switch]$Logs,
    [switch]$Cleanup,
    [switch]$Help
)

# 全局变量
$ServiceName = "blog-system"
$HealthCheckTimeout = $Timeout
$RollbackEnabled = -not $NoRollback
$BackupEnabled = -not $NoBackup
$SmokeTestEnabled = -not $NoSmokeTest

# 颜色函数
function Write-ColorOutput {
    param(
        [string]$Message,
        [string]$Color = "White"
    )
    Write-Host $Message -ForegroundColor $Color
}

function Write-Info {
    param([string]$Message)
    Write-ColorOutput "[INFO] $Message" "Cyan"
}

function Write-Success {
    param([string]$Message)
    Write-ColorOutput "[SUCCESS] $Message" "Green"
}

function Write-Warning {
    param([string]$Message)
    Write-ColorOutput "[WARNING] $Message" "Yellow"
}

function Write-Error {
    param([string]$Message)
    Write-ColorOutput "[ERROR] $Message" "Red"
}

# 显示帮助信息
function Show-Help {
    @"
自动化部署脚本 (PowerShell版本)

用法: .\deploy.ps1 [参数]

参数:
    -Environment <env>          部署环境 (development|test|production)
    -ImageTag <tag>             Docker镜像标签
    -Registry <registry>        Docker镜像仓库
    -ComposeFile <file>         Docker Compose文件
    -NoBackup                   禁用部署前备份
    -NoRollback                 禁用自动回滚
    -NoSmokeTest                禁用冒烟测试
    -Timeout <seconds>          健康检查超时时间 (默认: 300)
    -RollbackVersion <version>  回滚到指定版本
    -Status                     查看部署状态
    -Logs                       查看服务日志
    -Cleanup                    清理旧镜像和容器
    -Help                       显示此帮助信息

示例:
    .\deploy.ps1 -Environment production -ImageTag v1.2.3
    .\deploy.ps1 -RollbackVersion v1.2.2
    .\deploy.ps1 -Status
    .\deploy.ps1 -Cleanup
"@
}

# 验证环境
function Test-Environment {
    Write-Info "验证部署环境..."
    
    # 检查必需的命令
    $requiredCommands = @("docker", "docker-compose")
    foreach ($cmd in $requiredCommands) {
        if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) {
            Write-Error "缺少必需命令: $cmd"
            exit 1
        }
    }
    
    # 检查Docker是否运行
    try {
        docker info | Out-Null
    }
    catch {
        Write-Error "Docker未运行或无权限访问"
        exit 1
    }
    
    # 验证环境参数
    if ($Environment -notin @("development", "test", "production")) {
        Write-Error "无效的环境: $Environment"
        exit 1
    }
    
    Write-Success "环境验证通过: $Environment"
    
    # 设置环境特定的compose文件
    if ([string]::IsNullOrEmpty($ComposeFile)) {
        switch ($Environment) {
            "development" { $script:ComposeFile = "docker-compose.dev.yml" }
            "production" { $script:ComposeFile = "docker-compose.prod.yml" }
            default { $script:ComposeFile = "docker-compose.yml" }
        }
    }
    
    # 检查compose文件是否存在
    if (-not (Test-Path $script:ComposeFile)) {
        Write-Error "Compose文件不存在: $script:ComposeFile"
        exit 1
    }
}

# 加载环境变量
function Import-Environment {
    Write-Info "加载环境变量..."
    
    # 加载通用环境变量
    if (Test-Path ".env") {
        Get-Content ".env" | Where-Object { $_ -notmatch '^#' -and $_ -match '=' } | ForEach-Object {
            $key, $value = $_ -split '=', 2
            [Environment]::SetEnvironmentVariable($key, $value, "Process")
        }
        Write-Info "已加载 .env 文件"
    }
    
    # 加载环境特定的变量
    $envFile = ".env.$Environment"
    if (Test-Path $envFile) {
        Get-Content $envFile | Where-Object { $_ -notmatch '^#' -and $_ -match '=' } | ForEach-Object {
            $key, $value = $_ -split '=', 2
            [Environment]::SetEnvironmentVariable($key, $value, "Process")
        }
        Write-Info "已加载 $envFile 文件"
    }
    
    # 设置镜像名称
    if (-not [string]::IsNullOrEmpty($Registry)) {
        $script:ImageName = "$Registry/$ServiceName`:$ImageTag"
    } else {
        $script:ImageName = "$ServiceName`:$ImageTag"
    }
    
    [Environment]::SetEnvironmentVariable("ENVIRONMENT", $Environment, "Process")
    [Environment]::SetEnvironmentVariable("IMAGE_TAG", $ImageTag, "Process")
    [Environment]::SetEnvironmentVariable("IMAGE_NAME", $script:ImageName, "Process")
}

# 备份当前部署
function Backup-CurrentDeployment {
    if (-not $BackupEnabled) {
        Write-Info "跳过备份（已禁用）"
        return
    }
    
    Write-Info "备份当前部署..."
    
    $backupDir = "backups\$(Get-Date -Format 'yyyyMMdd_HHmmss')"
    New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
    
    # 备份数据库
    $postgresRunning = docker-compose -f $script:ComposeFile ps | Select-String "postgres"
    if ($postgresRunning) {
        Write-Info "备份数据库..."
        $dbUsername = $env:DB_USERNAME
        $dbName = $env:DB_NAME
        if ($dbUsername -and $dbName) {
            docker-compose -f $script:ComposeFile exec -T postgres pg_dump -U $dbUsername $dbName > "$backupDir\database.sql"
            Write-Success "数据库备份完成"
        }
    }
    
    # 备份上传文件
    if (Test-Path "uploads") {
        Write-Info "备份上传文件..."
        Compress-Archive -Path "uploads\*" -DestinationPath "$backupDir\uploads.zip" -Force
        Write-Success "上传文件备份完成"
    }
    
    # 保存当前镜像信息
    docker-compose -f $script:ComposeFile images > "$backupDir\images.txt"
    
    # 保存备份信息
    @"
BACKUP_DATE=$(Get-Date)
ENVIRONMENT=$Environment
IMAGE_TAG=$ImageTag
"@ | Out-File -FilePath "$backupDir\backup.info" -Encoding UTF8
    
    Write-Success "备份完成: $backupDir"
    $backupDir | Out-File -FilePath ".last_backup" -Encoding UTF8
}

# 拉取最新镜像
function Get-LatestImages {
    Write-Info "拉取Docker镜像..."
    
    if (-not [string]::IsNullOrEmpty($Registry)) {
        Write-Info "从仓库拉取镜像: $script:ImageName"
        docker pull $script:ImageName
        if ($LASTEXITCODE -ne 0) {
            Write-Error "镜像拉取失败"
            exit 1
        }
    } else {
        Write-Info "构建本地镜像..."
        docker-compose -f $script:ComposeFile build
        if ($LASTEXITCODE -ne 0) {
            Write-Error "镜像构建失败"
            exit 1
        }
    }
    
    Write-Success "镜像准备完成"
}

# 部署服务
function Deploy-Services {
    Write-Info "部署服务..."
    
    # 停止旧服务（保持数据库运行）
    Write-Info "停止应用服务..."
    docker-compose -f $script:ComposeFile stop app
    
    # 启动新服务
    Write-Info "启动新服务..."
    docker-compose -f $script:ComposeFile up -d
    
    if ($LASTEXITCODE -ne 0) {
        Write-Error "服务启动失败"
        return $false
    }
    
    Write-Success "服务部署完成"
    return $true
}

# 健康检查
function Test-Health {
    Write-Info "执行健康检查..."
    
    $appPort = $env:APP_PORT
    if ([string]::IsNullOrEmpty($appPort)) {
        $appPort = "3000"
    }
    
    $appUrl = "http://localhost:$appPort"
    $healthEndpoint = "$appUrl/health"
    $startTime = Get-Date
    
    Write-Info "等待服务启动... (超时: $HealthCheckTimeout 秒)"
    
    while ($true) {
        $elapsed = (Get-Date) - $startTime
        
        if ($elapsed.TotalSeconds -gt $HealthCheckTimeout) {
            Write-Error "健康检查超时"
            return $false
        }
        
        # 检查容器状态
        $containerStatus = docker-compose -f $script:ComposeFile ps app
        if ($containerStatus -notmatch "Up") {
            Write-Error "应用容器未运行"
            return $false
        }
        
        # 检查健康端点
        try {
            $response = Invoke-WebRequest -Uri $healthEndpoint -TimeoutSec 5 -ErrorAction Stop
            if ($response.StatusCode -eq 200) {
                Write-Success "健康检查通过"
                return $true
            }
        }
        catch {
            # 继续等待
        }
        
        Write-Host "." -NoNewline
        Start-Sleep -Seconds 5
    }
}

# 冒烟测试
function Test-Smoke {
    if (-not $SmokeTestEnabled) {
        Write-Info "跳过冒烟测试（已禁用）"
        return $true
    }
    
    Write-Info "执行冒烟测试..."
    
    $appPort = $env:APP_PORT
    if ([string]::IsNullOrEmpty($appPort)) {
        $appPort = "3000"
    }
    
    $appUrl = "http://localhost:$appPort"
    $testsPassed = 0
    $testsTotal = 0
    
    # 测试主页
    $testsTotal++
    try {
        $response = Invoke-WebRequest -Uri $appUrl -TimeoutSec 10 -ErrorAction Stop
        if ($response.StatusCode -eq 200) {
            Write-Success "✓ 主页访问正常"
            $testsPassed++
        }
    }
    catch {
        Write-Error "✗ 主页访问失败"
    }
    
    # 测试API端点
    $testsTotal++
    try {
        $response = Invoke-WebRequest -Uri "$appUrl/api/health" -TimeoutSec 10 -ErrorAction Stop
        if ($response.StatusCode -eq 200) {
            Write-Success "✓ API健康检查正常"
            $testsPassed++
        }
    }
    catch {
        Write-Error "✗ API健康检查失败"
    }
    
    # 测试数据库连接
    $testsTotal++
    try {
        $response = Invoke-WebRequest -Uri "$appUrl/api/health/db" -TimeoutSec 10 -ErrorAction Stop
        if ($response.StatusCode -eq 200) {
            Write-Success "✓ 数据库连接正常"
            $testsPassed++
        }
    }
    catch {
        Write-Error "✗ 数据库连接失败"
    }
    
    # 测试Redis连接
    $testsTotal++
    try {
        $response = Invoke-WebRequest -Uri "$appUrl/api/health/redis" -TimeoutSec 10 -ErrorAction Stop
        if ($response.StatusCode -eq 200) {
            Write-Success "✓ Redis连接正常"
            $testsPassed++
        }
    }
    catch {
        Write-Error "✗ Redis连接失败"
    }
    
    Write-Info "冒烟测试结果: $testsPassed/$testsTotal 通过"
    
    if ($testsPassed -eq $testsTotal) {
        Write-Success "所有冒烟测试通过"
        return $true
    } else {
        Write-Error "部分冒烟测试失败"
        return $false
    }
}

# 回滚部署
function Invoke-Rollback {
    param([string]$Version)
    
    Write-Warning "开始回滚到版本: $Version"
    
    # 检查备份是否存在
    if (-not (Test-Path ".last_backup")) {
        Write-Error "未找到备份信息，无法回滚"
        return $false
    }
    
    $backupDir = Get-Content ".last_backup" -Raw
    $backupDir = $backupDir.Trim()
    
    if (-not (Test-Path $backupDir)) {
        Write-Error "备份目录不存在: $backupDir"
        return $false
    }
    
    # 停止当前服务
    Write-Info "停止当前服务..."
    docker-compose -f $script:ComposeFile down
    
    # 恢复数据库
    if (Test-Path "$backupDir\database.sql") {
        Write-Info "恢复数据库..."
        docker-compose -f $script:ComposeFile up -d postgres
        Start-Sleep -Seconds 10
        
        $dbUsername = $env:DB_USERNAME
        $dbName = $env:DB_NAME
        if ($dbUsername -and $dbName) {
            Get-Content "$backupDir\database.sql" | docker-compose -f $script:ComposeFile exec -T postgres psql -U $dbUsername -d $dbName
        }
    }
    
    # 恢复上传文件
    if (Test-Path "$backupDir\uploads.zip") {
        Write-Info "恢复上传文件..."
        if (Test-Path "uploads") {
            Remove-Item -Path "uploads" -Recurse -Force
        }
        Expand-Archive -Path "$backupDir\uploads.zip" -DestinationPath "uploads" -Force
    }
    
    # 使用旧版本镜像
    $script:ImageTag = $Version
    if (-not [string]::IsNullOrEmpty($Registry)) {
        $script:ImageName = "$Registry/$ServiceName`:$Version"
    } else {
        $script:ImageName = "$ServiceName`:$Version"
    }
    
    [Environment]::SetEnvironmentVariable("IMAGE_TAG", $Version, "Process")
    [Environment]::SetEnvironmentVariable("IMAGE_NAME", $script:ImageName, "Process")
    
    # 启动服务
    Write-Info "启动回滚版本..."
    docker-compose -f $script:ComposeFile up -d
    
    # 健康检查
    if (Test-Health) {
        Write-Success "回滚成功"
        return $true
    } else {
        Write-Error "回滚后健康检查失败"
        return $false
    }
}

# 查看部署状态
function Show-Status {
    Write-Info "部署状态:"
    Write-Host ""
    
    # 显示服务状态
    Write-Info "服务状态:"
    docker-compose -f $script:ComposeFile ps
    Write-Host ""
    
    # 显示镜像信息
    Write-Info "镜像信息:"
    docker-compose -f $script:ComposeFile images
    Write-Host ""
    
    # 显示资源使用情况
    Write-Info "资源使用情况:"
    docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}\t{{.BlockIO}}"
    Write-Host ""
    
    # 显示健康状态
    $appPort = $env:APP_PORT
    if ([string]::IsNullOrEmpty($appPort)) {
        $appPort = "3000"
    }
    
    $appUrl = "http://localhost:$appPort"
    Write-Info "健康状态:"
    try {
        $response = Invoke-WebRequest -Uri "$appUrl/health" -TimeoutSec 10 -ErrorAction Stop
        $healthData = $response.Content | ConvertFrom-Json
        $healthData | ConvertTo-Json -Depth 3
        Write-Success "应用健康状态正常"
    }
    catch {
        Write-Warning "无法获取健康状态"
    }
}

# 查看日志
function Show-Logs {
    Write-Info "服务日志:"
    docker-compose -f $script:ComposeFile logs --tail=100 -f
}

# 清理旧镜像和容器
function Invoke-Cleanup {
    Write-Info "清理旧镜像和容器..."
    
    # 清理停止的容器
    Write-Info "清理停止的容器..."
    docker container prune -f
    
    # 清理未使用的镜像
    Write-Info "清理未使用的镜像..."
    docker image prune -f
    
    # 清理未使用的网络
    Write-Info "清理未使用的网络..."
    docker network prune -f
    
    # 清理未使用的卷（谨慎操作）
    $response = Read-Host "是否清理未使用的卷？这可能会删除数据 (y/N)"
    if ($response -eq 'y' -or $response -eq 'Y') {
        Write-Warning "清理未使用的卷..."
        docker volume prune -f
    }
    
    Write-Success "清理完成"
}

# 主部署流程
function Start-MainDeploy {
    Write-Info "开始部署 $ServiceName 到 $Environment 环境"
    Write-Info "镜像标签: $ImageTag"
    Write-Info "Compose文件: $script:ComposeFile"
    Write-Host ""
    
    # 验证环境
    Test-Environment
    
    # 加载环境变量
    Import-Environment
    
    # 备份当前部署
    Backup-CurrentDeployment
    
    # 拉取镜像
    Get-LatestImages
    
    # 部署服务
    if (-not (Deploy-Services)) {
        Write-Error "服务部署失败"
        exit 1
    }
    
    # 健康检查
    if (-not (Test-Health)) {
        if ($RollbackEnabled) {
            Write-Warning "健康检查失败，开始自动回滚..."
            Invoke-Rollback $ImageTag
        } else {
            Write-Error "健康检查失败，自动回滚已禁用"
            exit 1
        }
    }
    
    # 冒烟测试
    if (-not (Test-Smoke)) {
        if ($RollbackEnabled) {
            Write-Warning "冒烟测试失败，开始自动回滚..."
            Invoke-Rollback $ImageTag
        } else {
            Write-Error "冒烟测试失败，自动回滚已禁用"
            exit 1
        }
    }
    
    Write-Success "部署成功完成！"
    $appPort = $env:APP_PORT
    if ([string]::IsNullOrEmpty($appPort)) {
        $appPort = "3000"
    }
    Write-Info "应用访问地址: http://localhost:$appPort"
}

# 主函数
function Main {
    # 显示帮助信息
    if ($Help) {
        Show-Help
        return
    }
    
    # 根据参数执行相应功能
    if (-not [string]::IsNullOrEmpty($RollbackVersion)) {
        Test-Environment
        Import-Environment
        Invoke-Rollback $RollbackVersion
    }
    elseif ($Status) {
        Test-Environment
        Import-Environment
        Show-Status
    }
    elseif ($Logs) {
        Test-Environment
        Import-Environment
        Show-Logs
    }
    elseif ($Cleanup) {
        Invoke-Cleanup
    }
    else {
        Start-MainDeploy
    }
}

# 执行主函数
Main