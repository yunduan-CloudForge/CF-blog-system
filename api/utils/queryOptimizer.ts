/**
 * 数据库查询优化工具
 * 实现查询缓存、性能监控和查询优化
 */

import { query, get, run } from '../database/connection';

// 文章接口
interface Article {
  id: number;
  title: string;
  content: string;
  status: string;
  tags?: Tag[];
  [key: string]: unknown;
}

// 标签接口
interface Tag {
  id: number;
  name: string;
  color: string;
  article_id?: number;
}

// 查询缓存接口
interface QueryCache {
  [key: string]: {
    data: unknown;
    timestamp: number;
    ttl: number;
  };
}

// 性能监控接口
interface QueryPerformance {
  queryType: string;
  sql: string;
  executionTime: number;
  resultCount: number;
  parameters?: unknown[];
  userId?: number;
  ipAddress?: string;
}

interface CacheOptions {
  cacheKey?: string;
  ttl?: number;
  queryType?: string;
  userId?: number;
  ipAddress?: string;
}

interface ArticleListOptions {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
  tag?: string;
  status?: string;
  author?: string;
  userId?: number;
  ipAddress?: string;
}

interface FTSResult {
  rowid: number;
}

interface CountResult {
  total: number;
}

// 查询缓存实例
const queryCache: QueryCache = {};

// 默认缓存TTL（毫秒）
const DEFAULT_CACHE_TTL = 5 * 60 * 1000; // 5分钟

/**
 * 查询优化器类
 */
export class QueryOptimizer {
  private static instance: QueryOptimizer;
  private performanceLog: QueryPerformance[] = [];
  private cacheHitCount = 0;
  private cacheMissCount = 0;

  private constructor() {}

  public static getInstance(): QueryOptimizer {
    if (!QueryOptimizer.instance) {
      QueryOptimizer.instance = new QueryOptimizer();
    }
    return QueryOptimizer.instance;
  }

  /**
   * 带缓存的查询
   */
  async cachedQuery(
    sql: string,
    params: unknown[] = [],
    options: CacheOptions = {}
  ): Promise<unknown> {
    const {
      cacheKey = this.generateCacheKey(sql, params),
      ttl = DEFAULT_CACHE_TTL,
      queryType = 'unknown',
      userId,
      ipAddress
    } = options;

    // 检查缓存
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      this.cacheHitCount++;
      this.updateCacheStats(cacheKey, true);
      return cached;
    }

