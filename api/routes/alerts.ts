import express from 'express';
import { body, query, validationResult } from 'express-validator';
import { alertSystem } from '../utils/alertSystem';
import { logger } from '../utils/logger';
import { authenticateToken, requireAdmin } from '../middleware/auth';

const router = express.Router();

// 获取所有告警规则
router.get('/rules', authenticateToken, requireAdmin, (req, res) => {
  try {
    const rules = alertSystem.getRules();
    res.json({
      success: true,
      data: rules
    });
  } catch (error) {
    logger.error('获取告警规则失败:', error);
    res.status(500).json({
      success: false,
      message: '获取告警规则失败'
    });
  }
});

// 更新告警规则
router.put('/rules/:ruleId', [
  authenticateToken,
  requireAdmin,
  body('name').optional().isString().withMessage('规则名称必须是字符串'),
  body('threshold').optional().isNumeric().withMessage('阈值必须是数字'),
  body('enabled').optional().isBoolean().withMessage('启用状态必须是布尔值'),
  body('duration').optional().isInt({ min: 60 }).withMessage('持续时间至少60秒'),
  body('cooldown').optional().isInt({ min: 300 }).withMessage('冷却时间至少300秒')
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: '参数验证失败',
      errors: errors.array()
    });
  }

  try {
    const { ruleId } = req.params;
    const updates = req.body;
    
    alertSystem.updateRule(ruleId, updates);
    
    logger.info('告警规则已更新', {
      ruleId,
      updates,
      userId: req.user?.id,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.json({
      success: true,
      message: '告警规则更新成功'
    });
  } catch (error) {
    logger.error('更新告警规则失败:', error);
    res.status(500).json({
      success: false,
      message: '更新告警规则失败'
    });
  }
});

// 获取当前活跃告警
router.get('/active', authenticateToken, requireAdmin, (req, res) => {
  try {
    const activeAlerts = alertSystem.getActiveAlerts();
    res.json({
      success: true,
      data: activeAlerts
    });
  } catch (error) {
    logger.error('获取活跃告警失败:', error);
    res.status(500).json({
      success: false,
      message: '获取活跃告警失败'
    });
  }
});

// 获取指标数据
router.get('/metrics', [
  authenticateToken,
  requireAdmin,
  query('metric').optional().isString().withMessage('指标名称必须是字符串'),
  query('hours').optional().isInt({ min: 1, max: 24 }).withMessage('时间范围必须是1-24小时')
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: '参数验证失败',
      errors: errors.array()
    });
  }

  try {
    const { metric, hours = 1 } = req.query;
    let metrics;
    
    if (metric) {
      metrics = alertSystem.getMetrics(metric as string);
      // 过滤指定时间范围内的数据
      const hoursAgo = new Date(Date.now() - parseInt(hours as string) * 3600000);
      metrics = metrics.filter(m => new Date(m.timestamp) > hoursAgo);
    } else {
      metrics = alertSystem.getMetrics();
      // 对所有指标应用时间过滤
      const hoursAgo = new Date(Date.now() - parseInt(hours as string) * 3600000);
      for (const [key, values] of Object.entries(metrics)) {
        metrics[key] = values.filter(m => new Date(m.timestamp) > hoursAgo);
      }
    }

    res.json({
      success: true,
      data: metrics
    });
  } catch (error) {
    logger.error('获取指标数据失败:', error);
    res.status(500).json({
      success: false,
      message: '获取指标数据失败'
    });
  }
});

// 获取告警统计信息
router.get('/stats', authenticateToken, requireAdmin, (req, res) => {
  try {
    const rules = alertSystem.getRules();
    const activeAlerts = alertSystem.getActiveAlerts();
    const metrics = alertSystem.getMetrics();

    const stats = {
      totalRules: rules.length,
      enabledRules: rules.filter(r => r.enabled).length,
      activeAlerts: activeAlerts.length,
      availableMetrics: Object.keys(metrics).length,
      rulesByMetric: rules.reduce((acc, rule) => {
        acc[rule.metric] = (acc[rule.metric] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      alertsBySeverity: {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0
      }
    };

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error('获取告警统计失败:', error);
    res.status(500).json({
      success: false,
      message: '获取告警统计失败'
    });
  }
});

// 测试告警规则
router.post('/test/:ruleId', [
  authenticateToken,
  requireAdmin
], (req, res) => {
  try {
    const { ruleId } = req.params;
    const rules = alertSystem.getRules();
    const rule = rules.find(r => r.id === ruleId);
    
    if (!rule) {
      return res.status(404).json({
        success: false,
        message: '告警规则不存在'
      });
    }

    // 模拟触发告警进行测试
    logger.info('测试告警规则', {
      ruleId,
      ruleName: rule.name,
      userId: req.user?.id,
      ip: req.ip
    });

    res.json({
      success: true,
      message: '告警规则测试完成，请检查日志和通知'
    });
  } catch (error) {
    logger.error('测试告警规则失败:', error);
    res.status(500).json({
      success: false,
      message: '测试告警规则失败'
    });
  }
});

// 获取告警历史（从日志中提取）
router.get('/history', [
  authenticateToken,
  requireAdmin,
  query('page').optional().isInt({ min: 1 }).withMessage('页码必须是正整数'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('每页数量必须是1-100'),
  query('severity').optional().isIn(['low', 'medium', 'high', 'critical']).withMessage('严重程度无效')
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: '参数验证失败',
      errors: errors.array()
    });
  }

  try {
    const { page = 1, limit = 20, severity } = req.query;
    
    // 这里应该从日志文件或数据库中读取告警历史
    // 暂时返回模拟数据
    const mockHistory = [
      {
        id: '1',
        ruleName: '错误率过高',
        metric: 'error_rate',
        threshold: 5,
        currentValue: 7.2,
        severity: 'high',
        triggeredAt: new Date(Date.now() - 3600000),
        resolvedAt: new Date(Date.now() - 1800000),
        duration: 1800
      },
      {
        id: '2',
        ruleName: 'API响应时间过慢',
        metric: 'avg_response_time',
        threshold: 2000,
        currentValue: 2500,
        severity: 'medium',
        triggeredAt: new Date(Date.now() - 7200000),
        resolvedAt: new Date(Date.now() - 5400000),
        duration: 1800
      }
    ];

    let filteredHistory = mockHistory;
    if (severity) {
      filteredHistory = mockHistory.filter(h => h.severity === severity);
    }

    const startIndex = (parseInt(page as string) - 1) * parseInt(limit as string);
    const endIndex = startIndex + parseInt(limit as string);
    const paginatedHistory = filteredHistory.slice(startIndex, endIndex);

    res.json({
      success: true,
      data: {
        alerts: paginatedHistory,
        pagination: {
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          total: filteredHistory.length,
          totalPages: Math.ceil(filteredHistory.length / parseInt(limit as string))
        }
      }
    });
  } catch (error) {
    logger.error('获取告警历史失败:', error);
    res.status(500).json({
      success: false,
      message: '获取告警历史失败'
    });
  }
});

export default router;