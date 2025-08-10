import { createClient } from '@supabase/supabase-js';
import { logger, LogLevel, LogType } from '../utils/logger.js';

// Supabase配置
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_ANON_KEY || '';

let supabase: any = null;

if (!supabaseUrl || !supabaseKey) {
  logger.log(LogLevel.WARN, LogType.OPERATION, 'Supabase配置未设置，将使用本地SQLite数据库');
} else {
  // 创建Supabase客户端
  supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false
    },
    db: {
      schema: 'public'
    },
    global: {
      headers: {
        'X-Client-Info': 'blog-system-api'
      }
    }
  });
}

export { supabase };

// 数据库连接测试
export async function testDatabaseConnection(): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('articles')
      .select('id')
      .limit(1);
    
    if (error) {
      logger.error('数据库连接测试失败:', error);
      return false;
    }
    
    logger.info('数据库连接测试成功');
    return true;
  } catch (error) {
    logger.error('数据库连接测试异常:', error);
    return false;
  }
}

// 获取数据库状态
export async function getDatabaseStatus() {
  try {
    const startTime = Date.now();
    const { data, error } = await supabase
      .from('articles')
      .select('count')
      .limit(1);
    
    const responseTime = Date.now() - startTime;
    
    return {
      connected: !error,
      responseTime,
      error: error?.message || null
    };
  } catch (error) {
    return {
      connected: false,
      responseTime: 0,
      error: error instanceof Error ? error.message : '未知错误'
    };
  }
}

// 数据库性能监控
export async function getDatabaseMetrics() {
  try {
    const startTime = Date.now();
    
    // 获取文章总数
    const { count: articlesCount, error: articlesError } = await supabase
      .from('articles')
      .select('*', { count: 'exact', head: true });
    
    // 获取用户总数
    const { count: usersCount, error: usersError } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true });
    
    // 获取评论总数
    const { count: commentsCount, error: commentsError } = await supabase
      .from('comments')
      .select('*', { count: 'exact', head: true });
    
    const totalTime = Date.now() - startTime;
    
    return {
      responseTime: totalTime,
      tables: {
        articles: {
          count: articlesCount || 0,
          error: articlesError?.message || null
        },
        users: {
          count: usersCount || 0,
          error: usersError?.message || null
        },
        comments: {
          count: commentsCount || 0,
          error: commentsError?.message || null
        }
      },
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    logger.error('获取数据库指标失败:', error);
    throw error;
  }
}

// 导出默认客户端
export default supabase;