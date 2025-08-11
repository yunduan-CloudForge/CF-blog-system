-- 评论系统模块4.1数据库迁移脚本
-- 添加评论点赞表和相关索引
-- 创建时间: 2024年

-- 启用外键约束
PRAGMA foreign_keys = ON;

-- 创建评论点赞表
CREATE TABLE comment_likes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  comment_id INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, comment_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE
);

-- 创建评论点赞表索引
CREATE INDEX idx_comment_likes_user_id ON comment_likes(user_id);
CREATE INDEX idx_comment_likes_comment_id ON comment_likes(comment_id);

-- 为现有评论表添加复合索引以优化查询性能
CREATE INDEX idx_comments_article_parent ON comments(article_id, parent_id);
CREATE INDEX idx_comments_article_created ON comments(article_id, created_at DESC);

-- 验证表结构
-- SELECT name FROM sqlite_master WHERE type='table' AND name='comment_likes';
-- SELECT sql FROM sqlite_master WHERE type='index' AND tbl_name='comment_likes';
-- SELECT sql FROM sqlite_master WHERE type='index' AND tbl_name='comments';