import fs from 'fs/promises';
import path from 'path';
import { createReadStream, createWriteStream } from 'fs';
import { createGzip, createGunzip } from 'zlib';
import { pipeline } from 'stream/promises';
import { query, execute } from '../database/database.js';
import { logger, LogLevel, LogType } from './logger.js';

// 备份配置接口
export interface BackupConfig {
  backupDir: string;
  maxBackups: number;
  compressionEnabled: boolean;
  incrementalEnabled: boolean;
  scheduleInterval: number; // 分钟
  retentionDays: number;
  encryptionEnabled: boolean;
  encryptionKey?: string;
}

// 备份任务接口
export interface BackupTask {
  id: string;
  type: 'full' | 'incremental';
  status: 'pending' | 'running' | 'completed' | 'failed';
  startTime?: Date;
  endTime?: Date;
  filePath?: string;
  fileSize?: number;
  compressed: boolean;
  encrypted: boolean;
  checksum?: string;
  error?: string;
}

// 恢复选项接口
export interface RestoreOptions {
  backupFile: string;
  targetTables?: string[];
  dropExisting: boolean;
  validateBeforeRestore: boolean;
  createBackupBeforeRestore: boolean;
}

// 备份统计接口
export interface BackupStats {
  totalBackups: number;
  fullBackups: number;
  incrementalBackups: number;
  totalSize: number;
  lastBackupTime?: Date;
  lastFullBackupTime?: Date;
  successRate: number;
  averageBackupTime: number;
  oldestBackup?: Date;
  newestBackup?: Date;
}

class BackupRestoreManager {
  private config: BackupConfig;
  private isRunning = false;
  private currentTask: BackupTask | null = null;
  private backupHistory: BackupTask[] = [];
  private scheduleTimer: NodeJS.Timeout | null = null;
  private lastFullBackupTime: Date | null = null;

  constructor() {
    this.config = {
      backupDir: process.env.BACKUP_DIR || './backups',
      maxBackups: parseInt(process.env.MAX_BACKUPS || '10'),
      compressionEnabled: process.env.BACKUP_COMPRESSION === 'true',
      incrementalEnabled: process.env.INCREMENTAL_BACKUP === 'true',
      scheduleInterval: parseInt(process.env.BACKUP_INTERVAL || '60'), // 默认1小时
      retentionDays: parseInt(process.env.BACKUP_RETENTION_DAYS || '30'),
      encryptionEnabled: process.env.BACKUP_ENCRYPTION === 'true',
      encryptionKey: process.env.BACKUP_ENCRYPTION_KEY
    };
  }

