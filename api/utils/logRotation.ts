import fs from 'fs/promises';
import path from 'path';
import { logger, LogLevel, LogType } from './logger.js';

interface LogRotationConfig {
  logDirectory: string;
  maxFileSize: number; // MB
  maxFiles: number;
  maxAge: number; // days
  rotationInterval: number; // hours
}

class LogRotationManager {
  private config: LogRotationConfig;
  private rotationTimer: NodeJS.Timeout | null = null;

  constructor(config?: Partial<LogRotationConfig>) {
    this.config = {
      logDirectory: path.join(process.cwd(), 'logs'),
      maxFileSize: 100, // 100MB
      maxFiles: 10,
      maxAge: 30, // 30天
      rotationInterval: 24, // 24小时
      ...config
    };
  }

  public start() {
    // 立即执行一次清理
    this.performRotation();
    
    // 设置定时轮转
    this.rotationTimer = setInterval(() => {
      this.performRotation();
    }, this.config.rotationInterval * 60 * 60 * 1000);

    logger.log(LogLevel.INFO, LogType.OPERATION, '日志轮转服务已启动', {
      config: this.config
    });
  }

  public stop() {
    if (this.rotationTimer) {
      clearInterval(this.rotationTimer);
      this.rotationTimer = null;
      logger.log(LogLevel.INFO, LogType.OPERATION, '日志轮转服务已停止');
    }
  }

  private async performRotation() {
    try {
      logger.log(LogLevel.INFO, LogType.OPERATION, '开始执行日志轮转');
      
      // 确保日志目录存在
      await this.ensureLogDirectory();
      
      // 获取所有日志文件
      const logFiles = await this.getLogFiles();
      
      // 按修改时间排序（最新的在前）
      logFiles.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
      
      // 清理过期文件
      await this.cleanupOldFiles(logFiles);
      
      // 清理超出数量限制的文件
      await this.cleanupExcessFiles(logFiles);
      
      // 轮转大文件
      await this.rotateLargeFiles(logFiles);
      
      logger.log(LogLevel.INFO, LogType.OPERATION, '日志轮转完成');
    } catch (error) {
      logger.log(LogLevel.ERROR, LogType.ERROR, '日志轮转失败:', error);
    }
  }

  private async ensureLogDirectory() {
    try {
      await fs.access(this.config.logDirectory);
    } catch {
      await fs.mkdir(this.config.logDirectory, { recursive: true });
      logger.log(LogLevel.INFO, LogType.OPERATION, '创建日志目录:', this.config.logDirectory);
    }
  }

  private async getLogFiles() {
    const files = await fs.readdir(this.config.logDirectory);
    const logFiles = [];

    for (const file of files) {
      if (file.endsWith('.log') || file.endsWith('.log.json')) {
        const filePath = path.join(this.config.logDirectory, file);
        const stats = await fs.stat(filePath);
        
        logFiles.push({
          name: file,
          path: filePath,
          size: stats.size,
          mtime: stats.mtime,
          ctime: stats.ctime
        });
      }
    }

    return logFiles;
  }

  private async cleanupOldFiles(logFiles: any[]) {
    const maxAgeMs = this.config.maxAge * 24 * 60 * 60 * 1000;
    const cutoffDate = new Date(Date.now() - maxAgeMs);
    
    const oldFiles = logFiles.filter(file => file.mtime < cutoffDate);
    
    for (const file of oldFiles) {
      try {
        await fs.unlink(file.path);
        logger.log(LogLevel.INFO, LogType.OPERATION, '删除过期日志文件:', file.name);
      } catch (error) {
        logger.log(LogLevel.ERROR, LogType.ERROR, '删除文件失败:', { file: file.name, error });
      }
    }
  }

  private async cleanupExcessFiles(logFiles: any[]) {
    if (logFiles.length <= this.config.maxFiles) {
      return;
    }

    // 按文件类型分组
    const fileGroups = this.groupFilesByType(logFiles);
    
    for (const [type, files] of Object.entries(fileGroups)) {
      if (files.length > this.config.maxFiles) {
        const excessFiles = files.slice(this.config.maxFiles);
        
        for (const file of excessFiles) {
          try {
            await fs.unlink(file.path);
            logger.log(LogLevel.INFO, LogType.OPERATION, '删除超出数量限制的日志文件:', { type, file: file.name });
          } catch (error) {
            logger.log(LogLevel.ERROR, LogType.ERROR, '删除文件失败:', { file: file.name, error });
          }
        }
      }
    }
  }

