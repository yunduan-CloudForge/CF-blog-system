import express from 'express';
import { authenticateToken } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { dataArchiveManager } from '../utils/dataArchive';
import { logger } from '../utils/logger';
import { body, param, query, validationResult } from 'express-validator';

const router = express.Router();

// 验证中间件
const handleValidationErrors = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: '参数验证失败',
      errors: errors.array()
    });
  }
  next();
};

// 获取归档统计信息
router.get('/stats', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const stats = await dataArchiveManager.getArchiveStats();
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error('获取归档统计失败:', error);
    res.status(500).json({
      success: false,
      message: '获取归档统计失败'
    });
  }
});

// 获取所有归档任务
router.get('/tasks', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const tasks = dataArchiveManager.getAllTasks();
    res.json({
      success: true,
      data: tasks
    });
  } catch (error) {
    logger.error('获取归档任务列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取归档任务列表失败'
    });
  }
});

// 获取特定归档任务状态
router.get('/tasks/:taskId', 
  authenticateToken, 
  requireRole(['admin']),
  param('taskId').notEmpty().withMessage('任务ID不能为空'),
  handleValidationErrors,
  async (req, res) => {
    try {
      const { taskId } = req.params;
      const task = dataArchiveManager.getTaskStatus(taskId);
      
      if (!task) {
        return res.status(404).json({
          success: false,
          message: '归档任务不存在'
        });
      }
      
      res.json({
        success: true,
        data: task
      });
    } catch (error) {
      logger.error('获取归档任务状态失败:', error);
      res.status(500).json({
        success: false,
        message: '获取归档任务状态失败'
      });
    }
  }
);

// 创建归档任务
router.post('/tasks',
  authenticateToken,
  requireRole(['admin']),
  [
    body('tableName').notEmpty().withMessage('表名不能为空'),
    body('condition').notEmpty().withMessage('归档条件不能为空'),
    body('taskId').optional().isString().withMessage('任务ID必须是字符串')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { tableName, condition, taskId } = req.body;
      
      const newTaskId = await dataArchiveManager.createArchiveTask(
        tableName,
        condition,
        taskId
      );
      
      res.status(201).json({
        success: true,
        message: '归档任务创建成功',
        data: { taskId: newTaskId }
      });
    } catch (error) {
      logger.error('创建归档任务失败:', error);
      res.status(500).json({
        success: false,
        message: '创建归档任务失败'
      });
    }
  }
);

// 执行归档任务
router.post('/tasks/:taskId/execute',
  authenticateToken,
  requireRole(['admin']),
  param('taskId').notEmpty().withMessage('任务ID不能为空'),
  handleValidationErrors,
  async (req, res) => {
    try {
      const { taskId } = req.params;
      
      await dataArchiveManager.executeArchiveTask(taskId);
      
      res.json({
        success: true,
        message: '归档任务执行成功'
      });
    } catch (error) {
      logger.error('执行归档任务失败:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : '执行归档任务失败'
      });
    }
  }
);

// 归档指定表的旧数据
router.post('/tables/:tableName/archive',
  authenticateToken,
  requireRole(['admin']),
  [
    param('tableName').notEmpty().withMessage('表名不能为空'),
    body('dateColumn').optional().isString().withMessage('日期列名必须是字符串')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { tableName } = req.params;
      const { dateColumn } = req.body;
      
      const taskId = await dataArchiveManager.archiveOldData(tableName, dateColumn);
      
      res.json({
        success: true,
        message: '表数据归档完成',
        data: { taskId }
      });
    } catch (error) {
      logger.error('归档表数据失败:', error);
      res.status(500).json({
        success: false,
        message: '归档表数据失败'
      });
    }
  }
);

// 批量归档多个表
router.post('/tables/batch-archive',
  authenticateToken,
  requireRole(['admin']),
  [
    body('tables').isArray({ min: 1 }).withMessage('表列表不能为空'),
    body('tables.*.name').notEmpty().withMessage('表名不能为空'),
    body('tables.*.dateColumn').optional().isString().withMessage('日期列名必须是字符串')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { tables } = req.body;
      
      const taskIds = await dataArchiveManager.archiveMultipleTables(tables);
      
      res.json({
        success: true,
        message: '批量归档完成',
        data: { taskIds }
      });
    } catch (error) {
      logger.error('批量归档失败:', error);
      res.status(500).json({
        success: false,
        message: '批量归档失败'
      });
    }
  }
);

