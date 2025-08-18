-- 博客系统数据库初始化脚本
-- 创建时间: 2024年

-- 启用外键约束
PRAGMA foreign_keys = ON;

-- 创建用户表
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  username VARCHAR(100) NOT NULL,
  avatar VARCHAR(255) DEFAULT NULL,
  bio TEXT DEFAULT NULL,
  role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('user', 'author', 'admin')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 创建用户表索引
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);

-- 创建分类表
CREATE TABLE categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name VARCHAR(100) UNIQUE NOT NULL,
  description TEXT DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 创建标签表
CREATE TABLE tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name VARCHAR(50) UNIQUE NOT NULL,
  color VARCHAR(7) DEFAULT '#3B82F6',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 创建文章表
CREATE TABLE articles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  summary TEXT DEFAULT NULL,
  author_id INTEGER NOT NULL,
  category_id INTEGER DEFAULT NULL,
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  views INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
);

-- 创建文章表索引
CREATE INDEX idx_articles_author_id ON articles(author_id);
CREATE INDEX idx_articles_category_id ON articles(category_id);
CREATE INDEX idx_articles_status ON articles(status);
CREATE INDEX idx_articles_created_at ON articles(created_at DESC);

-- 创建文章标签关联表
CREATE TABLE article_tags (
  article_id INTEGER NOT NULL,
  tag_id INTEGER NOT NULL,
  PRIMARY KEY (article_id, tag_id),
  FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

-- 创建评论表
CREATE TABLE comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content TEXT NOT NULL,
  user_id INTEGER NOT NULL,
  article_id INTEGER NOT NULL,
  parent_id INTEGER DEFAULT NULL,
  likes INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_id) REFERENCES comments(id) ON DELETE CASCADE
);

-- 创建评论表索引
CREATE INDEX idx_comments_user_id ON comments(user_id);
CREATE INDEX idx_comments_article_id ON comments(article_id);
CREATE INDEX idx_comments_parent_id ON comments(parent_id);
CREATE INDEX idx_comments_created_at ON comments(created_at DESC);

-- 初始化分类数据
INSERT INTO categories (name, description) VALUES
('技术', '技术相关文章'),
('生活', '生活感悟和日常'),
('读书', '读书笔记和书评'),
('旅行', '旅行游记和攻略');

-- 初始化标签数据
INSERT INTO tags (name, color) VALUES
('JavaScript', '#F7DF1E'),
('React', '#61DAFB'),
('TypeScript', '#3178C6'),
('Node.js', '#339933'),
('前端', '#FF6B6B'),
('后端', '#4ECDC4'),
('数据库', '#FF9500'),
('算法', '#8E44AD'),
('设计模式', '#2ECC71'),
('性能优化', '#E74C3C'),
('开源项目', '#34495E'),
('学习笔记', '#95A5A6');

-- 创建默认用户账号
-- 注意：这里的密码哈希需要在应用程序中生成
-- 密码: admin123, demo123, user123
INSERT INTO users (email, password_hash, username, role, bio) VALUES
('admin@blog.com', '$2b$10$placeholder_hash_for_admin123', 'Admin', 'admin', '系统管理员'),
('demo@blog.com', '$2b$10$placeholder_hash_for_demo123', 'Demo用户', 'author', '演示博主账号'),
('user@blog.com', '$2b$10$placeholder_hash_for_user123', '普通用户', 'user', '普通注册用户');

-- 创建更新时间触发器
CREATE TRIGGER update_users_updated_at
  AFTER UPDATE ON users
  FOR EACH ROW
  BEGIN
    UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
  END;

CREATE TRIGGER update_articles_updated_at
  AFTER UPDATE ON articles
  FOR EACH ROW
  BEGIN
    UPDATE articles SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
  END;

CREATE TRIGGER update_comments_updated_at
  AFTER UPDATE ON comments
  FOR EACH ROW
  BEGIN
    UPDATE comments SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
  END;