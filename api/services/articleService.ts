import { query, queryOne, execute, beginTransaction, commitTransaction, rollbackTransaction } from '../database/database.js';
import { Article, ArticleWithAuthor, CreateArticleData, UpdateArticleData, ArticleListQuery, ArticleListResponse, Category, Tag } from '../models/Article.js';
import { cache, generateCacheKey, withCache } from './cacheService.js';

// 生成文章slug
const generateSlug = (title: string): string => {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 100);
};

// 确保slug唯一性
const ensureUniqueSlug = async (baseSlug: string, excludeId?: string): Promise<string> => {
  let slug = baseSlug;
  let counter = 1;
  
  while (true) {
    const existingArticle = await queryOne<Article>(
      excludeId 
        ? 'SELECT id FROM articles WHERE slug = ? AND id != ?'
        : 'SELECT id FROM articles WHERE slug = ?',
      excludeId ? [slug, excludeId] : [slug]
    );
    
    if (!existingArticle) {
      return slug;
    }
    
    slug = `${baseSlug}-${counter}`;
    counter++;
  }
};

// 创建文章
export const createArticle = async (authorId: string, articleData: CreateArticleData): Promise<ArticleWithAuthor> => {
  const { title, content, excerpt, category_id, tags = [], status = 'draft' } = articleData;
  
  // 验证分类是否存在
  const category = await queryOne<Category>(
    'SELECT * FROM categories WHERE id = ?',
    [category_id]
  );
  
  if (!category) {
    throw new Error('分类不存在');
  }
  
  // 生成唯一slug
  const baseSlug = generateSlug(title);
  const slug = await ensureUniqueSlug(baseSlug);
  
  const publishedAt = status === 'published' ? new Date().toISOString() : null;
  
  try {
    await beginTransaction();
    
    // 插入文章
    const result = await execute(
      `INSERT INTO articles (author_id, category_id, title, content, excerpt, slug, status, published_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [authorId, category_id, title, content, excerpt, slug, status, publishedAt]
    );
    
    const articleId = await queryOne<{ id: string }>(
      'SELECT id FROM articles WHERE rowid = ?',
      [result.lastID]
    );
    
    if (!articleId) {
      throw new Error('文章创建失败');
    }
    
    // 处理标签
    if (tags.length > 0) {
      for (const tagName of tags) {
        const tagSlug = generateSlug(tagName);
        
        // 创建或获取标签
        await execute(
          'INSERT OR IGNORE INTO tags (name, slug) VALUES (?, ?)',
          [tagName, tagSlug]
        );
        
        const tag = await queryOne<Tag>(
          'SELECT id FROM tags WHERE slug = ?',
          [tagSlug]
        );
        
        if (tag) {
          // 关联文章和标签
          await execute(
            'INSERT OR IGNORE INTO article_tags (article_id, tag_id) VALUES (?, ?)',
            [articleId.id, tag.id]
          );
        }
      }
    }
    
    await commitTransaction();
    
    // 清除相关缓存
    cache.clear(); // 清除所有缓存，因为新文章可能影响列表查询
    
    // 返回创建的文章
    const newArticle = await getArticleById(articleId.id);
    if (!newArticle) {
      throw new Error('文章创建失败');
    }
    
    return newArticle;
  } catch (error) {
    await rollbackTransaction();
    throw error;
  }
};

// 根据ID获取文章（带缓存）
const _getArticleById = async (articleId: string): Promise<ArticleWithAuthor | null> => {
  const article = await queryOne<ArticleWithAuthor>(
    `SELECT 
      a.*,
      u.name as author_name,
      u.email as author_email,
      c.name as category_name,
      c.slug as category_slug,
      c.color as category_color
     FROM articles a
     JOIN users u ON a.author_id = u.id
     JOIN categories c ON a.category_id = c.id
     WHERE a.id = ?`,
    [articleId]
  );
  
  if (article) {
    // 获取文章标签
    const tags = await query<Tag>(
      `SELECT t.* FROM tags t
       JOIN article_tags at ON t.id = at.tag_id
       WHERE at.article_id = ?
       ORDER BY t.name`,
      [articleId]
    );
    (article as any).tags = tags;
  }
  
  return article;
};

export const getArticleById = withCache(
  _getArticleById,
  (articleId: string) => `article:${articleId}`,
  5 * 60 * 1000 // 5分钟缓存
);

// 根据slug获取文章
export const getArticleBySlug = async (slug: string): Promise<ArticleWithAuthor | null> => {
  const article = await queryOne<ArticleWithAuthor>(
    `SELECT 
      a.*,
      u.name as author_name,
      u.email as author_email,
      c.name as category_name,
      c.slug as category_slug,
      c.color as category_color
     FROM articles a
     JOIN users u ON a.author_id = u.id
     JOIN categories c ON a.category_id = c.id
     WHERE a.slug = ?`,
    [slug]
  );
  
  if (article) {
    // 获取文章标签
    const tags = await query<Tag>(
      `SELECT t.* FROM tags t
       JOIN article_tags at ON t.id = at.tag_id
       WHERE at.article_id = ?
       ORDER BY t.name`,
      [article.id]
    );
    (article as any).tags = tags;
    
    // 增加浏览量（异步执行，不影响响应速度）
    setImmediate(async () => {
      try {
        await execute(
          'UPDATE articles SET view_count = view_count + 1 WHERE id = ?',
          [article.id]
        );
        // 清除相关缓存
        cache.delete(`article:${article.id}`);
      } catch (error) {
        console.error('更新浏览量失败:', error);
      }
    });
    article.view_count += 1;
  }
  
  return article;
};

// 获取文章列表（优化版本）
const _getArticles = async (queryParams: ArticleListQuery): Promise<ArticleListResponse> => {
  const {
    page = 1,
    limit = 10,
    category,
    search,
    status,
    author_id,
    tags,
    startDate,
    endDate
  } = queryParams;
  
  const offset = (page - 1) * limit;
  
  let whereConditions: string[] = [];
  let queryValues: any[] = [];
  
  // 构建查询条件
  if (category) {
    whereConditions.push('c.slug = ?');
    queryValues.push(category);
  }
  
  if (status) {
    whereConditions.push('a.status = ?');
    queryValues.push(status);
  } else {
    // 默认只显示已发布的文章
    whereConditions.push('a.status = ?');
    queryValues.push('published');
  }
  
  if (author_id) {
    whereConditions.push('a.author_id = ?');
    queryValues.push(author_id);
  }
  
  if (search) {
    // 使用全文搜索优化搜索性能
    whereConditions.push('a.id IN (SELECT rowid FROM articles_fts WHERE articles_fts MATCH ?)');
    queryValues.push(search);
  }

  // 标签筛选
  if (tags) {
    const tagIds = tags.split(',').filter(id => id.trim());
    if (tagIds.length > 0) {
      const tagPlaceholders = tagIds.map(() => '?').join(',');
      whereConditions.push(`a.id IN (
        SELECT DISTINCT at.article_id 
        FROM article_tags at 
        WHERE at.tag_id IN (${tagPlaceholders})
      )`);
      queryValues.push(...tagIds);
    }
  }

  // 日期范围筛选
  if (startDate) {
    whereConditions.push('DATE(a.published_at) >= DATE(?)');
    queryValues.push(startDate);
  }

  if (endDate) {
    whereConditions.push('DATE(a.published_at) <= DATE(?)');
    queryValues.push(endDate);
  }
  
  const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
  
  // 使用并行查询提高性能
  const [countResult, articles] = await Promise.all([
    // 获取总数
    queryOne<{ total: number }>(`
      SELECT COUNT(*) as total
      FROM articles a
      JOIN users u ON a.author_id = u.id
      JOIN categories c ON a.category_id = c.id
      ${whereClause}
    `, queryValues),
    
    // 获取文章列表
    query<ArticleWithAuthor>(`
      SELECT 
        a.*,
        u.name as author_name,
        u.email as author_email,
        c.name as category_name,
        c.slug as category_slug,
        c.color as category_color
      FROM articles a
      JOIN users u ON a.author_id = u.id
      JOIN categories c ON a.category_id = c.id
      ${whereClause}
      ORDER BY a.published_at DESC, a.created_at DESC
      LIMIT ? OFFSET ?
    `, [...queryValues, limit, offset])
  ]);
  
  const total = countResult?.total || 0;
  const totalPages = Math.ceil(total / limit);
  
  // 批量获取文章标签（避免N+1查询）
  if (articles.length > 0) {
    const articleIds = articles.map(a => a.id);
    const placeholders = articleIds.map(() => '?').join(',');
    
    const articleTags = await query<{article_id: string, tag_id: string, name: string, slug: string, created_at: string}>(`
      SELECT at.article_id, t.id as tag_id, t.name, t.slug, t.created_at
      FROM article_tags at
      JOIN tags t ON at.tag_id = t.id
      WHERE at.article_id IN (${placeholders})
      ORDER BY t.name
    `, articleIds);
    
    // 将标签分组到对应文章
    const tagsMap = new Map<string, Tag[]>();
    articleTags.forEach(tag => {
      if (!tagsMap.has(tag.article_id)) {
        tagsMap.set(tag.article_id, []);
      }
      tagsMap.get(tag.article_id)!.push({
        id: tag.tag_id,
        name: tag.name,
        slug: tag.slug,
        created_at: tag.created_at
      });
    });
    
    // 为每篇文章添加标签
    articles.forEach(article => {
      (article as any).tags = tagsMap.get(article.id) || [];
    });
  }
  
  return {
    articles,
    total,
    page,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1
  };
};

export const getArticles = withCache(
  _getArticles,
  (queryParams: ArticleListQuery) => generateCacheKey('articles', queryParams),
  2 * 60 * 1000 // 2分钟缓存
);

// 更新文章
export const updateArticle = async (articleId: string, authorId: string, updateData: UpdateArticleData): Promise<ArticleWithAuthor> => {
  const { title, content, excerpt, category_id, tags, status } = updateData;
  
  // 检查文章是否存在且属于当前用户
  const existingArticle = await queryOne<Article>(
    'SELECT * FROM articles WHERE id = ? AND author_id = ?',
    [articleId, authorId]
  );
  
  if (!existingArticle) {
    throw new Error('文章不存在或无权限修改');
  }
  
  const updates: string[] = [];
  const values: any[] = [];
  
  if (title !== undefined) {
    updates.push('title = ?');
    values.push(title);
    
    // 更新slug
    const baseSlug = generateSlug(title);
    const slug = await ensureUniqueSlug(baseSlug, articleId);
    updates.push('slug = ?');
    values.push(slug);
  }
  
  if (content !== undefined) {
    updates.push('content = ?');
    values.push(content);
  }
  
  if (excerpt !== undefined) {
    updates.push('excerpt = ?');
    values.push(excerpt);
  }
  
  if (category_id !== undefined) {
    // 验证分类是否存在
    const category = await queryOne<Category>(
      'SELECT * FROM categories WHERE id = ?',
      [category_id]
    );
    
    if (!category) {
      throw new Error('分类不存在');
    }
    
    updates.push('category_id = ?');
    values.push(category_id);
  }
  
  if (status !== undefined) {
    updates.push('status = ?');
    values.push(status);
    
    // 如果状态改为已发布且之前未发布，设置发布时间
    if (status === 'published' && existingArticle.status !== 'published') {
      updates.push('published_at = ?');
      values.push(new Date().toISOString());
    }
  }
  
  if (updates.length === 0 && !tags) {
    throw new Error('没有提供更新数据');
  }
  
  try {
    await beginTransaction();
    
    if (updates.length > 0) {
      updates.push('updated_at = CURRENT_TIMESTAMP');
      values.push(articleId);
      
      await execute(
        `UPDATE articles SET ${updates.join(', ')} WHERE id = ?`,
        values
      );
    }
    
    // 处理标签更新
    if (tags !== undefined) {
      // 删除现有标签关联
      await execute(
        'DELETE FROM article_tags WHERE article_id = ?',
        [articleId]
      );
      
      // 添加新标签
      if (tags.length > 0) {
        for (const tagName of tags) {
          const tagSlug = generateSlug(tagName);
          
          // 创建或获取标签
          await execute(
            'INSERT OR IGNORE INTO tags (name, slug) VALUES (?, ?)',
            [tagName, tagSlug]
          );
          
          const tag = await queryOne<Tag>(
            'SELECT id FROM tags WHERE slug = ?',
            [tagSlug]
          );
          
          if (tag) {
            // 关联文章和标签
            await execute(
              'INSERT OR IGNORE INTO article_tags (article_id, tag_id) VALUES (?, ?)',
              [articleId, tag.id]
            );
          }
        }
      }
    }
    
    await commitTransaction();
    
    // 清除相关缓存
    cache.delete(`article:${articleId}`);
    cache.clear(); // 清除列表缓存，因为更新可能影响排序和筛选
    
    // 返回更新后的文章
    const updatedArticle = await getArticleById(articleId);
    if (!updatedArticle) {
      throw new Error('文章更新失败');
    }
    
    return updatedArticle;
  } catch (error) {
    await rollbackTransaction();
    throw error;
  }
};

// 删除文章
export const deleteArticle = async (articleId: string, authorId: string): Promise<void> => {
  // 检查文章是否存在且属于当前用户
  const existingArticle = await queryOne<Article>(
    'SELECT * FROM articles WHERE id = ? AND author_id = ?',
    [articleId, authorId]
  );
  
  if (!existingArticle) {
    throw new Error('文章不存在或无权限删除');
  }
  
  try {
    await beginTransaction();
    
    // 删除文章标签关联
    await execute(
      'DELETE FROM article_tags WHERE article_id = ?',
      [articleId]
    );
    
    // 删除文章评论
    await execute(
      'DELETE FROM comments WHERE article_id = ?',
      [articleId]
    );
    
    // 删除文章
    await execute(
      'DELETE FROM articles WHERE id = ?',
      [articleId]
    );
    
    await commitTransaction();
    
    // 清除相关缓存
    cache.delete(`article:${articleId}`);
    cache.clear(); // 清除列表缓存
  } catch (error) {
    await rollbackTransaction();
    throw error;
  }
};

// 获取所有分类
export const getCategories = async (): Promise<Category[]> => {
  return await query<Category>(
    'SELECT * FROM categories ORDER BY name'
  );
};

// 获取所有标签
export const getTags = async (): Promise<Tag[]> => {
  return await query<Tag>(
    'SELECT * FROM tags ORDER BY name'
  );
};

// 获取文章的标签
export const getArticleTags = async (articleId: string): Promise<Tag[]> => {
  return await query<Tag>(
    `SELECT t.* FROM tags t
     JOIN article_tags at ON t.id = at.tag_id
     WHERE at.article_id = ?
     ORDER BY t.name`,
    [articleId]
  );
};