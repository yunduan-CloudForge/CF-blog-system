import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac';
import { backupRestoreManager, RestoreOptions } from '../utils/backupRestore.js';
import { logger } from '../utils/logger.js';
import { body, param, query, validationResult } from 'express-validator';

const router = express.Router();

// 验证中间件
const handleValidationErrors = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }
  next();
};

// 获取备份统计信息
router.get('/stats', 
  authenticateToken,
  requireRole(['admin']),
  async (req: express.Request, res: express.Response) => {
    try {
      const stats = await backupRestoreManager.getBackupStats();
      
      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      logger.error('Failed to get backup stats:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get backup statistics'
      });
    }
  }
);

// 获取备份历史
router.get('/history',
  authenticateToken,
  requireRole(['admin']),
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('type').optional().isIn(['full', 'incremental']).withMessage('Type must be full or incremental'),
    query('status').optional().isIn(['pending', 'running', 'completed', 'failed']).withMessage('Invalid status')
  ],
  handleValidationErrors,
  async (req: express.Request, res: express.Response) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const type = req.query.type as string;
      const status = req.query.status as string;
      
      let history = backupRestoreManager.getBackupHistory();
      
      // 过滤
      if (type) {
        history = history.filter(backup => backup.type === type);
      }
      if (status) {
        history = history.filter(backup => backup.status === status);
      }
      
      // 排序（最新的在前）
      history.sort((a, b) => {
        const timeA = a.startTime?.getTime() || 0;
        const timeB = b.startTime?.getTime() || 0;
        return timeB - timeA;
      });
      
      // 分页
      const total = history.length;
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedHistory = history.slice(startIndex, endIndex);
      
      res.json({
        success: true,
        data: {
          backups: paginatedHistory,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
          }
        }
      });
    } catch (error) {
      logger.error('Failed to get backup history:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get backup history'
      });
    }
  }
);

// 获取当前备份任务
router.get('/current-task',
  authenticateToken,
  requireRole(['admin']),
  async (req: express.Request, res: express.Response) => {
    try {
      const currentTask = backupRestoreManager.getCurrentTask();
      
      res.json({
        success: true,
        data: currentTask
      });
    } catch (error) {
      logger.error('Failed to get current backup task:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get current backup task'
      });
    }
  }
);

// 创建完整备份
router.post('/full',
  authenticateToken,
  requireRole(['admin']),
  async (req: express.Request, res: express.Response) => {
    try {
      const task = await backupRestoreManager.createFullBackup();
      
      res.json({
        success: true,
        message: 'Full backup initiated',
        data: task
      });
    } catch (error) {
      logger.error('Failed to create full backup:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create full backup'
      });
    }
  }
);

// 创建增量备份
router.post('/incremental',
  authenticateToken,
  requireRole(['admin']),
  async (req: express.Request, res: express.Response) => {
    try {
      const task = await backupRestoreManager.createIncrementalBackup();
      
      res.json({
        success: true,
        message: 'Incremental backup initiated',
        data: task
      });
    } catch (error) {
      logger.error('Failed to create incremental backup:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create incremental backup'
      });
    }
  }
);

