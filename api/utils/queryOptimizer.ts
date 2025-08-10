import { logger } from './logger';
import { connectionPool } from '../database/connectionPool';

// 查询性能分析结果接口
interface QueryAnalysis {
  query: string;
  executionTime: number;
  rowsAffected: number;
  indexUsage: string[];
  suggestions: string[];
  optimizedQuery?: string;
}

// 查询统计信息
interface QueryStats {
  query: string;
  count: number;
  totalTime: number;
  averageTime: number;
  minTime: number;
  maxTime: number;
  lastExecuted: Date;
}

// 索引建议
interface IndexSuggestion {
  table: string;
  columns: string[];
  type: 'btree' | 'hash' | 'fulltext';
  reason: string;
  estimatedImprovement: string;
}

class QueryOptimizer {
  private queryStats: Map<string, QueryStats> = new Map();
  private slowQueries: QueryAnalysis[] = [];
  private indexSuggestions: IndexSuggestion[] = [];
  private slowQueryThreshold: number;

  constructor(slowQueryThreshold = 1000) {
    this.slowQueryThreshold = slowQueryThreshold;
  }

  // 分析查询性能
  public async analyzeQuery(sql: string, params: any[] = []): Promise<QueryAnalysis> {
    const startTime = Date.now();
    const normalizedQuery = this.normalizeQuery(sql);
    
    try {
      // 执行EXPLAIN QUERY PLAN来分析查询
      const explainResult = await connectionPool.query(
        `EXPLAIN QUERY PLAN ${sql}`,
        params
      );
      
      const executionTime = Date.now() - startTime;
      
      // 分析执行计划
      const analysis = this.analyzeExecutionPlan(explainResult, sql, executionTime);
      
      // 更新查询统计
      this.updateQueryStats(normalizedQuery, executionTime);
      
      // 如果是慢查询，记录下来
      if (executionTime > this.slowQueryThreshold) {
        this.recordSlowQuery(analysis);
      }
      
      return analysis;
    } catch (error) {
      logger.error('查询分析失败:', error);
      return {
        query: sql,
        executionTime: Date.now() - startTime,
        rowsAffected: 0,
        indexUsage: [],
        suggestions: ['查询分析失败，请检查SQL语法']
      };
    }
  }