    // 执行查询并记录性能
    const startTime = Date.now();
    try {
      const result = await query(sql, params);
      const executionTime = Date.now() - startTime;

      // 缓存结果
      this.setCache(cacheKey, result, ttl);
      this.cacheMissCount++;
      this.updateCacheStats(cacheKey, false);

      // 记录性能
      this.logPerformance({
        queryType,
        sql,
        executionTime,
        resultCount: Array.isArray(result) ? result.length : 1,
        parameters: params,
        userId,
        ipAddress
      });

      return result;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.logPerformance({
        queryType: `${queryType}_error`,
        sql,
        executionTime,
        resultCount: 0,
        parameters: params,
        userId,
        ipAddress
      });
      throw error;
    }
  }

  /**
   * 带缓存的单行查询
   */
  async cachedGet(
    sql: string,
    params: unknown[] = [],
    options: CacheOptions = {}
  ): Promise<unknown> {
    const {
      cacheKey = this.generateCacheKey(sql, params),
      ttl = DEFAULT_CACHE_TTL,
      queryType = 'get',
      userId,
      ipAddress
    } = options;

    // 检查缓存
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      this.cacheHitCount++;
      this.updateCacheStats(cacheKey, true);
      return cached;
    }

    // 执行查询
    const startTime = Date.now();
    try {
      const result = await get(sql, params);
      const executionTime = Date.now() - startTime;

      // 缓存结果
      this.setCache(cacheKey, result, ttl);
      this.cacheMissCount++;
      this.updateCacheStats(cacheKey, false);

      // 记录性能
      this.logPerformance({
        queryType,
        sql,
        executionTime,
        resultCount: result ? 1 : 0,
        parameters: params,
        userId,
        ipAddress
      });

      return result;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.logPerformance({
        queryType: `${queryType}_error`,
        sql,
        executionTime,
        resultCount: 0,
        parameters: params,
        userId,
        ipAddress
      });
      throw error;
    }
  }

  /**
   * 优化的文章列表查询
   */
  async getOptimizedArticleList(options: ArticleListOptions = {}): Promise<{ articles: Article[]; total: number }> {
    const {
      page = 1,
      limit = 10,
      search = '',
      category = '',
      tag = '',
      status = 'published',
      author = '',
      userId,
      ipAddress
    } = options;

    const offset = (page - 1) * limit;
    const cacheKey = `articles_list_${JSON.stringify(options)}`;

    // 构建优化的查询
    const whereConditions: string[] = [];
        const queryParams: unknown[] = [];

    // 使用索引优化的状态查询
    if (status && status !== 'all') {
      whereConditions.push('a.status = ?');
      queryParams.push(status);
    }

    // 全文搜索优化
    if (search) {
      // 如果支持FTS，使用FTS搜索
      try {
        const ftsResult = await this.cachedQuery(
          'SELECT rowid FROM articles_fts WHERE articles_fts MATCH ?',
          [search],
          { queryType: 'fts_search', userId, ipAddress }
        );
        
        if (Array.isArray(ftsResult) && ftsResult.length > 0) {
          const ids = (ftsResult as FTSResult[]).map((r: FTSResult) => r.rowid).join(',');
          whereConditions.push(`a.id IN (${ids})`);
        } else {
          // 如果FTS没有结果，返回空
          return { articles: [], total: 0 };
        }
      } catch {
        // FTS不可用，使用传统LIKE搜索
        whereConditions.push('(a.title LIKE ? OR a.summary LIKE ?)');
        const searchTerm = `%${search}%`;
        queryParams.push(searchTerm, searchTerm);
      }
    }

    // 分类筛选（使用索引）
    if (category) {
      whereConditions.push('a.category_id = ?');
      queryParams.push(category);
    }

    // 作者筛选（使用索引）
    if (author) {
      whereConditions.push('a.author_id = ?');
      queryParams.push(author);
    }

    // 标签筛选优化
    let tagJoin = '';
    if (tag) {
      tagJoin = 'INNER JOIN article_tags at ON a.id = at.article_id';
      whereConditions.push('at.tag_id = ?');
      queryParams.push(tag);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // 使用视图优化查询
    const articlesQuery = `
      SELECT DISTINCT
        a.id,
        a.title,
        a.summary,
        a.status,
        a.cover_image,
        a.views,
        a.likes,
        a.comments_count,
        a.created_at,
        a.updated_at,
        u.username as author_name,
        u.avatar as author_avatar,
        c.name as category_name,
        c.id as category_id
      FROM articles a
      LEFT JOIN users u ON a.author_id = u.id
      LEFT JOIN categories c ON a.category_id = c.id
      ${tagJoin}
      ${whereClause}
      ORDER BY a.created_at DESC
      LIMIT ? OFFSET ?
    `;

    // 执行查询
    const articles = await this.cachedQuery(
      articlesQuery,
      [...queryParams, limit, offset],
      {
        cacheKey: `${cacheKey}_articles`,
        ttl: 2 * 60 * 1000, // 2分钟缓存
        queryType: 'article_list',
        userId,
        ipAddress
      }
    );

    // 批量获取标签（优化N+1查询）
    if (Array.isArray(articles) && articles.length > 0) {
      const articleIds = (articles as Article[]).map((a) => a.id).join(',');
      const tagsQuery = `
        SELECT 
          at.article_id,
          t.id,
          t.name,
          t.color
        FROM article_tags at
        INNER JOIN tags t ON at.tag_id = t.id
        WHERE at.article_id IN (${articleIds})
        ORDER BY t.name
      `;

      const allTags = await this.cachedQuery(
        tagsQuery,
        [],
        {
          cacheKey: `${cacheKey}_tags`,
          ttl: 5 * 60 * 1000, // 5分钟缓存
          queryType: 'article_tags',
          userId,
          ipAddress
        }
      );

      // 组织标签数据
      const tagsByArticle: { [key: number]: Tag[] } = {};
      (allTags as Tag[]).forEach((tag) => {
        if (!tagsByArticle[tag.article_id]) {
          tagsByArticle[tag.article_id] = [];
        }
        tagsByArticle[tag.article_id].push({
          id: tag.id,
          name: tag.name,
          color: tag.color
        });
      });

      // 将标签添加到文章
      (articles as Article[]).forEach((article) => {
        article.tags = tagsByArticle[article.id] || [];
      });
    }

    // 获取总数（使用缓存）
    const countQuery = `
      SELECT COUNT(DISTINCT a.id) as total
      FROM articles a
      ${tagJoin}
      ${whereClause}
    `;

    const countResult = await this.cachedGet(
      countQuery,
      queryParams,
      {
        cacheKey: `${cacheKey}_count`,
        ttl: 5 * 60 * 1000, // 5分钟缓存
        queryType: 'article_count',
        userId,
        ipAddress
      }
    );

    const total = (countResult as CountResult)?.total || 0;

    return { articles: articles as Article[], total };
  }

  /**
   * 生成缓存键
   */
  private generateCacheKey(sql: string, params: unknown[]): string {
    const hash = this.simpleHash(sql + JSON.stringify(params));
    return `query_${hash}`;
  }

  /**
   * 简单哈希函数
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 转换为32位整数
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * 从缓存获取数据
   */
  private getFromCache(key: string): unknown | null {
    const cached = queryCache[key];
    if (!cached) return null;

    if (Date.now() - cached.timestamp > cached.ttl) {
      delete queryCache[key];
      return null;
    }

    return cached.data;
  }

  /**
   * 设置缓存
   */
  private setCache(key: string, data: unknown, ttl: number): void {
    queryCache[key] = {
      data,
      timestamp: Date.now(),
      ttl
    };

    // 简单的缓存清理（当缓存项超过1000时清理过期项）
    if (Object.keys(queryCache).length > 1000) {
      this.cleanupCache();
    }
  }

  /**
   * 清理过期缓存
   */
  private cleanupCache(): void {
    const now = Date.now();
    Object.keys(queryCache).forEach(key => {
      const cached = queryCache[key];
      if (now - cached.timestamp > cached.ttl) {
        delete queryCache[key];
      }
    });
  }

  /**
   * 记录查询性能
   */
  private logPerformance(perf: QueryPerformance): void {
    this.performanceLog.push(perf);

    // 异步写入数据库（避免影响主查询性能）
    setImmediate(async () => {
      try {
        await run(
          `INSERT INTO query_performance_log 
           (query_type, query_sql, execution_time_ms, result_count, parameters, user_id, ip_address)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            perf.queryType,
            perf.sql,
            perf.executionTime,
            perf.resultCount,
            JSON.stringify(perf.parameters),
            perf.userId,
            perf.ipAddress
          ]
        );
      } catch (error) {
        console.error('记录查询性能失败:', error);
      }
    });

    // 保持性能日志在内存中的大小
    if (this.performanceLog.length > 1000) {
      this.performanceLog = this.performanceLog.slice(-500);
    }
  }

  /**
   * 更新缓存统计
   */
  private async updateCacheStats(cacheKey: string, isHit: boolean): Promise<void> {
    setImmediate(async () => {
      try {
        const now = new Date().toISOString();
        if (isHit) {
          await run(
            `INSERT OR REPLACE INTO cache_stats 
             (cache_key, hit_count, miss_count, last_hit_at, updated_at)
             VALUES (?, 
                     COALESCE((SELECT hit_count FROM cache_stats WHERE cache_key = ?), 0) + 1,
                     COALESCE((SELECT miss_count FROM cache_stats WHERE cache_key = ?), 0),
                     ?, ?)`,
            [cacheKey, cacheKey, cacheKey, now, now]
          );
        } else {
          await run(
            `INSERT OR REPLACE INTO cache_stats 
             (cache_key, hit_count, miss_count, last_miss_at, updated_at)
             VALUES (?, 
                     COALESCE((SELECT hit_count FROM cache_stats WHERE cache_key = ?), 0),
                     COALESCE((SELECT miss_count FROM cache_stats WHERE cache_key = ?), 0) + 1,
                     ?, ?)`,
            [cacheKey, cacheKey, cacheKey, now, now]
          );
        }
      } catch (error) {
        console.error('更新缓存统计失败:', error);
      }
    });
  }

  /**
   * 清除特定模式的缓存
   */
  invalidateCache(pattern: string): void {
    Object.keys(queryCache).forEach(key => {
      if (key.includes(pattern)) {
        delete queryCache[key];
      }
    });
  }

  /**
   * 获取性能统计
   */
  getPerformanceStats(): {
    cacheHitRate: number;
    averageQueryTime: number;
    slowQueries: QueryPerformance[];
    cacheSize: number;
  } {
    const totalCacheRequests = this.cacheHitCount + this.cacheMissCount;
    const cacheHitRate = totalCacheRequests > 0 ? (this.cacheHitCount / totalCacheRequests) * 100 : 0;

    const recentQueries = this.performanceLog.slice(-100);
    const averageQueryTime = recentQueries.length > 0 
      ? recentQueries.reduce((sum, q) => sum + q.executionTime, 0) / recentQueries.length 
      : 0;

    const slowQueries = this.performanceLog
      .filter(q => q.executionTime > 100) // 超过100ms的查询
      .sort((a, b) => b.executionTime - a.executionTime)
      .slice(0, 10);

    return {
      cacheHitRate,
      averageQueryTime,
      slowQueries,
      cacheSize: Object.keys(queryCache).length
    };
  }
}

// 导出单例实例
export const queryOptimizer = QueryOptimizer.getInstance();

// 导出便捷函数
export const cachedQuery = (sql: string, params?: unknown[], options?: CacheOptions) => 
  queryOptimizer.cachedQuery(sql, params, options);

export const cachedGet = (sql: string, params?: unknown[], options?: CacheOptions) => 
  queryOptimizer.cachedGet(sql, params, options);

export const getOptimizedArticleList = (options?: ArticleListOptions) => 
  queryOptimizer.getOptimizedArticleList(options);