// 恢复数据库
router.post('/restore',
  authenticateToken,
  requireRole(['admin']),
  [
    body('backupFile').notEmpty().withMessage('Backup file is required'),
    body('targetTables').optional().isArray().withMessage('Target tables must be an array'),
    body('dropExisting').optional().isBoolean().withMessage('Drop existing must be a boolean'),
    body('validateBeforeRestore').optional().isBoolean().withMessage('Validate before restore must be a boolean'),
    body('createBackupBeforeRestore').optional().isBoolean().withMessage('Create backup before restore must be a boolean')
  ],
  handleValidationErrors,
  async (req: express.Request, res: express.Response) => {
    try {
      const options: RestoreOptions = {
        backupFile: req.body.backupFile,
        targetTables: req.body.targetTables,
        dropExisting: req.body.dropExisting || false,
        validateBeforeRestore: req.body.validateBeforeRestore !== false,
        createBackupBeforeRestore: req.body.createBackupBeforeRestore !== false
      };
      
      await backupRestoreManager.restoreDatabase(options);
      
      res.json({
        success: true,
        message: 'Database restored successfully'
      });
    } catch (error) {
      logger.error('Failed to restore database:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to restore database',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

// 验证备份文件
router.post('/validate',
  authenticateToken,
  requireRole(['admin']),
  [
    body('backupFile').notEmpty().withMessage('Backup file is required')
  ],
  handleValidationErrors,
  async (req: express.Request, res: express.Response) => {
    try {
      const { backupFile } = req.body;
      const isValid = await backupRestoreManager.validateBackupFile(backupFile);
      
      res.json({
        success: true,
        data: {
          isValid,
          message: isValid ? 'Backup file is valid' : 'Backup file is invalid or corrupted'
        }
      });
    } catch (error) {
      logger.error('Failed to validate backup file:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to validate backup file'
      });
    }
  }
);

// 删除备份
router.delete('/:backupId',
  authenticateToken,
  requireRole(['admin']),
  [
    param('backupId').notEmpty().withMessage('Backup ID is required')
  ],
  handleValidationErrors,
  async (req: express.Request, res: express.Response) => {
    try {
      const { backupId } = req.params;
      await backupRestoreManager.deleteBackup(backupId);
      
      res.json({
        success: true,
        message: 'Backup deleted successfully'
      });
    } catch (error) {
      logger.error('Failed to delete backup:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete backup',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

// 获取备份配置
router.get('/config',
  authenticateToken,
  requireRole(['admin']),
  async (req: express.Request, res: express.Response) => {
    try {
      const config = {
        backupDir: process.env.BACKUP_DIR || './backups',
        maxBackups: parseInt(process.env.MAX_BACKUPS || '10'),
        compressionEnabled: process.env.BACKUP_COMPRESSION === 'true',
        incrementalEnabled: process.env.INCREMENTAL_BACKUP === 'true',
        scheduleInterval: parseInt(process.env.BACKUP_INTERVAL || '60'),
        retentionDays: parseInt(process.env.BACKUP_RETENTION_DAYS || '30'),
        encryptionEnabled: process.env.BACKUP_ENCRYPTION === 'true'
      };
      
      res.json({
        success: true,
        data: config
      });
    } catch (error) {
      logger.error('Failed to get backup config:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get backup configuration'
      });
    }
  }
);

// 获取备份建议
router.get('/recommendations',
  authenticateToken,
  requireRole(['admin']),
  async (req: express.Request, res: express.Response) => {
    try {
      const stats = await backupRestoreManager.getBackupStats();
      const recommendations = [];
      
      // 基于统计信息生成建议
      if (!stats.lastBackupTime) {
        recommendations.push({
          type: 'warning',
          message: 'No backups found. Consider creating your first backup.',
          action: 'Create full backup'
        });
      } else {
        const daysSinceLastBackup = Math.floor(
          (Date.now() - stats.lastBackupTime.getTime()) / (1000 * 60 * 60 * 24)
        );
        
        if (daysSinceLastBackup > 7) {
          recommendations.push({
            type: 'warning',
            message: `Last backup was ${daysSinceLastBackup} days ago. Consider creating a new backup.`,
            action: 'Create backup'
          });
        }
      }
      
      if (stats.successRate < 90) {
        recommendations.push({
          type: 'error',
          message: `Backup success rate is ${stats.successRate.toFixed(1)}%. Check backup configuration.`,
          action: 'Review backup logs'
        });
      }
      
      if (stats.totalBackups < 3) {
        recommendations.push({
          type: 'info',
          message: 'Consider maintaining at least 3 backup copies for better data protection.',
          action: 'Increase backup frequency'
        });
      }
      
      if (stats.averageBackupTime > 300000) { // 5 minutes
        recommendations.push({
          type: 'info',
          message: 'Backup process is taking longer than expected. Consider enabling compression or incremental backups.',
          action: 'Optimize backup settings'
        });
      }
      
      res.json({
        success: true,
        data: {
          recommendations,
          stats
        }
      });
    } catch (error) {
      logger.error('Failed to get backup recommendations:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get backup recommendations'
      });
    }
  }
);

export default router;