import fs from 'fs';
import path from 'path';
import { Request, Response } from 'express';

// 日志级别
export enum LogLevel {
  ERROR = 'ERROR',
  WARN = 'WARN',
  INFO = 'INFO',
  DEBUG = 'DEBUG'
}

// 日志类型
export enum LogType {
  ACCESS = 'access',
  ERROR = 'error',
  OPERATION = 'operation',
  PERFORMANCE = 'performance',
  SECURITY = 'security'
}

// 日志条目接口
interface LogEntry {
  timestamp: string;
  level: LogLevel;
  type: LogType;
  message: string;
  data?: any;
  userId?: string;
  ip?: string;
  userAgent?: string;
  requestId?: string;
  duration?: number;
  statusCode?: number;
  method?: string;
  url?: string;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

// 日志配置
interface LoggerConfig {
  logDir: string;
  maxFileSize: number; // MB
  maxFiles: number;
  enableConsole: boolean;
  enableFile: boolean;
  logLevels: LogLevel[];
}

class Logger {
  private config: LoggerConfig;
  private logDir: string;

  constructor(config?: Partial<LoggerConfig>) {
    this.config = {
      logDir: path.join(process.cwd(), 'logs'),
      maxFileSize: 10, // 10MB
      maxFiles: 30, // 保留30个文件
      enableConsole: process.env.NODE_ENV !== 'production',
      enableFile: true,
      logLevels: [LogLevel.ERROR, LogLevel.WARN, LogLevel.INFO],
      ...config
    };

    this.logDir = this.config.logDir;
    this.ensureLogDirectory();
  }

  // 确保日志目录存在
  private ensureLogDirectory(): void {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  // 格式化日志条目
  private formatLogEntry(entry: LogEntry): string {
    const { timestamp, level, type, message, data, ...meta } = entry;
    
    const logObject = {
      timestamp,
      level,
      type,
      message,
      ...meta
    };

    if (data) {
      logObject.data = data;
    }

    return JSON.stringify(logObject);
  }

  // 获取日志文件路径
  private getLogFilePath(type: LogType, date: Date = new Date()): string {
    const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
    return path.join(this.logDir, `${type}-${dateStr}.log`);
  }

  // 检查文件大小并轮转
  private async rotateLogFile(filePath: string): Promise<void> {
    try {
      const stats = await fs.promises.stat(filePath);
      const fileSizeMB = stats.size / (1024 * 1024);

      if (fileSizeMB > this.config.maxFileSize) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const rotatedPath = filePath.replace('.log', `-${timestamp}.log`);
        await fs.promises.rename(filePath, rotatedPath);
        
        // 清理旧文件
        await this.cleanOldLogs(path.dirname(filePath));
      }
    } catch (error) {
      // 文件不存在或其他错误，忽略
    }
  }

  // 清理旧日志文件
  private async cleanOldLogs(logDir: string): Promise<void> {
    try {
      const files = await fs.promises.readdir(logDir);
      const logFiles = files
        .filter(file => file.endsWith('.log'))
        .map(file => ({
          name: file,
          path: path.join(logDir, file),
          stat: fs.statSync(path.join(logDir, file))
        }))
        .sort((a, b) => b.stat.mtime.getTime() - a.stat.mtime.getTime());

      // 删除超过最大文件数的旧文件
      if (logFiles.length > this.config.maxFiles) {
        const filesToDelete = logFiles.slice(this.config.maxFiles);
        for (const file of filesToDelete) {
          await fs.promises.unlink(file.path);
        }
      }
    } catch (error) {
      console.error('清理旧日志文件失败:', error);
    }
  }

  // 写入日志
  private async writeLog(entry: LogEntry): Promise<void> {
    // 检查日志级别
    if (!this.config.logLevels.includes(entry.level)) {
      return;
    }

    const logLine = this.formatLogEntry(entry) + '\n';

    // 控制台输出
    if (this.config.enableConsole) {
      const colorCode = this.getColorCode(entry.level);
      console.log(`${colorCode}[${entry.timestamp}] ${entry.level} [${entry.type}]: ${entry.message}\x1b[0m`);
      if (entry.data) {
        console.log(entry.data);
      }
    }

    // 文件输出
    if (this.config.enableFile) {
      const filePath = this.getLogFilePath(entry.type);
      
      try {
        // 检查是否需要轮转
        await this.rotateLogFile(filePath);
        
        // 写入日志
        await fs.promises.appendFile(filePath, logLine, 'utf8');
      } catch (error) {
        console.error('写入日志文件失败:', error);
      }
    }
  }

  // 获取颜色代码
  private getColorCode(level: LogLevel): string {
    switch (level) {
      case LogLevel.ERROR: return '\x1b[31m'; // 红色
      case LogLevel.WARN: return '\x1b[33m';  // 黄色
      case LogLevel.INFO: return '\x1b[36m';  // 青色
      case LogLevel.DEBUG: return '\x1b[37m'; // 白色
      default: return '\x1b[0m';
    }
  }

