/**
 * 文章管理API路由
 * 处理文章的CRUD操作、分页、搜索等功能
 */
import { Router, type Request, type Response } from 'express';
import { query, run, get } from '../database/connection';
import { authMiddleware } from '../middleware/auth';
import { logDetailedAction } from '../middleware/logger';

const router = Router();

/**
 * 获取文章列表
 * GET /api/articles
 * 支持分页、搜索、筛选
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      page = 1,
      limit = 10,
      search = '',
      category = '',
      tag = '',
      status = '',
      author = ''
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;

    // 构建查询条件
    const whereConditions: string[] = [];
    const queryParams: unknown[] = [];

    // 状态筛选
    if (status && status !== 'all') {
      whereConditions.push('a.status = ?');
      queryParams.push(status);
    }

    // 搜索条件
    if (search) {
      whereConditions.push('(a.title LIKE ? OR a.content LIKE ? OR a.summary LIKE ?)');
      const searchTerm = `%${search}%`;
      queryParams.push(searchTerm, searchTerm, searchTerm);
    }

    // 分类筛选
    if (category) {
      whereConditions.push('a.category_id = ?');
      queryParams.push(category);
    }

    // 作者筛选
    if (author) {
      whereConditions.push('a.author_id = ?');
      queryParams.push(author);
    }

    // 标签筛选
    let tagJoin = '';
    if (tag) {
      tagJoin = 'INNER JOIN article_tags at ON a.id = at.article_id';
      whereConditions.push('at.tag_id = ?');
      queryParams.push(tag);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // 获取文章列表
    const articlesQuery = `
      SELECT DISTINCT
        a.id,
        a.title,
        a.summary,
        a.status,
        a.views,
        a.likes,
        a.created_at,
        a.updated_at,
        u.username as author_name,
        u.avatar as author_avatar,
        c.name as category_name,
        c.id as category_id
      FROM articles a
      LEFT JOIN users u ON a.author_id = u.id
      LEFT JOIN categories c ON a.category_id = c.id
      ${tagJoin}
      ${whereClause}
      ORDER BY a.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const articles = await query(articlesQuery, [...queryParams, limitNum, offset]);

    // 获取每篇文章的标签
    for (const article of articles as Array<{ id: number; tags?: unknown[] }>) {
      const tags = await query(`
        SELECT t.id, t.name, t.color
        FROM tags t
        INNER JOIN article_tags at ON t.id = at.tag_id
        WHERE at.article_id = ?
      `, [article.id]);
      article.tags = tags;
    }

    // 获取总数
    const countQuery = `
      SELECT COUNT(DISTINCT a.id) as total
      FROM articles a
      LEFT JOIN users u ON a.author_id = u.id
      LEFT JOIN categories c ON a.category_id = c.id
      ${tagJoin}
      ${whereClause}
    `;

    const countResult = await get(countQuery, queryParams);
    const total = countResult?.total || 0;
    const totalPages = Math.ceil(total / limitNum);

    res.json({
      success: true,
      message: '获取文章列表成功',
      data: {
        articles,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages
        }
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('获取文章列表错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * 获取文章统计数据
 * GET /api/articles/stats
 * 支持按作者筛选
 * 注意：这个路由必须放在 /:id 路由之前，避免 'stats' 被当作文章ID处理
 */
