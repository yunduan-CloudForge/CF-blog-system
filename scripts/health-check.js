#!/usr/bin/env node

/**
 * 健康检查脚本
 * 用于监控应用和服务的健康状态
 */

const http = require('http');
const https = require('https');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// 配置
const config = {
  app: {
    host: process.env.APP_HOST || 'localhost',
    port: process.env.APP_PORT || 3000,
    protocol: process.env.APP_PROTOCOL || 'http',
    timeout: parseInt(process.env.HEALTH_CHECK_TIMEOUT) || 30000
  },
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    name: process.env.DB_NAME || 'blog_system',
    username: process.env.DB_USERNAME || 'postgres'
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379
  },
  checks: {
    retries: parseInt(process.env.HEALTH_CHECK_RETRIES) || 3,
    interval: parseInt(process.env.HEALTH_CHECK_INTERVAL) || 5000,
    timeout: parseInt(process.env.HEALTH_CHECK_TIMEOUT) || 30000
  }
};

// 日志函数
function log(level, message, data = null) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level,
    message,
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

// HTTP请求函数
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      timeout: options.timeout || config.checks.timeout,
      headers: {
        'User-Agent': 'Health-Check/1.0',
        ...options.headers
      }
    };

    const client = urlObj.protocol === 'https:' ? https : http;
    
    const req = client.request(requestOptions, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data
        });
      });
    });
    
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    
    req.on('error', (err) => {
      reject(err);
    });
    
    if (options.body) {
      req.write(options.body);
    }
    
    req.end();
  });
}

// 重试函数
async function withRetry(fn, retries = config.checks.retries, interval = config.checks.interval) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === retries - 1) {
        throw error;
      }
      logWarning(`尝试 ${i + 1}/${retries} 失败，${interval}ms后重试`, { error: error.message });
      await new Promise(resolve => setTimeout(resolve, interval));
    }
  }
}

// 应用健康检查
async function checkApplication() {
  logInfo('检查应用健康状态...');
  
  const baseUrl = `${config.app.protocol}://${config.app.host}:${config.app.port}`;
  
  try {
    // 检查主健康端点
    const healthResponse = await withRetry(async () => {
      return await makeRequest(`${baseUrl}/health`);
    });
    
    if (healthResponse.statusCode !== 200) {
      throw new Error(`健康检查端点返回状态码: ${healthResponse.statusCode}`);
    }
    
    let healthData;
    try {
      healthData = JSON.parse(healthResponse.body);
    } catch (e) {
      throw new Error('健康检查端点返回无效JSON');
    }
    
    // 检查API端点
    const apiResponse = await withRetry(async () => {
      return await makeRequest(`${baseUrl}/api/health`);
    });
    
    if (apiResponse.statusCode !== 200) {
      throw new Error(`API健康检查端点返回状态码: ${apiResponse.statusCode}`);
    }
    
    logSuccess('应用健康检查通过', {
      url: baseUrl,
      health: healthData,
      responseTime: healthData.responseTime || 'N/A'
    });
    
    return {
      status: 'healthy',
      url: baseUrl,
      data: healthData
    };
    
  } catch (error) {
    logError('应用健康检查失败', {
      url: baseUrl,
      error: error.message
    });
    
    return {
      status: 'unhealthy',
      url: baseUrl,
      error: error.message
    };
  }
}

// 数据库健康检查
async function checkDatabase() {
  logInfo('检查数据库连接...');
  
  try {
    // 使用Docker检查数据库容器状态
    const containerStatus = execSync(
      'docker-compose ps postgres --format json',
      { encoding: 'utf8', timeout: 10000 }
    );
    
    const containers = JSON.parse(`[${containerStatus.trim().split('\n').join(',')}]`);
    const postgresContainer = containers.find(c => c.Service === 'postgres');
    
    if (!postgresContainer || postgresContainer.State !== 'running') {
      throw new Error('PostgreSQL容器未运行');
    }
    
    // 检查数据库连接
    const connectionTest = execSync(
      `docker-compose exec -T postgres pg_isready -h ${config.database.host} -p ${config.database.port} -U ${config.database.username}`,
      { encoding: 'utf8', timeout: 10000 }
    );
    
    if (!connectionTest.includes('accepting connections')) {
      throw new Error('数据库连接测试失败');
    }
    
    // 检查数据库查询
    const queryTest = execSync(
      `docker-compose exec -T postgres psql -U ${config.database.username} -d ${config.database.name} -c "SELECT 1;"`,
      { encoding: 'utf8', timeout: 10000 }
    );
    
    if (!queryTest.includes('1 row')) {
      throw new Error('数据库查询测试失败');
    }
    
    logSuccess('数据库健康检查通过', {
      host: config.database.host,
      port: config.database.port,
      database: config.database.name
    });
    
    return {
      status: 'healthy',
      host: config.database.host,
      port: config.database.port,
      database: config.database.name
    };
    
  } catch (error) {
    logError('数据库健康检查失败', {
      host: config.database.host,
      port: config.database.port,
      error: error.message
    });
    
    return {
      status: 'unhealthy',
      host: config.database.host,
      port: config.database.port,
      error: error.message
    };
  }
}

