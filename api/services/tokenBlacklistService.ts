import { db } from '../database/init.js';
import crypto from 'crypto';

// 内存黑名单缓存（用于快速查询）
const blacklistCache = new Set<string>();
let lastCacheUpdate = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5分钟缓存

/**
 * 将token添加到黑名单
 */
export const addToBlacklist = async (token: string, expiresAt: Date, reason = 'logout'): Promise<void> => {
  try {
    const tokenHash = hashToken(token);
    
    // 添加到数据库
    return new Promise((resolve, reject) => {
      db.run(
        'INSERT OR IGNORE INTO token_blacklist (token_hash, expires_at, reason) VALUES (?, ?, ?)',
        [tokenHash, expiresAt.toISOString(), reason],
        function(err) {
          if (err) {
            console.error('添加token到黑名单失败:', err);
            reject(new Error('添加token到黑名单失败'));
            return;
          }
          
          // 添加到内存缓存
          blacklistCache.add(tokenHash);
          
          console.log(`Token已添加到黑名单: ${reason}`);
          resolve();
        }
      );
    });
  } catch (error) {
    console.error('黑名单服务错误:', error);
    throw error;
  }
};

/**
 * 检查token是否在黑名单中
 */
export const isTokenBlacklisted = async (token: string): Promise<boolean> => {
  try {
    const tokenHash = hashToken(token);
    
    // 先检查内存缓存
    if (blacklistCache.has(tokenHash)) {
      return true;
    }
    
    // 查询数据库
    return new Promise((resolve) => {
      db.get(
        'SELECT expires_at FROM token_blacklist WHERE token_hash = ?',
        [tokenHash],
        (err, row: any) => {
          if (err) {
            console.error('查询黑名单失败:', err);
            resolve(false); // 查询失败时假设token有效
            return;
          }
          
          if (row) {
            const expiresAt = new Date(row.expires_at);
            if (expiresAt > new Date()) {
              // token仍在黑名单中且未过期
              blacklistCache.add(tokenHash);
              resolve(true);
              return;
            }
          }
          
          resolve(false);
        }
      );
    });
  } catch (error) {
    console.error('检查黑名单时发生错误:', error);
    return false; // 出错时假设token有效
  }
};

/**
 * 刷新内存缓存
 */
export const refreshCache = async (): Promise<void> => {
  try {
    return new Promise((resolve) => {
      db.all(
        'SELECT token_hash FROM token_blacklist WHERE expires_at > ?',
        [new Date().toISOString()],
        (err, rows: any[]) => {
          if (err) {
            console.error('刷新缓存失败:', err);
            resolve();
            return;
          }
          
          // 清空并重建缓存
          blacklistCache.clear();
          rows.forEach(row => {
            blacklistCache.add(row.token_hash);
          });
          
          lastCacheUpdate = Date.now();
          console.log(`缓存已刷新，包含 ${rows.length} 个黑名单token`);
          resolve();
        }
      );
    });
  } catch (error) {
    console.error('刷新缓存时发生错误:', error);
  }
};

/**
 * 清理过期的黑名单记录
 */
export const cleanupExpiredTokens = async (): Promise<void> => {
  try {
    return new Promise((resolve) => {
      db.run(
        'DELETE FROM token_blacklist WHERE expires_at < ?',
        [new Date().toISOString()],
        function(err) {
          if (err) {
            console.error('清理过期token失败:', err);
            resolve();
            return;
          }
          
          console.log(`过期的黑名单token已清理，删除了 ${this.changes} 条记录`);
          
          // 刷新缓存
          refreshCache().then(() => resolve());
        }
      );
    });
  } catch (error) {
    console.error('清理过期token时发生错误:', error);
  }
};

/**
 * 对token进行哈希处理（用于存储）
 */
function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * 启动定时清理任务
 */
export const startCleanupTask = (): void => {
  // 定期清理过期token（每小时执行一次）
  setInterval(cleanupExpiredTokens, 60 * 60 * 1000);
  
  // 初始化时刷新缓存
  refreshCache();
  
  console.log('Token黑名单清理任务已启动');
};

// 自动启动清理任务
startCleanupTask();