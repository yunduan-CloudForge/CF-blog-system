import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger, LogLevel, LogType } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// SQLite连接池配置接口
interface ConnectionPoolConfig {
  maxConnections: number;
  minConnections: number;
  acquireTimeoutMillis: number;
  idleTimeoutMillis: number;
  reapIntervalMillis: number;
  busyTimeoutMs: number;
  log: boolean;
}

// 连接状态
interface Connection {
  id: string;
  db: sqlite3.Database;
  createdAt: Date;
  lastUsed: Date;
  inUse: boolean;
  queryCount: number;
}

// 连接池统计信息
interface PoolStats {
  totalConnections: number;
  activeConnections: number;
  idleConnections: number;
  waitingRequests: number;
  totalQueries: number;
  averageQueryTime: number;
  peakConnections: number;
  connectionErrors: number;
}

class SQLiteConnectionPool {
  private config: ConnectionPoolConfig;
  private connections: Map<string, Connection> = new Map();
  private waitingQueue: Array<{
    resolve: (db: sqlite3.Database) => void;
    reject: (error: Error) => void;
    timestamp: Date;
  }> = [];
  private stats: PoolStats = {
    totalConnections: 0,
    activeConnections: 0,
    idleConnections: 0,
    waitingRequests: 0,
    totalQueries: 0,
    averageQueryTime: 0,
    peakConnections: 0,
    connectionErrors: 0
  };
  private queryTimes: number[] = [];
  private cleanupInterval?: NodeJS.Timeout;
  private dbPath: string;