// Redis健康检查
async function checkRedis() {
  logInfo('检查Redis连接...');
  
  try {
    // 使用Docker检查Redis容器状态
    const containerStatus = execSync(
      'docker-compose ps redis --format json',
      { encoding: 'utf8', timeout: 10000 }
    );
    
    const containers = JSON.parse(`[${containerStatus.trim().split('\n').join(',')}]`);
    const redisContainer = containers.find(c => c.Service === 'redis');
    
    if (!redisContainer || redisContainer.State !== 'running') {
      throw new Error('Redis容器未运行');
    }
    
    // 检查Redis连接
    const connectionTest = execSync(
      `docker-compose exec -T redis redis-cli -h ${config.redis.host} -p ${config.redis.port} ping`,
      { encoding: 'utf8', timeout: 10000 }
    );
    
    if (!connectionTest.includes('PONG')) {
      throw new Error('Redis连接测试失败');
    }
    
    // 检查Redis读写
    const writeTest = execSync(
      `docker-compose exec -T redis redis-cli -h ${config.redis.host} -p ${config.redis.port} set health_check_test "ok"`,
      { encoding: 'utf8', timeout: 10000 }
    );
    
    const readTest = execSync(
      `docker-compose exec -T redis redis-cli -h ${config.redis.host} -p ${config.redis.port} get health_check_test`,
      { encoding: 'utf8', timeout: 10000 }
    );
    
    if (!readTest.includes('ok')) {
      throw new Error('Redis读写测试失败');
    }
    
    // 清理测试数据
    execSync(
      `docker-compose exec -T redis redis-cli -h ${config.redis.host} -p ${config.redis.port} del health_check_test`,
      { encoding: 'utf8', timeout: 10000 }
    );
    
    logSuccess('Redis健康检查通过', {
      host: config.redis.host,
      port: config.redis.port
    });
    
    return {
      status: 'healthy',
      host: config.redis.host,
      port: config.redis.port
    };
    
  } catch (error) {
    logError('Redis健康检查失败', {
      host: config.redis.host,
      port: config.redis.port,
      error: error.message
    });
    
    return {
      status: 'unhealthy',
      host: config.redis.host,
      port: config.redis.port,
      error: error.message
    };
  }
}

// 容器健康检查
async function checkContainers() {
  logInfo('检查容器状态...');
  
  try {
    const containerStatus = execSync(
      'docker-compose ps --format json',
      { encoding: 'utf8', timeout: 10000 }
    );
    
    const containers = JSON.parse(`[${containerStatus.trim().split('\n').join(',')}]`);
    const results = [];
    
    for (const container of containers) {
      const isHealthy = container.State === 'running';
      
      results.push({
        name: container.Service,
        status: isHealthy ? 'healthy' : 'unhealthy',
        state: container.State,
        ports: container.Ports || 'N/A'
      });
      
      if (isHealthy) {
        logSuccess(`容器 ${container.Service} 运行正常`);
      } else {
        logError(`容器 ${container.Service} 状态异常`, { state: container.State });
      }
    }
    
    return results;
    
  } catch (error) {
    logError('容器状态检查失败', { error: error.message });
    return [];
  }
}

// 磁盘空间检查
async function checkDiskSpace() {
  logInfo('检查磁盘空间...');
  
  try {
    // Windows系统使用wmic命令
    const diskInfo = execSync(
      'wmic logicaldisk get size,freespace,caption /format:csv',
      { encoding: 'utf8', timeout: 10000 }
    );
    
    const lines = diskInfo.trim().split('\n').filter(line => line.includes(','));
    const results = [];
    
    for (const line of lines) {
      const [, caption, freeSpace, size] = line.split(',');
      
      if (caption && freeSpace && size) {
        const freeSpaceGB = Math.round(parseInt(freeSpace) / (1024 * 1024 * 1024));
        const totalSizeGB = Math.round(parseInt(size) / (1024 * 1024 * 1024));
        const usagePercent = Math.round(((totalSizeGB - freeSpaceGB) / totalSizeGB) * 100);
        
        const isHealthy = usagePercent < 90; // 磁盘使用率小于90%认为健康
        
        results.push({
          drive: caption,
          total: `${totalSizeGB}GB`,
          free: `${freeSpaceGB}GB`,
          usage: `${usagePercent}%`,
          status: isHealthy ? 'healthy' : 'warning'
        });
        
        if (isHealthy) {
          logSuccess(`磁盘 ${caption} 空间充足`, { usage: `${usagePercent}%` });
        } else {
          logWarning(`磁盘 ${caption} 空间不足`, { usage: `${usagePercent}%` });
        }
      }
    }
    
    return results;
    
  } catch (error) {
    logError('磁盘空间检查失败', { error: error.message });
    return [];
  }
}

