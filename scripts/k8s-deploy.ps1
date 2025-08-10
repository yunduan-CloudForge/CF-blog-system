# Kubernetes 部署脚本 (PowerShell)
# 支持蓝绿部署、滚动更新和金丝雀部署

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet('deploy', 'rolling-update', 'blue-green', 'canary', 'promote-canary', 'rollback-canary', 'status', 'logs', 'rollback', 'cleanup', 'help')]
    [string]$Command,
    
    [string]$Deployment = "",
    [string]$Revision = "",
    [switch]$Follow = $false,
    [switch]$DryRun = $false,
    [switch]$Verbose = $false
)

# 配置
$AppName = if ($env:APP_NAME) { $env:APP_NAME } else { "blog-system" }
$Namespace = if ($env:NAMESPACE) { $env:NAMESPACE } else { "default" }
$ImageRegistry = if ($env:DOCKER_REGISTRY) { $env:DOCKER_REGISTRY } else { "localhost:5000" }
$ImageName = if ($env:DOCKER_IMAGE) { $env:DOCKER_IMAGE } else { "blog-system" }
$ImageTag = if ($env:DOCKER_TAG) { $env:DOCKER_TAG } else { "latest" }
$DeployStrategy = if ($env:DEPLOY_STRATEGY) { $env:DEPLOY_STRATEGY } else { "rolling" }
$HealthCheckTimeout = if ($env:HEALTH_CHECK_TIMEOUT) { [int]$env:HEALTH_CHECK_TIMEOUT } else { 300 }
$HealthCheckInterval = if ($env:HEALTH_CHECK_INTERVAL) { [int]$env:HEALTH_CHECK_INTERVAL } else { 10 }
$CanaryPercentage = if ($env:CANARY_PERCENTAGE) { [int]$env:CANARY_PERCENTAGE } else { 10 }
$RollbackOnFailure = if ($env:ROLLBACK_ON_FAILURE) { $env:ROLLBACK_ON_FAILURE -eq "true" } else { $true }

if ($env:DRY_RUN -eq "true") { $DryRun = $true }
if ($env:VERBOSE -eq "true") { $Verbose = $true }

# 日志函数
function Write-Log {
    param(
        [string]$Level,
        [string]$Message,
        [string]$Color = "White"
    )
    
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Write-Host "[$Level] $timestamp - $Message" -ForegroundColor $Color
}

function Write-Info {
    param([string]$Message)
    Write-Log "INFO" $Message "Cyan"
}

function Write-Success {
    param([string]$Message)
    Write-Log "SUCCESS" $Message "Green"
}

function Write-Warning {
    param([string]$Message)
    Write-Log "WARNING" $Message "Yellow"
}

function Write-Error {
    param([string]$Message)
    Write-Log "ERROR" $Message "Red"
}

function Write-Debug {
    param([string]$Message)
    if ($Verbose) {
        Write-Log "DEBUG" $Message "Gray"
    }
}

# 检查依赖
function Test-Dependencies {
    Write-Info "检查依赖..."
    
    $dependencies = @("kubectl", "docker")
    foreach ($dep in $dependencies) {
        if (!(Get-Command $dep -ErrorAction SilentlyContinue)) {
            Write-Error "$dep 未安装"
            exit 1
        }
    }
    
    # 检查kubectl连接
    try {
        kubectl cluster-info | Out-Null
        if ($LASTEXITCODE -ne 0) {
            throw "kubectl连接失败"
        }
    }
    catch {
        Write-Error "无法连接到Kubernetes集群"
        exit 1
    }
    
    Write-Success "依赖检查通过"
}

# 构建Docker镜像
function Build-Image {
    param([string]$Tag)
    
    Write-Info "构建Docker镜像: $Tag"
    
    if ($DryRun) {
        Write-Info "[DRY RUN] 将构建镜像: $Tag"
        return
    }
    
    docker build -t $Tag .
    if ($LASTEXITCODE -ne 0) {
        throw "镜像构建失败"
    }
    
    # 推送到注册表
    if ($ImageRegistry -ne "localhost:5000") {
        Write-Info "推送镜像到注册表: $Tag"
        docker push $Tag
        if ($LASTEXITCODE -ne 0) {
            throw "镜像推送失败"
        }
    }
    
    Write-Success "镜像构建完成: $Tag"
}