router.get('/stats', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { author } = req.query;
    const userId = req.user?.userId;
    
    // 如果指定了作者ID，检查权限（只能查看自己的统计或管理员权限）
    const targetAuthorId = author ? parseInt(author as string) : userId;
    if (targetAuthorId !== userId) {
      // 这里可以添加管理员权限检查
      const user = await get('SELECT role FROM users WHERE id = ?', [userId]);
      if (!user || user.role !== 'admin') {
        res.status(403).json({
          success: false,
          message: '无权限查看其他用户的统计数据',
          timestamp: new Date().toISOString()
        });
        return;
      }
    }

    // 获取基础统计数据
    const basicStats = await get(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END) as published,
        SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) as draft,
        SUM(CASE WHEN status = 'archived' THEN 1 ELSE 0 END) as archived,
        SUM(views) as totalViews,
        SUM(likes) as totalLikes
      FROM articles 
      WHERE author_id = ?
    `, [targetAuthorId]);

    // 获取评论统计（如果有评论表的话）
    let totalComments = 0;
    try {
      const commentStats = await get(`
        SELECT COUNT(*) as total
        FROM comments c
        INNER JOIN articles a ON c.article_id = a.id
        WHERE a.author_id = ?
      `, [targetAuthorId]);
      totalComments = commentStats?.total || 0;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (_error) {
      // 如果评论表不存在，忽略错误
      console.log('评论表可能不存在，跳过评论统计');
    }

    // 获取最近30天的文章发布趋势
    const trendData = await query(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as count
      FROM articles 
      WHERE author_id = ? 
        AND created_at >= datetime('now', '-30 days')
        AND status = 'published'
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `, [targetAuthorId]);

    // 获取分类分布
    const categoryStats = await query(`
      SELECT 
        c.name as category_name,
        COUNT(a.id) as article_count
      FROM categories c
      LEFT JOIN articles a ON c.id = a.category_id AND a.author_id = ?
      WHERE a.id IS NOT NULL
      GROUP BY c.id, c.name
      ORDER BY article_count DESC
    `, [targetAuthorId]);

    // 获取热门文章（按浏览量排序）
    const popularArticles = await query(`
      SELECT 
        id,
        title,
        views,
        likes,
        created_at
      FROM articles 
      WHERE author_id = ? AND status = 'published'
      ORDER BY views DESC
      LIMIT 5
    `, [targetAuthorId]);

    const stats = {
      total: basicStats?.total || 0,
      published: basicStats?.published || 0,
      draft: basicStats?.draft || 0,
      archived: basicStats?.archived || 0,
      totalViews: basicStats?.totalViews || 0,
      totalLikes: basicStats?.totalLikes || 0,
      totalComments,
      trendData,
      categoryStats,
      popularArticles
    };

    res.json({
      success: true,
      message: '获取统计数据成功',
      data: stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('获取统计数据错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * 获取单篇文章详情
 * GET /api/articles/:id
 */
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // 获取文章详情
    const article = await get(`
      SELECT 
        a.*,
        u.username as author_name,
        u.avatar as author_avatar,
        u.bio as author_bio,
        c.name as category_name
      FROM articles a
      LEFT JOIN users u ON a.author_id = u.id
      LEFT JOIN categories c ON a.category_id = c.id
      WHERE a.id = ?
    `, [id]);

    if (!article) {
      res.status(404).json({
        success: false,
        message: '文章不存在',
        timestamp: new Date().toISOString()
      });
      return;
    }

    // 获取文章标签
    const tags = await query(`
      SELECT t.id, t.name, t.color
      FROM tags t
      INNER JOIN article_tags at ON t.id = at.tag_id
      WHERE at.article_id = ?
    `, [id]);
    article.tags = tags;

    // 增加浏览量
    await run('UPDATE articles SET views = views + 1 WHERE id = ?', [id]);
    article.views = (article.views as number) + 1;

    res.json({
      success: true,
      message: '获取文章详情成功',
      data: { article },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('获取文章详情错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * 创建文章
 * POST /api/articles
 */
router.post('/', authMiddleware, logDetailedAction('create_article', 'articles'), async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as { user: { userId: number } }).user.userId;
    const { title, content, summary, status = 'draft', category_id, tag_ids = [] } = req.body;

    // 验证必填字段
    if (!title || !content) {
      res.status(400).json({
        success: false,
        message: '标题和内容不能为空',
        timestamp: new Date().toISOString()
      });
      return;
    }

    // 创建文章
    const result = await run(`
      INSERT INTO articles (title, content, summary, author_id, category_id, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [title, content, summary, userId, category_id || null, status]);

    const articleId = result.lastID;

    // 添加标签关联
    if (tag_ids && tag_ids.length > 0) {
      for (const tagId of tag_ids) {
        await run('INSERT INTO article_tags (article_id, tag_id) VALUES (?, ?)', [articleId, tagId]);
      }
    }

    // 获取创建后的文章数据
    const createdArticle = await get(`
      SELECT 
        a.*,
        u.username as author_name,
        u.avatar as author_avatar,
        c.name as category_name
      FROM articles a
      LEFT JOIN users u ON a.author_id = u.id
      LEFT JOIN categories c ON a.category_id = c.id
      WHERE a.id = ?
    `, [articleId]);

    // 获取文章标签
    const articleTags = await query(`
      SELECT t.id, t.name, t.color
      FROM tags t
      JOIN article_tags at ON t.id = at.tag_id
      WHERE at.article_id = ?
    `, [articleId]);

    const articleWithTags = {
      ...createdArticle,
      author: {
        id: createdArticle.author_id,
        username: createdArticle.author_name,
        avatar: createdArticle.author_avatar
      },
      category: createdArticle.category_id ? {
        id: createdArticle.category_id,
        name: createdArticle.category_name
      } : null,
      tags: articleTags
    };

    res.status(201).json({
      success: true,
      message: '文章创建成功',
      data: articleWithTags,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('创建文章错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * 更新文章
 * PUT /api/articles/:id
 */
router.put('/:id', authMiddleware, logDetailedAction('update_article', 'articles'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = (req as { user: { userId: number; role: string } }).user.userId;
    const userRole = (req as { user: { userId: number; role: string } }).user.role;
    const { title, content, summary, status, category_id, tag_ids = [] } = req.body;

    // 检查文章是否存在
    const article = await get('SELECT author_id FROM articles WHERE id = ?', [id]);
    if (!article) {
      res.status(404).json({
        success: false,
        message: '文章不存在',
        timestamp: new Date().toISOString()
      });
      return;
    }

    // 检查权限
    if (userRole !== 'admin' && article.author_id !== userId) {
      res.status(403).json({
        success: false,
        message: '没有权限编辑此文章',
        timestamp: new Date().toISOString()
      });
      return;
    }

    // 更新文章
    await run(`
      UPDATE articles 
      SET title = ?, content = ?, summary = ?, status = ?, category_id = ?
      WHERE id = ?
    `, [title, content, summary, status, category_id || null, id]);

    // 更新标签关联
    await run('DELETE FROM article_tags WHERE article_id = ?', [id]);
    if (tag_ids && tag_ids.length > 0) {
      for (const tagId of tag_ids) {
        await run('INSERT INTO article_tags (article_id, tag_id) VALUES (?, ?)', [id, tagId]);
      }
    }

    // 获取更新后的文章数据
    const updatedArticle = await get(`
      SELECT 
        a.*,
        u.username as author_name,
        u.avatar as author_avatar,
        c.name as category_name
      FROM articles a
      LEFT JOIN users u ON a.author_id = u.id
      LEFT JOIN categories c ON a.category_id = c.id
      WHERE a.id = ?
    `, [id]);

    // 获取文章标签
    const articleTags = await query(`
      SELECT t.id, t.name, t.color
      FROM tags t
      JOIN article_tags at ON t.id = at.tag_id
      WHERE at.article_id = ?
    `, [id]);

    const articleWithTags = {
      ...updatedArticle,
      author: {
        id: updatedArticle.author_id,
        username: updatedArticle.author_name,
        avatar: updatedArticle.author_avatar
      },
      category: updatedArticle.category_id ? {
        id: updatedArticle.category_id,
        name: updatedArticle.category_name
      } : null,
      tags: articleTags
    };

    res.json({
      success: true,
      message: '文章更新成功',
      data: articleWithTags,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('更新文章错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * 删除文章
 * DELETE /api/articles/:id
 */
router.delete('/:id', authMiddleware, logDetailedAction('delete_article', 'articles'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = (req as { user: { userId: number; role: string } }).user.userId;
    const userRole = (req as { user: { userId: number; role: string } }).user.role;

    // 检查文章是否存在
    const article = await get('SELECT author_id FROM articles WHERE id = ?', [id]);
    if (!article) {
      res.status(404).json({
        success: false,
        message: '文章不存在',
        timestamp: new Date().toISOString()
      });
      return;
    }

    // 检查权限
    if (userRole !== 'admin' && article.author_id !== userId) {
      res.status(403).json({
        success: false,
        message: '没有权限删除此文章',
        timestamp: new Date().toISOString()
      });
      return;
    }

    // 删除文章（级联删除标签关联和评论）
    await run('DELETE FROM articles WHERE id = ?', [id]);

    res.json({
      success: true,
      message: '文章删除成功',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('删除文章错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * 点赞/取消点赞文章
 * POST /api/articles/:id/like
 */
router.post('/:id/like', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: '用户未认证',
        timestamp: new Date().toISOString()
      });
      return;
    }

    // 检查文章是否存在
    const article = await get('SELECT id, likes FROM articles WHERE id = ?', [id]);
    if (!article) {
      res.status(404).json({
        success: false,
        message: '文章不存在',
        timestamp: new Date().toISOString()
      });
      return;
    }

    // 检查用户是否已经点赞
    const existingLike = await get(
      'SELECT id FROM article_likes WHERE user_id = ? AND article_id = ?',
      [userId, id]
    );

    let newLikes: number;
    let liked: boolean;
    let message: string;

    if (existingLike) {
      // 用户已点赞，执行取消点赞
      await run('DELETE FROM article_likes WHERE user_id = ? AND article_id = ?', [userId, id]);
      await run('UPDATE articles SET likes = likes - 1 WHERE id = ?', [id]);
      newLikes = Math.max(0, (article.likes as number) - 1);
      liked = false;
      message = '取消点赞成功';
    } else {
      // 用户未点赞，执行点赞
      await run('INSERT INTO article_likes (user_id, article_id) VALUES (?, ?)', [userId, id]);
      await run('UPDATE articles SET likes = likes + 1 WHERE id = ?', [id]);
      newLikes = (article.likes as number) + 1;
      liked = true;
      message = '点赞成功';
    }

    res.json({
      success: true,
      message,
      data: { 
        likes: newLikes,
        liked 
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('点赞文章错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * 检查用户是否已点赞文章
 * GET /api/articles/:id/like/status
 */
router.get('/:id/like/status', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: '用户未认证',
        timestamp: new Date().toISOString()
      });
      return;
    }

    // 检查用户是否已点赞
    const existingLike = await get(
      'SELECT id FROM article_likes WHERE user_id = ? AND article_id = ?',
      [userId, id]
    );

    res.json({
      success: true,
      data: { liked: !!existingLike },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('检查点赞状态错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误',
      timestamp: new Date().toISOString()
    });
  }
});

export default router;