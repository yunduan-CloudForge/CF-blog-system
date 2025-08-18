-- 数据库性能优化脚本
-- 第八阶段8.1：性能优化 - 数据库查询优化

-- ============================================
-- 索引优化
-- ============================================

-- 文章表索引优化
-- 已有的基础索引（在init.sql中定义）：
-- CREATE INDEX idx_articles_author_id ON articles(author_id);
-- CREATE INDEX idx_articles_category_id ON articles(category_id);
-- CREATE INDEX idx_articles_status ON articles(status);
-- CREATE INDEX idx_articles_created_at ON articles(created_at DESC);
-- CREATE INDEX idx_articles_views ON articles(views DESC);
-- CREATE INDEX idx_articles_likes ON articles(likes DESC);

-- 添加复合索引以优化常见查询
CREATE INDEX IF NOT EXISTS idx_articles_status_created_at ON articles(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_articles_author_status ON articles(author_id, status);
CREATE INDEX IF NOT EXISTS idx_articles_category_status ON articles(category_id, status);
CREATE INDEX IF NOT EXISTS idx_articles_status_views ON articles(status, views DESC);
CREATE INDEX IF NOT EXISTS idx_articles_status_likes ON articles(status, likes DESC);

-- 全文搜索索引（如果SQLite版本支持FTS5）
-- 注意：这需要SQLite编译时包含FTS5支持
CREATE VIRTUAL TABLE IF NOT EXISTS articles_fts USING fts5(
  title, 
  content, 
  summary,
  content='articles',
  content_rowid='id'
);

-- 创建触发器以保持FTS索引同步
CREATE TRIGGER IF NOT EXISTS articles_fts_insert AFTER INSERT ON articles BEGIN
  INSERT INTO articles_fts(rowid, title, content, summary) 
  VALUES (new.id, new.title, new.content, new.summary);
END;

CREATE TRIGGER IF NOT EXISTS articles_fts_delete AFTER DELETE ON articles BEGIN
  INSERT INTO articles_fts(articles_fts, rowid, title, content, summary) 
  VALUES('delete', old.id, old.title, old.content, old.summary);
END;

CREATE TRIGGER IF NOT EXISTS articles_fts_update AFTER UPDATE ON articles BEGIN
  INSERT INTO articles_fts(articles_fts, rowid, title, content, summary) 
  VALUES('delete', old.id, old.title, old.content, old.summary);
  INSERT INTO articles_fts(rowid, title, content, summary) 
  VALUES (new.id, new.title, new.content, new.summary);
END;

-- 用户表索引优化
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at DESC);