  // 执行优化后的查询
  public async executeOptimizedQuery<T>(
    sql: string, 
    params: any[] = [], 
    options: { analyze?: boolean; timeout?: number } = {}
  ): Promise<{ data: T[]; analysis?: QueryAnalysis }> {
    const { analyze = false, timeout = 30000 } = options;
    
    let analysis: QueryAnalysis | undefined;
    
    if (analyze) {
      analysis = await this.analyzeQuery(sql, params);
    }
    
    const startTime = Date.now();
    
    try {
      // 设置查询超时
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('查询超时')), timeout);
      });
      
      const queryPromise = connectionPool.query<T>(sql, params);
      
      const data = await Promise.race([queryPromise, timeoutPromise]) as T[];
      
      const executionTime = Date.now() - startTime;
      
      // 更新统计信息
      const normalizedQuery = this.normalizeQuery(sql);
      this.updateQueryStats(normalizedQuery, executionTime);
      
      return { data, analysis };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      logger.error(`查询执行失败 (${executionTime}ms):`, error);
      throw error;
    }
  }

  // 分析执行计划
  private analyzeExecutionPlan(
    explainResult: any[], 
    originalQuery: string, 
    executionTime: number
  ): QueryAnalysis {
    const indexUsage: string[] = [];
    const suggestions: string[] = [];
    let rowsAffected = 0;
    
    // 分析执行计划中的每一步
    for (const step of explainResult) {
      const detail = step.detail || '';
      
      // 检查是否使用了索引
      if (detail.includes('USING INDEX')) {
        const indexMatch = detail.match(/USING INDEX (\w+)/);
        if (indexMatch) {
          indexUsage.push(indexMatch[1]);
        }
      }
      
      // 检查是否进行了全表扫描
      if (detail.includes('SCAN TABLE')) {
        const tableMatch = detail.match(/SCAN TABLE (\w+)/);
        if (tableMatch) {
          suggestions.push(`表 ${tableMatch[1]} 进行了全表扫描，考虑添加索引`);
        }
      }
      
      // 检查是否使用了临时表
      if (detail.includes('USE TEMP B-TREE')) {
        suggestions.push('查询使用了临时B-Tree，考虑优化ORDER BY或GROUP BY子句');
      }
      
      // 估算影响的行数
      const rowsMatch = detail.match(/(\d+) rows/);
      if (rowsMatch) {
        rowsAffected = Math.max(rowsAffected, parseInt(rowsMatch[1]));
      }
    }
    
    // 基于执行时间给出建议
    if (executionTime > 5000) {
      suggestions.push('查询执行时间过长，建议分解为多个简单查询');
    } else if (executionTime > 1000) {
      suggestions.push('查询执行时间较长，建议检查索引使用情况');
    }
    
    // 分析查询类型并给出特定建议
    const queryType = this.getQueryType(originalQuery);
    suggestions.push(...this.getQueryTypeSuggestions(queryType, originalQuery));
    
    return {
      query: originalQuery,
      executionTime,
      rowsAffected,
      indexUsage,
      suggestions,
      optimizedQuery: this.generateOptimizedQuery(originalQuery, suggestions)
    };
  }

  // 获取查询类型
  private getQueryType(query: string): string {
    const upperQuery = query.trim().toUpperCase();
    if (upperQuery.startsWith('SELECT')) return 'SELECT';
    if (upperQuery.startsWith('INSERT')) return 'INSERT';
    if (upperQuery.startsWith('UPDATE')) return 'UPDATE';
    if (upperQuery.startsWith('DELETE')) return 'DELETE';
    return 'OTHER';
  }

  // 根据查询类型给出建议
  private getQueryTypeSuggestions(queryType: string, query: string): string[] {
    const suggestions: string[] = [];
    const upperQuery = query.toUpperCase();
    
    switch (queryType) {
      case 'SELECT':
        if (upperQuery.includes('SELECT *')) {
          suggestions.push('避免使用SELECT *，只选择需要的列');
        }
        if (upperQuery.includes('LIKE \'%')) {
          suggestions.push('避免在LIKE模式开头使用通配符，考虑使用全文搜索');
        }
        if (upperQuery.includes('ORDER BY') && !upperQuery.includes('LIMIT')) {
          suggestions.push('ORDER BY查询建议添加LIMIT限制结果数量');
        }
        break;
        
      case 'INSERT':
        if (upperQuery.includes('INSERT INTO') && !upperQuery.includes('VALUES')) {
          suggestions.push('批量插入时考虑使用事务以提高性能');
        }
        break;
        
      case 'UPDATE':
        if (!upperQuery.includes('WHERE')) {
          suggestions.push('UPDATE语句缺少WHERE条件，可能影响所有行');
        }
        break;
        
      case 'DELETE':
        if (!upperQuery.includes('WHERE')) {
          suggestions.push('DELETE语句缺少WHERE条件，可能删除所有行');
        }
        break;
    }
    
    return suggestions;
  }

  // 生成优化后的查询（简单示例）
  private generateOptimizedQuery(originalQuery: string, suggestions: string[]): string | undefined {
    let optimizedQuery = originalQuery;
    
    // 简单的优化示例
    if (suggestions.some(s => s.includes('SELECT *'))) {
      // 这里应该根据实际表结构替换SELECT *
      // 为了演示，我们只是添加注释
      optimizedQuery = `-- 建议替换SELECT *为具体列名\n${optimizedQuery}`;
    }
    
    if (suggestions.some(s => s.includes('LIMIT'))) {
      if (!originalQuery.toUpperCase().includes('LIMIT')) {
        optimizedQuery += ' LIMIT 100';
      }
    }
    
    return optimizedQuery !== originalQuery ? optimizedQuery : undefined;
  }

  // 标准化查询（用于统计）
  private normalizeQuery(query: string): string {
    return query
      .replace(/\s+/g, ' ')
      .replace(/\b\d+\b/g, '?')
      .replace(/\'[^']*\'/g, '?')
      .trim()
      .toLowerCase();
  }

  // 更新查询统计
  private updateQueryStats(normalizedQuery: string, executionTime: number): void {
    const existing = this.queryStats.get(normalizedQuery);
    
    if (existing) {
      existing.count++;
      existing.totalTime += executionTime;
      existing.averageTime = existing.totalTime / existing.count;
      existing.minTime = Math.min(existing.minTime, executionTime);
      existing.maxTime = Math.max(existing.maxTime, executionTime);
      existing.lastExecuted = new Date();
    } else {
      this.queryStats.set(normalizedQuery, {
        query: normalizedQuery,
        count: 1,
        totalTime: executionTime,
        averageTime: executionTime,
        minTime: executionTime,
        maxTime: executionTime,
        lastExecuted: new Date()
      });
    }
  }

  // 记录慢查询
  private recordSlowQuery(analysis: QueryAnalysis): void {
    this.slowQueries.push(analysis);
    
    // 保持最近100个慢查询
    if (this.slowQueries.length > 100) {
      this.slowQueries = this.slowQueries.slice(-100);
    }
    
    logger.warn(`慢查询检测: ${analysis.executionTime}ms`, {
      query: analysis.query,
      suggestions: analysis.suggestions
    });
  }

  // 生成索引建议
  public async generateIndexSuggestions(): Promise<IndexSuggestion[]> {
    const suggestions: IndexSuggestion[] = [];
    
    try {
      // 分析慢查询中的模式
      for (const slowQuery of this.slowQueries) {
        const indexSuggestion = this.analyzeQueryForIndexes(slowQuery.query);
        if (indexSuggestion) {
          suggestions.push(indexSuggestion);
        }
      }
      
      // 分析频繁查询
      const frequentQueries = Array.from(this.queryStats.values())
        .filter(stat => stat.count > 10 && stat.averageTime > 100)
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);
      
      for (const stat of frequentQueries) {
        const indexSuggestion = this.analyzeQueryForIndexes(stat.query);
        if (indexSuggestion) {
          suggestions.push(indexSuggestion);
        }
      }
      
      this.indexSuggestions = suggestions;
      return suggestions;
    } catch (error) {
      logger.error('生成索引建议失败:', error);
      return [];
    }
  }

  // 分析查询以生成索引建议
  private analyzeQueryForIndexes(query: string): IndexSuggestion | null {
    const upperQuery = query.toUpperCase();
    
    // 简单的WHERE子句分析
    const whereMatch = upperQuery.match(/WHERE\s+([\w.]+)\s*[=<>]/);
    if (whereMatch) {
      const column = whereMatch[1];
      const tableMatch = upperQuery.match(/FROM\s+(\w+)/);
      
      if (tableMatch) {
        return {
          table: tableMatch[1].toLowerCase(),
          columns: [column.toLowerCase()],
          type: 'btree',
          reason: '频繁的WHERE条件查询',
          estimatedImprovement: '50-80%'
        };
      }
    }
    
    // ORDER BY分析
    const orderByMatch = upperQuery.match(/ORDER\s+BY\s+([\w.]+)/);
    if (orderByMatch) {
      const column = orderByMatch[1];
      const tableMatch = upperQuery.match(/FROM\s+(\w+)/);
      
      if (tableMatch) {
        return {
          table: tableMatch[1].toLowerCase(),
          columns: [column.toLowerCase()],
          type: 'btree',
          reason: '频繁的ORDER BY操作',
          estimatedImprovement: '30-60%'
        };
      }
    }
    
    return null;
  }

  // 获取查询统计信息
  public getQueryStats(): QueryStats[] {
    return Array.from(this.queryStats.values())
      .sort((a, b) => b.averageTime - a.averageTime);
  }

  // 获取慢查询
  public getSlowQueries(): QueryAnalysis[] {
    return [...this.slowQueries].sort((a, b) => b.executionTime - a.executionTime);
  }

  // 获取索引建议
  public getIndexSuggestions(): IndexSuggestion[] {
    return [...this.indexSuggestions];
  }

  // 清理统计数据
  public clearStats(): void {
    this.queryStats.clear();
    this.slowQueries = [];
    this.indexSuggestions = [];
    logger.info('查询统计数据已清理');
  }

  // 获取性能报告
  public getPerformanceReport() {
    const stats = this.getQueryStats();
    const slowQueries = this.getSlowQueries();
    const indexSuggestions = this.getIndexSuggestions();
    
    const totalQueries = stats.reduce((sum, stat) => sum + stat.count, 0);
    const averageExecutionTime = stats.length > 0 ? 
      stats.reduce((sum, stat) => sum + stat.averageTime, 0) / stats.length : 0;
    
    return {
      summary: {
        totalQueries,
        uniqueQueries: stats.length,
        slowQueries: slowQueries.length,
        averageExecutionTime: Math.round(averageExecutionTime),
        indexSuggestions: indexSuggestions.length
      },
      topSlowQueries: slowQueries.slice(0, 10),
      mostFrequentQueries: stats.slice(0, 10),
      indexSuggestions,
      generatedAt: new Date().toISOString()
    };
  }
}

// 创建全局查询优化器实例
export const queryOptimizer = new QueryOptimizer(
  parseInt(process.env.SLOW_QUERY_THRESHOLD || '1000')
);

export { QueryOptimizer };
export type { QueryAnalysis, QueryStats, IndexSuggestion };