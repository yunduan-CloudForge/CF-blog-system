import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcryptjs';

// 数据库文件路径
const DB_PATH = path.join(process.cwd(), 'blog.db');
const INIT_SQL_PATH = path.join(process.cwd(), 'api', 'database', 'init.sql');
const MIGRATION_SQL_PATH = path.join(process.cwd(), 'api', 'database', 'comment_migration.sql');
const SYSTEM_SETTINGS_MIGRATION_PATH = path.join(process.cwd(), 'api', 'database', 'system_settings_migration.sql');
const LIKES_MIGRATION_PATH = path.join(process.cwd(), 'api', 'database', 'likes_migration.sql');
const ADMIN_MIGRATION_PATH = path.join(process.cwd(), 'api', 'database', 'admin_migration.sql');

let db: Database | null = null;

/**
 * 获取数据库连接
 */
export async function getDatabase(): Promise<Database> {
  if (db) {
    return db;
  }

  try {
    db = await open({
      filename: DB_PATH,
      driver: sqlite3.Database
    });

    // 启用外键约束
    await db.exec('PRAGMA foreign_keys = ON');
    
    console.log('数据库连接成功');
    return db;
  } catch (error) {
    console.error('数据库连接失败:', error);
    throw error;
  }
}

/**
 * 初始化数据库
 */
export async function initializeDatabase(): Promise<void> {
  try {
    const database = await getDatabase();
    
    // 检查是否已经初始化
    const tables = await database.all(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='users'"
    );
    
    if (tables.length > 0) {
      console.log('数据库已经初始化');
      // 检查并执行评论系统迁移
      await runCommentMigration(database);
      // 检查并执行系统设置迁移
      await runSystemSettingsMigration(database);
      // 检查并执行点赞系统迁移
      await runLikesMigration(database);
      // 检查并执行管理员权限系统迁移
      await runAdminMigration(database);
      return;
    }

    console.log('开始初始化数据库...');
    
    // 读取初始化SQL脚本
    const initSQL = fs.readFileSync(INIT_SQL_PATH, 'utf8');
    
    // 执行初始化脚本
    await database.exec(initSQL);
    
    // 生成真实的密码哈希并更新用户表
    await updateUserPasswords(database);
    
    // 执行评论系统迁移
    await runCommentMigration(database);
    
    // 执行系统设置迁移
    await runSystemSettingsMigration(database);
    
    // 执行点赞系统迁移
    await runLikesMigration(database);
    
    // 执行管理员权限系统迁移
    await runAdminMigration(database);
    
    console.log('数据库初始化完成');
  } catch (error) {
    console.error('数据库初始化失败:', error);
    throw error;
  }
}

/**
 * 执行评论系统迁移
 */
async function runCommentMigration(database: Database): Promise<void> {
  try {
    // 检查comment_reports表是否已存在（最新的迁移表）
    const commentReportsTable = await database.all(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='comment_reports'"
    );
    
    if (commentReportsTable.length > 0) {
      console.log('评论系统迁移已完成');
      return;
    }

    console.log('开始执行评论系统迁移...');
    
    // 读取迁移SQL脚本
    const migrationSQL = fs.readFileSync(MIGRATION_SQL_PATH, 'utf8');
    
    // 执行迁移脚本
    await database.exec(migrationSQL);
    
    console.log('评论系统迁移完成');
  } catch (error) {
    console.error('评论系统迁移失败:', error);
    throw error;
  }
}

/**
 * 执行系统设置迁移
 */
async function runSystemSettingsMigration(database: Database): Promise<void> {
  try {
    // 检查system_settings表是否已存在
    const systemSettingsTable = await database.all(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='system_settings'"
    );
    
    if (systemSettingsTable.length > 0) {
      console.log('系统设置迁移已完成');
      return;
    }

    console.log('开始执行系统设置迁移...');
    
    // 读取迁移SQL脚本
    const migrationSQL = fs.readFileSync(SYSTEM_SETTINGS_MIGRATION_PATH, 'utf8');
    
    // 执行迁移脚本
    await database.exec(migrationSQL);
    
    console.log('系统设置迁移完成');
  } catch (error) {
    console.error('系统设置迁移失败:', error);
    throw error;
  }
}

/**
 * 执行点赞系统迁移
 */
async function runLikesMigration(database: Database): Promise<void> {
  try {
    // 检查article_likes表是否已存在
    const articleLikesTable = await database.all(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='article_likes'"
    );
    
    if (articleLikesTable.length > 0) {
      console.log('点赞系统迁移已完成');
      return;
    }

    console.log('开始执行点赞系统迁移...');
    
    // 读取并执行点赞系统迁移脚本
    const migrationSQL = fs.readFileSync(LIKES_MIGRATION_PATH, 'utf8');
    await database.exec(migrationSQL);
    
    console.log('点赞系统迁移已完成');
  } catch (error) {
    console.error('点赞系统迁移失败:', error);
    throw error;
  }
}

/**
 * 执行管理员权限系统迁移
 */
async function runAdminMigration(database: Database): Promise<void> {
  try {
    // 检查是否已经存在权限表
    const tables = await database.all(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='permissions'"
    );
    
    if (tables.length > 0) {
      console.log('管理员权限系统迁移已执行');
      return;
    }
    
    console.log('执行管理员权限系统迁移...');
    const migrationSQL = fs.readFileSync(ADMIN_MIGRATION_PATH, 'utf8');
    await database.exec(migrationSQL);
    console.log('管理员权限系统迁移完成');
  } catch (error) {
    console.error('管理员权限系统迁移失败:', error);
    throw error;
  }
}

/**
 * 更新用户密码哈希
 */
async function updateUserPasswords(database: Database): Promise<void> {
  const users = [
    { email: 'admin@blog.com', password: 'admin123' },
    { email: 'demo@blog.com', password: 'demo123' },
    { email: 'user@blog.com', password: 'user123' }
  ];

  for (const user of users) {
    const hashedPassword = await bcrypt.hash(user.password, 10);
    await database.run(
      'UPDATE users SET password_hash = ? WHERE email = ?',
      [hashedPassword, user.email]
    );
  }
  
  console.log('用户密码哈希更新完成');
}

/**
 * 关闭数据库连接
 */
export async function closeDatabase(): Promise<void> {
  if (db) {
    await db.close();
    db = null;
    console.log('数据库连接已关闭');
  }
}

// 定义数据库操作结果类型
interface DatabaseRunResult {
  lastID?: number;
  changes?: number;
}

interface DatabaseRecord {
  [key: string]: unknown;
  // 常用字段类型提示
  id?: number;
  count?: number;
  total?: number;
  lastID?: number;
  changes?: number;
}

/**
 * 执行数据库查询
 */
export async function query(sql: string, params: unknown[] = []): Promise<DatabaseRecord[]> {
  const database = await getDatabase();
  const result = await database.all(sql, params);
  return result as DatabaseRecord[];
}

/**
 * 执行数据库插入/更新/删除
 */
export async function run(sql: string, params: unknown[] = []): Promise<DatabaseRunResult> {
  const database = await getDatabase();
  const result = await database.run(sql, params);
  return result as DatabaseRunResult;
}

/**
 * 获取单条记录
 */
export async function get(sql: string, params: unknown[] = []): Promise<DatabaseRecord | undefined> {
  const database = await getDatabase();
  const result = await database.get(sql, params);
  return result as DatabaseRecord | undefined;
}