  constructor(dbPath: string, config?: Partial<ConnectionPoolConfig>) {
    this.dbPath = dbPath;
    this.config = {
      maxConnections: 10, // SQLite建议较少的连接数
      minConnections: 1,
      acquireTimeoutMillis: 30000,
      idleTimeoutMillis: 300000, // 5分钟
      reapIntervalMillis: 60000, // 1分钟
      busyTimeoutMs: 30000,
      log: process.env.NODE_ENV === 'development',
      ...config
    };

    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      // 创建最小连接数
      for (let i = 0; i < this.config.minConnections; i++) {
        await this.createConnection();
      }

      // 启动清理任务
      this.startCleanupTask();

      if (this.config.log) {
        logger.log(LogLevel.INFO, LogType.OPERATION, `SQLite连接池初始化完成，最小连接数: ${this.config.minConnections}`);
      }
    } catch (error) {
      logger.log(LogLevel.ERROR, LogType.ERROR, 'SQLite连接池初始化失败:', error);
      throw error;
    }
  }

  private async createConnection(): Promise<Connection> {
    const connectionId = `sqlite_conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    return new Promise((resolve, reject) => {
      const db = new sqlite3.Database(this.dbPath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
        if (err) {
          this.stats.connectionErrors++;
          logger.log(LogLevel.ERROR, LogType.ERROR, `创建SQLite连接失败: ${connectionId}`, err);
          reject(err);
          return;
        }

        // 设置SQLite配置
        db.configure('busyTimeout', this.config.busyTimeoutMs);
        
        // 启用WAL模式以提高并发性能
        db.run('PRAGMA journal_mode = WAL', (err) => {
          if (err) {
            logger.log(LogLevel.WARN, LogType.OPERATION, '启用WAL模式失败:', err);
          }
        });

        // 设置其他性能优化参数
        db.run('PRAGMA synchronous = NORMAL');
        db.run('PRAGMA cache_size = 10000');
        db.run('PRAGMA temp_store = memory');
        db.run('PRAGMA mmap_size = 268435456'); // 256MB

        const connection: Connection = {
          id: connectionId,
          db,
          createdAt: new Date(),
          lastUsed: new Date(),
          inUse: false,
          queryCount: 0
        };

        this.connections.set(connectionId, connection);
        this.stats.totalConnections++;
        this.stats.idleConnections++;
        
        if (this.stats.totalConnections > this.stats.peakConnections) {
          this.stats.peakConnections = this.stats.totalConnections;
        }

        if (this.config.log) {
          logger.log(LogLevel.DEBUG, LogType.OPERATION, `创建新SQLite连接: ${connectionId}`);
        }

        resolve(connection);
      });
    });
  }

  private async destroyConnection(connectionId: string): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    return new Promise((resolve) => {
      connection.db.close((err) => {
        if (err) {
          logger.log(LogLevel.ERROR, LogType.ERROR, `关闭SQLite连接失败: ${connectionId}`, err);
        }

        this.connections.delete(connectionId);
        this.stats.totalConnections--;
        
        if (connection.inUse) {
          this.stats.activeConnections--;
        } else {
          this.stats.idleConnections--;
        }

        if (this.config.log) {
          logger.log(LogLevel.DEBUG, LogType.OPERATION, `销毁SQLite连接: ${connectionId}`);
        }

        resolve();
      });
    });
  }

  public async acquire(): Promise<sqlite3.Database> {
    return new Promise(async (resolve, reject) => {
      const timeoutId = setTimeout(() => {
        const index = this.waitingQueue.findIndex(item => item.resolve === resolve);
        if (index !== -1) {
          this.waitingQueue.splice(index, 1);
          this.stats.waitingRequests--;
        }
        reject(new Error('获取SQLite连接超时'));
      }, this.config.acquireTimeoutMillis);

      try {
        // 查找空闲连接
        const idleConnection = Array.from(this.connections.values())
          .find(conn => !conn.inUse);

        if (idleConnection) {
          clearTimeout(timeoutId);
          this.markConnectionAsUsed(idleConnection);
          resolve(idleConnection.db);
          return;
        }

        // 如果没有空闲连接且未达到最大连接数，创建新连接
        if (this.connections.size < this.config.maxConnections) {
          try {
            const newConnection = await this.createConnection();
            clearTimeout(timeoutId);
            this.markConnectionAsUsed(newConnection);
            resolve(newConnection.db);
            return;
          } catch (error) {
            // 创建连接失败，继续等待
          }
        }

        // 加入等待队列
        this.waitingQueue.push({
          resolve: (db: sqlite3.Database) => {
            clearTimeout(timeoutId);
            resolve(db);
          },
          reject: (error: Error) => {
            clearTimeout(timeoutId);
            reject(error);
          },
          timestamp: new Date()
        });
        this.stats.waitingRequests++;

      } catch (error) {
        clearTimeout(timeoutId);
        reject(error);
      }
    });
  }

  public release(db: sqlite3.Database): void {
    const connection = Array.from(this.connections.values())
      .find(conn => conn.db === db);

    if (!connection) {
      logger.log(LogLevel.WARN, LogType.OPERATION, '尝试释放未知SQLite连接');
      return;
    }

    if (!connection.inUse) {
      logger.log(LogLevel.WARN, LogType.OPERATION, `SQLite连接 ${connection.id} 已经是空闲状态`);
      return;
    }

    this.markConnectionAsIdle(connection);

    // 处理等待队列
    if (this.waitingQueue.length > 0) {
      const waiting = this.waitingQueue.shift();
      if (waiting) {
        this.stats.waitingRequests--;
        this.markConnectionAsUsed(connection);
        waiting.resolve(connection.db);
      }
    }
  }

  private markConnectionAsUsed(connection: Connection): void {
    connection.inUse = true;
    connection.lastUsed = new Date();
    connection.queryCount++;
    this.stats.activeConnections++;
    this.stats.idleConnections--;
  }

  private markConnectionAsIdle(connection: Connection): void {
    connection.inUse = false;
    connection.lastUsed = new Date();
    this.stats.activeConnections--;
    this.stats.idleConnections++;
  }

  // 执行查询（返回多行）
  public async query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    const startTime = Date.now();
    const db = await this.acquire();
    
    return new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => {
        const queryTime = Date.now() - startTime;
        this.updateQueryStats(queryTime);
        this.release(db);
        
        if (err) {
          reject(err);
        } else {
          resolve(rows as T[]);
        }
      });
    });
  }

  // 执行查询（返回单行）
  public async queryOne<T = any>(sql: string, params: any[] = []): Promise<T | null> {
    const startTime = Date.now();
    const db = await this.acquire();
    
    return new Promise((resolve, reject) => {
      db.get(sql, params, (err, row) => {
        const queryTime = Date.now() - startTime;
        this.updateQueryStats(queryTime);
        this.release(db);
        
        if (err) {
          reject(err);
        } else {
          resolve(row as T || null);
        }
      });
    });
  }

  // 执行更新/插入/删除操作
  public async execute(sql: string, params: any[] = []): Promise<{ lastID: number; changes: number }> {
    const startTime = Date.now();
    const db = await this.acquire();
    
    return new Promise((resolve, reject) => {
      db.run(sql, params, function(err) {
        const queryTime = Date.now() - startTime;
        connectionPool.updateQueryStats(queryTime);
        connectionPool.release(db);
        
        if (err) {
          reject(err);
        } else {
          resolve({
            lastID: this.lastID,
            changes: this.changes
          });
        }
      });
    });
  }

  // 执行事务
  public async transaction<T>(callback: (db: sqlite3.Database) => Promise<T>): Promise<T> {
    const startTime = Date.now();
    const db = await this.acquire();
    
    return new Promise(async (resolve, reject) => {
      db.run('BEGIN TRANSACTION', async (err) => {
        if (err) {
          this.release(db);
          reject(err);
          return;
        }

        try {
          const result = await callback(db);
          
          db.run('COMMIT', (err) => {
            const queryTime = Date.now() - startTime;
            this.updateQueryStats(queryTime);
            this.release(db);
            
            if (err) {
              reject(err);
            } else {
              resolve(result);
            }
          });
        } catch (error) {
          db.run('ROLLBACK', (rollbackErr) => {
            const queryTime = Date.now() - startTime;
            this.updateQueryStats(queryTime);
            this.release(db);
            
            if (rollbackErr) {
              logger.log(LogLevel.ERROR, LogType.ERROR, '事务回滚失败:', rollbackErr);
            }
            reject(error);
          });
        }
      });
    });
  }

  private updateQueryStats(queryTime: number): void {
    this.stats.totalQueries++;
    this.queryTimes.push(queryTime);
    
    // 保持最近1000次查询的时间记录
    if (this.queryTimes.length > 1000) {
      this.queryTimes = this.queryTimes.slice(-1000);
    }
    
    this.stats.averageQueryTime = this.queryTimes.reduce((a, b) => a + b, 0) / this.queryTimes.length;
  }

  private startCleanupTask(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, this.config.reapIntervalMillis);
  }

  private async cleanup(): Promise<void> {
    const now = new Date();
    const connectionsToDestroy: string[] = [];

    // 查找需要清理的空闲连接
    for (const [id, connection] of this.connections) {
      if (!connection.inUse) {
        const idleTime = now.getTime() - connection.lastUsed.getTime();
        if (idleTime > this.config.idleTimeoutMillis && 
            this.connections.size > this.config.minConnections) {
          connectionsToDestroy.push(id);
        }
      }
    }

    // 销毁过期连接
    for (const id of connectionsToDestroy) {
      await this.destroyConnection(id);
    }

    // 清理过期的等待请求
    const expiredRequests = this.waitingQueue.filter(req => {
      const waitTime = now.getTime() - req.timestamp.getTime();
      return waitTime > this.config.acquireTimeoutMillis;
    });

    for (const req of expiredRequests) {
      const index = this.waitingQueue.indexOf(req);
      if (index !== -1) {
        this.waitingQueue.splice(index, 1);
        this.stats.waitingRequests--;
        req.reject(new Error('等待SQLite连接超时'));
      }
    }

    if (this.config.log && (connectionsToDestroy.length > 0 || expiredRequests.length > 0)) {
      logger.log(LogLevel.DEBUG, LogType.OPERATION, `SQLite连接池清理完成: 销毁 ${connectionsToDestroy.length} 个连接, 清理 ${expiredRequests.length} 个过期请求`);
    }
  }

  public getStats(): PoolStats {
    return { ...this.stats };
  }

  public getDetailedStats() {
    const connections = Array.from(this.connections.values());
    return {
      ...this.stats,
      connections: connections.map(conn => ({
        id: conn.id,
        createdAt: conn.createdAt,
        lastUsed: conn.lastUsed,
        inUse: conn.inUse,
        queryCount: conn.queryCount,
        ageMinutes: Math.floor((Date.now() - conn.createdAt.getTime()) / 60000)
      })),
      config: this.config,
      recentQueryTimes: this.queryTimes.slice(-10) // 最近10次查询时间
    };
  }

  public async destroy(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    // 拒绝所有等待的请求
    for (const waiting of this.waitingQueue) {
      waiting.reject(new Error('SQLite连接池正在关闭'));
    }
    this.waitingQueue = [];
    this.stats.waitingRequests = 0;

    // 销毁所有连接
    const connectionIds = Array.from(this.connections.keys());
    for (const id of connectionIds) {
      await this.destroyConnection(id);
    }

    if (this.config.log) {
      logger.log(LogLevel.INFO, LogType.OPERATION, 'SQLite连接池已关闭');
    }
  }
}

// 创建全局连接池实例
const DB_PATH = path.join(__dirname, '../../data/blog.db');

export const connectionPool = new SQLiteConnectionPool(DB_PATH, {
  maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '10'),
  minConnections: parseInt(process.env.DB_MIN_CONNECTIONS || '1'),
  acquireTimeoutMillis: parseInt(process.env.DB_ACQUIRE_TIMEOUT || '30000'),
  idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '300000'),
  busyTimeoutMs: parseInt(process.env.DB_BUSY_TIMEOUT || '30000'),
  log: process.env.NODE_ENV === 'development'
});

export { SQLiteConnectionPool };
export type { ConnectionPoolConfig, PoolStats };