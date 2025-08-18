/**
 * 错误监控和性能监控API路由
 * 接收前端发送的错误报告和性能数据
 */

import { Router, type Request, type Response } from 'express';
import { run, query, get } from '../database/connection';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// 错误报告接口
interface ErrorReport {
  id: string;
  type: 'javascript' | 'promise' | 'resource' | 'network' | 'custom';
  message: string;
  stack?: string;
  filename?: string;
  lineno?: number;
  colno?: number;
  timestamp: string;
  url: string;
  userAgent: string;
  userId?: string;
  sessionId: string;
  breadcrumbs: Record<string, unknown>[];
  context?: Record<string, unknown>;
}

// 性能指标接口
interface PerformanceMetrics {
  id: string;
  type: 'navigation' | 'resource' | 'paint' | 'layout' | 'custom';
  name: string;
  value: number;
  unit: string;
  timestamp: string;
  url: string;
  userId?: string;
  sessionId: string;
  context?: Record<string, unknown>;
}

/**
 * 接收错误报告
 * POST /api/monitoring
 */
router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const data = req.body;
    const clientIP = req.ip || req.connection.remoteAddress || 'unknown';

    // 验证数据格式
    if (!data || !data.id || !data.timestamp) {
      res.status(400).json({
        success: false,
        message: '无效的监控数据格式'
      });
      return;
    }

    // 判断数据类型并存储
    if ('message' in data) {
      // 错误报告
      await storeErrorReport(data as ErrorReport, clientIP);
    } else if ('value' in data) {
      // 性能指标
      await storePerformanceMetrics(data as PerformanceMetrics, clientIP);
    } else {
      res.status(400).json({
        success: false,
        message: '未知的数据类型'
      });
      return;
    }

    res.json({
      success: true,
      message: '监控数据已接收'
    });
  } catch (error) {
    console.error('处理监控数据错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
});

/**
 * 获取错误统计
 * GET /api/monitoring/errors/stats
 */
router.get('/errors/stats', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { timeRange = '24h' } = req.query;
    const user = (req as { user: { role: string; userId: number } }).user;

    // 检查管理员权限
    if (user.role !== 'admin') {
      res.status(403).json({
        success: false,
        message: '需要管理员权限'
      });
      return;
    }

    // 计算时间范围
    const timeCondition = getTimeCondition(String(timeRange));

    // 获取错误统计
    const errorStats = await query(`
      SELECT 
        type,
        COUNT(*) as count,
        COUNT(DISTINCT session_id) as affected_sessions,
        COUNT(DISTINCT user_id) as affected_users
      FROM error_reports 
      WHERE created_at > datetime('now', '${timeCondition}')
      GROUP BY type
      ORDER BY count DESC
    `);

    // 获取错误趋势
    const errorTrend = await query(`
      SELECT 
        datetime(created_at, 'localtime') as hour,
        COUNT(*) as count
      FROM error_reports 
      WHERE created_at > datetime('now', '${timeCondition}')
      GROUP BY datetime(created_at, 'localtime')
      ORDER BY hour
    `);

    // 获取最频繁的错误
    const topErrors = await query(`
      SELECT 
        message,
        filename,
        COUNT(*) as count,
        MAX(created_at) as last_seen
      FROM error_reports 
      WHERE created_at > datetime('now', '${timeCondition}')
      GROUP BY message, filename
      ORDER BY count DESC
      LIMIT 10
    `);

    // 获取受影响的页面
    const affectedPages = await query(`
      SELECT 
        url,
        COUNT(*) as error_count,
        COUNT(DISTINCT session_id) as affected_sessions
      FROM error_reports 
      WHERE created_at > datetime('now', '${timeCondition}')
      GROUP BY url
      ORDER BY error_count DESC
      LIMIT 10
    `);

    res.json({
      success: true,
      data: {
        errorStats,
        errorTrend,
        topErrors,
        affectedPages
      }
    });
  } catch (error) {
    console.error('获取错误统计失败:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
});

/**
 * 获取性能统计
 * GET /api/monitoring/performance/stats
 */
router.get('/performance/stats', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { timeRange = '24h' } = req.query;
    const user = (req as { user: { role: string; userId: number } }).user;

    // 检查管理员权限
    if (user.role !== 'admin') {
      res.status(403).json({
        success: false,
        message: '需要管理员权限'
      });
      return;
    }

    const timeCondition = getTimeCondition(String(timeRange));

    // 获取性能指标统计
    const performanceStats = await query(`
      SELECT 
        type,
        name,
        AVG(value) as avg_value,
        MIN(value) as min_value,
        MAX(value) as max_value,
        COUNT(*) as count,
        unit
      FROM performance_metrics 
      WHERE created_at > datetime('now', '${timeCondition}')
      GROUP BY type, name, unit
      ORDER BY type, name
    `);

    // 获取页面加载时间趋势
    const loadTimeTrend = await query(`
      SELECT 
        datetime(created_at, 'localtime') as hour,
        AVG(value) as avg_load_time
      FROM performance_metrics 
      WHERE name = 'Load' 
        AND created_at > datetime('now', '${timeCondition}')
      GROUP BY datetime(created_at, 'localtime')
      ORDER BY hour
    `);

    // 获取慢页面
    const slowPages = await query(`
      SELECT 
        url,
        AVG(value) as avg_load_time,
        COUNT(*) as sample_count
      FROM performance_metrics 
      WHERE name = 'Load' 
        AND created_at > datetime('now', '${timeCondition}')
      GROUP BY url
      HAVING avg_load_time > 3000
      ORDER BY avg_load_time DESC
      LIMIT 10
    `);

    // 获取Core Web Vitals
    const webVitals = await query(`
      SELECT 
        name,
        AVG(value) as avg_value,
        PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY value) as p75_value,
        unit
      FROM performance_metrics 
      WHERE name IN ('FCP', 'LCP', 'CLS') 
        AND created_at > datetime('now', '${timeCondition}')
      GROUP BY name, unit
    `);

    res.json({
      success: true,
      data: {
        performanceStats,
        loadTimeTrend,
        slowPages,
        webVitals
      }
    });
  } catch (error) {
    console.error('获取性能统计失败:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
});

