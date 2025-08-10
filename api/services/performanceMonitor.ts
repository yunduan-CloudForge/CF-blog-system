import { query, queryOne, execute } from '../database/database.js';

// 性能监控接口
interface QueryPerformance {
  id?: string;
  query_type: string;
  query_sql: string;
  execution_time: number;
  rows_affected: number;
  created_at: string;
}

interface SlowQuery {
  query_type: string;
  avg_time: number;
  max_time: number;
  count: number;
  last_executed: string;
}

class PerformanceMonitor {
  private slowQueryThreshold = 100; // 100ms阈值
  private enabled = true;

  // 记录查询性能
  async recordQuery(
    queryType: string,
    sql: string,
    executionTime: number,
    rowsAffected: number = 0
  ): Promise<void> {
    if (!this.enabled) return;

    try {
      await execute(
        `INSERT INTO query_performance (query_type, query_sql, execution_time, rows_affected, created_at)
         VALUES (?, ?, ?, ?, ?)`,
        [queryType, sql, executionTime, rowsAffected, new Date().toISOString()]
      );
    } catch (error) {
      console.error('记录查询性能失败:', error);
    }
  }

  // 包装查询函数以监控性能
  wrapQuery<T>(
    originalQuery: (sql: string, params?: any[]) => Promise<T>,
    queryType: string
  ) {
    return async (sql: string, params?: any[]): Promise<T> => {
      const startTime = Date.now();
      
      try {
        const result = await originalQuery(sql, params);
        const executionTime = Date.now() - startTime;
        
        // 记录性能数据
        await this.recordQuery(
          queryType,
          sql.substring(0, 500), // 限制SQL长度
          executionTime,
          Array.isArray(result) ? result.length : 1
        );
        
        // 如果查询时间超过阈值，记录慢查询
        if (executionTime > this.slowQueryThreshold) {
          console.warn(`慢查询检测 [${executionTime}ms]:`, {
            type: queryType,
            sql: sql.substring(0, 200),
            params
          });
        }
        
        return result;
      } catch (error) {
        const executionTime = Date.now() - startTime;
        await this.recordQuery(
          `${queryType}_ERROR`,
          sql.substring(0, 500),
          executionTime,
          0
        );
        throw error;
      }
    };
  }

  // 获取慢查询统计
  async getSlowQueries(limit: number = 10): Promise<SlowQuery[]> {
    try {
      return await query<SlowQuery>(
        `SELECT 
          query_type,
          AVG(execution_time) as avg_time,
          MAX(execution_time) as max_time,
          COUNT(*) as count,
          MAX(created_at) as last_executed
         FROM query_performance 
         WHERE execution_time > ?
         GROUP BY query_type
         ORDER BY avg_time DESC
         LIMIT ?`,
        [this.slowQueryThreshold, limit]
      );
    } catch (error) {
      console.error('获取慢查询统计失败:', error);
      return [];
    }
  }

  // 获取查询性能统计
  async getPerformanceStats(hours: number = 24) {
    try {
      const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
      
      const [totalQueries, avgTime, slowQueries] = await Promise.all([
        queryOne<{ count: number }>(
          'SELECT COUNT(*) as count FROM query_performance WHERE created_at > ?',
          [since]
        ),
        queryOne<{ avg_time: number }>(
          'SELECT AVG(execution_time) as avg_time FROM query_performance WHERE created_at > ?',
          [since]
        ),
        queryOne<{ count: number }>(
          'SELECT COUNT(*) as count FROM query_performance WHERE created_at > ? AND execution_time > ?',
          [since, this.slowQueryThreshold]
        )
      ]);
      
      return {
        totalQueries: totalQueries?.count || 0,
        averageTime: Math.round(avgTime?.avg_time || 0),
        slowQueries: slowQueries?.count || 0,
        period: `${hours}小时`,
        threshold: this.slowQueryThreshold
      };
    } catch (error) {
      console.error('获取性能统计失败:', error);
      return {
        totalQueries: 0,
        averageTime: 0,
        slowQueries: 0,
        period: `${hours}小时`,
        threshold: this.slowQueryThreshold
      };
    }
  }

  // 清理旧的性能数据
  async cleanupOldData(days: number = 7): Promise<void> {
    try {
      const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
      const result = await execute(
        'DELETE FROM query_performance WHERE created_at < ?',
        [cutoff]
      );
      console.log(`清理了 ${result.changes} 条旧的性能数据`);
    } catch (error) {
      console.error('清理性能数据失败:', error);
    }
  }

  // 设置慢查询阈值
  setSlowQueryThreshold(ms: number): void {
    this.slowQueryThreshold = ms;
  }

  // 启用/禁用监控
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  // 获取数据库索引使用情况
  async getIndexUsage() {
    try {
      return await query(
        `SELECT 
          name,
          tbl_name,
          CASE 
            WHEN sql LIKE '%UNIQUE%' THEN 'UNIQUE'
            ELSE 'INDEX'
          END as type
         FROM sqlite_master 
         WHERE type = 'index' 
         AND name NOT LIKE 'sqlite_%'
         ORDER BY tbl_name, name`
      );
    } catch (error) {
      console.error('获取索引使用情况失败:', error);
      return [];
    }
  }

  // 分析表统计信息
  async analyzeTableStats() {
    try {
      const tables = ['articles', 'users', 'categories', 'tags', 'comments', 'article_tags'];
      const stats = [];
      
      for (const table of tables) {
        const count = await queryOne<{ count: number }>(
          `SELECT COUNT(*) as count FROM ${table}`
        );
        stats.push({
          table,
          rows: count?.count || 0
        });
      }
      
      return stats;
    } catch (error) {
      console.error('分析表统计信息失败:', error);
      return [];
    }
  }
}

// 创建全局性能监控实例
export const performanceMonitor = new PerformanceMonitor();

// 定期清理旧数据
setInterval(() => {
  performanceMonitor.cleanupOldData();
}, 24 * 60 * 60 * 1000); // 每天清理一次

// 导出监控装饰器
export const withPerformanceMonitoring = <T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  queryType: string
) => {
  return async (...args: T): Promise<R> => {
    const startTime = Date.now();
    
    try {
      const result = await fn(...args);
      const executionTime = Date.now() - startTime;
      
      await performanceMonitor.recordQuery(
        queryType,
        `Function: ${fn.name}`,
        executionTime,
        Array.isArray(result) ? result.length : 1
      );
      
      return result;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      await performanceMonitor.recordQuery(
        `${queryType}_ERROR`,
        `Function: ${fn.name}`,
        executionTime,
        0
      );
      throw error;
    }
  };
};