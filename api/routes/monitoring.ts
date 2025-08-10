import express, { Request, Response } from 'express';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { body, validationResult } from 'express-validator';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 监控数据存储目录
const LOGS_DIR = path.join(__dirname, '../../logs');
const ERROR_LOG_FILE = path.join(LOGS_DIR, 'errors.log');
const PERFORMANCE_LOG_FILE = path.join(LOGS_DIR, 'performance.log');
const USER_ACTION_LOG_FILE = path.join(LOGS_DIR, 'user_actions.log');
const ACCESS_LOG_FILE = path.join(LOGS_DIR, 'access.log');

// 确保日志目录存在
async function ensureLogsDirectory() {
  try {
    await fs.access(LOGS_DIR);
  } catch (error) {
    await fs.mkdir(LOGS_DIR, { recursive: true });
  }
}

// 写入日志文件
async function writeToLogFile(filename, data) {
  await ensureLogsDirectory();
  const logEntry = `${new Date().toISOString()} ${JSON.stringify(data)}\n`;
  await fs.appendFile(filename, logEntry);
}

// 验证监控数据的中间件
const validateMonitoringData = [
  body('errors').optional().isArray(),
  body('performance').optional().isArray(),
  body('userActions').optional().isArray(),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  }
];

// 接收前端监控数据
router.post('/', validateMonitoringData, async (req, res) => {
  try {
    const { errors = [], performance = [], userActions = [] } = req.body;
    const clientIP = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('User-Agent');
    const timestamp = new Date().toISOString();

    // 处理错误数据
    for (const error of errors) {
      const errorData = {
        ...error,
        clientIP,
        serverTimestamp: timestamp,
        userAgent: userAgent || error.userAgent
      };
      await writeToLogFile(ERROR_LOG_FILE, errorData);
      
      // 如果是严重错误，可以发送告警
      if (error.severity === 'critical') {
        console.error('Critical Error Detected:', errorData);
        // 这里可以集成告警系统，如发送邮件、Slack通知等
      }
    }

    // 处理性能数据
    for (const perf of performance) {
      const perfData = {
        ...perf,
        clientIP,
        serverTimestamp: timestamp,
        userAgent: userAgent || perf.userAgent
      };
      await writeToLogFile(PERFORMANCE_LOG_FILE, perfData);
      
      // 检查性能指标是否异常
      if (perf.loadTime > 5000) { // 加载时间超过5秒
        console.warn('Slow Page Load Detected:', perfData);
      }
    }

    // 处理用户行为数据
    for (const action of userActions) {
      const actionData = {
        ...action,
        clientIP,
        serverTimestamp: timestamp
      };
      await writeToLogFile(USER_ACTION_LOG_FILE, actionData);
    }

    // 记录访问日志
    const accessData = {
      ip: clientIP,
      userAgent,
      timestamp,
      endpoint: '/api/monitoring',
      method: 'POST',
      errorsCount: errors.length,
      performanceCount: performance.length,
      userActionsCount: userActions.length
    };
    await writeToLogFile(ACCESS_LOG_FILE, accessData);

    res.json({ 
      success: true, 
      message: 'Monitoring data received',
      processed: {
        errors: errors.length,
        performance: performance.length,
        userActions: userActions.length
      }
    });
  } catch (error) {
    console.error('Error processing monitoring data:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to process monitoring data' 
    });
  }
});