// 内存使用检查
async function checkMemoryUsage() {
  logInfo('检查内存使用情况...');
  
  try {
    // 检查系统内存
    const memInfo = execSync(
      'wmic OS get TotalVisibleMemorySize,FreePhysicalMemory /format:csv',
      { encoding: 'utf8', timeout: 10000 }
    );
    
    const lines = memInfo.trim().split('\n').filter(line => line.includes(','));
    let systemMemory = null;
    
    for (const line of lines) {
      const [, freeMemory, totalMemory] = line.split(',');
      
      if (freeMemory && totalMemory) {
        const freeMemoryMB = Math.round(parseInt(freeMemory) / 1024);
        const totalMemoryMB = Math.round(parseInt(totalMemory) / 1024);
        const usagePercent = Math.round(((totalMemoryMB - freeMemoryMB) / totalMemoryMB) * 100);
        
        systemMemory = {
          total: `${totalMemoryMB}MB`,
          free: `${freeMemoryMB}MB`,
          usage: `${usagePercent}%`,
          status: usagePercent < 90 ? 'healthy' : 'warning'
        };
        
        break;
      }
    }
    
    // 检查Docker容器内存使用
    const dockerStats = execSync(
      'docker stats --no-stream --format "{{.Container}},{{.MemUsage}},{{.MemPerc}}"',
      { encoding: 'utf8', timeout: 10000 }
    );
    
    const containerMemory = [];
    const dockerLines = dockerStats.trim().split('\n');
    
    for (const line of dockerLines) {
      const [container, memUsage, memPerc] = line.split(',');
      
      if (container && memUsage && memPerc) {
        const usagePercent = parseFloat(memPerc.replace('%', ''));
        
        containerMemory.push({
          container,
          usage: memUsage,
          percent: memPerc,
          status: usagePercent < 80 ? 'healthy' : 'warning'
        });
      }
    }
    
    logSuccess('内存使用检查完成', {
      system: systemMemory,
      containers: containerMemory.length
    });
    
    return {
      system: systemMemory,
      containers: containerMemory
    };
    
  } catch (error) {
    logError('内存使用检查失败', { error: error.message });
    return null;
  }
}

// 生成健康报告
function generateHealthReport(results) {
  const report = {
    timestamp: new Date().toISOString(),
    overall: 'healthy',
    checks: results,
    summary: {
      total: 0,
      healthy: 0,
      unhealthy: 0,
      warnings: 0
    }
  };
  
  // 计算总体状态
  for (const [checkName, result] of Object.entries(results)) {
    if (Array.isArray(result)) {
      // 处理数组结果（如容器检查）
      for (const item of result) {
        report.summary.total++;
        if (item.status === 'healthy') {
          report.summary.healthy++;
        } else if (item.status === 'warning') {
          report.summary.warnings++;
        } else {
          report.summary.unhealthy++;
          report.overall = 'unhealthy';
        }
      }
    } else if (result && typeof result === 'object') {
      // 处理对象结果
      report.summary.total++;
      if (result.status === 'healthy') {
        report.summary.healthy++;
      } else if (result.status === 'warning') {
        report.summary.warnings++;
        if (report.overall === 'healthy') {
          report.overall = 'warning';
        }
      } else {
        report.summary.unhealthy++;
        report.overall = 'unhealthy';
      }
    }
  }
  
  return report;
}

// 保存健康报告
function saveHealthReport(report) {
  const reportsDir = path.join(__dirname, '..', 'logs', 'health-reports');
  
  // 确保目录存在
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }
  
  // 保存详细报告
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportFile = path.join(reportsDir, `health-report-${timestamp}.json`);
  fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
  
  // 保存最新报告
  const latestFile = path.join(reportsDir, 'latest.json');
  fs.writeFileSync(latestFile, JSON.stringify(report, null, 2));
  
  logInfo('健康报告已保存', { file: reportFile });
}

// 主函数
async function main() {
  const startTime = Date.now();
  
  logInfo('开始健康检查...');
  
  const results = {};
  
  try {
    // 执行各项检查
    results.application = await checkApplication();
    results.database = await checkDatabase();
    results.redis = await checkRedis();
    results.containers = await checkContainers();
    results.diskSpace = await checkDiskSpace();
    results.memory = await checkMemoryUsage();
    
    // 生成报告
    const report = generateHealthReport(results);
    report.duration = Date.now() - startTime;
    
    // 保存报告
    saveHealthReport(report);
    
    // 输出结果
    console.log('\n=== 健康检查报告 ===');
    console.log(JSON.stringify(report, null, 2));
    
    // 根据结果设置退出码
    if (report.overall === 'unhealthy') {
      logError('健康检查失败');
      process.exit(1);
    } else if (report.overall === 'warning') {
      logWarning('健康检查发现警告');
      process.exit(0);
    } else {
      logSuccess('健康检查通过');
      process.exit(0);
    }
    
  } catch (error) {
    logError('健康检查过程中发生错误', { error: error.message });
    process.exit(1);
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  main();
}

module.exports = {
  checkApplication,
  checkDatabase,
  checkRedis,
  checkContainers,
  checkDiskSpace,
  checkMemoryUsage,
  generateHealthReport
};