import { Database } from 'sqlite3';
import { query, execute, transaction } from '../database/database';
import { logger, LogLevel, LogType } from './logger.js';
import path from 'path';
import fs from 'fs/promises';
import { createReadStream, createWriteStream } from 'fs';
import { createGzip, createGunzip } from 'zlib';
import { pipeline } from 'stream/promises';

// 归档配置接口
interface ArchiveConfig {
  // 归档规则
  retentionDays: number; // 数据保留天数
  archiveAfterDays: number; // 多少天后归档
  batchSize: number; // 批处理大小
  
  // 归档目录
  archiveDir: string;
  
  // 压缩设置
  enableCompression: boolean;
  compressionLevel: number;
  
  // 自动清理
  autoCleanup: boolean;
  cleanupInterval: number; // 清理间隔（毫秒）
}

// 归档任务接口
interface ArchiveTask {
  id: string;
  tableName: string;
  condition: string; // WHERE条件
  status: 'pending' | 'running' | 'completed' | 'failed';
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  recordsProcessed: number;
  errorMessage?: string;
}

// 归档统计接口
interface ArchiveStats {
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  totalRecordsArchived: number;
  totalSizeArchived: number; // 字节
  lastArchiveTime?: Date;
  archiveFiles: {
    name: string;
    size: number;
    createdAt: Date;
    compressed: boolean;
  }[];
}

// 数据归档管理器
export class DataArchiveManager {
  private config: ArchiveConfig;
  private tasks: Map<string, ArchiveTask> = new Map();
  private cleanupTimer?: NodeJS.Timeout;
  private isRunning = false;

  constructor(config?: Partial<ArchiveConfig>) {
    this.config = {
      retentionDays: parseInt(process.env.ARCHIVE_RETENTION_DAYS || '365'),
      archiveAfterDays: parseInt(process.env.ARCHIVE_AFTER_DAYS || '90'),
      batchSize: parseInt(process.env.ARCHIVE_BATCH_SIZE || '1000'),
      archiveDir: process.env.ARCHIVE_DIR || path.join(process.cwd(), 'archives'),
      enableCompression: process.env.ARCHIVE_COMPRESSION === 'true',
      compressionLevel: parseInt(process.env.ARCHIVE_COMPRESSION_LEVEL || '6'),
      autoCleanup: process.env.ARCHIVE_AUTO_CLEANUP !== 'false',
      cleanupInterval: parseInt(process.env.ARCHIVE_CLEANUP_INTERVAL || '86400000'), // 24小时
      ...config
    };
  }

  // 启动归档服务
  async start(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    logger.log(LogLevel.INFO, LogType.OPERATION, '数据归档服务启动');

    // 确保归档目录存在
    await this.ensureArchiveDirectory();

    // 启动自动清理
    if (this.config.autoCleanup) {
      this.startAutoCleanup();
    }
  }