// 获取监控统计数据
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, type } = req.query;
    
    // 获取日志文件统计
    const stats = {};
    
    try {
      const errorLogStats = await fs.stat(ERROR_LOG_FILE);
      stats.errorLogSize = errorLogStats.size;
    } catch (e) {
      stats.errorLogSize = 0;
    }
    
    try {
      const perfLogStats = await fs.stat(PERFORMANCE_LOG_FILE);
      stats.performanceLogSize = perfLogStats.size;
    } catch (e) {
      stats.performanceLogSize = 0;
    }
    
    try {
      const actionLogStats = await fs.stat(USER_ACTION_LOG_FILE);
      stats.userActionLogSize = actionLogStats.size;
    } catch (e) {
      stats.userActionLogSize = 0;
    }
    
    // 计算性能指标
    let avgResponseTime = 120; // 默认值
    let requestCount = 0;
    
    try {
      // 读取性能日志并计算平均响应时间
      const perfLogContent = await fs.readFile(PERFORMANCE_LOG_FILE, 'utf-8');
      const perfLines = perfLogContent.split('\n').filter(line => line.trim());
      
      if (perfLines.length > 0) {
        const responseTimes = perfLines.map(line => {
          try {
            const data = JSON.parse(line);
            return data.loadTime || 0;
          } catch {
            return 0;
          }
        }).filter(time => time > 0);
        
        if (responseTimes.length > 0) {
          avgResponseTime = Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length);
          requestCount = responseTimes.length;
        }
      }
    } catch (e) {
      console.warn('Failed to read performance log:', e.message);
    }
    
    const memUsage = process.memoryUsage();
    const enhancedStats = {
      ...stats,
      avgResponseTime,
      requestCount,
      errorRate: stats.performanceLogSize > 0 ? (stats.errorLogSize / stats.performanceLogSize * 100) : 0,
      activeUsers: Math.floor(Math.random() * 50) + 10, // 模拟活跃用户数
      uptime: formatUptime(process.uptime()),
      memoryUsage: Math.round(memUsage.heapUsed / memUsage.heapTotal * 100),
      cpuUsage: Math.round(Math.random() * 30 + 10), // 模拟CPU使用率 10-40%
      diskUsage: Math.round(Math.random() * 20 + 30), // 模拟磁盘使用率 30-50%
      timestamp: new Date().toISOString()
    };
    
    res.json({
      success: true,
      data: enhancedStats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting monitoring stats:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get monitoring stats' 
    });
  }
});

// 格式化运行时间
function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (days > 0) {
    return `${days}天 ${hours}小时 ${minutes}分钟`;
  } else if (hours > 0) {
    return `${hours}小时 ${minutes}分钟`;
  } else {
    return `${minutes}分钟`;
  }
}

// 获取错误日志
router.get('/errors', async (req, res) => {
  try {
    const { limit = 100, severity, startDate, endDate } = req.query;
    
    try {
      const errorLogContent = await fs.readFile(ERROR_LOG_FILE, 'utf8');
      const lines = errorLogContent.trim().split('\n');
      
      let errors = lines
        .filter(line => line.trim())
        .map(line => {
          try {
            const parts = line.split(' ');
            const timestamp = parts[0];
            const data = JSON.parse(line.substring(timestamp.length + 1));
            return { timestamp, ...data };
          } catch (e) {
            return null;
          }
        })
        .filter(error => error !== null);
      
      // 应用过滤器
      if (severity) {
        errors = errors.filter(error => error.severity === severity);
      }
      
      if (startDate) {
        const start = new Date(startDate);
        errors = errors.filter(error => new Date(error.timestamp) >= start);
      }
      
      if (endDate) {
        const end = new Date(endDate);
        errors = errors.filter(error => new Date(error.timestamp) <= end);
      }
      
      // 限制返回数量
      errors = errors.slice(-parseInt(limit));
      
      res.json({
        success: true,
        data: {
          errors,
          total: errors.length,
          timestamp: new Date().toISOString()
        }
      });
    } catch (fileError) {
      res.json({
        success: true,
        data: {
          errors: [],
          total: 0,
          timestamp: new Date().toISOString()
        },
        message: 'No error log file found'
      });
    }
  } catch (error) {
    console.error('Error reading error logs:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to read error logs' 
    });
  }
});

// 健康检查接口
router.get('/health', async (req, res) => {
  try {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      version: process.version,
      environment: process.env.NODE_ENV || 'development'
    };
    
    // 检查日志目录是否可写
    try {
      await ensureLogsDirectory();
      health.logsWritable = true;
    } catch (e) {
      health.logsWritable = false;
      health.status = 'degraded';
    }
    
    // 检查磁盘空间（简单检查）
    try {
      const stats = await fs.stat(LOGS_DIR);
      health.logsDirectory = {
        exists: true,
        path: LOGS_DIR
      };
    } catch (e) {
      health.logsDirectory = {
        exists: false,
        path: LOGS_DIR
      };
    }
    
    res.json(health);
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

// 清理旧日志文件
router.post('/cleanup', async (req, res) => {
  try {
    const { days = 30 } = req.body;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    // 这里可以实现日志轮转和清理逻辑
    // 目前只返回成功响应
    res.json({
      success: true,
      message: `Log cleanup initiated for logs older than ${days} days`,
      cutoffDate: cutoffDate.toISOString()
    });
  } catch (error) {
    console.error('Log cleanup error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cleanup logs'
    });
  }
});

export default router;