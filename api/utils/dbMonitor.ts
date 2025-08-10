import { query, execute } from '../database/database.js';
import { logger } from './logger.js';
import { alertSystem } from './alertSystem.js';

// 数据库监控配置
export interface DbMonitorConfig {
  enabled: boolean;
  collectInterval: number; // 秒
  slowQueryThreshold: number; // 毫秒
  connectionThreshold: number;
  diskSpaceThreshold: number; // 百分比
  memoryThreshold: number; // 百分比
  alertEnabled: boolean;
  retentionDays: number;
}

// 性能指标接口
export interface PerformanceMetrics {
  timestamp: Date;
  connections: {
    active: number;
    idle: number;
    total: number;
    maxUsed: number;
  };
  queries: {
    total: number;
    slow: number;
    failed: number;
    avgResponseTime: number;
    qps: number; // queries per second
  };
  database: {
    size: number;
    tableCount: number;
    indexCount: number;
    fragmentationRatio: number;
  };
  system: {
    cpuUsage: number;
    memoryUsage: number;
    diskUsage: number;
    diskSpace: number;
  };
  locks: {
    waiting: number;
    blocked: number;
    deadlocks: number;
  };
}

// 慢查询记录
export interface SlowQuery {
  id: string;
  query: string;
  duration: number;
  timestamp: Date;
  parameters?: any[];
  stackTrace?: string;
  userId?: string;
  endpoint?: string;
}

// 数据库健康状态
export interface DbHealthStatus {
  status: 'healthy' | 'warning' | 'critical';
  score: number; // 0-100
  issues: {
    type: 'performance' | 'connection' | 'disk' | 'memory' | 'query';
    severity: 'low' | 'medium' | 'high' | 'critical';
    message: string;
    value?: number;
    threshold?: number;
  }[];
  recommendations: string[];
}

// 性能趋势数据
export interface PerformanceTrend {
  period: '1h' | '6h' | '24h' | '7d' | '30d';
  metrics: {
    timestamp: Date;
    avgResponseTime: number;
    qps: number;
    errorRate: number;
    connectionUsage: number;
  }[];
}

export class DatabaseMonitor {
  private config: DbMonitorConfig;
  private isRunning = false;
  private collectTimer: NodeJS.Timeout | null = null;
  private metricsHistory: PerformanceMetrics[] = [];
  private slowQueries: SlowQuery[] = [];
  private queryStats = new Map<string, {
    count: number;
    totalTime: number;
    avgTime: number;
    maxTime: number;
    minTime: number;
    errors: number;
  }>();
  private connectionStats = {
    peak: 0,
    current: 0,
    total: 0
  };

  constructor(config?: Partial<DbMonitorConfig>) {
    this.config = {
      enabled: process.env.DB_MONITOR_ENABLED === 'true',
      collectInterval: parseInt(process.env.DB_MONITOR_INTERVAL || '30'),
      slowQueryThreshold: parseInt(process.env.SLOW_QUERY_THRESHOLD || '1000'),
      connectionThreshold: parseInt(process.env.CONNECTION_THRESHOLD || '80'),
      diskSpaceThreshold: parseInt(process.env.DISK_SPACE_THRESHOLD || '85'),
      memoryThreshold: parseInt(process.env.MEMORY_THRESHOLD || '80'),
      alertEnabled: process.env.DB_MONITOR_ALERTS === 'true',
      retentionDays: parseInt(process.env.DB_MONITOR_RETENTION || '7'),
      ...config
    };
  }

  // 启动监控
  async start(): Promise<void> {
    if (!this.config.enabled || this.isRunning) {
      return;
    }

    try {
      // 初始化监控表
      await this.initMonitoringTables();
      
      // 开始收集指标
      this.startMetricsCollection();
      
      this.isRunning = true;
      logger.info('Database monitoring started');
    } catch (error) {
      logger.error('Failed to start database monitoring:', error);
      throw error;
    }
  }

  // 停止监控
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    if (this.collectTimer) {
      clearInterval(this.collectTimer);
      this.collectTimer = null;
    }

