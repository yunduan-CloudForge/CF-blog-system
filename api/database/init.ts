import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 数据库文件路径
const DB_PATH = path.join(__dirname, '../../data/blog.db');

// 创建数据库连接
export const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to SQLite database.');
  }
});

// 初始化数据库表结构
export const initDatabase = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // 创建用户表
      db.run(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
          email VARCHAR(255) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          salt VARCHAR(64),
          name VARCHAR(100) NOT NULL,
          avatar_url TEXT,
          bio TEXT,
          role VARCHAR(20) DEFAULT 'reader' CHECK (role IN ('admin', 'author', 'reader')),
          password_updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // 创建用户表索引
      db.run('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)');
      db.run('CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)');

      // 创建分类表
      db.run(`
        CREATE TABLE IF NOT EXISTS categories (
          id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
          name VARCHAR(100) UNIQUE NOT NULL,
          slug VARCHAR(100) UNIQUE NOT NULL,
          description TEXT,
          color VARCHAR(7) DEFAULT '#2563eb',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // 创建分类表索引
      db.run('CREATE INDEX IF NOT EXISTS idx_categories_slug ON categories(slug)');

      // 创建文章表
      db.run(`
        CREATE TABLE IF NOT EXISTS articles (
          id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
          author_id TEXT NOT NULL,
          category_id TEXT NOT NULL,
          title VARCHAR(255) NOT NULL,
          content TEXT NOT NULL,
          excerpt TEXT,
          slug VARCHAR(255) UNIQUE NOT NULL,
          status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
          view_count INTEGER DEFAULT 0,
          published_at DATETIME,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // 创建文章表索引
      db.run('CREATE INDEX IF NOT EXISTS idx_articles_author_id ON articles(author_id)');
      db.run('CREATE INDEX IF NOT EXISTS idx_articles_category_id ON articles(category_id)');
      db.run('CREATE INDEX IF NOT EXISTS idx_articles_status ON articles(status)');
      db.run('CREATE INDEX IF NOT EXISTS idx_articles_published_at ON articles(published_at DESC)');
      db.run('CREATE INDEX IF NOT EXISTS idx_articles_slug ON articles(slug)');

      // 创建标签表
      db.run(`
        CREATE TABLE IF NOT EXISTS tags (
          id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
          name VARCHAR(50) UNIQUE NOT NULL,
          slug VARCHAR(50) UNIQUE NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // 创建文章标签关联表
      db.run(`
        CREATE TABLE IF NOT EXISTS article_tags (
          article_id TEXT NOT NULL,
          tag_id TEXT NOT NULL,
          PRIMARY KEY (article_id, tag_id)
        )
      `);

      // 创建标签表索引
      db.run('CREATE INDEX IF NOT EXISTS idx_tags_slug ON tags(slug)');
      db.run('CREATE INDEX IF NOT EXISTS idx_article_tags_article_id ON article_tags(article_id)');
      db.run('CREATE INDEX IF NOT EXISTS idx_article_tags_tag_id ON article_tags(tag_id)');

      // 创建评论表
      db.run(`
        CREATE TABLE IF NOT EXISTS comments (
          id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
          article_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          parent_id TEXT,
          content TEXT NOT NULL,
          status VARCHAR(20) DEFAULT 'approved' CHECK (status IN ('pending', 'approved', 'rejected')),
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // 创建评论表索引
      db.run('CREATE INDEX IF NOT EXISTS idx_comments_article_id ON comments(article_id)');
      db.run('CREATE INDEX IF NOT EXISTS idx_comments_user_id ON comments(user_id)');
      db.run('CREATE INDEX IF NOT EXISTS idx_comments_parent_id ON comments(parent_id)');
      db.run('CREATE INDEX IF NOT EXISTS idx_comments_created_at ON comments(created_at DESC)');

      // 创建token黑名单表
      db.run(`
        CREATE TABLE IF NOT EXISTS token_blacklist (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          token_hash VARCHAR(255) UNIQUE NOT NULL,
          expires_at DATETIME NOT NULL,
          reason VARCHAR(100) DEFAULT 'logout',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // 创建token黑名单表索引
      db.run('CREATE INDEX IF NOT EXISTS idx_token_blacklist_hash ON token_blacklist(token_hash)');
      db.run('CREATE INDEX IF NOT EXISTS idx_token_blacklist_expires ON token_blacklist(expires_at)');

      // 创建用户会话表
      db.run(`
        CREATE TABLE IF NOT EXISTS user_sessions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id TEXT NOT NULL,
          session_token TEXT NOT NULL UNIQUE,
          device_info TEXT,
          ip_address TEXT,
          user_agent TEXT,
          is_active BOOLEAN DEFAULT 1,
          last_activity DATETIME DEFAULT CURRENT_TIMESTAMP,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          expires_at DATETIME NOT NULL,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `);

      // 为user_sessions表创建索引
      db.run('CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id)');
      db.run('CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(session_token)');
      db.run('CREATE INDEX IF NOT EXISTS idx_user_sessions_active ON user_sessions(is_active)');
      db.run('CREATE INDEX IF NOT EXISTS idx_user_sessions_expires ON user_sessions(expires_at)');

      // 创建全文搜索表
      db.run(`
        CREATE VIRTUAL TABLE IF NOT EXISTS articles_fts USING fts5(
          title, content, content='articles', content_rowid='rowid'
        )
      `);

      // 插入初始分类数据
      const categories = [
        { name: '技术', description: '技术相关文章' },
        { name: '生活', description: '生活感悟分享' },
        { name: '随笔', description: '随心所欲的文字' }
      ];

      for (const category of categories) {
        db.prepare(`
          INSERT OR IGNORE INTO categories (name, description)
          VALUES (?, ?)
        `).run(category.name, category.description);
      }

      // 创建默认管理员账号
      const adminEmail = 'admin@blog.com';
      const adminPassword = 'admin123';
      const hashedPassword = bcrypt.hashSync(adminPassword, 10);
      
      db.prepare(`
        INSERT OR IGNORE INTO users (email, password_hash, name, role)
        VALUES (?, ?, ?, ?)
      `).run(adminEmail, hashedPassword, 'admin', 'admin');

      console.log('数据库初始化完成');
      console.log('默认管理员账号: admin@blog.com / admin123');
      resolve();
    });
    
    db.on('error', (err) => {
      reject(err);
    });
  });
};

// 关闭数据库连接
export const closeDatabase = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    db.close((err) => {
      if (err) {
        console.error('Error closing database:', err.message);
        reject(err);
      } else {
        console.log('Database connection closed.');
        resolve();
      }
    });
  });
};