// 从归档恢复数据
router.post('/restore',
  authenticateToken,
  requireRole(['admin']),
  [
    body('archiveFileName').notEmpty().withMessage('归档文件名不能为空'),
    body('tableName').optional().isString().withMessage('目标表名必须是字符串')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { archiveFileName, tableName } = req.body;
      
      const restoredCount = await dataArchiveManager.restoreFromArchive(
        archiveFileName,
        tableName
      );
      
      res.json({
        success: true,
        message: '数据恢复完成',
        data: { restoredRecords: restoredCount }
      });
    } catch (error) {
      logger.error('数据恢复失败:', error);
      res.status(500).json({
        success: false,
        message: '数据恢复失败'
      });
    }
  }
);

// 清理过期归档文件
router.post('/cleanup',
  authenticateToken,
  requireRole(['admin']),
  async (req, res) => {
    try {
      const cleanedCount = await dataArchiveManager.cleanupExpiredArchives();
      
      res.json({
        success: true,
        message: '清理完成',
        data: { cleanedFiles: cleanedCount }
      });
    } catch (error) {
      logger.error('清理归档文件失败:', error);
      res.status(500).json({
        success: false,
        message: '清理归档文件失败'
      });
    }
  }
);

// 获取归档配置信息
router.get('/config', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    // 获取当前配置（不包含敏感信息）
    const config = {
      retentionDays: parseInt(process.env.ARCHIVE_RETENTION_DAYS || '365'),
      archiveAfterDays: parseInt(process.env.ARCHIVE_AFTER_DAYS || '90'),
      batchSize: parseInt(process.env.ARCHIVE_BATCH_SIZE || '1000'),
      enableCompression: process.env.ARCHIVE_COMPRESSION === 'true',
      compressionLevel: parseInt(process.env.ARCHIVE_COMPRESSION_LEVEL || '6'),
      autoCleanup: process.env.ARCHIVE_AUTO_CLEANUP !== 'false',
      cleanupInterval: parseInt(process.env.ARCHIVE_CLEANUP_INTERVAL || '86400000')
    };
    
    res.json({
      success: true,
      data: config
    });
  } catch (error) {
    logger.error('获取归档配置失败:', error);
    res.status(500).json({
      success: false,
      message: '获取归档配置失败'
    });
  }
});

// 获取推荐的归档策略
router.get('/recommendations', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    // 模拟推荐策略（实际应用中可以基于数据分析）
    const recommendations = [
      {
        tableName: 'posts',
        reason: '文章表数据量较大，建议归档6个月前的数据',
        suggestedCondition: "created_at < datetime('now', '-6 months')",
        estimatedRecords: 1500,
        estimatedSize: '2.5MB'
      },
      {
        tableName: 'comments',
        reason: '评论表增长较快，建议归档3个月前的数据',
        suggestedCondition: "created_at < datetime('now', '-3 months')",
        estimatedRecords: 3200,
        estimatedSize: '1.8MB'
      },
      {
        tableName: 'user_activities',
        reason: '用户活动日志数据量大，建议归档1个月前的数据',
        suggestedCondition: "created_at < datetime('now', '-1 month')",
        estimatedRecords: 8500,
        estimatedSize: '4.2MB'
      }
    ];
    
    res.json({
      success: true,
      data: recommendations
    });
  } catch (error) {
    logger.error('获取归档推荐失败:', error);
    res.status(500).json({
      success: false,
      message: '获取归档推荐失败'
    });
  }
});

// 获取归档历史记录
router.get('/history',
  authenticateToken,
  requireRole(['admin']),
  [
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('限制数量必须在1-100之间'),
    query('offset').optional().isInt({ min: 0 }).withMessage('偏移量必须大于等于0')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = parseInt(req.query.offset as string) || 0;
      
      const allTasks = dataArchiveManager.getAllTasks();
      const completedTasks = allTasks
        .filter(task => task.status === 'completed')
        .sort((a, b) => (b.completedAt?.getTime() || 0) - (a.completedAt?.getTime() || 0))
        .slice(offset, offset + limit);
      
      res.json({
        success: true,
        data: {
          tasks: completedTasks,
          total: allTasks.filter(task => task.status === 'completed').length,
          limit,
          offset
        }
      });
    } catch (error) {
      logger.error('获取归档历史失败:', error);
      res.status(500).json({
        success: false,
        message: '获取归档历史失败'
      });
    }
  }
);

export default router;