-- 评论表索引优化
CREATE INDEX IF NOT EXISTS idx_comments_article_created ON comments(article_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_user_created ON comments(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_parent_created ON comments(parent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_likes ON comments(likes DESC);

-- 文章标签关联表索引优化
CREATE INDEX IF NOT EXISTS idx_article_tags_tag_id ON article_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_article_tags_article_id ON article_tags(article_id);

-- 标签表索引优化
CREATE INDEX IF NOT EXISTS idx_tags_use_count ON tags(use_count DESC);
CREATE INDEX IF NOT EXISTS idx_tags_name ON tags(name);

-- 分类表索引优化
CREATE INDEX IF NOT EXISTS idx_categories_sort_order ON categories(sort_order);
CREATE INDEX IF NOT EXISTS idx_categories_article_count ON categories(article_count DESC);

-- ============================================
-- 查询优化视图
-- ============================================

-- 文章详情视图（包含作者、分类信息）
CREATE VIEW IF NOT EXISTS v_article_details AS
SELECT 
  a.id,
  a.title,
  a.content,
  a.summary,
  a.status,
  a.cover_image,
  a.views,
  a.likes,
  a.comments_count,
  a.created_at,
  a.updated_at,
  a.publish_time,
  u.id as author_id,
  u.username as author_name,
  u.avatar as author_avatar,
  c.id as category_id,
  c.name as category_name,
  c.icon as category_icon
FROM articles a
LEFT JOIN users u ON a.author_id = u.id
LEFT JOIN categories c ON a.category_id = c.id;

-- 文章列表视图（优化列表查询）
CREATE VIEW IF NOT EXISTS v_article_list AS
SELECT 
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
WHERE a.status = 'published';

-- 用户统计视图
CREATE VIEW IF NOT EXISTS v_user_stats AS
SELECT 
  u.id,
  u.username,
  u.email,
  u.role,
  u.created_at,
  COUNT(a.id) as article_count,
  SUM(CASE WHEN a.status = 'published' THEN 1 ELSE 0 END) as published_count,
  SUM(CASE WHEN a.status = 'draft' THEN 1 ELSE 0 END) as draft_count,
  SUM(a.views) as total_views,
  SUM(a.likes) as total_likes
FROM users u
LEFT JOIN articles a ON u.id = a.author_id
GROUP BY u.id, u.username, u.email, u.role, u.created_at;

-- 分类统计视图
CREATE VIEW IF NOT EXISTS v_category_stats AS
SELECT 
  c.id,
  c.name,
  c.description,
  c.icon,
  c.sort_order,
  COUNT(a.id) as article_count,
  SUM(a.views) as total_views,
  SUM(a.likes) as total_likes,
  MAX(a.created_at) as latest_article_date
FROM categories c
LEFT JOIN articles a ON c.id = a.category_id AND a.status = 'published'
GROUP BY c.id, c.name, c.description, c.icon, c.sort_order;

-- 标签统计视图
CREATE VIEW IF NOT EXISTS v_tag_stats AS
SELECT 
  t.id,
  t.name,
  t.description,
  t.color,
  COUNT(at.article_id) as article_count,
  SUM(a.views) as total_views,
  SUM(a.likes) as total_likes
FROM tags t
LEFT JOIN article_tags at ON t.id = at.tag_id
LEFT JOIN articles a ON at.article_id = a.id AND a.status = 'published'
GROUP BY t.id, t.name, t.description, t.color;

-- ============================================
-- 性能监控表
-- ============================================

-- 查询性能日志表
CREATE TABLE IF NOT EXISTS query_performance_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  query_type VARCHAR(50) NOT NULL,
  query_sql TEXT,
  execution_time_ms INTEGER NOT NULL,
  result_count INTEGER,
  parameters TEXT,
  user_id INTEGER,
  ip_address VARCHAR(45),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_query_perf_type_time ON query_performance_log(query_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_query_perf_execution_time ON query_performance_log(execution_time_ms DESC);

-- 缓存统计表
CREATE TABLE IF NOT EXISTS cache_stats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cache_key VARCHAR(255) NOT NULL,
  hit_count INTEGER DEFAULT 0,
  miss_count INTEGER DEFAULT 0,
  last_hit_at DATETIME,
  last_miss_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_cache_stats_key ON cache_stats(cache_key);
CREATE INDEX IF NOT EXISTS idx_cache_stats_hit_count ON cache_stats(hit_count DESC);

-- ============================================
-- 数据清理和维护
-- ============================================

-- 清理过期的查询性能日志（保留30天）
-- 这个可以通过定时任务执行
-- DELETE FROM query_performance_log WHERE created_at < datetime('now', '-30 days');

-- 更新文章的评论数量（如果评论表存在）
-- UPDATE articles SET comments_count = (
--   SELECT COUNT(*) FROM comments WHERE article_id = articles.id
-- );

-- 更新分类的文章数量
UPDATE categories SET article_count = (
  SELECT COUNT(*) FROM articles WHERE category_id = categories.id AND status = 'published'
);

-- 更新标签的使用次数
UPDATE tags SET use_count = (
  SELECT COUNT(*) FROM article_tags at 
  INNER JOIN articles a ON at.article_id = a.id 
  WHERE at.tag_id = tags.id AND a.status = 'published'
);

-- ============================================
-- 分析和统计查询
-- ============================================

-- 查看表的大小和行数
-- SELECT name, 
--        (SELECT COUNT(*) FROM sqlite_master WHERE type='index' AND tbl_name=m.name) as index_count
-- FROM sqlite_master m WHERE type='table';

-- 查看索引使用情况
-- EXPLAIN QUERY PLAN SELECT * FROM articles WHERE status = 'published' ORDER BY created_at DESC LIMIT 10;

-- 查看最慢的查询
-- SELECT query_type, AVG(execution_time_ms) as avg_time, COUNT(*) as count
-- FROM query_performance_log 
-- WHERE created_at > datetime('now', '-7 days')
-- GROUP BY query_type 
-- ORDER BY avg_time DESC;

-- ============================================
-- 优化建议
-- ============================================

/*
性能优化建议：

1. 索引策略：
   - 为常用的WHERE条件创建索引
   - 为ORDER BY字段创建索引
   - 使用复合索引优化多条件查询
   - 定期分析查询计划，确保索引被正确使用

2. 查询优化：
   - 使用LIMIT限制结果集大小
   - 避免SELECT *，只查询需要的字段
   - 使用EXISTS代替IN子查询
   - 合理使用JOIN，避免N+1查询问题

3. 缓存策略：
   - 对频繁查询的数据进行缓存
   - 使用Redis或内存缓存热点数据
   - 实现查询结果缓存

4. 数据库维护：
   - 定期VACUUM数据库
   - 定期ANALYZE更新统计信息
   - 监控数据库大小和性能
   - 定期清理过期数据

5. 应用层优化：
   - 实现连接池
   - 使用预编译语句
   - 批量操作代替单条操作
   - 异步处理非关键操作
*/