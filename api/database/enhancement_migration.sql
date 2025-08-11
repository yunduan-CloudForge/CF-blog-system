-- 6.1数据模型优化迁移脚本
-- 优化分类系统、标签系统和文章系统
-- 创建时间: 2024年

-- 启用外键约束
PRAGMA foreign_keys = ON;

-- ========================================
-- 1. 优化分类系统 (categories表)
-- ========================================

-- 添加缺失的字段
ALTER TABLE categories ADD COLUMN icon VARCHAR(100) DEFAULT NULL;
ALTER TABLE categories ADD COLUMN slug VARCHAR(100) DEFAULT NULL;
ALTER TABLE categories ADD COLUMN sort_order INTEGER DEFAULT 0;
ALTER TABLE categories ADD COLUMN article_count INTEGER DEFAULT 0;
ALTER TABLE categories ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP;

-- 创建新索引
CREATE INDEX IF NOT EXISTS idx_categories_slug ON categories(slug);
CREATE INDEX IF NOT EXISTS idx_categories_sort_order ON categories(sort_order);
CREATE INDEX IF NOT EXISTS idx_categories_article_count ON categories(article_count DESC);

-- 更新现有分类数据，添加图标和slug
UPDATE categories SET 
  icon = '💻',
  slug = 'tech',
  sort_order = 1
WHERE name = '技术';

UPDATE categories SET 
  icon = '🌱',
  slug = 'life',
  sort_order = 2
WHERE name = '生活';

UPDATE categories SET 
  icon = '📚',
  slug = 'reading',
  sort_order = 3
WHERE name = '读书';

UPDATE categories SET 
  icon = '✈️',
  slug = 'travel',
  sort_order = 4
WHERE name = '旅行';

-- 创建分类表更新时间触发器
CREATE TRIGGER IF NOT EXISTS update_categories_timestamp 
  AFTER UPDATE ON categories
  FOR EACH ROW
  BEGIN
    UPDATE categories SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
  END;

-- ========================================
-- 2. 优化标签系统 (tags表)
-- ========================================

-- 添加缺失的字段
ALTER TABLE tags ADD COLUMN description TEXT DEFAULT NULL;
ALTER TABLE tags ADD COLUMN slug VARCHAR(50) DEFAULT NULL;
ALTER TABLE tags ADD COLUMN use_count INTEGER DEFAULT 0;
ALTER TABLE tags ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP;

-- 创建新索引
CREATE INDEX IF NOT EXISTS idx_tags_slug ON tags(slug);
CREATE INDEX IF NOT EXISTS idx_tags_use_count ON tags(use_count DESC);
CREATE INDEX IF NOT EXISTS idx_tags_name ON tags(name);

-- 更新现有标签数据，添加描述和slug
UPDATE tags SET 
  description = 'JavaScript编程语言相关技术',
  slug = 'javascript'
WHERE name = 'JavaScript';

UPDATE tags SET 
  description = 'React前端框架相关技术',
  slug = 'react'
WHERE name = 'React';

UPDATE tags SET 
  description = 'TypeScript编程语言相关技术',
  slug = 'typescript'
WHERE name = 'TypeScript';

UPDATE tags SET 
  description = 'Node.js后端技术相关',
  slug = 'nodejs'
WHERE name = 'Node.js';

UPDATE tags SET 
  description = '前端开发技术和最佳实践',
  slug = 'frontend'
WHERE name = '前端';

UPDATE tags SET 
  description = '后端开发技术和架构设计',
  slug = 'backend'
WHERE name = '后端';

UPDATE tags SET 
  description = '数据库设计和优化技术',
  slug = 'database'
WHERE name = '数据库';

UPDATE tags SET 
  description = '算法和数据结构相关内容',
  slug = 'algorithm'
WHERE name = '算法';

UPDATE tags SET 
  description = '软件设计模式和架构',
  slug = 'design-pattern'
WHERE name = '设计模式';

UPDATE tags SET 
  description = '性能优化技巧和方法',
  slug = 'performance'
WHERE name = '性能优化';

UPDATE tags SET 
  description = '开源项目分享和贡献',
  slug = 'opensource'
WHERE name = '开源项目';

UPDATE tags SET 
  description = '学习心得和技术笔记',
  slug = 'notes'
WHERE name = '学习笔记';

-- 创建标签表更新时间触发器
CREATE TRIGGER IF NOT EXISTS update_tags_timestamp 
  AFTER UPDATE ON tags
  FOR EACH ROW
  BEGIN
    UPDATE tags SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
  END;

-- ========================================
-- 3. 优化文章系统 (articles表)
-- ========================================

-- 添加缺失的字段
ALTER TABLE articles ADD COLUMN cover_image VARCHAR(500) DEFAULT NULL;
ALTER TABLE articles ADD COLUMN slug VARCHAR(255) DEFAULT NULL;
ALTER TABLE articles ADD COLUMN is_featured BOOLEAN DEFAULT FALSE;
ALTER TABLE articles ADD COLUMN publish_time DATETIME DEFAULT NULL;
ALTER TABLE articles ADD COLUMN comments_count INTEGER DEFAULT 0;
ALTER TABLE articles ADD COLUMN meta_description TEXT DEFAULT NULL;
ALTER TABLE articles ADD COLUMN meta_keywords TEXT DEFAULT NULL;

-- 创建新索引
CREATE INDEX IF NOT EXISTS idx_articles_slug ON articles(slug);
CREATE INDEX IF NOT EXISTS idx_articles_is_featured ON articles(is_featured);
CREATE INDEX IF NOT EXISTS idx_articles_publish_time ON articles(publish_time DESC);
CREATE INDEX IF NOT EXISTS idx_articles_views ON articles(views DESC);
CREATE INDEX IF NOT EXISTS idx_articles_likes ON articles(likes DESC);
CREATE INDEX IF NOT EXISTS idx_articles_comments_count ON articles(comments_count DESC);

