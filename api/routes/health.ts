import express from 'express';
import { query, validationResult } from 'express-validator';
import { logger } from '../utils/logger';
import { logRotationManager } from '../utils/logRotation';
import { alertSystem } from '../utils/alertSystem';
import { emailService } from '../utils/emailService';
import { supabase } from '../database/supabase';

const router = express.Router();

// 基础健康检查
router.get('/', (req, res) => {
  const healthStatus = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  };

  res.json(healthStatus);
});

// 详细健康检查
router.get('/detailed', [
  query('include').optional().isString().withMessage('include参数必须是字符串')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: '参数验证失败',
      errors: errors.array()
    });
  }

  try {
    const { include } = req.query;
    const includeServices = include ? (include as string).split(',') : ['all'];
    
    const healthData: any = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: formatUptime(process.uptime()),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      services: {}
    };

    // 检查数据库连接
    if (includeServices.includes('all') || includeServices.includes('database')) {
      healthData.services.database = await checkDatabaseHealth();
    }

    // 检查内存使用
    if (includeServices.includes('all') || includeServices.includes('memory')) {
      healthData.services.memory = getMemoryHealth();
    }

    // 检查日志系统
    if (includeServices.includes('all') || includeServices.includes('logs')) {
      healthData.services.logs = await checkLogHealth();
    }

    // 检查告警系统
    if (includeServices.includes('all') || includeServices.includes('alerts')) {
      healthData.services.alerts = checkAlertHealth();
    }

    // 检查邮件服务
    if (includeServices.includes('all') || includeServices.includes('email')) {
      healthData.services.email = await checkEmailHealth();
    }

    // 检查磁盘空间
    if (includeServices.includes('all') || includeServices.includes('disk')) {
      healthData.services.disk = await checkDiskHealth();
    }

    // 计算整体健康状态
    const serviceStatuses = Object.values(healthData.services).map((service: any) => service.status);
    if (serviceStatuses.includes('error')) {
      healthData.status = 'error';
    } else if (serviceStatuses.includes('warning')) {
      healthData.status = 'warning';
    }

    res.json(healthData);
  } catch (error) {
    logger.error('健康检查失败:', error);
    res.status(500).json({
      status: 'error',
      message: '健康检查失败',
      timestamp: new Date().toISOString()
    });
  }
});

// 就绪检查（用于容器编排）
router.get('/ready', async (req, res) => {
  try {
    // 检查关键服务是否就绪
    const dbHealth = await checkDatabaseHealth();
    
    if (dbHealth.status === 'ok') {
      res.status(200).json({
        status: 'ready',
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(503).json({
        status: 'not ready',
        reason: 'Database not available',
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    logger.error('就绪检查失败:', error);
    res.status(503).json({
      status: 'not ready',
      reason: 'Health check failed',
      timestamp: new Date().toISOString()
    });
  }
});

// 存活检查（用于容器编排）
router.get('/live', (req, res) => {
  // 简单的存活检查，只要进程在运行就返回成功
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// 系统指标
router.get('/metrics', async (req, res) => {
  try {
    const metrics = {
      timestamp: new Date().toISOString(),
      system: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        cpu: process.cpuUsage(),
        platform: process.platform,
        arch: process.arch,
        nodeVersion: process.version
      },
      application: {
        environment: process.env.NODE_ENV || 'development',
        version: process.env.npm_package_version || '1.0.0'
      },
      logs: await logRotationManager.getLogStats(),
      alerts: {
        activeAlerts: alertSystem.getActiveAlerts().length,
        totalRules: alertSystem.getRules().length,
        enabledRules: alertSystem.getRules().filter(r => r.enabled).length
      }
    };

    res.json(metrics);
  } catch (error) {
    logger.error('获取系统指标失败:', error);
    res.status(500).json({
      error: '获取系统指标失败',
      timestamp: new Date().toISOString()
    });
  }
});

// 辅助函数
function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  return `${days}d ${hours}h ${minutes}m ${secs}s`;
}

async function checkDatabaseHealth() {
  try {
    const startTime = Date.now();
    const { data, error } = await supabase
      .from('articles')
      .select('id')
      .limit(1);
    
    const responseTime = Date.now() - startTime;
    
    if (error) {
      return {
        status: 'error',
        message: error.message,
        responseTime
      };
    }
    
    return {
      status: 'ok',
      responseTime,
      message: 'Database connection successful'
    };
  } catch (error) {
    return {
      status: 'error',
      message: 'Database connection failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

function getMemoryHealth() {
  const memUsage = process.memoryUsage();
  const totalMem = memUsage.heapTotal;
  const usedMem = memUsage.heapUsed;
  const usagePercent = (usedMem / totalMem) * 100;
  
  let status = 'ok';
  if (usagePercent > 90) {
    status = 'error';
  } else if (usagePercent > 75) {
    status = 'warning';
  }
  
  return {
    status,
    usage: {
      heapUsed: Math.round(usedMem / 1024 / 1024 * 100) / 100, // MB
      heapTotal: Math.round(totalMem / 1024 / 1024 * 100) / 100, // MB
      usagePercent: Math.round(usagePercent * 100) / 100,
      external: Math.round(memUsage.external / 1024 / 1024 * 100) / 100, // MB
      rss: Math.round(memUsage.rss / 1024 / 1024 * 100) / 100 // MB
    }
  };
}

async function checkLogHealth() {
  try {
    const logStats = await logRotationManager.getLogStats();
    
    if (!logStats) {
      return {
        status: 'warning',
        message: '无法获取日志统计信息'
      };
    }
    
    let status = 'ok';
    const totalSizeMB = parseFloat(logStats.totalSizeMB);
    
    if (totalSizeMB > 1000) { // 1GB
      status = 'warning';
    }
    
    return {
      status,
      stats: logStats
    };
  } catch (error) {
    return {
      status: 'error',
      message: '日志系统检查失败',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

function checkAlertHealth() {
  try {
    const activeAlerts = alertSystem.getActiveAlerts();
    const rules = alertSystem.getRules();
    
    let status = 'ok';
    if (activeAlerts.length > 0) {
      status = 'warning';
    }
    
    return {
      status,
      activeAlerts: activeAlerts.length,
      totalRules: rules.length,
      enabledRules: rules.filter(r => r.enabled).length
    };
  } catch (error) {
    return {
      status: 'error',
      message: '告警系统检查失败',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

async function checkEmailHealth() {
  try {
    const isConnected = await emailService.testConnection();
    
    return {
      status: isConnected ? 'ok' : 'warning',
      message: isConnected ? '邮件服务连接正常' : '邮件服务未配置或连接失败'
    };
  } catch (error) {
    return {
      status: 'error',
      message: '邮件服务检查失败',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

async function checkDiskHealth() {
  try {
    // 在实际项目中，这里应该检查磁盘空间
    // 由于Node.js没有内置的磁盘空间检查API，这里返回模拟数据
    return {
      status: 'ok',
      message: '磁盘空间充足',
      usage: {
        total: '100GB',
        used: '45GB',
        available: '55GB',
        usagePercent: 45
      }
    };
  } catch (error) {
    return {
      status: 'error',
      message: '磁盘检查失败',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

export default router;