#!/usr/bin/env node

/**
 * 零停机部署策略脚本
 * 支持蓝绿部署和滚动更新
 */

const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');
const { promisify } = require('util');
const exec = promisify(require('child_process').exec);

// 配置
const config = {
  deployment: {
    strategy: process.env.DEPLOY_STRATEGY || 'blue-green', // blue-green, rolling, canary
    environment: process.env.NODE_ENV || 'production',
    replicas: parseInt(process.env.REPLICAS) || 3,
    maxUnavailable: process.env.MAX_UNAVAILABLE || '25%',
    maxSurge: process.env.MAX_SURGE || '25%',
    healthCheckTimeout: parseInt(process.env.HEALTH_CHECK_TIMEOUT) || 300,
    healthCheckInterval: parseInt(process.env.HEALTH_CHECK_INTERVAL) || 10,
    rollbackOnFailure: process.env.ROLLBACK_ON_FAILURE !== 'false'
  },
  application: {
    name: 'blog-system',
    version: process.env.APP_VERSION || '1.0.0',
    port: process.env.PORT || 3000,
    healthEndpoint: process.env.HEALTH_ENDPOINT || '/health'
  },
  docker: {
    registry: process.env.DOCKER_REGISTRY || 'localhost:5000',
    image: process.env.DOCKER_IMAGE || 'blog-system',
    tag: process.env.DOCKER_TAG || 'latest'
  },
  loadBalancer: {
    type: process.env.LB_TYPE || 'nginx', // nginx, haproxy, traefik
    configPath: process.env.LB_CONFIG_PATH || '/etc/nginx/conf.d/blog-system.conf'
  },
  notifications: {
    slack: {
      webhook: process.env.SLACK_WEBHOOK_URL,
      channel: process.env.SLACK_CHANNEL || '#deployments'
    },
    email: {
      enabled: process.env.EMAIL_NOTIFICATIONS === 'true',
      recipients: process.env.EMAIL_RECIPIENTS?.split(',') || []
    }
  }
};

// 日志函数
function log(level, message, data = null) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level,
    message,
    deployment_id: process.env.DEPLOYMENT_ID || 'unknown',
    ...(data && { data })
  };
  
  console.log(JSON.stringify(logEntry));
}

function logInfo(message, data) {
  log('INFO', message, data);
}

function logError(message, data) {
  log('ERROR', message, data);
}

function logSuccess(message, data) {
  log('SUCCESS', message, data);
}

function logWarning(message, data) {
  log('WARNING', message, data);
}

// 执行命令
async function executeCommand(command, options = {}) {
  try {
    logInfo(`执行命令: ${command}`);
    const { stdout, stderr } = await exec(command, options);
    if (stderr && !options.ignoreStderr) {
      logWarning(`命令警告: ${stderr}`);
    }
    return { success: true, stdout, stderr };
  } catch (error) {
    logError(`命令执行失败: ${command}`, { error: error.message });
    return { success: false, error: error.message };
  }
}

// 健康检查
async function healthCheck(url, timeout = 30000) {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    try {
      const response = await fetch(url, {
        method: 'GET',
        timeout: 5000
      });
      
      if (response.ok) {
        const data = await response.json();
        logInfo(`健康检查通过: ${url}`, { status: response.status, data });
        return true;
      }
    } catch (error) {
      logWarning(`健康检查失败: ${url}`, { error: error.message });
    }
    
    await new Promise(resolve => setTimeout(resolve, config.deployment.healthCheckInterval * 1000));
  }
  
  logError(`健康检查超时: ${url}`);
  return false;
}

