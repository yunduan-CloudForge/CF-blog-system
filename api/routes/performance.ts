import { Router } from 'express';
import { performanceMonitor } from '../services/performanceMonitor.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';

const router = Router();

// 获取性能统计 - 需要管理员权限
router.get('/stats', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const hours = parseInt(req.query.hours as string) || 24;
    const stats = await performanceMonitor.getPerformanceStats(hours);
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('获取性能统计失败:', error);
    res.status(500).json({
      success: false,
      message: '获取性能统计失败'
    });
  }
});

// 获取慢查询列表 - 需要管理员权限
router.get('/slow-queries', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const slowQueries = await performanceMonitor.getSlowQueries(limit);
    
    res.json({
      success: true,
      data: slowQueries
    });
  } catch (error) {
    console.error('获取慢查询失败:', error);
    res.status(500).json({
      success: false,
      message: '获取慢查询失败'
    });
  }
});

// 获取索引使用情况 - 需要管理员权限
router.get('/indexes', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const indexes = await performanceMonitor.getIndexUsage();
    
    res.json({
      success: true,
      data: indexes
    });
  } catch (error) {
    console.error('获取索引信息失败:', error);
    res.status(500).json({
      success: false,
      message: '获取索引信息失败'
    });
  }
});

// 获取表统计信息 - 需要管理员权限
router.get('/tables', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const tables = await performanceMonitor.analyzeTableStats();
    
    res.json({
      success: true,
      data: tables
    });
  } catch (error) {
    console.error('获取表统计失败:', error);
    res.status(500).json({
      success: false,
      message: '获取表统计失败'
    });
  }
});

// 设置慢查询阈值 - 需要管理员权限
router.post('/threshold', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { threshold } = req.body;
    
    if (!threshold || threshold < 1) {
      return res.status(400).json({
        success: false,
        message: '阈值必须大于0'
      });
    }
    
    performanceMonitor.setSlowQueryThreshold(threshold);
    
    res.json({
      success: true,
      message: `慢查询阈值已设置为 ${threshold}ms`
    });
  } catch (error) {
    console.error('设置阈值失败:', error);
    res.status(500).json({
      success: false,
      message: '设置阈值失败'
    });
  }
});

// 清理旧数据 - 需要管理员权限
router.post('/cleanup', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { days } = req.body;
    const cleanupDays = days || 7;
    
    await performanceMonitor.cleanupOldData(cleanupDays);
    
    res.json({
      success: true,
      message: `已清理 ${cleanupDays} 天前的性能数据`
    });
  } catch (error) {
    console.error('清理数据失败:', error);
    res.status(500).json({
      success: false,
      message: '清理数据失败'
    });
  }
});

// 启用/禁用性能监控 - 需要管理员权限
router.post('/toggle', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { enabled } = req.body;
    
    performanceMonitor.setEnabled(enabled);
    
    res.json({
      success: true,
      message: `性能监控已${enabled ? '启用' : '禁用'}`
    });
  } catch (error) {
    console.error('切换监控状态失败:', error);
    res.status(500).json({
      success: false,
      message: '切换监控状态失败'
    });
  }
});

export default router;