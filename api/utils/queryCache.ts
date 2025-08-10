import { logger } from './logger';

// 缓存项接口
interface CacheItem<T> {
  data: T;
  timestamp: number;
  ttl: number;
  hits: number;
  lastAccessed: number;
  size: number;
}

// 缓存统计信息
interface CacheStats {
  totalItems: number;
  totalSize: number;
  hitRate: number;
  missRate: number;
  totalHits: number;
  totalMisses: number;
  evictions: number;
  oldestItem: number;
  newestItem: number;
}

// 缓存配置
interface CacheConfig {
  maxSize: number;        // 最大缓存大小（字节）
  maxItems: number;       // 最大缓存项数
  defaultTTL: number;     // 默认TTL（毫秒）
  cleanupInterval: number; // 清理间隔（毫秒）
  enableStats: boolean;   // 是否启用统计
}

class QueryCache {
  private cache: Map<string, CacheItem<any>> = new Map();
  private config: CacheConfig;
  private stats = {
    hits: 0,
    misses: 0,
    evictions: 0
  };
  private cleanupTimer?: NodeJS.Timeout;
  private currentSize = 0;

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = {
      maxSize: parseInt(process.env.CACHE_MAX_SIZE || '100') * 1024 * 1024, // 100MB
      maxItems: parseInt(process.env.CACHE_MAX_ITEMS || '10000'),
      defaultTTL: parseInt(process.env.CACHE_DEFAULT_TTL || '300000'), // 5分钟
      cleanupInterval: parseInt(process.env.CACHE_CLEANUP_INTERVAL || '60000'), // 1分钟
      enableStats: process.env.CACHE_ENABLE_STATS !== 'false',
      ...config
    };