  private groupFilesByType(logFiles: any[]) {
    const groups: Record<string, any[]> = {};
    
    for (const file of logFiles) {
      let type = 'general';
      
      if (file.name.includes('error')) {
        type = 'error';
      } else if (file.name.includes('access')) {
        type = 'access';
      } else if (file.name.includes('operation')) {
        type = 'operation';
      } else if (file.name.includes('performance')) {
        type = 'performance';
      }
      
      if (!groups[type]) {
        groups[type] = [];
      }
      
      groups[type].push(file);
    }
    
    // 对每个组按修改时间排序
    for (const group of Object.values(groups)) {
      group.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
    }
    
    return groups;
  }

  private async rotateLargeFiles(logFiles: any[]) {
    const maxSizeBytes = this.config.maxFileSize * 1024 * 1024;
    
    for (const file of logFiles) {
      if (file.size > maxSizeBytes) {
        await this.rotateFile(file);
      }
    }
  }

  private async rotateFile(file: any) {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const rotatedName = file.name.replace(/\.log$/, `.${timestamp}.log`);
      const rotatedPath = path.join(this.config.logDirectory, rotatedName);
      
      // 重命名当前文件
      await fs.rename(file.path, rotatedPath);
      
      // 创建新的空日志文件
      await fs.writeFile(file.path, '');
      
      logger.log(LogLevel.INFO, LogType.OPERATION, '轮转大文件:', {
        original: file.name,
        rotated: rotatedName,
        size: `${(file.size / 1024 / 1024).toFixed(2)}MB`
      });
    } catch (error) {
      logger.log(LogLevel.ERROR, LogType.ERROR, '文件轮转失败:', { file: file.name, error });
    }
  }

  // 手动触发轮转
  public async manualRotation() {
    await this.performRotation();
  }

  // 获取日志统计信息
  public async getLogStats() {
    try {
      const logFiles = await this.getLogFiles();
      const totalSize = logFiles.reduce((sum, file) => sum + file.size, 0);
      const fileGroups = this.groupFilesByType(logFiles);
      
      return {
        totalFiles: logFiles.length,
        totalSize: totalSize,
        totalSizeMB: (totalSize / 1024 / 1024).toFixed(2),
        filesByType: Object.fromEntries(
          Object.entries(fileGroups).map(([type, files]) => [
            type,
            {
              count: files.length,
              size: files.reduce((sum, file) => sum + file.size, 0),
              sizeMB: (files.reduce((sum, file) => sum + file.size, 0) / 1024 / 1024).toFixed(2)
            }
          ])
        ),
        oldestFile: logFiles.length > 0 ? logFiles[logFiles.length - 1].mtime : null,
        newestFile: logFiles.length > 0 ? logFiles[0].mtime : null
      };
    } catch (error) {
      logger.log(LogLevel.ERROR, LogType.ERROR, '获取日志统计失败:', error);
      return null;
    }
  }

  // 压缩旧日志文件
  public async compressOldLogs() {
    try {
      const { createGzip } = await import('zlib');
      const { pipeline } = await import('stream/promises');
      
      const logFiles = await this.getLogFiles();
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      
      const oldFiles = logFiles.filter(file => 
        file.mtime < sevenDaysAgo && 
        !file.name.endsWith('.gz') &&
        file.size > 1024 * 1024 // 只压缩大于1MB的文件
      );
      
      for (const file of oldFiles) {
        try {
          const gzipPath = `${file.path}.gz`;
          
          // 检查压缩文件是否已存在
          try {
            await fs.access(gzipPath);
            continue; // 已存在，跳过
          } catch {
            // 文件不存在，继续压缩
          }
          
          const readStream = (await import('fs')).createReadStream(file.path);
          const writeStream = (await import('fs')).createWriteStream(gzipPath);
          const gzip = createGzip();
          
          await pipeline(readStream, gzip, writeStream);
          
          // 删除原文件
          await fs.unlink(file.path);
          
          logger.log(LogLevel.INFO, LogType.OPERATION, '压缩日志文件:', {
            original: file.name,
            compressed: `${file.name}.gz`,
            originalSize: `${(file.size / 1024 / 1024).toFixed(2)}MB`
          });
        } catch (error) {
          logger.log(LogLevel.ERROR, LogType.ERROR, '压缩文件失败:', { file: file.name, error });
        }
      }
    } catch (error) {
      logger.log(LogLevel.ERROR, LogType.ERROR, '压缩日志失败:', error);
    }
  }
}

// 创建全局实例
export const logRotationManager = new LogRotationManager();

// 导出类型和配置
export { LogRotationManager, LogRotationConfig };