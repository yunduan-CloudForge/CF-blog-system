import { connectionPool } from './connectionPool';
import { logger } from '../utils/logger';
import { queryOptimizer } from '../utils/queryOptimizer';
import { queryCache } from '../utils/queryCache';
import { dbMonitor } from '../utils/dbMonitor';

// 数据库操作接口
export interface DatabaseResult<T = any> {
  data?: T[];
  changes?: number;
  lastInsertRowid?: number;
}

// 查询选项
export interface QueryOptions {
  useCache?: boolean;
  cacheTTL?: number;
  analyze?: boolean;
  timeout?: number;
  invalidateCache?: string[]; // 要失效的缓存模式
}

// 获取数据库连接（已弃用，使用连接池）
export async function getDatabase() {
  logger.warn('getDatabase() 已弃用，请使用连接池');
  return connectionPool.getConnection();
}

// 执行优化查询
export async function query<T = any>(
  sql: string, 
  params: any[] = [], 
  options: QueryOptions = {}
): Promise<T[]> {
  const startTime = Date.now();
  const {
    useCache = true,
    cacheTTL,
    analyze = false,
    timeout,
    invalidateCache = []
  } = options;

  // 失效相关缓存
  for (const pattern of invalidateCache) {
    queryCache.invalidatePattern(pattern);
  }

  // 尝试从缓存获取
  if (useCache) {
    const cached = queryCache.get<T[]>(sql, params);
    if (cached) {
      logger.debug('从缓存返回查询结果');
      return cached;
    }
  }

  dbMonitor.recordConnection('acquire');

  try {
    // 执行查询
    let result: T[];
    if (analyze) {
      const optimizedResult = await queryOptimizer.executeOptimizedQuery<T>(
        sql, 
        params, 
        { analyze: true, timeout }
      );
      result = optimizedResult.data;
      
      if (optimizedResult.analysis) {
        logger.info('查询分析结果:', optimizedResult.analysis);
      }
    } else {
      result = await connectionPool.query<T>(sql, params);
    }

    const duration = Date.now() - startTime;
    
    // 记录查询性能
    dbMonitor.recordQuery(sql, duration, true, {
      parameters: params
    });

    // 缓存结果
    if (useCache && result) {
      queryCache.set(sql, params, result, cacheTTL);
    }

    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    dbMonitor.recordQuery(sql, duration, false, {
      parameters: params
    });
    throw error;
  } finally {
    dbMonitor.recordConnection('release');
  }
}

// 执行查询并返回单个结果
export async function queryOne<T = any>(
  sql: string, 
  params: any[] = [], 
  options: QueryOptions = {}
): Promise<T | null> {
  const results = await query<T>(sql, params, options);
  return results.length > 0 ? results[0] : null;
}

// 执行非查询语句（INSERT, UPDATE, DELETE）
export async function execute(
  sql: string, 
  params: any[] = [], 
  options: QueryOptions = {}
): Promise<DatabaseResult> {
  const startTime = Date.now();
  const { invalidateCache = [], analyze = false } = options;

  // 失效相关缓存
  for (const pattern of invalidateCache) {
    queryCache.invalidatePattern(pattern);
  }

  dbMonitor.recordConnection('acquire');

  try {
    // 分析查询（如果需要）
    if (analyze) {
      await queryOptimizer.analyzeQuery(sql, params);
    }

    const result = await connectionPool.execute(sql, params);
    const duration = Date.now() - startTime;
    
    // 记录查询性能
    dbMonitor.recordQuery(sql, duration, true, {
      parameters: params
    });

    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    dbMonitor.recordQuery(sql, duration, false, {
      parameters: params
    });
    throw error;
  } finally {
    dbMonitor.recordConnection('release');
  }
}

// 执行事务
export async function transaction<T>(
  callback: (connection: any) => Promise<T>,
  options: QueryOptions = {}
): Promise<T> {
  const startTime = Date.now();
  const { analyze = false } = options;
  
  const connection = await connectionPool.getConnection();
  dbMonitor.recordConnection('acquire');
  dbMonitor.recordTransaction('begin');
  
  try {
    await connection.beginTransaction();
    
    if (analyze) {
      logger.info('开始事务分析');
    }
    
    const result = await callback(connection);
    await connection.commitTransaction();
    
    const duration = Date.now() - startTime;
    dbMonitor.recordTransaction('commit', duration);
    
    return result;
  } catch (error) {
    await connection.rollbackTransaction();
    const duration = Date.now() - startTime;
    dbMonitor.recordTransaction('rollback', duration);
    throw error;
  } finally {
    connectionPool.releaseConnection(connection);
    dbMonitor.recordConnection('release');
  }
}

// 开始事务（已弃用）
export async function beginTransaction() {
  logger.warn('beginTransaction() 已弃用，请使用 transaction()');
  return connectionPool.beginTransaction();
}

// 提交事务（已弃用）
export async function commitTransaction() {
  logger.warn('commitTransaction() 已弃用，请使用 transaction()');
  // 这个方法在新的连接池中不再需要单独调用
}

// 回滚事务（已弃用）
export async function rollbackTransaction() {
  logger.warn('rollbackTransaction() 已弃用，请使用 transaction()');
  // 这个方法在新的连接池中不再需要单独调用
}

// 关闭数据库连接
export async function closeDatabase() {
  queryCache.stop();
  dbMonitor.stop();
  await connectionPool.close();
}

// 获取连接池统计信息
export function getConnectionPoolStats() {
  return connectionPool.getStats();
}

// 获取查询缓存统计信息
export function getQueryCacheStats() {
  return queryCache.getStats();
}

// 获取查询性能报告
export function getQueryPerformanceReport() {
  return queryOptimizer.getPerformanceReport();
}

// 清理查询统计和缓存
export function clearQueryStats() {
  queryOptimizer.clearStats();
  queryCache.clear();
}

// 生成索引建议
export async function generateIndexSuggestions() {
  return queryOptimizer.generateIndexSuggestions();
}

// 失效表相关缓存
export function invalidateTableCache(tableName: string) {
  return queryCache.invalidateTable(tableName);
}

// 预热查询缓存
export async function warmupCache(queries: Array<{ sql: string; params?: any[]; ttl?: number }>) {
  return queryCache.warmup(queries);
}

// 获取数据库监控统计
export function getDbMonitorStats() {
  return dbMonitor.getStats();
}

// 获取数据库健康状态
export async function getDbHealthStatus() {
  return dbMonitor.getHealthStatus();
}

// 获取慢查询列表
export function getSlowQueries() {
  return dbMonitor.getSlowQueries();
}

// 获取性能趋势
export function getPerformanceTrends() {
  return dbMonitor.getPerformanceTrends();
}

// 清理监控数据
export function clearMonitorData() {
  dbMonitor.clearData();
}