# 健康检查
function Test-Health {
    param(
        [string]$ServiceName,
        [int]$Timeout,
        [int]$Interval
    )
    
    Write-Info "执行健康检查: $ServiceName"
    
    $startTime = Get-Date
    $endTime = $startTime.AddSeconds($Timeout)
    
    while ((Get-Date) -lt $endTime) {
        try {
            # 检查Pod状态
            $readyPods = (kubectl get pods -l app=$AppName -n $Namespace -o jsonpath='{.items[*].status.conditions[?(@.type=="Ready")].status}' | Select-String "True" -AllMatches).Matches.Count
            $totalPods = (kubectl get pods -l app=$AppName -n $Namespace --no-headers | Measure-Object).Count
            
            if ($readyPods -gt 0 -and $readyPods -eq $totalPods) {
                # 检查服务端点
                $endpoints = (kubectl get endpoints $ServiceName -n $Namespace -o jsonpath='{.subsets[*].addresses[*].ip}' | Measure-Object -Word).Words
                
                if ($endpoints -gt 0) {
                    Write-Success "健康检查通过: $ServiceName"
                    return $true
                }
            }
            
            Write-Debug "等待Pod就绪... ($readyPods/$totalPods)"
            Start-Sleep $Interval
        }
        catch {
            Write-Debug "健康检查异常: $($_.Exception.Message)"
            Start-Sleep $Interval
        }
    }
    
    Write-Error "健康检查超时: $ServiceName"
    return $false
}

# 等待部署完成
function Wait-ForDeployment {
    param(
        [string]$DeploymentName,
        [int]$Timeout = 300
    )
    
    Write-Info "等待部署完成: $DeploymentName"
    
    if ($DryRun) {
        Write-Info "[DRY RUN] 将等待部署: $DeploymentName"
        return $true
    }
    
    kubectl rollout status deployment/$DeploymentName -n $Namespace --timeout="${Timeout}s"
    
    if ($LASTEXITCODE -eq 0) {
        Write-Success "部署完成: $DeploymentName"
        return $true
    }
    else {
        Write-Error "部署超时: $DeploymentName"
        return $false
    }
}

# 滚动更新部署
function Invoke-RollingUpdate {
    Write-Info "开始滚动更新部署"
    
    $imageTag = "$ImageRegistry/$ImageName`:$ImageTag"
    
    try {
        # 构建镜像
        Build-Image $imageTag
        
        # 更新部署
        Write-Info "更新部署镜像: $imageTag"
        
        if ($DryRun) {
            Write-Info "[DRY RUN] 将更新部署镜像: $imageTag"
        }
        else {
            kubectl set image deployment/$AppName $AppName=$imageTag -n $Namespace
            if ($LASTEXITCODE -ne 0) {
                throw "更新部署失败"
            }
            
            # 等待部署完成
            if (!(Wait-ForDeployment $AppName $HealthCheckTimeout)) {
                if ($RollbackOnFailure) {
                    Write-Warning "部署失败，执行回滚"
                    kubectl rollout undo deployment/$AppName -n $Namespace
                    Wait-ForDeployment $AppName $HealthCheckTimeout | Out-Null
                }
                throw "部署失败"
            }
            
            # 健康检查
            if (!(Test-Health "$AppName-service" $HealthCheckTimeout $HealthCheckInterval)) {
                if ($RollbackOnFailure) {
                    Write-Warning "健康检查失败，执行回滚"
                    kubectl rollout undo deployment/$AppName -n $Namespace
                    Wait-ForDeployment $AppName $HealthCheckTimeout | Out-Null
                }
                throw "健康检查失败"
            }
        }
        
        Write-Success "滚动更新部署完成"
    }
    catch {
        Write-Error "滚动更新失败: $($_.Exception.Message)"
        throw
    }
}

