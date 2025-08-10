import express from 'express';
import { authenticateToken } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { connectionPool } from '../database/connectionPool';
import { 
  getConnectionPoolStats, 
  getQueryCacheStats, 
  getQueryPerformanceReport,
  clearQueryStats,
  generateIndexSuggestions,
  invalidateTableCache,
  warmupCache,
  getDbMonitorStats,
  getDbHealthStatus,
  getPerformanceTrends,
  clearMonitorData
} from '../database/database';
import { queryOptimizer } from '../utils/queryOptimizer';
import { queryCache } from '../utils/queryCache';
import { logger } from '../utils/logger';

const router = express.Router();

// 获取连接池基础统计信息
router.get('/stats', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const stats = getConnectionPoolStats();
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error('获取连接池统计失败:', error);
    res.status(500).json({
      success: false,
      message: '获取统计信息失败'
    });
  }
});

// 获取连接池详细统计信息
router.get('/stats/detailed', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const poolStats = getConnectionPoolStats();
    const cacheStats = getQueryCacheStats();
    const performanceReport = getQueryPerformanceReport();
    const monitorStats = getDbMonitorStats();
    
    res.json({
      success: true,
      data: {
        connectionPool: poolStats,
        queryCache: cacheStats,
        performance: performanceReport,
        monitor: monitorStats
      }
    });
  } catch (error) {
    logger.error('获取详细统计失败:', error);
    res.status(500).json({
      success: false,
      message: '获取详细统计信息失败'
    });
  }
});

// 获取查询缓存统计
router.get('/cache/stats', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const stats = getQueryCacheStats();
    const hotItems = queryCache.getHotItems(10);
    const largeItems = queryCache.getLargeItems(10);
    
    res.json({
      success: true,
      data: {
        ...stats,
        hotItems,
        largeItems
      }
    });
  } catch (error) {
    logger.error('获取缓存统计失败:', error);
    res.status(500).json({
      success: false,
      message: '获取缓存统计失败'
    });
  }
});

// 清理查询缓存
router.post('/cache/clear', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    queryCache.clear();
    res.json({
      success: true,
      message: '查询缓存已清理'
    });
  } catch (error) {
    logger.error('清理缓存失败:', error);
    res.status(500).json({
      success: false,
      message: '清理缓存失败'
    });
  }
});

// 失效表缓存
router.post('/cache/invalidate/:table', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { table } = req.params;
    const count = invalidateTableCache(table);
    
    res.json({
      success: true,
      message: `表 ${table} 相关缓存已失效`,
      data: { invalidatedItems: count }
    });
  } catch (error) {
    logger.error('失效缓存失败:', error);
    res.status(500).json({
      success: false,
      message: '失效缓存失败'
    });
  }
});

// 获取查询性能报告
router.get('/performance/report', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const report = getQueryPerformanceReport();
    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    logger.error('获取性能报告失败:', error);
    res.status(500).json({
      success: false,
      message: '获取性能报告失败'
    });
  }
});

// 获取慢查询
router.get('/performance/slow-queries', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const slowQueries = queryOptimizer.getSlowQueries();
    res.json({
      success: true,
      data: slowQueries
    });
  } catch (error) {
    logger.error('获取慢查询失败:', error);
    res.status(500).json({
      success: false,
      message: '获取慢查询失败'
    });
  }
});

// 获取查询统计
router.get('/performance/query-stats', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const stats = queryOptimizer.getQueryStats();
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error('获取查询统计失败:', error);
    res.status(500).json({
      success: false,
      message: '获取查询统计失败'
    });
  }
});

// 生成索引建议
router.get('/optimization/index-suggestions', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const suggestions = await generateIndexSuggestions();
    res.json({
      success: true,
      data: suggestions
    });
  } catch (error) {
    logger.error('生成索引建议失败:', error);
    res.status(500).json({
      success: false,
      message: '生成索引建议失败'
    });
  }
});

// 清理性能统计
router.post('/performance/clear', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    clearQueryStats();
    res.json({
      success: true,
      message: '性能统计已清理'
    });
  } catch (error) {
    logger.error('清理性能统计失败:', error);
    res.status(500).json({
      success: false,
      message: '清理性能统计失败'
    });
  }
});

// 预热缓存
router.post('/cache/warmup', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { queries } = req.body;
    
    if (!Array.isArray(queries)) {
      return res.status(400).json({
        success: false,
        message: '查询列表必须是数组格式'
      });
    }
    
    await warmupCache(queries);
    
    res.json({
      success: true,
      message: '缓存预热完成'
    });
  } catch (error) {
    logger.error('缓存预热失败:', error);
    res.status(500).json({
      success: false,
      message: '缓存预热失败'
    });
  }
});

// 获取连接池健康状态
router.get('/health', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const healthStatus = await getDbHealthStatus();
    
    res.json({
      success: true,
      data: healthStatus
    });
  } catch (error) {
    logger.error('获取健康状态失败:', error);
    res.status(500).json({
      success: false,
      message: '获取健康状态失败'
    });
  }
});

// 获取性能历史（模拟数据）
router.get('/performance/history', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const now = Date.now();
    const history = [];
    
    // 生成最近24小时的模拟数据
    for (let i = 23; i >= 0; i--) {
      const timestamp = now - (i * 60 * 60 * 1000);
      history.push({
        timestamp,
        activeConnections: Math.floor(Math.random() * 10) + 1,
        queryCount: Math.floor(Math.random() * 100) + 50,
        averageResponseTime: Math.floor(Math.random() * 50) + 10,
        errorRate: Math.random() * 2,
        cacheHitRate: Math.random() * 40 + 60 // 60-100%
      });
    }
    
    res.json({
      success: true,
      data: history
    });
  } catch (error) {
    logger.error('获取性能历史失败:', error);
    res.status(500).json({
      success: false,
      message: '获取性能历史失败'
    });
  }
});

// 获取数据库监控统计
router.get('/monitor/stats', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const stats = getDbMonitorStats();
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error('获取监控统计失败:', error);
    res.status(500).json({
      success: false,
      message: '获取监控统计失败'
    });
  }
});

// 获取性能趋势
router.get('/monitor/trends', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const trends = getPerformanceTrends();
    
    res.json({
      success: true,
      data: trends
    });
  } catch (error) {
    logger.error('获取性能趋势失败:', error);
    res.status(500).json({
      success: false,
      message: '获取性能趋势失败'
    });
  }
});

// 清理监控数据
router.delete('/monitor/data', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    clearMonitorData();
    
    res.json({
      success: true,
      message: '监控数据清理完成'
    });
  } catch (error) {
    logger.error('清理监控数据失败:', error);
    res.status(500).json({
      success: false,
      message: '清理监控数据失败'
    });
  }
});

export default router;