/**
 * 获取错误详情
 * GET /api/monitoring/errors/:id
 */
router.get('/errors/:id', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const user = req.user;

    // 检查管理员权限
    if (user.role !== 'admin') {
      res.status(403).json({
        success: false,
        message: '需要管理员权限'
      });
      return;
    }

    const errorReport = await get(`
      SELECT * FROM error_reports WHERE id = ?
    `, [id]);

    if (!errorReport) {
      res.status(404).json({
        success: false,
        message: '错误报告不存在'
      });
      return;
    }

    // 解析JSON字段
    if (errorReport.breadcrumbs) {
      errorReport.breadcrumbs = JSON.parse(errorReport.breadcrumbs as string);
    }
    if (errorReport.context) {
      errorReport.context = JSON.parse(errorReport.context as string);
    }

    res.json({
      success: true,
      data: errorReport
    });
  } catch (error) {
    console.error('获取错误详情失败:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
});

/**
 * 获取系统健康状态
 * GET /api/monitoring/health
 */
router.get('/health', async (req: Request, res: Response): Promise<void> => {
  try {
    // 获取最近1小时的错误率
    const errorRate = await get(`
      SELECT COUNT(*) as error_count
      FROM error_reports 
      WHERE created_at > datetime('now', '-1 hour')
    `);

    // 获取平均页面加载时间
    const avgLoadTime = await get(`
      SELECT AVG(value) as avg_load_time
      FROM performance_metrics 
      WHERE name = 'Load' 
        AND created_at > datetime('now', '-1 hour')
    `);

    // 获取活跃会话数
    const activeSessions = await get(`
      SELECT COUNT(DISTINCT session_id) as active_sessions
      FROM (
        SELECT session_id FROM error_reports WHERE created_at > datetime('now', '-1 hour')
        UNION
        SELECT session_id FROM performance_metrics WHERE created_at > datetime('now', '-1 hour')
      )
    `);

    // 计算健康分数
    const errorCount = (errorRate?.error_count as unknown as number) || 0;
    const loadTime = (avgLoadTime?.avg_load_time as unknown as number) || 0;
    const sessions = (activeSessions?.active_sessions as unknown as number) || 0;

    let healthScore = 100;
    if (errorCount > 10) healthScore -= 20;
    if (loadTime > 3000) healthScore -= 15;
    if (loadTime > 5000) healthScore -= 25;

    const status = healthScore >= 80 ? 'healthy' : healthScore >= 60 ? 'warning' : 'critical';

    res.json({
      success: true,
      data: {
        status,
        healthScore,
        metrics: {
          errorCount,
          avgLoadTime: loadTime,
          activeSessions: sessions
        },
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('获取系统健康状态失败:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
});

/**
 * 存储错误报告
 */
async function storeErrorReport(errorReport: ErrorReport, clientIP: string): Promise<void> {
  await run(`
    INSERT INTO error_reports (
      id, type, message, stack, filename, lineno, colno, 
      timestamp, url, user_agent, user_id, session_id, 
      breadcrumbs, context, client_ip, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `, [
    errorReport.id,
    errorReport.type,
    errorReport.message,
    errorReport.stack,
    errorReport.filename,
    errorReport.lineno,
    errorReport.colno,
    errorReport.timestamp,
    errorReport.url,
    errorReport.userAgent,
    errorReport.userId,
    errorReport.sessionId,
    JSON.stringify(errorReport.breadcrumbs),
    JSON.stringify(errorReport.context),
    clientIP
  ]);
}

/**
 * 存储性能指标
 */
async function storePerformanceMetrics(metrics: PerformanceMetrics, clientIP: string): Promise<void> {
  await run(`
    INSERT INTO performance_metrics (
      id, type, name, value, unit, timestamp, url, 
      user_id, session_id, context, client_ip, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `, [
    metrics.id,
    metrics.type,
    metrics.name,
    metrics.value,
    metrics.unit,
    metrics.timestamp,
    metrics.url,
    metrics.userId,
    metrics.sessionId,
    JSON.stringify(metrics.context),
    clientIP
  ]);
}

/**
 * 获取时间条件
 */
function getTimeCondition(timeRange: string): string {
  switch (timeRange) {
    case '1h':
      return '-1 hour';
    case '24h':
      return '-1 day';
    case '7d':
      return '-7 days';
    case '30d':
      return '-30 days';
    default:
      return '-1 day';
  }
}

export default router;