  // 停止归档服务
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }

    logger.log(LogLevel.INFO, LogType.OPERATION, '数据归档服务停止');
  }

  // 创建归档任务
  async createArchiveTask(
    tableName: string,
    condition: string,
    taskId?: string
  ): Promise<string> {
    const id = taskId || `archive_${tableName}_${Date.now()}`;
    
    const task: ArchiveTask = {
      id,
      tableName,
      condition,
      status: 'pending',
      createdAt: new Date(),
      recordsProcessed: 0
    };

    this.tasks.set(id, task);
    logger.log(LogLevel.INFO, LogType.OPERATION, `创建归档任务: ${id}`, { tableName, condition });

    return id;
  }

  // 执行归档任务
  async executeArchiveTask(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`归档任务不存在: ${taskId}`);
    }

    if (task.status === 'running') {
      throw new Error(`归档任务正在运行: ${taskId}`);
    }

    task.status = 'running';
    task.startedAt = new Date();
    task.errorMessage = undefined;

    try {
      logger.log(LogLevel.INFO, LogType.OPERATION, `开始执行归档任务: ${taskId}`);

      // 获取要归档的数据
      const records = await this.getRecordsToArchive(task.tableName, task.condition);
      
      if (records.length === 0) {
        logger.log(LogLevel.INFO, LogType.OPERATION, `没有找到需要归档的数据: ${taskId}`);
        task.status = 'completed';
        task.completedAt = new Date();
        return;
      }

      // 创建归档文件
      const archiveFileName = this.generateArchiveFileName(task.tableName, task.id);
      const archiveFilePath = path.join(this.config.archiveDir, archiveFileName);

      // 导出数据到归档文件
      await this.exportToArchiveFile(records, archiveFilePath, task.tableName);

      // 删除原始数据
      const deletedCount = await this.deleteArchivedRecords(task.tableName, task.condition);
      
      task.recordsProcessed = deletedCount;
      task.status = 'completed';
      task.completedAt = new Date();

      logger.log(LogLevel.INFO, LogType.OPERATION, `归档任务完成: ${taskId}`, {
        recordsProcessed: deletedCount,
        archiveFile: archiveFileName
      });

    } catch (error) {
      task.status = 'failed';
      task.errorMessage = error instanceof Error ? error.message : String(error);
      task.completedAt = new Date();
      
      logger.log(LogLevel.ERROR, LogType.ERROR, `归档任务失败: ${taskId}`, error);
      throw error;
    }
  }

  // 归档指定表的旧数据
  async archiveOldData(tableName: string, dateColumn = 'created_at'): Promise<string> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.archiveAfterDays);
    
    const condition = `${dateColumn} < '${cutoffDate.toISOString()}'`;
    const taskId = await this.createArchiveTask(tableName, condition);
    
    await this.executeArchiveTask(taskId);
    return taskId;
  }

  // 批量归档多个表
  async archiveMultipleTables(tables: { name: string; dateColumn?: string }[]): Promise<string[]> {
    const taskIds: string[] = [];
    
    for (const table of tables) {
      try {
        const taskId = await this.archiveOldData(table.name, table.dateColumn);
        taskIds.push(taskId);
      } catch (error) {
        logger.log(LogLevel.ERROR, LogType.ERROR, `归档表失败: ${table.name}`, error);
      }
    }
    
    return taskIds;
  }

  // 恢复归档数据
  async restoreFromArchive(archiveFileName: string, tableName?: string): Promise<number> {
    const archiveFilePath = path.join(this.config.archiveDir, archiveFileName);
    
    try {
      // 检查文件是否存在
      await fs.access(archiveFilePath);
      
      // 读取归档文件
      const data = await this.readArchiveFile(archiveFilePath);
      
      // 确定目标表名
      const targetTable = tableName || this.extractTableNameFromArchive(archiveFileName);
      
      // 恢复数据
      const restoredCount = await this.importFromArchiveData(data, targetTable);
      
      logger.log(LogLevel.INFO, LogType.OPERATION, `从归档恢复数据完成`, {
        archiveFile: archiveFileName,
        targetTable,
        recordsRestored: restoredCount
      });
      
      return restoredCount;
      
    } catch (error) {
      logger.log(LogLevel.ERROR, LogType.ERROR, `恢复归档数据失败: ${archiveFileName}`, error);
      throw error;
    }
  }

  // 清理过期归档文件
  async cleanupExpiredArchives(): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays);
    
    let cleanedCount = 0;
    
    try {
      const files = await fs.readdir(this.config.archiveDir);
      
      for (const file of files) {
        const filePath = path.join(this.config.archiveDir, file);
        const stats = await fs.stat(filePath);
        
        if (stats.mtime < cutoffDate) {
          await fs.unlink(filePath);
          cleanedCount++;
          logger.log(LogLevel.INFO, LogType.OPERATION, `删除过期归档文件: ${file}`);
        }
      }
      
    } catch (error) {
      logger.log(LogLevel.ERROR, LogType.ERROR, '清理过期归档文件失败', error);
    }
    
    return cleanedCount;
  }

  // 获取归档统计信息
  async getArchiveStats(): Promise<ArchiveStats> {
    const tasks = Array.from(this.tasks.values());
    const completedTasks = tasks.filter(t => t.status === 'completed');
    const failedTasks = tasks.filter(t => t.status === 'failed');
    
    const totalRecordsArchived = completedTasks.reduce(
      (sum, task) => sum + task.recordsProcessed, 0
    );
    
    const lastArchiveTime = completedTasks.length > 0 
      ? new Date(Math.max(...completedTasks.map(t => t.completedAt?.getTime() || 0)))
      : undefined;
    
    // 获取归档文件信息
    const archiveFiles = await this.getArchiveFilesList();
    const totalSizeArchived = archiveFiles.reduce((sum, file) => sum + file.size, 0);
    
    return {
      totalTasks: tasks.length,
      completedTasks: completedTasks.length,
      failedTasks: failedTasks.length,
      totalRecordsArchived,
      totalSizeArchived,
      lastArchiveTime,
      archiveFiles
    };
  }

  // 获取任务状态
  getTaskStatus(taskId: string): ArchiveTask | undefined {
    return this.tasks.get(taskId);
  }

  // 获取所有任务
  getAllTasks(): ArchiveTask[] {
    return Array.from(this.tasks.values());
  }

  // 私有方法：确保归档目录存在
  private async ensureArchiveDirectory(): Promise<void> {
    try {
      await fs.access(this.config.archiveDir);
    } catch {
      await fs.mkdir(this.config.archiveDir, { recursive: true });
      logger.log(LogLevel.INFO, LogType.OPERATION, `创建归档目录: ${this.config.archiveDir}`);
    }
  }

  // 私有方法：启动自动清理
  private startAutoCleanup(): void {
    this.cleanupTimer = setInterval(async () => {
      try {
        const cleanedCount = await this.cleanupExpiredArchives();
        if (cleanedCount > 0) {
          logger.log(LogLevel.INFO, LogType.OPERATION, `自动清理完成，删除了 ${cleanedCount} 个过期归档文件`);
        }
      } catch (error) {
        logger.log(LogLevel.ERROR, LogType.ERROR, '自动清理失败', error);
      }
    }, this.config.cleanupInterval);
  }

  // 私有方法：获取要归档的记录
  private async getRecordsToArchive(tableName: string, condition: string): Promise<any[]> {
    const sql = `SELECT * FROM ${tableName} WHERE ${condition}`;
    return await query(sql);
  }

  // 私有方法：生成归档文件名
  private generateArchiveFileName(tableName: string, taskId: string): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const extension = this.config.enableCompression ? '.json.gz' : '.json';
    return `${tableName}_${timestamp}_${taskId}${extension}`;
  }

  // 私有方法：导出数据到归档文件
  private async exportToArchiveFile(
    records: any[], 
    filePath: string, 
    tableName: string
  ): Promise<void> {
    const archiveData = {
      tableName,
      exportedAt: new Date().toISOString(),
      recordCount: records.length,
      records
    };

    const jsonData = JSON.stringify(archiveData, null, 2);

    if (this.config.enableCompression) {
      // 压缩写入
      const readStream = require('stream').Readable.from([jsonData]);
      const writeStream = createWriteStream(filePath);
      const gzipStream = createGzip({ level: this.config.compressionLevel });
      
      await pipeline(readStream, gzipStream, writeStream);
    } else {
      // 直接写入
      await fs.writeFile(filePath, jsonData, 'utf8');
    }
  }

  // 私有方法：删除已归档的记录
  private async deleteArchivedRecords(tableName: string, condition: string): Promise<number> {
    const sql = `DELETE FROM ${tableName} WHERE ${condition}`;
    const result = await execute(sql);
    return result.changes || 0;
  }

  // 私有方法：读取归档文件
  private async readArchiveFile(filePath: string): Promise<any> {
    const isCompressed = filePath.endsWith('.gz');
    
    if (isCompressed) {
      // 解压读取
      const readStream = createReadStream(filePath);
      const gunzipStream = createGunzip();
      
      const chunks: Buffer[] = [];
      
      await pipeline(
        readStream,
        gunzipStream,
        async function* (source) {
          for await (const chunk of source) {
            chunks.push(chunk);
          }
        }
      );
      
      const jsonData = Buffer.concat(chunks).toString('utf8');
      return JSON.parse(jsonData);
    } else {
      // 直接读取
      const jsonData = await fs.readFile(filePath, 'utf8');
      return JSON.parse(jsonData);
    }
  }

  // 私有方法：从归档文件名提取表名
  private extractTableNameFromArchive(fileName: string): string {
    const parts = fileName.split('_');
    return parts[0];
  }

  // 私有方法：从归档数据导入
  private async importFromArchiveData(archiveData: any, tableName: string): Promise<number> {
    const { records } = archiveData;
    
    if (!Array.isArray(records) || records.length === 0) {
      return 0;
    }

    let importedCount = 0;
    
    await transaction(async () => {
      for (const record of records) {
        const columns = Object.keys(record);
        const values = Object.values(record);
        const placeholders = columns.map(() => '?').join(', ');
        
        const sql = `INSERT OR REPLACE INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`;
        await execute(sql, values);
        importedCount++;
      }
    });
    
    return importedCount;
  }

  // 私有方法：获取归档文件列表
  private async getArchiveFilesList(): Promise<ArchiveStats['archiveFiles']> {
    try {
      const files = await fs.readdir(this.config.archiveDir);
      const fileStats = [];
      
      for (const file of files) {
        const filePath = path.join(this.config.archiveDir, file);
        const stats = await fs.stat(filePath);
        
        fileStats.push({
          name: file,
          size: stats.size,
          createdAt: stats.birthtime,
          compressed: file.endsWith('.gz')
        });
      }
      
      return fileStats.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    } catch (error) {
      logger.log(LogLevel.ERROR, LogType.ERROR, '获取归档文件列表失败', error);
      return [];
    }
  }
}

// 创建全局归档管理器实例
export const dataArchiveManager = new DataArchiveManager();