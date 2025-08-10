-- 数据库索引优化迁移
-- 创建时间: 2024-01-20
-- 目的: 优化查询性能，添加复合索引和优化现有索引

-- 1. 为articles表添加复合索引，优化分类和时间查询
CREATE INDEX IF NOT EXISTS idx_articles_category_published 
  ON articles(category_id, published_at DESC) 
  WHERE status = 'published';

-- 2. 为articles表添加复合索引，优化作者和状态查询
CREATE INDEX IF NOT EXISTS idx_articles_author_status 
  ON articles(author_id, status, published_at DESC);

-- 3. 为articles表添加复合索引，优化搜索查询
CREATE INDEX IF NOT EXISTS idx_articles_search 
  ON articles(status, published_at DESC) 
  WHERE status = 'published';

-- 4. 为comments表添加复合索引，优化文章评论查询
CREATE INDEX IF NOT EXISTS idx_comments_article_status 
  ON comments(article_id, status, created_at DESC);

-- 5. 为comments表添加复合索引，优化用户评论查询
CREATE INDEX IF NOT EXISTS idx_comments_user_status 
  ON comments(user_id, status, created_at DESC);

-- 6. 为article_tags表添加覆盖索引，优化标签查询
CREATE INDEX IF NOT EXISTS idx_article_tags_covering 
  ON article_tags(tag_id, article_id);

-- 7. 为users表添加角色索引，优化权限查询
CREATE INDEX IF NOT EXISTS idx_users_role_created 
  ON users(role, created_at DESC);

-- 8. 为categories表添加名称索引，优化分类查询
CREATE INDEX IF NOT EXISTS idx_categories_name 
  ON categories(name);

-- 9. 为tags表添加名称索引，优化标签查询
CREATE INDEX IF NOT EXISTS idx_tags_name 
  ON tags(name);

-- 10. 优化全文搜索表的触发器
-- 删除旧的触发器（如果存在）
DROP TRIGGER IF EXISTS articles_fts_insert;
DROP TRIGGER IF EXISTS articles_fts_update;
DROP TRIGGER IF EXISTS articles_fts_delete;

-- 创建新的全文搜索触发器
CREATE TRIGGER articles_fts_insert AFTER INSERT ON articles BEGIN
  INSERT INTO articles_fts(rowid, title, content) 
  VALUES (new.rowid, new.title, new.content);
END;

CREATE TRIGGER articles_fts_update AFTER UPDATE ON articles BEGIN
  UPDATE articles_fts SET title = new.title, content = new.content 
  WHERE rowid = new.rowid;
END;

CREATE TRIGGER articles_fts_delete AFTER DELETE ON articles BEGIN
  DELETE FROM articles_fts WHERE rowid = old.rowid;
END;

-- 11. 创建视图优化常用查询
CREATE VIEW IF NOT EXISTS v_published_articles AS
SELECT 
  a.id,
  a.title,
  a.excerpt,
  a.slug,
  a.view_count,
  a.published_at,
  a.created_at,
  u.name as author_name,
  u.email as author_email,
  c.name as category_name,
  c.slug as category_slug,
  c.color as category_color
FROM articles a
JOIN users u ON a.author_id = u.id
JOIN categories c ON a.category_id = c.id
WHERE a.status = 'published'
ORDER BY a.published_at DESC;

-- 12. 创建文章统计视图
CREATE VIEW IF NOT EXISTS v_article_stats AS
SELECT 
  c.id as category_id,
  c.name as category_name,
  COUNT(a.id) as article_count,
  SUM(a.view_count) as total_views
FROM categories c
LEFT JOIN articles a ON c.id = a.category_id AND a.status = 'published'
GROUP BY c.id, c.name;

-- 13. 分析表统计信息（SQLite特定）
ANALYZE;

-- 14. 创建性能监控表
CREATE TABLE IF NOT EXISTS query_performance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  query_type VARCHAR(50) NOT NULL,
  execution_time_ms INTEGER NOT NULL,
  query_params TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_query_performance_type_time 
  ON query_performance(query_type, created_at DESC);

-- 15. 创建缓存表
CREATE TABLE IF NOT EXISTS query_cache (
  cache_key VARCHAR(255) PRIMARY KEY,
  cache_value TEXT NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_query_cache_expires 
  ON query_cache(expires_at);

-- 优化完成提示
SELECT 'Database index optimization completed successfully!' as message;