    this.isRunning = false;
    logger.info('Database monitoring stopped');
  }

  // 记录查询性能
  recordQuery(queryText: string, duration: number, success: boolean, metadata?: {
    userId?: string;
    endpoint?: string;
    parameters?: any[];
  }): void {
    if (!this.config.enabled) return;

    // 更新查询统计
    const normalizedQuery = this.normalizeQuery(queryText);
    const stats = this.queryStats.get(normalizedQuery) || {
      count: 0,
      totalTime: 0,
      avgTime: 0,
      maxTime: 0,
      minTime: Infinity,
      errors: 0
    };

    stats.count++;
    stats.totalTime += duration;
    stats.avgTime = stats.totalTime / stats.count;
    stats.maxTime = Math.max(stats.maxTime, duration);
    stats.minTime = Math.min(stats.minTime, duration);
    
    if (!success) {
      stats.errors++;
    }

    this.queryStats.set(normalizedQuery, stats);

    // 记录慢查询
    if (duration > this.config.slowQueryThreshold) {
      const slowQuery: SlowQuery = {
        id: `slow_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        query: queryText,
        duration,
        timestamp: new Date(),
        parameters: metadata?.parameters,
        userId: metadata?.userId,
        endpoint: metadata?.endpoint
      };

      this.slowQueries.push(slowQuery);
      
      // 限制慢查询记录数量
      if (this.slowQueries.length > 1000) {
        this.slowQueries = this.slowQueries.slice(-500);
      }

      logger.warn(`Slow query detected: ${duration}ms`, {
        query: queryText.substring(0, 200),
        duration,
        endpoint: metadata?.endpoint
      });

      // 发送告警
      if (this.config.alertEnabled && duration > this.config.slowQueryThreshold * 2) {
        alertSystem.createAlert({
          type: 'database',
          severity: duration > this.config.slowQueryThreshold * 5 ? 'critical' : 'warning',
          message: `Slow query detected: ${duration}ms`,
          details: {
            query: queryText.substring(0, 200),
            duration,
            threshold: this.config.slowQueryThreshold
          }
        });
      }
    }
  }

  // 记录连接使用
  recordConnection(action: 'acquire' | 'release'): void {
    if (!this.config.enabled) return;

    if (action === 'acquire') {
      this.connectionStats.current++;
      this.connectionStats.total++;
      this.connectionStats.peak = Math.max(this.connectionStats.peak, this.connectionStats.current);
    } else {
      this.connectionStats.current = Math.max(0, this.connectionStats.current - 1);
    }
  }

  // 获取当前性能指标
  async getCurrentMetrics(): Promise<PerformanceMetrics> {
    const metrics: PerformanceMetrics = {
      timestamp: new Date(),
      connections: {
        active: this.connectionStats.current,
        idle: 0, // 简化实现
        total: this.connectionStats.total,
        maxUsed: this.connectionStats.peak
      },
      queries: await this.getQueryMetrics(),
      database: await this.getDatabaseMetrics(),
      system: await this.getSystemMetrics(),
      locks: await this.getLockMetrics()
    };

    return metrics;
  }

  // 获取数据库健康状态
  async getHealthStatus(): Promise<DbHealthStatus> {
    const metrics = await this.getCurrentMetrics();
    const issues: DbHealthStatus['issues'] = [];
    const recommendations: string[] = [];
    let score = 100;

    // 检查查询性能
    if (metrics.queries.avgResponseTime > this.config.slowQueryThreshold) {
      issues.push({
        type: 'performance',
        severity: metrics.queries.avgResponseTime > this.config.slowQueryThreshold * 2 ? 'high' : 'medium',
        message: 'Average query response time is high',
        value: metrics.queries.avgResponseTime,
        threshold: this.config.slowQueryThreshold
      });
      score -= 20;
      recommendations.push('Consider optimizing slow queries or adding indexes');
    }

    // 检查连接使用率
    const connectionUsage = (metrics.connections.active / 100) * 100; // 假设最大100个连接
    if (connectionUsage > this.config.connectionThreshold) {
      issues.push({
        type: 'connection',
        severity: connectionUsage > 90 ? 'critical' : 'medium',
        message: 'High connection usage',
        value: connectionUsage,
        threshold: this.config.connectionThreshold
      });
      score -= 15;
      recommendations.push('Consider increasing connection pool size or optimizing connection usage');
    }

    // 检查磁盘使用率
    if (metrics.system.diskUsage > this.config.diskSpaceThreshold) {
      issues.push({
        type: 'disk',
        severity: metrics.system.diskUsage > 95 ? 'critical' : 'high',
        message: 'High disk usage',
        value: metrics.system.diskUsage,
        threshold: this.config.diskSpaceThreshold
      });
      score -= 25;
      recommendations.push('Consider cleaning up old data or expanding disk space');
    }

    // 检查内存使用率
    if (metrics.system.memoryUsage > this.config.memoryThreshold) {
      issues.push({
        type: 'memory',
        severity: metrics.system.memoryUsage > 90 ? 'high' : 'medium',
        message: 'High memory usage',
        value: metrics.system.memoryUsage,
        threshold: this.config.memoryThreshold
      });
      score -= 10;
      recommendations.push('Consider optimizing memory usage or increasing available memory');
    }

    // 检查慢查询数量
    const recentSlowQueries = this.slowQueries.filter(
      q => Date.now() - q.timestamp.getTime() < 3600000 // 最近1小时
    ).length;
    
    if (recentSlowQueries > 10) {
      issues.push({
        type: 'query',
        severity: recentSlowQueries > 50 ? 'high' : 'medium',
        message: 'High number of slow queries',
        value: recentSlowQueries
      });
      score -= 15;
      recommendations.push('Review and optimize frequently slow queries');
    }

    // 确定整体状态
    let status: DbHealthStatus['status'];
    if (score >= 80) {
      status = 'healthy';
    } else if (score >= 60) {
      status = 'warning';
    } else {
      status = 'critical';
    }

    return {
      status,
      score: Math.max(0, score),
      issues,
      recommendations
    };
  }

  // 获取性能趋势
  getPerformanceTrend(period: PerformanceTrend['period']): PerformanceTrend {
    const now = new Date();
    let startTime: Date;
    let interval: number;

    switch (period) {
      case '1h':
        startTime = new Date(now.getTime() - 3600000);
        interval = 300000; // 5分钟间隔
        break;
      case '6h':
        startTime = new Date(now.getTime() - 6 * 3600000);
        interval = 1800000; // 30分钟间隔
        break;
      case '24h':
        startTime = new Date(now.getTime() - 24 * 3600000);
        interval = 3600000; // 1小时间隔
        break;
      case '7d':
        startTime = new Date(now.getTime() - 7 * 24 * 3600000);
        interval = 6 * 3600000; // 6小时间隔
        break;
      case '30d':
        startTime = new Date(now.getTime() - 30 * 24 * 3600000);
        interval = 24 * 3600000; // 1天间隔
        break;
    }

    const relevantMetrics = this.metricsHistory.filter(
      m => m.timestamp >= startTime
    );

    // 按时间间隔聚合数据
    const aggregatedMetrics: PerformanceTrend['metrics'] = [];
    const buckets = new Map<number, PerformanceMetrics[]>();

    relevantMetrics.forEach(metric => {
      const bucketKey = Math.floor(metric.timestamp.getTime() / interval) * interval;
      if (!buckets.has(bucketKey)) {
        buckets.set(bucketKey, []);
      }
      buckets.get(bucketKey)!.push(metric);
    });

    buckets.forEach((metrics, bucketKey) => {
      const avgResponseTime = metrics.reduce((sum, m) => sum + m.queries.avgResponseTime, 0) / metrics.length;
      const qps = metrics.reduce((sum, m) => sum + m.queries.qps, 0) / metrics.length;
      const errorRate = metrics.reduce((sum, m) => sum + (m.queries.failed / m.queries.total * 100), 0) / metrics.length;
      const connectionUsage = metrics.reduce((sum, m) => sum + (m.connections.active / 100 * 100), 0) / metrics.length;

      aggregatedMetrics.push({
        timestamp: new Date(bucketKey),
        avgResponseTime,
        qps,
        errorRate: isNaN(errorRate) ? 0 : errorRate,
        connectionUsage
      });
    });

    return {
      period,
      metrics: aggregatedMetrics.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
    };
  }

  // 获取慢查询列表
  getSlowQueries(limit = 50): SlowQuery[] {
    return this.slowQueries
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  // 获取查询统计
  getQueryStats(): Map<string, any> {
    return new Map(this.queryStats);
  }

  // 清理历史数据
  async cleanupHistory(): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays);

    // 清理指标历史
    this.metricsHistory = this.metricsHistory.filter(
      m => m.timestamp >= cutoffDate
    );

    // 清理慢查询记录
    this.slowQueries = this.slowQueries.filter(
      q => q.timestamp >= cutoffDate
    );

    logger.info('Database monitoring history cleaned up');
  }

  // 清理所有数据
  clearData(): void {
    this.slowQueries = [];
    this.metricsHistory = [];
    this.queryStats.clear();
    this.connectionStats = {
      peak: 0,
      current: 0,
      total: 0
    };
  }

  // 私有方法
  private async initMonitoringTables(): Promise<void> {
    // 创建监控相关的表（如果需要持久化）
    // 这里简化实现，使用内存存储
  }

  private startMetricsCollection(): void {
    this.collectTimer = setInterval(async () => {
      try {
        const metrics = await this.getCurrentMetrics();
        this.metricsHistory.push(metrics);

        // 限制历史记录数量
        if (this.metricsHistory.length > 10000) {
          this.metricsHistory = this.metricsHistory.slice(-5000);
        }

        // 检查健康状态并发送告警
        if (this.config.alertEnabled) {
          const health = await this.getHealthStatus();
          if (health.status === 'critical') {
            alertManager.createAlert({
              type: 'database',
              severity: 'critical',
              message: 'Database health is critical',
              details: {
                score: health.score,
                issues: health.issues.length
              }
            });
          }
        }
      } catch (error) {
        logger.error('Failed to collect database metrics:', error);
      }
    }, this.config.collectInterval * 1000);
  }

  private normalizeQuery(query: string): string {
    // 标准化查询，移除参数值
    return query
      .replace(/\s+/g, ' ')
      .replace(/'[^']*'/g, '?')
      .replace(/\d+/g, '?')
      .trim()
      .toLowerCase();
  }

  private async getQueryMetrics(): Promise<PerformanceMetrics['queries']> {
    const totalQueries = Array.from(this.queryStats.values())
      .reduce((sum, stats) => sum + stats.count, 0);
    
    const totalTime = Array.from(this.queryStats.values())
      .reduce((sum, stats) => sum + stats.totalTime, 0);
    
    const failedQueries = Array.from(this.queryStats.values())
      .reduce((sum, stats) => sum + stats.errors, 0);
    
    const recentSlowQueries = this.slowQueries.filter(
      q => Date.now() - q.timestamp.getTime() < 60000 // 最近1分钟
    ).length;

    return {
      total: totalQueries,
      slow: recentSlowQueries,
      failed: failedQueries,
      avgResponseTime: totalQueries > 0 ? totalTime / totalQueries : 0,
      qps: totalQueries / Math.max(1, this.metricsHistory.length * this.config.collectInterval)
    };
  }

  private async getDatabaseMetrics(): Promise<PerformanceMetrics['database']> {
    try {
      // 获取数据库大小（简化实现）
      const sizeResult = await query("PRAGMA page_count");
      const pageSizeResult = await query("PRAGMA page_size");
      
      const pageCount = sizeResult[0]?.page_count || 0;
      const pageSize = pageSizeResult[0]?.page_size || 4096;
      const dbSize = pageCount * pageSize;

      // 获取表数量
      const tablesResult = await query(
        "SELECT COUNT(*) as count FROM sqlite_master WHERE type='table'"
      );
      const tableCount = tablesResult[0]?.count || 0;

      // 获取索引数量
      const indexesResult = await query(
        "SELECT COUNT(*) as count FROM sqlite_master WHERE type='index'"
      );
      const indexCount = indexesResult[0]?.count || 0;

      return {
        size: dbSize,
        tableCount,
        indexCount,
        fragmentationRatio: 0 // 简化实现
      };
    } catch (error) {
      logger.error('Failed to get database metrics:', error);
      return {
        size: 0,
        tableCount: 0,
        indexCount: 0,
        fragmentationRatio: 0
      };
    }
  }

  private async getSystemMetrics(): Promise<PerformanceMetrics['system']> {
    // 简化实现，返回模拟数据
    return {
      cpuUsage: Math.random() * 100,
      memoryUsage: Math.random() * 100,
      diskUsage: Math.random() * 100,
      diskSpace: 1024 * 1024 * 1024 // 1GB
    };
  }

  private async getLockMetrics(): Promise<PerformanceMetrics['locks']> {
    // 简化实现，SQLite 不支持复杂的锁监控
    return {
      waiting: 0,
      blocked: 0,
      deadlocks: 0
    };
  }
}

// 导出单例实例
export const dbMonitor = new DatabaseMonitor();

// 自动启动监控
dbMonitor.start();