  // 启动备份服务
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.log(LogLevel.WARN, LogType.OPERATION, 'Backup service is already running');
      return;
    }

    try {
      // 确保备份目录存在
      await this.ensureBackupDirectory();
      
      // 加载备份历史
      await this.loadBackupHistory();
      
      // 启动定时备份
      this.scheduleBackups();
      
      this.isRunning = true;
      logger.log(LogLevel.INFO, LogType.OPERATION, 'Backup service started successfully');
    } catch (error) {
      logger.log(LogLevel.ERROR, LogType.ERROR, 'Failed to start backup service:', error);
      throw error;
    }
  }

  // 停止备份服务
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    if (this.scheduleTimer) {
      clearInterval(this.scheduleTimer);
      this.scheduleTimer = null;
    }

    // 等待当前任务完成
    if (this.currentTask && this.currentTask.status === 'running') {
      logger.log(LogLevel.INFO, LogType.OPERATION, 'Waiting for current backup task to complete...');
      while (this.currentTask && this.currentTask.status === 'running') {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    this.isRunning = false;
    logger.log(LogLevel.INFO, LogType.OPERATION, 'Backup service stopped');
  }

  // 创建完整备份
  async createFullBackup(): Promise<BackupTask> {
    const task: BackupTask = {
      id: `backup_${Date.now()}`,
      type: 'full',
      status: 'pending',
      compressed: this.config.compressionEnabled,
      encrypted: this.config.encryptionEnabled
    };

    try {
      task.status = 'running';
      task.startTime = new Date();
      this.currentTask = task;
      
      logger.log(LogLevel.INFO, LogType.OPERATION, `Starting full backup: ${task.id}`);
      
      // 获取所有表
      const tables = await this.getAllTables();
      
      // 创建备份文件路径
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `full_backup_${timestamp}.sql${this.config.compressionEnabled ? '.gz' : ''}`;
      const filePath = path.join(this.config.backupDir, fileName);
      
      // 执行备份
      await this.performBackup(tables, filePath, task);
      
      task.status = 'completed';
      task.endTime = new Date();
      task.filePath = filePath;
      this.lastFullBackupTime = new Date();
      
      logger.log(LogLevel.INFO, LogType.OPERATION, `Full backup completed: ${task.id}`);
      
    } catch (error) {
      task.status = 'failed';
      task.error = error instanceof Error ? error.message : String(error);
      task.endTime = new Date();
      
      logger.log(LogLevel.ERROR, LogType.ERROR, `Full backup failed: ${task.id}`, error);
    } finally {
      this.currentTask = null;
      this.backupHistory.push(task);
      await this.saveBackupHistory();
      await this.cleanupOldBackups();
    }

    return task;
  }

  // 创建增量备份
  async createIncrementalBackup(): Promise<BackupTask> {
    if (!this.lastFullBackupTime) {
      logger.log(LogLevel.WARN, LogType.OPERATION, 'No full backup found, creating full backup instead');
      return this.createFullBackup();
    }

    const task: BackupTask = {
      id: `incremental_${Date.now()}`,
      type: 'incremental',
      status: 'pending',
      compressed: this.config.compressionEnabled,
      encrypted: this.config.encryptionEnabled
    };

    try {
      task.status = 'running';
      task.startTime = new Date();
      this.currentTask = task;
      
      logger.log(LogLevel.INFO, LogType.OPERATION, `Starting incremental backup: ${task.id}`);
      
      // 获取自上次备份以来修改的数据
      const modifiedTables = await this.getModifiedTables(this.lastFullBackupTime);
      
      if (modifiedTables.length === 0) {
        task.status = 'completed';
        task.endTime = new Date();
        logger.log(LogLevel.INFO, LogType.OPERATION, `No changes found for incremental backup: ${task.id}`);
        return task;
      }
      
      // 创建备份文件路径
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `incremental_backup_${timestamp}.sql${this.config.compressionEnabled ? '.gz' : ''}`;
      const filePath = path.join(this.config.backupDir, fileName);
      
      // 执行增量备份
      await this.performIncrementalBackup(modifiedTables, filePath, task);
      
      task.status = 'completed';
      task.endTime = new Date();
      task.filePath = filePath;
      
      logger.log(LogLevel.INFO, LogType.OPERATION, `Incremental backup completed: ${task.id}`);
      
    } catch (error) {
      task.status = 'failed';
      task.error = error instanceof Error ? error.message : String(error);
      task.endTime = new Date();
      
      logger.log(LogLevel.ERROR, LogType.ERROR, `Incremental backup failed: ${task.id}`, error);
    } finally {
      this.currentTask = null;
      this.backupHistory.push(task);
      await this.saveBackupHistory();
    }

    return task;
  }

  // 恢复数据库
  async restoreDatabase(options: RestoreOptions): Promise<void> {
    try {
      logger.log(LogLevel.INFO, LogType.OPERATION, `Starting database restore from: ${options.backupFile}`);
      
      // 验证备份文件
      if (options.validateBeforeRestore) {
        const isValid = await this.validateBackupFile(options.backupFile);
        if (!isValid) {
          throw new Error('Backup file validation failed');
        }
      }
      
      // 创建恢复前备份
      if (options.createBackupBeforeRestore) {
        await this.createFullBackup();
      }
      
      // 读取备份文件
      const sqlContent = await this.readBackupFile(options.backupFile);
      
      // 如果需要删除现有表
      if (options.dropExisting && options.targetTables) {
        for (const table of options.targetTables) {
          await execute(`DROP TABLE IF EXISTS ${table}`);
        }
      }
      
      // 执行SQL语句
      const statements = sqlContent.split(';').filter(stmt => stmt.trim());
      for (const statement of statements) {
        if (statement.trim()) {
          await execute(statement.trim());
        }
      }
      
      logger.log(LogLevel.INFO, LogType.OPERATION, 'Database restore completed successfully');
      
    } catch (error) {
      logger.log(LogLevel.ERROR, LogType.ERROR, 'Database restore failed:', error);
      throw error;
    }
  }

  // 验证备份文件
  async validateBackupFile(filePath: string): Promise<boolean> {
    try {
      const content = await this.readBackupFile(filePath);
      
      // 基本SQL语法检查
      const hasCreateTable = content.includes('CREATE TABLE');
      const hasInsert = content.includes('INSERT INTO');
      
      return hasCreateTable || hasInsert;
    } catch (error) {
      logger.log(LogLevel.ERROR, LogType.ERROR, 'Backup file validation failed:', error);
      return false;
    }
  }

  // 获取备份统计信息
  async getBackupStats(): Promise<BackupStats> {
    const completedBackups = this.backupHistory.filter(b => b.status === 'completed');
    const fullBackups = completedBackups.filter(b => b.type === 'full');
    const incrementalBackups = completedBackups.filter(b => b.type === 'incremental');
    
    const totalSize = completedBackups.reduce((sum, backup) => sum + (backup.fileSize || 0), 0);
    const successRate = this.backupHistory.length > 0 ? 
      (completedBackups.length / this.backupHistory.length) * 100 : 0;
    
    const backupTimes = completedBackups
      .filter(b => b.startTime && b.endTime)
      .map(b => b.endTime!.getTime() - b.startTime!.getTime());
    
    const averageBackupTime = backupTimes.length > 0 ? 
      backupTimes.reduce((sum, time) => sum + time, 0) / backupTimes.length : 0;
    
    const sortedBackups = completedBackups.sort((a, b) => 
      (a.startTime?.getTime() || 0) - (b.startTime?.getTime() || 0)
    );
    
    return {
      totalBackups: completedBackups.length,
      fullBackups: fullBackups.length,
      incrementalBackups: incrementalBackups.length,
      totalSize,
      lastBackupTime: sortedBackups[sortedBackups.length - 1]?.startTime,
      lastFullBackupTime: this.lastFullBackupTime || undefined,
      successRate,
      averageBackupTime,
      oldestBackup: sortedBackups[0]?.startTime,
      newestBackup: sortedBackups[sortedBackups.length - 1]?.startTime
    };
  }

  // 获取备份历史
  getBackupHistory(): BackupTask[] {
    return [...this.backupHistory];
  }

  // 获取当前任务
  getCurrentTask(): BackupTask | null {
    return this.currentTask;
  }

  // 删除备份文件
  async deleteBackup(backupId: string): Promise<void> {
    const backup = this.backupHistory.find(b => b.id === backupId);
    if (!backup || !backup.filePath) {
      throw new Error('Backup not found');
    }

    try {
      await fs.unlink(backup.filePath);
      this.backupHistory = this.backupHistory.filter(b => b.id !== backupId);
      await this.saveBackupHistory();
      
      logger.log(LogLevel.INFO, LogType.OPERATION, `Backup deleted: ${backupId}`);
    } catch (error) {
      logger.log(LogLevel.ERROR, LogType.ERROR, `Failed to delete backup: ${backupId}`, error);
      throw error;
    }
  }

  // 私有方法
  private async ensureBackupDirectory(): Promise<void> {
    try {
      await fs.access(this.config.backupDir);
    } catch {
      await fs.mkdir(this.config.backupDir, { recursive: true });
    }
  }

  private scheduleBackups(): void {
    this.scheduleTimer = setInterval(async () => {
      try {
        if (this.config.incrementalEnabled) {
          await this.createIncrementalBackup();
        } else {
          await this.createFullBackup();
        }
      } catch (error) {
        logger.log(LogLevel.ERROR, LogType.ERROR, 'Scheduled backup failed:', error);
      }
    }, this.config.scheduleInterval * 60 * 1000);
  }

  private async getAllTables(): Promise<string[]> {
    const result = await query(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
    );
    return result.map((row: any) => row.name);
  }

  private async getModifiedTables(since: Date): Promise<string[]> {
    // 简化实现：返回所有表（实际应该检查表的修改时间）
    return this.getAllTables();
  }

  private async performBackup(tables: string[], filePath: string, task: BackupTask): Promise<void> {
    let sqlContent = '';
    
    // 生成表结构和数据的SQL
    for (const table of tables) {
      // 获取表结构
      const createTableResult = await query(
        "SELECT sql FROM sqlite_master WHERE type='table' AND name=?",
        [table]
      );
      
      if (createTableResult.length > 0) {
        sqlContent += `${createTableResult[0].sql};\n\n`;
      }
      
      // 获取表数据
      const rows = await query(`SELECT * FROM ${table}`);
      if (rows.length > 0) {
        const columns = Object.keys(rows[0]);
        const columnList = columns.join(', ');
        
        for (const row of rows) {
          const values = columns.map(col => {
            const value = row[col];
            if (value === null) return 'NULL';
            if (typeof value === 'string') return `'${value.replace(/'/g, "''")}'`;
            return value;
          }).join(', ');
          
          sqlContent += `INSERT INTO ${table} (${columnList}) VALUES (${values});\n`;
        }
        sqlContent += '\n';
      }
    }
    
    // 写入文件
    await this.writeBackupFile(filePath, sqlContent, task);
  }

  private async performIncrementalBackup(tables: string[], filePath: string, task: BackupTask): Promise<void> {
    // 简化实现：执行完整备份（实际应该只备份修改的数据）
    await this.performBackup(tables, filePath, task);
  }

  private async writeBackupFile(filePath: string, content: string, task: BackupTask): Promise<void> {
    if (this.config.compressionEnabled) {
      const writeStream = createWriteStream(filePath);
      const gzipStream = createGzip();
      
      await pipeline(
        Buffer.from(content),
        gzipStream,
        writeStream
      );
    } else {
      await fs.writeFile(filePath, content, 'utf8');
    }
    
    // 获取文件大小
    const stats = await fs.stat(filePath);
    task.fileSize = stats.size;
  }

  private async readBackupFile(filePath: string): Promise<string> {
    if (filePath.endsWith('.gz')) {
      const readStream = createReadStream(filePath);
      const gunzipStream = createGunzip();
      
      const chunks: Buffer[] = [];
      await pipeline(
        readStream,
        gunzipStream,
        async function* (source) {
          for await (const chunk of source) {
            chunks.push(chunk);
            yield chunk;
          }
        }
      );
      
      return Buffer.concat(chunks).toString('utf8');
    } else {
      return fs.readFile(filePath, 'utf8');
    }
  }

  private async loadBackupHistory(): Promise<void> {
    const historyFile = path.join(this.config.backupDir, 'backup_history.json');
    
    try {
      const content = await fs.readFile(historyFile, 'utf8');
      const history = JSON.parse(content);
      
      this.backupHistory = history.backups || [];
      this.lastFullBackupTime = history.lastFullBackupTime ? 
        new Date(history.lastFullBackupTime) : null;
    } catch {
      // 文件不存在或格式错误，使用空历史
      this.backupHistory = [];
      this.lastFullBackupTime = null;
    }
  }

  private async saveBackupHistory(): Promise<void> {
    const historyFile = path.join(this.config.backupDir, 'backup_history.json');
    
    const history = {
      backups: this.backupHistory,
      lastFullBackupTime: this.lastFullBackupTime
    };
    
    await fs.writeFile(historyFile, JSON.stringify(history, null, 2));
  }

  private async cleanupOldBackups(): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays);
    
    const oldBackups = this.backupHistory.filter(backup => 
      backup.startTime && backup.startTime < cutoffDate
    );
    
    for (const backup of oldBackups) {
      try {
        if (backup.filePath) {
          await fs.unlink(backup.filePath);
        }
        this.backupHistory = this.backupHistory.filter(b => b.id !== backup.id);
      } catch (error) {
        logger.log(LogLevel.ERROR, LogType.ERROR, `Failed to cleanup old backup: ${backup.id}`, error);
      }
    }
    
    // 限制备份数量
    if (this.backupHistory.length > this.config.maxBackups) {
      const sortedBackups = this.backupHistory.sort((a, b) => 
        (b.startTime?.getTime() || 0) - (a.startTime?.getTime() || 0)
      );
      
      const backupsToRemove = sortedBackups.slice(this.config.maxBackups);
      
      for (const backup of backupsToRemove) {
        try {
          if (backup.filePath) {
            await fs.unlink(backup.filePath);
          }
          this.backupHistory = this.backupHistory.filter(b => b.id !== backup.id);
        } catch (error) {
          logger.log(LogLevel.ERROR, LogType.ERROR, `Failed to cleanup excess backup: ${backup.id}`, error);
        }
      }
    }
    
    await this.saveBackupHistory();
  }
}

// 导出单例实例
export const backupRestoreManager = new BackupRestoreManager();