/**
 * 前端缓存策略和工具函数
 * 支持内存缓存、localStorage缓存、sessionStorage缓存和IndexedDB缓存
 */
import { useState, useEffect } from 'react';

// 缓存配置接口
interface CacheConfig {
  ttl?: number; // 生存时间（毫秒）
  maxSize?: number; // 最大缓存条目数
  storage?: 'memory' | 'localStorage' | 'sessionStorage' | 'indexedDB';
  prefix?: string; // 缓存键前缀
}

// 缓存项接口
interface CacheItem<T> {
  data: T;
  timestamp: number;
  ttl: number;
  accessCount: number;
  lastAccess: number;
}

// 默认配置
const DEFAULT_CONFIG: Required<CacheConfig> = {
  ttl: 5 * 60 * 1000, // 5分钟
  maxSize: 100,
  storage: 'memory',
  prefix: 'blog_cache_'
};

/**
 * 通用缓存管理器
 */
class CacheManager<T = unknown> {
  private cache = new Map<string, CacheItem<T>>();
  private config: Required<CacheConfig>;
  private cleanupTimer?: NodeJS.Timeout;

  constructor(config: CacheConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.startCleanupTimer();
  }

  /**
   * 设置缓存
   */
  set(key: string, data: T, ttl?: number): void {
    const fullKey = this.getFullKey(key);
    const item: CacheItem<T> = {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.config.ttl,
      accessCount: 0,
      lastAccess: Date.now()
    };

    // 检查缓存大小限制
    if (this.cache.size >= this.config.maxSize) {
      this.evictLRU();
    }

    this.cache.set(fullKey, item);
    this.persistToStorage(fullKey, item);
  }

  /**
   * 获取缓存
   */
  get(key: string): T | null {
    const fullKey = this.getFullKey(key);
    let item = this.cache.get(fullKey);

    // 如果内存中没有，尝试从持久化存储中获取
    if (!item) {
      item = this.loadFromStorage(fullKey);
      if (item) {
        this.cache.set(fullKey, item);
      }
    }

    if (!item) {
      return null;
    }

    // 检查是否过期
    if (this.isExpired(item)) {
      this.delete(key);
      return null;
    }

    // 更新访问信息
    item.accessCount++;
    item.lastAccess = Date.now();

    return item.data;
  }

  /**
   * 删除缓存
   */
  delete(key: string): boolean {
    const fullKey = this.getFullKey(key);
    const deleted = this.cache.delete(fullKey);
    this.removeFromStorage(fullKey);
    return deleted;
  }

  /**
   * 清空缓存
   */
  clear(): void {
    this.cache.clear();
    this.clearStorage();
  }

  /**
   * 检查缓存是否存在且未过期
   */
  has(key: string): boolean {
    return this.get(key) !== null;
  }

  /**
   * 获取缓存统计信息
   */
  getStats() {
    const items = Array.from(this.cache.values());
    return {
      size: this.cache.size,
      maxSize: this.config.maxSize,
      hitRate: this.calculateHitRate(),
      totalAccess: items.reduce((sum, item) => sum + item.accessCount, 0),
      averageAge: this.calculateAverageAge(items),
      expiredCount: items.filter(item => this.isExpired(item)).length
    };
  }

  private getFullKey(key: string): string {
    return `${this.config.prefix}${key}`;
  }

  private isExpired(item: CacheItem<T>): boolean {
    return Date.now() - item.timestamp > item.ttl;
  }