# 蓝绿部署
function Invoke-BlueGreenDeploy {
    Write-Info "开始蓝绿部署"
    
    try {
        # 获取当前活跃颜色
        $currentColor = kubectl get service "$AppName-active-service" -n $Namespace -o jsonpath='{.metadata.annotations.deployment\.kubernetes\.io/active-color}' 2>$null
        if (!$currentColor) { $currentColor = "blue" }
        
        $targetColor = if ($currentColor -eq "blue") { "green" } else { "blue" }
        
        Write-Info "当前颜色: $currentColor, 目标颜色: $targetColor"
        
        $imageTag = "$ImageRegistry/$ImageName`:$targetColor-$ImageTag"
        
        # 构建镜像
        Build-Image $imageTag
        
        if ($DryRun) {
            Write-Info "[DRY RUN] 蓝绿部署流程"
            Write-Info "[DRY RUN] 1. 更新$targetColor环境镜像"
            Write-Info "[DRY RUN] 2. 扩展$targetColor环境"
            Write-Info "[DRY RUN] 3. 健康检查"
            Write-Info "[DRY RUN] 4. 切换流量"
            Write-Info "[DRY RUN] 5. 缩减$currentColor环境"
            return
        }
        
        # 1. 更新目标环境镜像
        Write-Info "更新$targetColor环境镜像"
        kubectl set image deployment/$AppName-$targetColor $AppName=$imageTag -n $Namespace
        if ($LASTEXITCODE -ne 0) {
            throw "更新$targetColor环境镜像失败"
        }
        
        # 2. 扩展目标环境
        Write-Info "扩展$targetColor环境"
        kubectl scale deployment/$AppName-$targetColor --replicas=3 -n $Namespace
        if ($LASTEXITCODE -ne 0) {
            throw "扩展$targetColor环境失败"
        }
        
        # 3. 等待目标环境就绪
        if (!(Wait-ForDeployment "$AppName-$targetColor" $HealthCheckTimeout)) {
            Write-Error "$targetColor环境部署失败"
            kubectl scale deployment/$AppName-$targetColor --replicas=0 -n $Namespace
            throw "$targetColor环境部署失败"
        }
        
        # 4. 健康检查
        if (!(Test-Health "$AppName-$targetColor-service" $HealthCheckTimeout $HealthCheckInterval)) {
            Write-Error "$targetColor环境健康检查失败"
            kubectl scale deployment/$AppName-$targetColor --replicas=0 -n $Namespace
            throw "$targetColor环境健康检查失败"
        }
        
        # 5. 切换流量
        Write-Info "切换流量到$targetColor环境"
        kubectl patch service "$AppName-active-service" -n $Namespace -p "{`"spec`":{`"selector`":{`"version`":`"$targetColor`"}}}"
        kubectl annotate service "$AppName-active-service" -n $Namespace "deployment.kubernetes.io/active-color=$targetColor" --overwrite
        
        # 更新预览服务指向旧环境
        kubectl patch service "$AppName-preview-service" -n $Namespace -p "{`"spec`":{`"selector`":{`"version`":`"$currentColor`"}}}"
        
        # 6. 等待流量切换生效
        Start-Sleep 10
        
        # 7. 最终健康检查
        if (!(Test-Health "$AppName-active-service" 60 5)) {
            Write-Error "流量切换后健康检查失败，回滚"
            # 回滚流量
            kubectl patch service "$AppName-active-service" -n $Namespace -p "{`"spec`":{`"selector`":{`"version`":`"$currentColor`"}}}"
            kubectl annotate service "$AppName-active-service" -n $Namespace "deployment.kubernetes.io/active-color=$currentColor" --overwrite
            kubectl scale deployment/$AppName-$targetColor --replicas=0 -n $Namespace
            throw "流量切换后健康检查失败"
        }
        
        # 8. 缩减旧环境
        Write-Info "缩减$currentColor环境"
        kubectl scale deployment/$AppName-$currentColor --replicas=0 -n $Namespace
        
        Write-Success "蓝绿部署完成"
    }
    catch {
        Write-Error "蓝绿部署失败: $($_.Exception.Message)"
        throw
    }
}

# 金丝雀部署
function Invoke-CanaryDeploy {
    Write-Info "开始金丝雀部署 ($CanaryPercentage%)"
    
    $imageTag = "$ImageRegistry/$ImageName`:canary-$ImageTag"
    
    try {
        # 构建镜像
        Build-Image $imageTag
        
        if ($DryRun) {
            Write-Info "[DRY RUN] 金丝雀部署流程"
            return
        }
        
        # 创建金丝雀部署
        Write-Info "创建金丝雀部署"
        
        # 计算金丝雀副本数
        $totalReplicas = [int](kubectl get deployment $AppName -n $Namespace -o jsonpath='{.spec.replicas}')
        $canaryReplicas = [Math]::Max(1, [Math]::Floor(($totalReplicas * $CanaryPercentage + 50) / 100))
        
        Write-Info "金丝雀副本数: $canaryReplicas / $totalReplicas"
        
        # 部署金丝雀版本
        kubectl create deployment "$AppName-canary" --image=$imageTag -n $Namespace --dry-run=client -o yaml | kubectl apply -f -
        if ($LASTEXITCODE -ne 0) {
            throw "创建金丝雀部署失败"
        }
        
        kubectl scale deployment/$AppName-canary --replicas=$canaryReplicas -n $Namespace
        if ($LASTEXITCODE -ne 0) {
            throw "扩展金丝雀部署失败"
        }
        
        # 等待金丝雀部署就绪
        if (!(Wait-ForDeployment "$AppName-canary" $HealthCheckTimeout)) {
            Write-Error "金丝雀部署失败"
            kubectl delete deployment "$AppName-canary" -n $Namespace --ignore-not-found
            throw "金丝雀部署失败"
        }
        
        # 更新服务选择器以包含金丝雀
        kubectl patch service "$AppName-service" -n $Namespace -p "{`"spec`":{`"selector`":{`"app`":`"$AppName`"}}}"
        
        Write-Info "金丝雀部署完成，监控中..."
        Write-Info "使用以下命令监控金丝雀:"
        Write-Info "  kubectl logs -f deployment/$AppName-canary -n $Namespace"
        Write-Info "  kubectl top pods -l app=$AppName -n $Namespace"
        Write-Info ""
        Write-Info "使用以下命令提升或回滚:"
        Write-Info "  .\k8s-deploy.ps1 promote-canary  # 提升金丝雀"
        Write-Info "  .\k8s-deploy.ps1 rollback-canary # 回滚金丝雀"
    }
    catch {
        Write-Error "金丝雀部署失败: $($_.Exception.Message)"
        throw
    }
}

# 提升金丝雀
function Invoke-PromoteCanary {
    Write-Info "提升金丝雀为生产版本"
    
    if ($DryRun) {
        Write-Info "[DRY RUN] 提升金丝雀"
        return
    }
    
    try {
        # 获取金丝雀镜像
        $canaryImage = kubectl get deployment "$AppName-canary" -n $Namespace -o jsonpath='{.spec.template.spec.containers[0].image}'
        if ($LASTEXITCODE -ne 0) {
            throw "获取金丝雀镜像失败"
        }
        
        # 更新主部署
        kubectl set image deployment/$AppName $AppName=$canaryImage -n $Namespace
        if ($LASTEXITCODE -ne 0) {
            throw "更新主部署失败"
        }
        
        # 等待主部署更新完成
        if (!(Wait-ForDeployment $AppName $HealthCheckTimeout)) {
            throw "主部署更新失败"
        }
        
        # 删除金丝雀部署
        kubectl delete deployment "$AppName-canary" -n $Namespace
        
        Write-Success "金丝雀提升完成"
    }
    catch {
        Write-Error "金丝雀提升失败: $($_.Exception.Message)"
        throw
    }
}

# 回滚金丝雀
function Invoke-RollbackCanary {
    Write-Info "回滚金丝雀部署"
    
    if ($DryRun) {
        Write-Info "[DRY RUN] 回滚金丝雀"
        return
    }
    
    try {
        # 删除金丝雀部署
        kubectl delete deployment "$AppName-canary" -n $Namespace --ignore-not-found
        
        # 恢复服务选择器
        kubectl patch service "$AppName-service" -n $Namespace -p "{`"spec`":{`"selector`":{`"app`":`"$AppName`",`"version`":`"stable`"}}}"
        
        Write-Success "金丝雀回滚完成"
    }
    catch {
        Write-Error "金丝雀回滚失败: $($_.Exception.Message)"
        throw
    }
}

# 查看部署状态
function Get-DeploymentStatus {
    Write-Info "查看部署状态"
    
    Write-Host "`n=== Deployments ===" -ForegroundColor Yellow
    kubectl get deployments -l app=$AppName -n $Namespace -o wide
    
    Write-Host "`n=== Pods ===" -ForegroundColor Yellow
    kubectl get pods -l app=$AppName -n $Namespace -o wide
    
    Write-Host "`n=== Services ===" -ForegroundColor Yellow
    kubectl get services -l app=$AppName -n $Namespace -o wide
    
    Write-Host "`n=== Ingress ===" -ForegroundColor Yellow
    kubectl get ingress -l app=$AppName -n $Namespace -o wide
    
    Write-Host "`n=== HPA ===" -ForegroundColor Yellow
    kubectl get hpa -l app=$AppName -n $Namespace -o wide
    
    # 检查当前活跃颜色（如果是蓝绿部署）
    $activeColor = kubectl get service "$AppName-active-service" -n $Namespace -o jsonpath='{.metadata.annotations.deployment\.kubernetes\.io/active-color}' 2>$null
    if (!$activeColor) { $activeColor = "N/A" }
    
    if ($activeColor -ne "N/A") {
        Write-Host "`n=== Blue-Green Status ===" -ForegroundColor Yellow
        Write-Host "Active Color: $activeColor"
    }
}

# 查看日志
function Get-DeploymentLogs {
    param(
        [string]$DeploymentName = $AppName,
        [bool]$FollowLogs = $false
    )
    
    Write-Info "查看 $DeploymentName 日志"
    
    if ($FollowLogs) {
        kubectl logs -f deployment/$DeploymentName -n $Namespace
    }
    else {
        kubectl logs deployment/$DeploymentName -n $Namespace --tail=100
    }
}

# 回滚部署
function Invoke-Rollback {
    param([string]$RevisionNumber = "")
    
    Write-Info "回滚部署"
    
    if ($DryRun) {
        Write-Info "[DRY RUN] 回滚部署"
        return
    }
    
    try {
        if ($RevisionNumber) {
            kubectl rollout undo deployment/$AppName -n $Namespace --to-revision=$RevisionNumber
        }
        else {
            kubectl rollout undo deployment/$AppName -n $Namespace
        }
        
        if ($LASTEXITCODE -ne 0) {
            throw "回滚命令执行失败"
        }
        
        Wait-ForDeployment $AppName $HealthCheckTimeout | Out-Null
        
        Write-Success "回滚完成"
    }
    catch {
        Write-Error "回滚失败: $($_.Exception.Message)"
        throw
    }
}

# 清理资源
function Remove-DeploymentResources {
    Write-Info "清理部署资源"
    
    if ($DryRun) {
        Write-Info "[DRY RUN] 清理资源"
        return
    }
    
    try {
        # 删除部署
        kubectl delete deployment -l app=$AppName -n $Namespace --ignore-not-found
        
        # 删除服务
        kubectl delete service -l app=$AppName -n $Namespace --ignore-not-found
        
        # 删除Ingress
        kubectl delete ingress -l app=$AppName -n $Namespace --ignore-not-found
        
        # 删除HPA
        kubectl delete hpa -l app=$AppName -n $Namespace --ignore-not-found
        
        # 删除PDB
        kubectl delete pdb -l app=$AppName -n $Namespace --ignore-not-found
        
        Write-Success "清理完成"
    }
    catch {
        Write-Error "清理失败: $($_.Exception.Message)"
        throw
    }
}

# 显示帮助
function Show-Help {
    Write-Host @"
Kubernetes 部署脚本 (PowerShell)

用法:
  .\k8s-deploy.ps1 -Command <command> [options]

命令:
  deploy              执行部署（根据DEPLOY_STRATEGY）
  rolling-update      执行滚动更新
  blue-green          执行蓝绿部署
  canary              执行金丝雀部署
  promote-canary      提升金丝雀为生产版本
  rollback-canary     回滚金丝雀部署
  status              查看部署状态
  logs                查看日志
  rollback            回滚部署
  cleanup             清理资源
  help                显示帮助

参数:
  -Deployment         指定部署名称（用于logs命令）
  -Revision           指定回滚版本（用于rollback命令）
  -Follow             跟踪日志输出（用于logs命令）
  -DryRun             演练模式
  -Verbose            详细输出

环境变量:
  DEPLOY_STRATEGY     部署策略 (rolling|blue-green|canary)
  DOCKER_REGISTRY     Docker注册表地址
  DOCKER_IMAGE        Docker镜像名称
  DOCKER_TAG          Docker镜像标签
  HEALTH_CHECK_TIMEOUT 健康检查超时时间（秒）
  CANARY_PERCENTAGE   金丝雀流量百分比
  ROLLBACK_ON_FAILURE 失败时是否自动回滚
  DRY_RUN             是否为演练模式
  VERBOSE             是否显示详细日志

示例:
  # 滚动更新部署
  `$env:DEPLOY_STRATEGY="rolling"; .\k8s-deploy.ps1 -Command deploy
  
  # 蓝绿部署
  `$env:DEPLOY_STRATEGY="blue-green"; `$env:DOCKER_TAG="v1.2.0"; .\k8s-deploy.ps1 -Command deploy
  
  # 金丝雀部署（10%流量）
  `$env:DEPLOY_STRATEGY="canary"; `$env:CANARY_PERCENTAGE="10"; .\k8s-deploy.ps1 -Command deploy
  
  # 查看日志并跟踪
  .\k8s-deploy.ps1 -Command logs -Follow
  
  # 演练模式
  .\k8s-deploy.ps1 -Command blue-green -DryRun
"@
}

# 主函数
function Main {
    try {
        switch ($Command) {
            "deploy" {
                Test-Dependencies
                switch ($DeployStrategy) {
                    "rolling" { Invoke-RollingUpdate }
                    "blue-green" { Invoke-BlueGreenDeploy }
                    "canary" { Invoke-CanaryDeploy }
                    default {
                        Write-Error "不支持的部署策略: $DeployStrategy"
                        exit 1
                    }
                }
            }
            "rolling-update" {
                Test-Dependencies
                Invoke-RollingUpdate
            }
            "blue-green" {
                Test-Dependencies
                Invoke-BlueGreenDeploy
            }
            "canary" {
                Test-Dependencies
                Invoke-CanaryDeploy
            }
            "promote-canary" {
                Test-Dependencies
                Invoke-PromoteCanary
            }
            "rollback-canary" {
                Test-Dependencies
                Invoke-RollbackCanary
            }
            "status" {
                Test-Dependencies
                Get-DeploymentStatus
            }
            "logs" {
                Test-Dependencies
                $deploymentName = if ($Deployment) { $Deployment } else { $AppName }
                Get-DeploymentLogs $deploymentName $Follow
            }
            "rollback" {
                Test-Dependencies
                Invoke-Rollback $Revision
            }
            "cleanup" {
                Test-Dependencies
                Remove-DeploymentResources
            }
            "help" {
                Show-Help
            }
            default {
                Write-Error "未知命令: $Command"
                Show-Help
                exit 1
            }
        }
    }
    catch {
        Write-Error "执行失败: $($_.Exception.Message)"
        exit 1
    }
}

# 执行主函数
Main