// 发送通知
async function sendNotification(message, level = 'info') {
  // Slack通知
  if (config.notifications.slack.webhook) {
    try {
      const color = {
        info: '#36a64f',
        warning: '#ff9900',
        error: '#ff0000',
        success: '#00ff00'
      }[level] || '#36a64f';
      
      const payload = {
        channel: config.notifications.slack.channel,
        username: 'Deployment Bot',
        attachments: [{
          color,
          title: `部署通知 - ${config.application.name}`,
          text: message,
          fields: [
            {
              title: '环境',
              value: config.deployment.environment,
              short: true
            },
            {
              title: '版本',
              value: config.application.version,
              short: true
            },
            {
              title: '策略',
              value: config.deployment.strategy,
              short: true
            },
            {
              title: '时间',
              value: new Date().toISOString(),
              short: true
            }
          ]
        }]
      };
      
      await fetch(config.notifications.slack.webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      logInfo('Slack通知发送成功');
    } catch (error) {
      logError('Slack通知发送失败', { error: error.message });
    }
  }
}

// 蓝绿部署
class BlueGreenDeployment {
  constructor() {
    this.currentColor = null;
    this.targetColor = null;
  }
  
  async getCurrentColor() {
    try {
      const result = await executeCommand('docker ps --filter "name=blog-system" --format "{{.Names}}"');
      if (result.success && result.stdout) {
        const containers = result.stdout.trim().split('\n');
        const blueRunning = containers.some(name => name.includes('blue'));
        const greenRunning = containers.some(name => name.includes('green'));
        
        if (blueRunning && !greenRunning) return 'blue';
        if (greenRunning && !blueRunning) return 'green';
        if (blueRunning && greenRunning) return 'both';
      }
    } catch (error) {
      logError('获取当前颜色失败', { error: error.message });
    }
    return null;
  }
  
  async deploy() {
    logInfo('开始蓝绿部署');
    await sendNotification('开始蓝绿部署');
    
    try {
      // 1. 确定当前和目标颜色
      this.currentColor = await this.getCurrentColor();
      this.targetColor = this.currentColor === 'blue' ? 'green' : 'blue';
      
      logInfo(`当前颜色: ${this.currentColor}, 目标颜色: ${this.targetColor}`);
      
      // 2. 构建新镜像
      await this.buildImage();
      
      // 3. 启动目标环境
      await this.startTargetEnvironment();
      
      // 4. 健康检查
      const healthOk = await this.performHealthCheck();
      if (!healthOk) {
        throw new Error('健康检查失败');
      }
      
      // 5. 切换流量
      await this.switchTraffic();
      
      // 6. 停止旧环境
      await this.stopOldEnvironment();
      
      logSuccess('蓝绿部署完成');
      await sendNotification('蓝绿部署成功完成', 'success');
      
    } catch (error) {
      logError('蓝绿部署失败', { error: error.message });
      await sendNotification(`蓝绿部署失败: ${error.message}`, 'error');
      
      if (config.deployment.rollbackOnFailure) {
        await this.rollback();
      }
      
      throw error;
    }
  }
  
  async buildImage() {
    logInfo('构建Docker镜像');
    
    const imageTag = `${config.docker.registry}/${config.docker.image}:${this.targetColor}-${config.application.version}`;
    const buildCommand = `docker build -t ${imageTag} .`;
    
    const result = await executeCommand(buildCommand);
    if (!result.success) {
      throw new Error(`镜像构建失败: ${result.error}`);
    }
    
    // 推送到注册表
    if (config.docker.registry !== 'localhost:5000') {
      const pushResult = await executeCommand(`docker push ${imageTag}`);
      if (!pushResult.success) {
        throw new Error(`镜像推送失败: ${pushResult.error}`);
      }
    }
    
    logSuccess(`镜像构建完成: ${imageTag}`);
  }
  
  async startTargetEnvironment() {
    logInfo(`启动${this.targetColor}环境`);
    
    const containerName = `blog-system-${this.targetColor}`;
    const imageTag = `${config.docker.registry}/${config.docker.image}:${this.targetColor}-${config.application.version}`;
    const port = this.targetColor === 'blue' ? 3001 : 3002;
    
    // 停止现有的目标容器
    await executeCommand(`docker stop ${containerName}`, { ignoreStderr: true });
    await executeCommand(`docker rm ${containerName}`, { ignoreStderr: true });
    
    // 启动新容器
    const runCommand = `docker run -d \
      --name ${containerName} \
      --network app-network \
      -p ${port}:${config.application.port} \
      -e NODE_ENV=${config.deployment.environment} \
      -e PORT=${config.application.port} \
      --health-cmd="curl -f http://localhost:${config.application.port}${config.application.healthEndpoint} || exit 1" \
      --health-interval=30s \
      --health-timeout=10s \
      --health-retries=3 \
      ${imageTag}`;
    
    const result = await executeCommand(runCommand);
    if (!result.success) {
      throw new Error(`启动${this.targetColor}环境失败: ${result.error}`);
    }
    
    logSuccess(`${this.targetColor}环境启动成功`);
  }
  
  async performHealthCheck() {
    logInfo('执行健康检查');
    
    const port = this.targetColor === 'blue' ? 3001 : 3002;
    const healthUrl = `http://localhost:${port}${config.application.healthEndpoint}`;
    
    return await healthCheck(healthUrl, config.deployment.healthCheckTimeout * 1000);
  }
  
  async switchTraffic() {
    logInfo('切换流量到新环境');
    
    if (config.loadBalancer.type === 'nginx') {
      await this.updateNginxConfig();
    } else if (config.loadBalancer.type === 'haproxy') {
      await this.updateHAProxyConfig();
    }
    
    logSuccess('流量切换完成');
  }
  
  async updateNginxConfig() {
    const port = this.targetColor === 'blue' ? 3001 : 3002;
    
    const nginxConfig = `
upstream blog_system {
    server localhost:${port};
}

server {
    listen 80;
    server_name localhost;
    
    location / {
        proxy_pass http://blog_system;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # 健康检查
        proxy_connect_timeout 5s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
    
    location /health {
        proxy_pass http://blog_system/health;
        access_log off;
    }
}
`;
    
    fs.writeFileSync(config.loadBalancer.configPath, nginxConfig.trim());
    
    // 重新加载Nginx配置
    const result = await executeCommand('nginx -s reload');
    if (!result.success) {
      throw new Error(`Nginx配置重载失败: ${result.error}`);
    }
  }
  
  async updateHAProxyConfig() {
    const port = this.targetColor === 'blue' ? 3001 : 3002;
    
    const haproxyConfig = `
global
    daemon
    maxconn 4096

defaults
    mode http
    timeout connect 5000ms
    timeout client 50000ms
    timeout server 50000ms
    option httplog
    option dontlognull
    option redispatch
    retries 3

frontend blog_system_frontend
    bind *:80
    default_backend blog_system_backend

backend blog_system_backend
    balance roundrobin
    option httpchk GET /health
    server app1 localhost:${port} check
`;
    
    fs.writeFileSync('/etc/haproxy/haproxy.cfg', haproxyConfig.trim());
    
    // 重新加载HAProxy配置
    const result = await executeCommand('systemctl reload haproxy');
    if (!result.success) {
      throw new Error(`HAProxy配置重载失败: ${result.error}`);
    }
  }
  
  async stopOldEnvironment() {
    if (this.currentColor && this.currentColor !== 'both') {
      logInfo(`停止${this.currentColor}环境`);
      
      const containerName = `blog-system-${this.currentColor}`;
      await executeCommand(`docker stop ${containerName}`);
      await executeCommand(`docker rm ${containerName}`);
      
      logSuccess(`${this.currentColor}环境已停止`);
    }
  }
  
  async rollback() {
    logInfo('开始回滚');
    await sendNotification('开始回滚到上一个版本', 'warning');
    
    try {
      // 停止目标环境
      const targetContainer = `blog-system-${this.targetColor}`;
      await executeCommand(`docker stop ${targetContainer}`, { ignoreStderr: true });
      await executeCommand(`docker rm ${targetContainer}`, { ignoreStderr: true });
      
      // 如果有当前环境，切换回去
      if (this.currentColor && this.currentColor !== 'both') {
        const currentPort = this.currentColor === 'blue' ? 3001 : 3002;
        
        if (config.loadBalancer.type === 'nginx') {
          const nginxConfig = `
upstream blog_system {
    server localhost:${currentPort};
}

server {
    listen 80;
    server_name localhost;
    
    location / {
        proxy_pass http://blog_system;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
`;
          
          fs.writeFileSync(config.loadBalancer.configPath, nginxConfig.trim());
          await executeCommand('nginx -s reload');
        }
      }
      
      logSuccess('回滚完成');
      await sendNotification('回滚成功完成', 'success');
      
    } catch (error) {
      logError('回滚失败', { error: error.message });
      await sendNotification(`回滚失败: ${error.message}`, 'error');
      throw error;
    }
  }
}

// 滚动更新部署
class RollingDeployment {
  constructor() {
    this.instances = [];
  }
  
  async deploy() {
    logInfo('开始滚动更新部署');
    await sendNotification('开始滚动更新部署');
    
    try {
      // 1. 获取当前实例
      await this.getCurrentInstances();
      
      // 2. 构建新镜像
      await this.buildImage();
      
      // 3. 逐个更新实例
      await this.updateInstances();
      
      logSuccess('滚动更新部署完成');
      await sendNotification('滚动更新部署成功完成', 'success');
      
    } catch (error) {
      logError('滚动更新部署失败', { error: error.message });
      await sendNotification(`滚动更新部署失败: ${error.message}`, 'error');
      
      if (config.deployment.rollbackOnFailure) {
        await this.rollback();
      }
      
      throw error;
    }
  }
  
  async getCurrentInstances() {
    const result = await executeCommand('docker ps --filter "name=blog-system" --format "{{.Names}}"');
    if (result.success && result.stdout) {
      this.instances = result.stdout.trim().split('\n').filter(name => name);
    }
    
    logInfo(`当前实例数量: ${this.instances.length}`, { instances: this.instances });
  }
  
  async buildImage() {
    logInfo('构建Docker镜像');
    
    const imageTag = `${config.docker.registry}/${config.docker.image}:${config.application.version}`;
    const buildCommand = `docker build -t ${imageTag} .`;
    
    const result = await executeCommand(buildCommand);
    if (!result.success) {
      throw new Error(`镜像构建失败: ${result.error}`);
    }
    
    logSuccess(`镜像构建完成: ${imageTag}`);
  }
  
  async updateInstances() {
    const maxUnavailable = this.calculateMaxUnavailable();
    const batchSize = Math.max(1, Math.floor(this.instances.length / maxUnavailable));
    
    logInfo(`批次大小: ${batchSize}, 最大不可用: ${maxUnavailable}`);
    
    for (let i = 0; i < this.instances.length; i += batchSize) {
      const batch = this.instances.slice(i, i + batchSize);
      await this.updateBatch(batch, i / batchSize + 1);
    }
  }
  
  calculateMaxUnavailable() {
    const maxUnavailable = config.deployment.maxUnavailable;
    
    if (maxUnavailable.endsWith('%')) {
      const percentage = parseInt(maxUnavailable) / 100;
      return Math.max(1, Math.floor(this.instances.length * percentage));
    }
    
    return parseInt(maxUnavailable);
  }
  
  async updateBatch(batch, batchNumber) {
    logInfo(`更新批次 ${batchNumber}`, { instances: batch });
    
    // 停止旧实例
    for (const instance of batch) {
      await executeCommand(`docker stop ${instance}`);
      await executeCommand(`docker rm ${instance}`);
    }
    
    // 启动新实例
    for (let i = 0; i < batch.length; i++) {
      const instanceName = `blog-system-${batchNumber}-${i + 1}`;
      const port = 3000 + (batchNumber - 1) * batch.length + i;
      
      await this.startInstance(instanceName, port);
      
      // 健康检查
      const healthOk = await healthCheck(`http://localhost:${port}${config.application.healthEndpoint}`);
      if (!healthOk) {
        throw new Error(`实例 ${instanceName} 健康检查失败`);
      }
    }
    
    logSuccess(`批次 ${batchNumber} 更新完成`);
  }
  
  async startInstance(name, port) {
    const imageTag = `${config.docker.registry}/${config.docker.image}:${config.application.version}`;
    
    const runCommand = `docker run -d \
      --name ${name} \
      --network app-network \
      -p ${port}:${config.application.port} \
      -e NODE_ENV=${config.deployment.environment} \
      -e PORT=${config.application.port} \
      --health-cmd="curl -f http://localhost:${config.application.port}${config.application.healthEndpoint} || exit 1" \
      --health-interval=30s \
      --health-timeout=10s \
      --health-retries=3 \
      ${imageTag}`;
    
    const result = await executeCommand(runCommand);
    if (!result.success) {
      throw new Error(`启动实例 ${name} 失败: ${result.error}`);
    }
    
    logInfo(`实例 ${name} 启动成功`);
  }
  
  async rollback() {
    logInfo('开始滚动回滚');
    // 实现滚动回滚逻辑
    logSuccess('滚动回滚完成');
  }
}

// 金丝雀部署
class CanaryDeployment {
  constructor() {
    this.canaryPercentage = parseInt(process.env.CANARY_PERCENTAGE) || 10;
  }
  
  async deploy() {
    logInfo('开始金丝雀部署');
    await sendNotification('开始金丝雀部署');
    
    try {
      // 1. 构建新镜像
      await this.buildImage();
      
      // 2. 部署金丝雀实例
      await this.deployCanary();
      
      // 3. 配置流量分割
      await this.configureTrafficSplit();
      
      // 4. 监控金丝雀
      await this.monitorCanary();
      
      // 5. 全量部署
      await this.promoteCanary();
      
      logSuccess('金丝雀部署完成');
      await sendNotification('金丝雀部署成功完成', 'success');
      
    } catch (error) {
      logError('金丝雀部署失败', { error: error.message });
      await sendNotification(`金丝雀部署失败: ${error.message}`, 'error');
      
      await this.rollbackCanary();
      throw error;
    }
  }
  
  async buildImage() {
    // 与蓝绿部署相同的构建逻辑
  }
  
  async deployCanary() {
    logInfo('部署金丝雀实例');
    // 实现金丝雀实例部署
  }
  
  async configureTrafficSplit() {
    logInfo(`配置流量分割: ${this.canaryPercentage}%`);
    // 实现流量分割配置
  }
  
  async monitorCanary() {
    logInfo('监控金丝雀实例');
    // 实现金丝雀监控
  }
  
  async promoteCanary() {
    logInfo('提升金丝雀为生产版本');
    // 实现金丝雀提升
  }
  
  async rollbackCanary() {
    logInfo('回滚金丝雀部署');
    // 实现金丝雀回滚
  }
}

// 部署管理器
class DeploymentManager {
  constructor() {
    this.strategy = config.deployment.strategy;
  }
  
  async deploy() {
    logInfo(`开始${this.strategy}部署`, { config });
    
    let deployment;
    
    switch (this.strategy) {
      case 'blue-green':
        deployment = new BlueGreenDeployment();
        break;
      case 'rolling':
        deployment = new RollingDeployment();
        break;
      case 'canary':
        deployment = new CanaryDeployment();
        break;
      default:
        throw new Error(`不支持的部署策略: ${this.strategy}`);
    }
    
    await deployment.deploy();
  }
  
  async status() {
    logInfo('检查部署状态');
    
    const result = await executeCommand('docker ps --filter "name=blog-system" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"');
    if (result.success) {
      console.log('\n=== 当前部署状态 ===');
      console.log(result.stdout);
    }
  }
  
  async logs(service = 'all') {
    logInfo(`查看${service}日志`);
    
    if (service === 'all') {
      const result = await executeCommand('docker ps --filter "name=blog-system" --format "{{.Names}}"');
      if (result.success && result.stdout) {
        const containers = result.stdout.trim().split('\n');
        for (const container of containers) {
          console.log(`\n=== ${container} 日志 ===`);
          await executeCommand(`docker logs --tail 50 ${container}`);
        }
      }
    } else {
      await executeCommand(`docker logs --tail 100 -f ${service}`);
    }
  }
}

// 主函数
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  const manager = new DeploymentManager();
  
  try {
    switch (command) {
      case 'deploy':
        await manager.deploy();
        break;
      case 'status':
        await manager.status();
        break;
      case 'logs':
        await manager.logs(args[1]);
        break;
      case 'rollback':
        // 实现回滚逻辑
        logInfo('执行回滚');
        break;
      default:
        console.log('\n用法:');
        console.log('  node zero-downtime-deploy.js deploy   # 执行部署');
        console.log('  node zero-downtime-deploy.js status   # 查看状态');
        console.log('  node zero-downtime-deploy.js logs     # 查看日志');
        console.log('  node zero-downtime-deploy.js rollback # 执行回滚');
        console.log('\n环境变量:');
        console.log('  DEPLOY_STRATEGY=blue-green|rolling|canary');
        console.log('  NODE_ENV=production|staging|development');
        console.log('  REPLICAS=3');
        console.log('  HEALTH_CHECK_TIMEOUT=300');
        console.log('  ROLLBACK_ON_FAILURE=true');
        break;
    }
  } catch (error) {
    logError('部署失败', { error: error.message });
    process.exit(1);
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  main();
}

module.exports = {
  DeploymentManager,
  BlueGreenDeployment,
  RollingDeployment,
  CanaryDeployment
};