    this.startCleanup();
  }

  // 生成缓存键
  private generateKey(sql: string, params: any[] = []): string {
    const normalizedSql = sql.replace(/\s+/g, ' ').trim().toLowerCase();
    const paramsStr = JSON.stringify(params);
    return `${normalizedSql}:${paramsStr}`;
  }

  // 计算数据大小（估算）
  private calculateSize(data: any): number {
    try {
      return JSON.stringify(data).length * 2; // 粗略估算（UTF-16）
    } catch {
      return 1000; // 默认大小
    }
  }

  // 获取缓存数据
  public get<T>(sql: string, params: any[] = []): T | null {
    const key = this.generateKey(sql, params);
    const item = this.cache.get(key);

    if (!item) {
      this.stats.misses++;
      return null;
    }

    const now = Date.now();
    
    // 检查是否过期
    if (now - item.timestamp > item.ttl) {
      this.cache.delete(key);
      this.currentSize -= item.size;
      this.stats.misses++;
      return null;
    }

    // 更新访问统计
    item.hits++;
    item.lastAccessed = now;
    this.stats.hits++;

    logger.debug(`缓存命中: ${key}`);
    return item.data;
  }

  // 设置缓存数据
  public set<T>(sql: string, params: any[] = [], data: T, ttl?: number): void {
    const key = this.generateKey(sql, params);
    const size = this.calculateSize(data);
    const now = Date.now();
    
    // 检查是否需要清理空间
    this.ensureSpace(size);

    const item: CacheItem<T> = {
      data,
      timestamp: now,
      ttl: ttl || this.config.defaultTTL,
      hits: 0,
      lastAccessed: now,
      size
    };

    // 如果键已存在，先减去旧的大小
    const existingItem = this.cache.get(key);
    if (existingItem) {
      this.currentSize -= existingItem.size;
    }

    this.cache.set(key, item);
    this.currentSize += size;

    logger.debug(`缓存设置: ${key}, 大小: ${size}字节`);
  }

  // 确保有足够空间
  private ensureSpace(newItemSize: number): void {
    // 检查项数限制
    while (this.cache.size >= this.config.maxItems) {
      this.evictLRU();
    }

    // 检查大小限制
    while (this.currentSize + newItemSize > this.config.maxSize && this.cache.size > 0) {
      this.evictLRU();
    }
  }

  // LRU淘汰策略
  private evictLRU(): void {
    let oldestKey: string | null = null;
    let oldestTime = Date.now();

    for (const [key, item] of this.cache.entries()) {
      if (item.lastAccessed < oldestTime) {
        oldestTime = item.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      const item = this.cache.get(oldestKey)!;
      this.cache.delete(oldestKey);
      this.currentSize -= item.size;
      this.stats.evictions++;
      logger.debug(`LRU淘汰: ${oldestKey}`);
    }
  }

  // 删除缓存
  public delete(sql: string, params: any[] = []): boolean {
    const key = this.generateKey(sql, params);
    const item = this.cache.get(key);
    
    if (item) {
      this.cache.delete(key);
      this.currentSize -= item.size;
      return true;
    }
    
    return false;
  }

  // 清空缓存
  public clear(): void {
    this.cache.clear();
    this.currentSize = 0;
    this.stats = { hits: 0, misses: 0, evictions: 0 };
    logger.info('查询缓存已清空');
  }

  // 使缓存失效（基于模式）
  public invalidatePattern(pattern: string): number {
    let count = 0;
    const regex = new RegExp(pattern, 'i');
    
    for (const [key, item] of this.cache.entries()) {
      if (regex.test(key)) {
        this.cache.delete(key);
        this.currentSize -= item.size;
        count++;
      }
    }
    
    logger.info(`模式失效: ${pattern}, 删除 ${count} 项`);
    return count;
  }

  // 使表相关缓存失效
  public invalidateTable(tableName: string): number {
    return this.invalidatePattern(`from\\s+${tableName}\\b`);
  }

  // 获取缓存统计
  public getStats(): CacheStats {
    const items = Array.from(this.cache.values());
    const totalRequests = this.stats.hits + this.stats.misses;
    
    let oldestItem = Date.now();
    let newestItem = 0;
    
    for (const item of items) {
      oldestItem = Math.min(oldestItem, item.timestamp);
      newestItem = Math.max(newestItem, item.timestamp);
    }

    return {
      totalItems: this.cache.size,
      totalSize: this.currentSize,
      hitRate: totalRequests > 0 ? (this.stats.hits / totalRequests) * 100 : 0,
      missRate: totalRequests > 0 ? (this.stats.misses / totalRequests) * 100 : 0,
      totalHits: this.stats.hits,
      totalMisses: this.stats.misses,
      evictions: this.stats.evictions,
      oldestItem: items.length > 0 ? oldestItem : 0,
      newestItem: items.length > 0 ? newestItem : 0
    };
  }

  // 获取热门缓存项
  public getHotItems(limit = 10): Array<{ key: string; hits: number; size: number; age: number }> {
    const now = Date.now();
    const items: Array<{ key: string; hits: number; size: number; age: number }> = [];
    
    for (const [key, item] of this.cache.entries()) {
      items.push({
        key,
        hits: item.hits,
        size: item.size,
        age: now - item.timestamp
      });
    }
    
    return items
      .sort((a, b) => b.hits - a.hits)
      .slice(0, limit);
  }

  // 获取大缓存项
  public getLargeItems(limit = 10): Array<{ key: string; size: number; hits: number }> {
    const items: Array<{ key: string; size: number; hits: number }> = [];
    
    for (const [key, item] of this.cache.entries()) {
      items.push({
        key,
        size: item.size,
        hits: item.hits
      });
    }
    
    return items
      .sort((a, b) => b.size - a.size)
      .slice(0, limit);
  }

  // 启动清理定时器
  private startCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);
  }

  // 清理过期项
  private cleanup(): void {
    const now = Date.now();
    let cleanedCount = 0;
    let cleanedSize = 0;
    
    for (const [key, item] of this.cache.entries()) {
      if (now - item.timestamp > item.ttl) {
        this.cache.delete(key);
        this.currentSize -= item.size;
        cleanedCount++;
        cleanedSize += item.size;
      }
    }
    
    if (cleanedCount > 0) {
      logger.debug(`缓存清理: 删除 ${cleanedCount} 项, 释放 ${cleanedSize} 字节`);
    }
  }

  // 停止清理定时器
  public stop(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
  }

  // 预热缓存
  public async warmup(queries: Array<{ sql: string; params?: any[]; ttl?: number }>): Promise<void> {
    logger.info(`开始缓存预热: ${queries.length} 个查询`);
    
    for (const query of queries) {
      try {
        // 这里应该执行实际查询并缓存结果
        // 为了演示，我们只是设置一个占位符
        this.set(query.sql, query.params || [], { placeholder: true }, query.ttl);
      } catch (error) {
        logger.error(`缓存预热失败: ${query.sql}`, error);
      }
    }
    
    logger.info('缓存预热完成');
  }

  // 导出缓存数据（用于备份）
  public export(): any {
    const data: any = {};
    
    for (const [key, item] of this.cache.entries()) {
      data[key] = {
        data: item.data,
        timestamp: item.timestamp,
        ttl: item.ttl,
        hits: item.hits
      };
    }
    
    return {
      cache: data,
      stats: this.stats,
      config: this.config,
      exportTime: Date.now()
    };
  }

  // 导入缓存数据（用于恢复）
  public import(exportData: any): void {
    this.clear();
    
    const now = Date.now();
    
    for (const [key, item] of Object.entries(exportData.cache || {})) {
      const cacheItem = item as any;
      
      // 检查是否过期
      if (now - cacheItem.timestamp < cacheItem.ttl) {
        const size = this.calculateSize(cacheItem.data);
        
        this.cache.set(key, {
          data: cacheItem.data,
          timestamp: cacheItem.timestamp,
          ttl: cacheItem.ttl,
          hits: cacheItem.hits || 0,
          lastAccessed: now,
          size
        });
        
        this.currentSize += size;
      }
    }
    
    if (exportData.stats) {
      this.stats = { ...this.stats, ...exportData.stats };
    }
    
    logger.info(`缓存导入完成: ${this.cache.size} 项`);
  }
}

// 创建全局查询缓存实例
export const queryCache = new QueryCache();

export { QueryCache };
export type { CacheStats, CacheConfig };