  private evictLRU(): void {
    let oldestKey = '';
    let oldestTime = Date.now();

    for (const [key, item] of this.cache.entries()) {
      if (item.lastAccess < oldestTime) {
        oldestTime = item.lastAccess;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.removeFromStorage(oldestKey);
    }
  }

  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, 60000); // 每分钟清理一次
  }

  private cleanup(): void {
    const expiredKeys: string[] = [];
    
    for (const [key, item] of this.cache.entries()) {
      if (this.isExpired(item)) {
        expiredKeys.push(key);
      }
    }

    expiredKeys.forEach(key => {
      this.cache.delete(key);
      this.removeFromStorage(key);
    });
  }

  private persistToStorage(key: string, item: CacheItem<T>): void {
    if (this.config.storage === 'memory') return;

    try {
      const serialized = JSON.stringify(item);
      
      switch (this.config.storage) {
        case 'localStorage':
          localStorage.setItem(key, serialized);
          break;
        case 'sessionStorage':
          sessionStorage.setItem(key, serialized);
          break;
        case 'indexedDB':
          // IndexedDB实现（简化版）
          this.setIndexedDB(key, item);
          break;
      }
    } catch (error) {
      console.warn('Failed to persist cache item:', error);
    }
  }

  private loadFromStorage(key: string): CacheItem<T> | null {
    if (this.config.storage === 'memory') return null;

    try {
      let serialized: string | null = null;
      
      switch (this.config.storage) {
        case 'localStorage':
          serialized = localStorage.getItem(key);
          break;
        case 'sessionStorage':
          serialized = sessionStorage.getItem(key);
          break;
        case 'indexedDB':
          // IndexedDB实现（简化版）
          return this.getIndexedDB(key);
      }

      return serialized ? JSON.parse(serialized) : null;
    } catch (error) {
      console.warn('Failed to load cache item:', error);
      return null;
    }
  }

  private removeFromStorage(key: string): void {
    if (this.config.storage === 'memory') return;

    try {
      switch (this.config.storage) {
        case 'localStorage':
          localStorage.removeItem(key);
          break;
        case 'sessionStorage':
          sessionStorage.removeItem(key);
          break;
        case 'indexedDB':
          this.deleteIndexedDB(key);
          break;
      }
    } catch (error) {
      console.warn('Failed to remove cache item:', error);
    }
  }

  private clearStorage(): void {
    if (this.config.storage === 'memory') return;

    try {
      const prefix = this.config.prefix;
      
      switch (this.config.storage) {
        case 'localStorage':
          Object.keys(localStorage)
            .filter(key => key.startsWith(prefix))
            .forEach(key => localStorage.removeItem(key));
          break;
        case 'sessionStorage':
          Object.keys(sessionStorage)
            .filter(key => key.startsWith(prefix))
            .forEach(key => sessionStorage.removeItem(key));
          break;
        case 'indexedDB':
          this.clearIndexedDB();
          break;
      }
    } catch (error) {
      console.warn('Failed to clear cache storage:', error);
    }
  }

  private calculateHitRate(): number {
    // 简化的命中率计算
    const items = Array.from(this.cache.values());
    const totalAccess = items.reduce((sum, item) => sum + item.accessCount, 0);
    return totalAccess > 0 ? (items.length / totalAccess) * 100 : 0;
  }

  private calculateAverageAge(items: CacheItem<T>[]): number {
    if (items.length === 0) return 0;
    const now = Date.now();
    const totalAge = items.reduce((sum, item) => sum + (now - item.timestamp), 0);
    return totalAge / items.length;
  }

  // IndexedDB 简化实现（实际项目中建议使用专门的IndexedDB库）
  private async setIndexedDB(key: string, item: CacheItem<T>): Promise<void> {
    // 简化实现，实际应该使用完整的IndexedDB API
    console.log('IndexedDB set:', key, item);
  }

  private getIndexedDB(key: string): CacheItem<T> | null {
    // 简化实现
    console.log('IndexedDB get:', key);
    return null;
  }

  private deleteIndexedDB(key: string): void {
    console.log('IndexedDB delete:', key);
  }

  private clearIndexedDB(): void {
    console.log('IndexedDB clear');
  }

  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    this.clear();
  }
}

// 创建不同类型的缓存实例
export const memoryCache = new CacheManager({ storage: 'memory', ttl: 5 * 60 * 1000 });
export const localCache = new CacheManager({ storage: 'localStorage', ttl: 24 * 60 * 60 * 1000 });
export const sessionCache = new CacheManager({ storage: 'sessionStorage', ttl: 60 * 60 * 1000 });

// API缓存装饰器
export function withCache<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  options: {
    keyGenerator?: (...args: Parameters<T>) => string;
    ttl?: number;
    cache?: CacheManager;
  } = {}
): T {
  const {
    keyGenerator = (...args) => JSON.stringify(args),
    ttl = 5 * 60 * 1000,
    cache = memoryCache
  } = options;

  return (async (...args: Parameters<T>) => {
    const cacheKey = keyGenerator(...args);
    
    // 尝试从缓存获取
    const cached = cache.get(cacheKey);
    if (cached !== null) {
      return cached;
    }

    // 执行原函数
    const result = await fn(...args);
    // 缓存结果
    cache.set(cacheKey, result, ttl);
    return result;
  }) as T;
}

// React Hook：使用缓存
export function useCache<T>(key: string, fetcher: () => Promise<T>, options: {
  ttl?: number;
  cache?: CacheManager;
  enabled?: boolean;
} = {}) {
  const {
    ttl = 5 * 60 * 1000,
    cache = memoryCache,
    enabled = true
  } = options;

  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const loadData = async () => {
      // 尝试从缓存获取
      const cached = cache.get(key);
      if (cached !== null) {
        setData(cached as T);
        return;
      }

      // 从网络获取
      setLoading(true);
      setError(null);
      
      try {
        const result = await fetcher();
        cache.set(key, result, ttl);
        setData(result);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [key, enabled, ttl, cache, fetcher]);

  const invalidate = () => {
    cache.delete(key);
    setData(null);
  };

  const refetch = async () => {
    cache.delete(key);
    setLoading(true);
    setError(null);
    
    try {
      const result = await fetcher();
      cache.set(key, result, ttl);
      setData(result);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  };

  return { data, loading, error, invalidate, refetch };
}

// 缓存工具函数
export const cacheUtils = {
  // 生成缓存键
  generateKey: (prefix: string, ...parts: (string | number)[]): string => {
    return `${prefix}:${parts.join(':')}`;
  },

  // 批量设置缓存
  setBatch: <T>(cache: CacheManager<T>, items: Array<{ key: string; data: T; ttl?: number }>) => {
    items.forEach(({ key, data, ttl }) => {
      cache.set(key, data, ttl);
    });
  },

  // 批量获取缓存
  getBatch: <T>(cache: CacheManager<T>, keys: string[]): Array<T | null> => {
    return keys.map(key => cache.get(key));
  },

  // 预热缓存
  warmup: async <T>(cache: CacheManager<T>, items: Array<{ key: string; fetcher: () => Promise<T>; ttl?: number }>) => {
    const promises = items.map(async ({ key, fetcher, ttl }) => {
      if (!cache.has(key)) {
        try {
          const data = await fetcher();
          cache.set(key, data, ttl);
        } catch (error) {
          console.warn(`Failed to warmup cache for key: ${key}`, error);
        }
      }
    });

    await Promise.allSettled(promises);
  }
};

export default CacheManager;