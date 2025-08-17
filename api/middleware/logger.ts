/**
 * 操作日志记录中间件
 * 模块: 5.1 管理员权限系统 - 操作日志
 */

import { Request, Response, NextFunction } from 'express';
import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, '../../blog.db');

// 日志级别
export enum LogLevel {
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  DEBUG = 'debug'
}

// 日志状态
export enum LogStatus {
  SUCCESS = 'success',
  FAILED = 'failed',
  PENDING = 'pending'
}

// 日志数据接口
interface LogData {
  user_id?: number;
  action: string;
  resource: string;
  resource_id?: string | number;
  details?: Record<string, unknown>;
  ip_address?: string;
  user_agent?: string;
  status: LogStatus;
  level?: LogLevel;
  error_message?: string;
}

/**
 * 记录操作日志到数据库
 * @param logData 日志数据
 */
export async function logToDatabase(logData: LogData): Promise<void> {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath);
    
    const query = `
      INSERT INTO admin_logs (
        user_id, action, resource, resource_id, details, 
        ip_address, user_agent, status, level, error_message
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const details = logData.details ? JSON.stringify(logData.details) : null;
    
    db.run(query, [
      logData.user_id || null,
      logData.action,
      logData.resource,
      logData.resource_id || null,
      details,
      logData.ip_address || null,
      logData.user_agent || null,
      logData.status,
      logData.level || LogLevel.INFO,
      logData.error_message || null
    ], function(err) {
      db.close();
      if (err) {
        console.error('Failed to log to database:', err);
        reject(err);
      } else {
        // 广播用户活动到WebSocket客户端
        broadcastUserActivity({
          type: 'user_action',
          userId: logData.user_id,
          action: logData.action,
          resource: logData.resource,
          resourceId: logData.resource_id,
          status: logData.status,
          timestamp: Date.now(),
          details: logData.details
        });
        resolve();
      }
    });
  });
}

/**
 * 广播用户活动到WebSocket客户端
 * @param activity 活动数据
 */
function broadcastUserActivity(activity: Record<string, unknown>): void {
  try {
    // 动态导入WebSocket服务实例
    import('../server.js').then(({ realtimeService }) => {
      if (realtimeService) {
        realtimeService.broadcastUserActivity(activity);
      }
    }).catch(err => {
      console.error('Failed to broadcast user activity:', err);
    });
  } catch (error) {
    console.error('Error broadcasting user activity:', error);
  }
}

/**
 * 操作日志记录中间件
 * @param action 操作名称
 * @param resource 资源类型
 * @param options 配置选项
 */
export const logAction = (action: string, resource: string, options: {
  level?: LogLevel;
  includeBody?: boolean;
  includeQuery?: boolean;
  includeHeaders?: boolean;
  excludeFields?: string[];
} = {}) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const startTime = Date.now();
    const originalSend = res.send;
    const originalJson = res.json;
    
    // 获取请求信息
    const getRequestInfo = () => {
      const info: Record<string, unknown> = {
        method: req.method,
        url: req.originalUrl,
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime
      };
      
      if (options.includeBody && req.body) {
        info.body = filterSensitiveData(req.body, options.excludeFields);
      }
      
      if (options.includeQuery && Object.keys(req.query).length > 0) {
        info.query = req.query;
      }
      
      if (options.includeHeaders) {
        info.headers = filterSensitiveHeaders(req.headers);
      }
      
      return info;
    };
    
    // 记录日志的函数
    const writeLog = (status: LogStatus, errorMessage?: string) => {
      const logData: LogData = {
        user_id: req.user?.id,
        action,
        resource,
        resource_id: req.params.id || req.body?.id || null,
        details: getRequestInfo(),
        ip_address: getClientIP(req),
        user_agent: req.get('User-Agent'),
        status,
        level: status === LogStatus.FAILED ? LogLevel.ERROR : (options.level || LogLevel.INFO),
        error_message: errorMessage
      };
      
      // 异步记录日志，不阻塞响应
      logToDatabase(logData).catch(err => {
        console.error('Failed to log action:', err);
      });
    };
    
    // 重写 res.send
    res.send = function(data: unknown) {
      const status = res.statusCode >= 200 && res.statusCode < 300 ? LogStatus.SUCCESS : LogStatus.FAILED;
      const errorMessage = status === LogStatus.FAILED ? 
        (data && typeof data === 'object' && 'error' in data ? (data as Record<string, unknown>).error : 
         data && typeof data === 'object' && 'message' in data ? (data as Record<string, unknown>).message : undefined) : undefined;
      writeLog(status, errorMessage);
      return originalSend.call(this, data);
    };
    
    // 重写 res.json
    res.json = function(data: unknown) {
      const status = res.statusCode >= 200 && res.statusCode < 300 ? LogStatus.SUCCESS : LogStatus.FAILED;
      const errorMessage = status === LogStatus.FAILED ? 
        (data && typeof data === 'object' && 'error' in data ? (data as Record<string, unknown>).error : 
         data && typeof data === 'object' && 'message' in data ? (data as Record<string, unknown>).message : undefined) : undefined;
      writeLog(status, errorMessage);
      return originalJson.call(this, data);
    };
    
    // 处理未捕获的错误
    const originalNext = next;
    next = (error?: Error | string) => {
      if (error) {
        writeLog(LogStatus.FAILED, (error as Error).message || String(error));
      }
      originalNext(error);
    };
    
    next();
  };
};

/**
 * 简化的日志记录中间件（只记录基本信息）
 * @param action 操作名称
 * @param resource 资源类型
 */
export const logSimpleAction = (action: string, resource: string) => {
  return logAction(action, resource, {
    level: LogLevel.INFO,
    includeBody: false,
    includeQuery: false,
    includeHeaders: false
  });
};

/**
 * 详细的日志记录中间件（记录所有信息）
 * @param action 操作名称
 * @param resource 资源类型
 */
export const logDetailedAction = (action: string, resource: string) => {
  return logAction(action, resource, {
    level: LogLevel.INFO,
    includeBody: true,
    includeQuery: true,
    includeHeaders: true,
    excludeFields: ['password', 'password_hash', 'token', 'secret']
  });
};

/**
 * 安全操作日志记录中间件（用于敏感操作）
 * @param action 操作名称
 * @param resource 资源类型
 */
export const logSecurityAction = (action: string, resource: string) => {
  return logAction(action, resource, {
    level: LogLevel.WARN,
    includeBody: true,
    includeQuery: true,
    includeHeaders: true,
    excludeFields: ['password', 'password_hash', 'token', 'secret', 'key']
  });
};

/**
 * 手动记录日志
 * @param req 请求对象
 * @param action 操作名称
 * @param resource 资源类型
 * @param status 状态
 * @param details 详细信息
 * @param level 日志级别
 */
export async function manualLog(
  req: Request,
  action: string,
  resource: string,
  status: LogStatus,
  details?: Record<string, unknown>,
  level: LogLevel = LogLevel.INFO
): Promise<void> {
  const logData: LogData = {
    user_id: req.user?.id,
    action,
    resource,
    details: details || null,
    ip_address: getClientIP(req),
    user_agent: req.get('User-Agent'),
    status,
    level
  };
  
  return logToDatabase(logData);
}

/**
 * 获取客户端IP地址
 * @param req 请求对象
 * @returns IP地址
 */
function getClientIP(req: Request): string {
  return (
    req.ip ||
    req.connection.remoteAddress ||
    req.socket.remoteAddress ||
    (req.connection as { socket?: { remoteAddress?: string } })?.socket?.remoteAddress ||
    req.headers['x-forwarded-for'] as string ||
    req.headers['x-real-ip'] as string ||
    'unknown'
  );
}

/**
 * 过滤敏感数据
 * @param data 原始数据
 * @param excludeFields 要排除的字段
 * @returns 过滤后的数据
 */
function filterSensitiveData(data: Record<string, unknown>, excludeFields: string[] = []): Record<string, unknown> {
  if (!data || typeof data !== 'object') {
    return data;
  }
  
  const filtered = { ...data };
  const defaultExcludeFields = ['password', 'password_hash', 'token', 'secret', 'key'];
  const fieldsToExclude = [...defaultExcludeFields, ...excludeFields];
  
  fieldsToExclude.forEach(field => {
    if (field in filtered) {
      filtered[field] = '[FILTERED]';
    }
  });
  
  return filtered;
}

/**
 * 过滤敏感请求头
 * @param headers 原始请求头
 * @returns 过滤后的请求头
 */
function filterSensitiveHeaders(headers: Record<string, unknown>): Record<string, unknown> {
  const filtered = { ...headers };
  const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key', 'x-auth-token'];
  
  sensitiveHeaders.forEach(header => {
    if (header in filtered) {
      filtered[header] = '[FILTERED]';
    }
  });
  
  return filtered;
}

/**
 * 批量日志查询
 * @param filters 查询过滤条件
 * @param pagination 分页参数
 * @returns Promise<{logs: any[], total: number}>
 */
export async function queryLogs(filters: {
  userId?: number;
  action?: string;
  resource?: string;
  status?: LogStatus;
  level?: LogLevel;
  startDate?: string;
  endDate?: string;
}, pagination: {
  page: number;
  limit: number;
}): Promise<{logs: Record<string, unknown>[], total: number}> {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath);
    
    let whereClause = 'WHERE 1=1';
    const params: unknown[] = [];
    
    if (filters.userId) {
      whereClause += ' AND user_id = ?';
      params.push(filters.userId);
    }
    
    if (filters.action) {
      whereClause += ' AND action LIKE ?';
      params.push(`%${filters.action}%`);
    }
    
    if (filters.resource) {
      whereClause += ' AND resource = ?';
      params.push(filters.resource);
    }
    
    if (filters.status) {
      whereClause += ' AND status = ?';
      params.push(filters.status);
    }
    
    if (filters.level) {
      whereClause += ' AND level = ?';
      params.push(filters.level);
    }
    
    if (filters.startDate) {
      whereClause += ' AND created_at >= ?';
      params.push(filters.startDate);
    }
    
    if (filters.endDate) {
      whereClause += ' AND created_at <= ?';
      params.push(filters.endDate);
    }
    
    const offset = (pagination.page - 1) * pagination.limit;
    
    const countQuery = `SELECT COUNT(*) as total FROM admin_logs ${whereClause}`;
    const dataQuery = `
      SELECT al.*, u.username, u.email
      FROM admin_logs al
      LEFT JOIN users u ON al.user_id = u.id
      ${whereClause}
      ORDER BY al.created_at DESC
      LIMIT ? OFFSET ?
    `;
    
    // 获取总数
    db.get(countQuery, params, (err, countRow: { count: number }) => {
      if (err) {
        db.close();
        reject(err);
        return;
      }
      
      // 获取数据
      db.all(dataQuery, [...params, pagination.limit, offset], (err, rows: LogEntry[]) => {
        db.close();
        if (err) {
          reject(err);
          return;
        }
        
        const logs = rows.map(row => ({
          ...row,
          details: row.details ? JSON.parse(row.details) : null
        }));
        
        resolve({
          logs,
          total: countRow.total
        });
      });
    });
  });
}