  // 创建日志条目
  private createLogEntry(
    level: LogLevel,
    type: LogType,
    message: string,
    data?: any,
    meta?: Partial<LogEntry>
  ): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      type,
      message,
      data,
      ...meta
    };
  }

  // 访问日志
  async logAccess(req: Request, res: Response, duration: number): Promise<void> {
    const entry = this.createLogEntry(
      LogLevel.INFO,
      LogType.ACCESS,
      `${req.method} ${req.originalUrl}`,
      {
        query: req.query,
        body: req.method !== 'GET' ? this.sanitizeBody(req.body) : undefined
      },
      {
        method: req.method,
        url: req.originalUrl,
        statusCode: res.statusCode,
        duration,
        ip: this.getClientIP(req),
        userAgent: req.get('User-Agent'),
        userId: (req as any).user?.id?.toString(),
        requestId: (req as any).requestId
      }
    );

    await this.writeLog(entry);
  }

  // 错误日志
  async logError(error: Error, req?: Request, meta?: any): Promise<void> {
    const entry = this.createLogEntry(
      LogLevel.ERROR,
      LogType.ERROR,
      error.message,
      meta,
      {
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack
        },
        method: req?.method,
        url: req?.originalUrl,
        ip: req ? this.getClientIP(req) : undefined,
        userAgent: req?.get('User-Agent'),
        userId: req ? (req as any).user?.id?.toString() : undefined,
        requestId: req ? (req as any).requestId : undefined
      }
    );

    await this.writeLog(entry);
  }

  // 操作日志
  async logOperation(
    operation: string,
    userId: string,
    data?: any,
    req?: Request
  ): Promise<void> {
    const entry = this.createLogEntry(
      LogLevel.INFO,
      LogType.OPERATION,
      operation,
      data,
      {
        userId,
        ip: req ? this.getClientIP(req) : undefined,
        userAgent: req?.get('User-Agent'),
        requestId: req ? (req as any).requestId : undefined
      }
    );

    await this.writeLog(entry);
  }

  // 性能日志
  async logPerformance(
    operation: string,
    duration: number,
    data?: any,
    req?: Request
  ): Promise<void> {
    const level = duration > 5000 ? LogLevel.WARN : LogLevel.INFO;
    const entry = this.createLogEntry(
      level,
      LogType.PERFORMANCE,
      `${operation} completed in ${duration}ms`,
      data,
      {
        duration,
        method: req?.method,
        url: req?.originalUrl,
        userId: req ? (req as any).user?.id?.toString() : undefined,
        requestId: req ? (req as any).requestId : undefined
      }
    );

    await this.writeLog(entry);
  }

  // 安全日志
  async logSecurity(
    event: string,
    level: LogLevel,
    data?: any,
    req?: Request
  ): Promise<void> {
    const entry = this.createLogEntry(
      level,
      LogType.SECURITY,
      event,
      data,
      {
        ip: req ? this.getClientIP(req) : undefined,
        userAgent: req?.get('User-Agent'),
        userId: req ? (req as any).user?.id?.toString() : undefined,
        requestId: req ? (req as any).requestId : undefined
      }
    );

    await this.writeLog(entry);
  }

  // 通用日志方法
  async log(
    level: LogLevel,
    type: LogType,
    message: string,
    data?: any,
    meta?: Partial<LogEntry>
  ): Promise<void> {
    const entry = this.createLogEntry(level, type, message, data, meta);
    await this.writeLog(entry);
  }

  async warn(message: string, data?: any, meta?: Partial<LogEntry>): Promise<void> {
    await this.log(LogLevel.WARN, LogType.OPERATION, message, data, meta);
  }

  async info(message: string, data?: any, meta?: Partial<LogEntry>): Promise<void> {
    await this.log(LogLevel.INFO, LogType.OPERATION, message, data, meta);
  }

  async error(message: string, data?: any, meta?: Partial<LogEntry>): Promise<void> {
    await this.log(LogLevel.ERROR, LogType.ERROR, message, data, meta);
  }

  async debug(message: string, data?: any, meta?: Partial<LogEntry>): Promise<void> {
    await this.log(LogLevel.DEBUG, LogType.OPERATION, message, data, meta);
  }

  // 获取客户端IP
  private getClientIP(req: Request): string {
    return (
      (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
      req.connection.remoteAddress ||
      req.socket.remoteAddress ||
      'unknown'
    );
  }

  // 清理敏感数据
  private sanitizeBody(body: any): any {
    if (!body || typeof body !== 'object') return body;

    const sensitiveFields = ['password', 'token', 'secret', 'key', 'auth'];
    const sanitized = { ...body };

    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    }

    return sanitized;
  }

  // 获取日志统计
  async getLogStats(type?: LogType, days: number = 7): Promise<any> {
    const stats = {
      totalEntries: 0,
      errorCount: 0,
      warnCount: 0,
      infoCount: 0,
      avgResponseTime: 0,
      topErrors: [],
      topIPs: [],
      topUserAgents: []
    };

    try {
      const files = await fs.promises.readdir(this.logDir);
      const logFiles = files.filter(file => {
        if (type && !file.startsWith(type)) return false;
        return file.endsWith('.log');
      });

      for (const file of logFiles.slice(-days)) {
        const filePath = path.join(this.logDir, file);
        const content = await fs.promises.readFile(filePath, 'utf8');
        const lines = content.split('\n').filter(line => line.trim());

        for (const line of lines) {
          try {
            const entry = JSON.parse(line);
            stats.totalEntries++;

            switch (entry.level) {
              case LogLevel.ERROR:
                stats.errorCount++;
                break;
              case LogLevel.WARN:
                stats.warnCount++;
                break;
              case LogLevel.INFO:
                stats.infoCount++;
                break;
            }
          } catch (error) {
            // 忽略解析错误
          }
        }
      }
    } catch (error) {
      console.error('获取日志统计失败:', error);
    }

    return stats;
  }
}

// 创建全局日志实例
export const logger = new Logger();

// 导出日志中间件
export const loggerMiddleware = (req: Request, res: Response, next: Function) => {
  const startTime = Date.now();
  
  // 生成请求ID
  (req as any).requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // 监听响应结束
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    logger.logAccess(req, res, duration);
  });

  next();
};

// 导出错误处理中间件
export const errorLoggerMiddleware = (error: Error, req: Request, res: Response, next: Function) => {
  logger.logError(error, req);
  next(error);
};