-- 为现有文章生成slug和设置发布时间
UPDATE articles SET 
  slug = 'welcome-to-my-blog',
  publish_time = created_at,
  meta_description = '博客系统的第一篇文章，介绍基本功能和特点',
  meta_keywords = '博客,系统,功能,介绍'
WHERE title = '欢迎来到我的博客';

UPDATE articles SET 
  slug = 'react-best-practices',
  publish_time = created_at,
  meta_description = 'React开发中的最佳实践和经验分享',
  meta_keywords = 'React,最佳实践,前端开发,经验分享'
WHERE title = 'React开发最佳实践';

UPDATE articles SET 
  slug = 'my-reading-notes',
  publish_time = NULL,
  meta_description = '技术书籍推荐和读书心得分享',
  meta_keywords = '读书笔记,技术书籍,学习心得'
WHERE title = '我的读书笔记';

-- ========================================
-- 4. 创建统计更新触发器
-- ========================================

-- 文章数量统计触发器 - 新增文章时
CREATE TRIGGER IF NOT EXISTS update_category_article_count_insert
  AFTER INSERT ON articles
  FOR EACH ROW
  WHEN NEW.category_id IS NOT NULL AND NEW.status = 'published'
  BEGIN
    UPDATE categories 
    SET article_count = article_count + 1 
    WHERE id = NEW.category_id;
  END;

-- 文章数量统计触发器 - 删除文章时
CREATE TRIGGER IF NOT EXISTS update_category_article_count_delete
  AFTER DELETE ON articles
  FOR EACH ROW
  WHEN OLD.category_id IS NOT NULL AND OLD.status = 'published'
  BEGIN
    UPDATE categories 
    SET article_count = article_count - 1 
    WHERE id = OLD.category_id;
  END;

-- 文章数量统计触发器 - 更新文章时
CREATE TRIGGER IF NOT EXISTS update_category_article_count_update
  AFTER UPDATE ON articles
  FOR EACH ROW
  WHEN (OLD.category_id != NEW.category_id) OR (OLD.status != NEW.status)
  BEGIN
    -- 减少旧分类的文章数
    UPDATE categories 
    SET article_count = article_count - 1 
    WHERE id = OLD.category_id AND OLD.status = 'published';
    
    -- 增加新分类的文章数
    UPDATE categories 
    SET article_count = article_count + 1 
    WHERE id = NEW.category_id AND NEW.status = 'published';
  END;

-- 标签使用次数统计触发器 - 新增关联时
CREATE TRIGGER IF NOT EXISTS update_tag_use_count_insert
  AFTER INSERT ON article_tags
  FOR EACH ROW
  BEGIN
    UPDATE tags 
    SET use_count = use_count + 1 
    WHERE id = NEW.tag_id;
  END;

-- 标签使用次数统计触发器 - 删除关联时
CREATE TRIGGER IF NOT EXISTS update_tag_use_count_delete
  AFTER DELETE ON article_tags
  FOR EACH ROW
  BEGIN
    UPDATE tags 
    SET use_count = use_count - 1 
    WHERE id = OLD.tag_id;
  END;

-- 评论数量统计触发器 - 新增评论时
CREATE TRIGGER IF NOT EXISTS update_article_comments_count_insert
  AFTER INSERT ON comments
  FOR EACH ROW
  BEGIN
    UPDATE articles 
    SET comments_count = comments_count + 1 
    WHERE id = NEW.article_id;
  END;

-- 评论数量统计触发器 - 删除评论时
CREATE TRIGGER IF NOT EXISTS update_article_comments_count_delete
  AFTER DELETE ON comments
  FOR EACH ROW
  BEGIN
    UPDATE articles 
    SET comments_count = comments_count - 1 
    WHERE id = OLD.article_id;
  END;

-- ========================================
-- 5. 初始化统计数据
-- ========================================

-- 更新现有分类的文章数量
UPDATE categories 
SET article_count = (
  SELECT COUNT(*) 
  FROM articles 
  WHERE articles.category_id = categories.id 
    AND articles.status = 'published'
);

-- 更新现有标签的使用次数
UPDATE tags 
SET use_count = (
  SELECT COUNT(*) 
  FROM article_tags 
  WHERE article_tags.tag_id = tags.id
);

-- 更新现有文章的评论数量
UPDATE articles 
SET comments_count = (
  SELECT COUNT(*) 
  FROM comments 
  WHERE comments.article_id = articles.id
);

-- ========================================
-- 6. 验证迁移结果
-- ========================================

-- ========================================
-- 5. 创建UNIQUE索引 (在数据更新后)
-- ========================================

-- 为分类slug创建唯一索引
CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_slug_unique ON categories(slug) WHERE slug IS NOT NULL;

-- 为标签slug创建唯一索引
CREATE UNIQUE INDEX IF NOT EXISTS idx_tags_slug_unique ON tags(slug) WHERE slug IS NOT NULL;

-- 为文章slug创建唯一索引
CREATE UNIQUE INDEX IF NOT EXISTS idx_articles_slug_unique ON articles(slug) WHERE slug IS NOT NULL;

-- 验证分类表结构
-- PRAGMA table_info(categories);

-- 验证标签表结构
-- PRAGMA table_info(tags);

-- 验证文章表结构
-- PRAGMA table_info(articles);

-- 验证统计数据
-- SELECT name, article_count FROM categories;
-- SELECT name, use_count FROM tags ORDER BY use_count DESC;
-- SELECT title, comments_count FROM articles;

PRAGMA foreign_keys = OFF;