import { db } from '../database/init.js';
import crypto from 'crypto';

export interface SessionInfo {
  id: number;
  userId: string;
  sessionToken: string;
  deviceInfo?: string;
  ipAddress?: string;
  userAgent?: string;
  isActive: boolean;
  lastActivity: string;
  createdAt: string;
  expiresAt: string;
}

export interface CreateSessionData {
  userId: string;
  deviceInfo?: string;
  ipAddress?: string;
  userAgent?: string;
  expiresAt: Date;
}

/**
 * 创建新的用户会话
 */
export async function createSession(sessionData: CreateSessionData): Promise<string> {
  const sessionToken = crypto.randomBytes(32).toString('hex');
  
  const stmt = db.prepare(`
    INSERT INTO user_sessions (
      user_id, session_token, device_info, ip_address, user_agent, expires_at
    ) VALUES (?, ?, ?, ?, ?, ?)
  `);
  
  stmt.run(
    sessionData.userId,
    sessionToken,
    sessionData.deviceInfo || null,
    sessionData.ipAddress || null,
    sessionData.userAgent || null,
    sessionData.expiresAt.toISOString()
  );
  
  return sessionToken;
}

/**
 * 获取用户的所有活跃会话
 */
export async function getUserSessions(userId: string): Promise<SessionInfo[]> {
  const stmt = db.prepare(`
    SELECT * FROM user_sessions 
    WHERE user_id = ? AND is_active = 1 AND expires_at > datetime('now')
    ORDER BY last_activity DESC
  `);
  
  return stmt.all(userId) as SessionInfo[];
}

/**
 * 验证会话token是否有效
 */
export async function validateSession(sessionToken: string): Promise<SessionInfo | null> {
  const stmt = db.prepare(`
    SELECT * FROM user_sessions 
    WHERE session_token = ? AND is_active = 1 AND expires_at > datetime('now')
  `);
  
  const session = stmt.get(sessionToken) as SessionInfo | undefined;
  
  if (session) {
    // 更新最后活动时间
    await updateSessionActivity(sessionToken);
    return session;
  }
  
  return null;
}

/**
 * 更新会话的最后活动时间
 */
export async function updateSessionActivity(sessionToken: string): Promise<void> {
  const stmt = db.prepare(`
    UPDATE user_sessions 
    SET last_activity = datetime('now') 
    WHERE session_token = ?
  `);
  
  stmt.run(sessionToken);
}

/**
 * 终止指定的会话
 */
export async function terminateSession(sessionToken: string): Promise<boolean> {
  const stmt = db.prepare(`
    UPDATE user_sessions 
    SET is_active = 0 
    WHERE session_token = ?
  `);
  
  const result = stmt.run(sessionToken);
  return result.changes > 0;
}

/**
 * 终止用户的所有会话（除了当前会话）
 */
export async function terminateAllUserSessions(userId: string, excludeToken?: string): Promise<number> {
  let stmt;
  let params: any[];
  
  if (excludeToken) {
    stmt = db.prepare(`
      UPDATE user_sessions 
      SET is_active = 0 
      WHERE user_id = ? AND session_token != ?
    `);
    params = [userId, excludeToken];
  } else {
    stmt = db.prepare(`
      UPDATE user_sessions 
      SET is_active = 0 
      WHERE user_id = ?
    `);
    params = [userId];
  }
  
  const result = stmt.run(...params);
  return result.changes;
}

/**
 * 清理过期的会话
 */
export async function cleanupExpiredSessions(): Promise<number> {
  const stmt = db.prepare(`
    DELETE FROM user_sessions 
    WHERE expires_at < datetime('now') OR is_active = 0
  `);
  
  const result = stmt.run();
  return result.changes;
}

/**
 * 获取用户的设备信息摘要
 */
export function getDeviceFingerprint(userAgent?: string, ipAddress?: string): string {
  const deviceInfo = {
    userAgent: userAgent || 'unknown',
    ip: ipAddress || 'unknown'
  };
  
  // 简化的设备指纹，实际应用中可以更复杂
  return crypto.createHash('md5')
    .update(JSON.stringify(deviceInfo))
    .digest('hex')
    .substring(0, 16);
}

/**
 * 启动会话清理定时任务
 */
export function startSessionCleanupTask(): void {
  // 每小时清理一次过期会话
  setInterval(async () => {
    try {
      const cleaned = await cleanupExpiredSessions();
      if (cleaned > 0) {
        console.log(`清理了 ${cleaned} 个过期会话`);
      }
    } catch (error) {
      console.error('清理过期会话失败:', error);
    }
  }, 60 * 60 * 1000); // 1小时
  
  console.log('会话清理定时任务已启动');
}