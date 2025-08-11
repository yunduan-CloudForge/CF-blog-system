/**
 * 文章管理API路由
 * 处理文章的CRUD操作、分页、搜索等功能
 */
import { Router, type Request, type Response } from 'express';
import { query, run, get } from '../database/connection';
import { authMiddleware } from '../middleware/auth';

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
      status = 'published',
      author = ''
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;

    // 构建查询条件
    let whereConditions = [];
    let queryParams = [];

    // 状态筛选
    if (status) {
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
    for (const article of articles) {
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
    article.views += 1;

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
router.post('/', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user.userId;
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

    res.status(201).json({
      success: true,
      message: '文章创建成功',
      data: { articleId },
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
router.put('/:id', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.userId;
    const userRole = (req as any).user.role;
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

    res.json({
      success: true,
      message: '文章更新成功',
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
router.delete('/:id', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.userId;
    const userRole = (req as any).user.role;

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
 * 点赞文章
 * POST /api/articles/:id/like
 */
router.post('/:id/like', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // 检查文章是否存在
    const article = await get('SELECT likes FROM articles WHERE id = ?', [id]);
    if (!article) {
      res.status(404).json({
        success: false,
        message: '文章不存在',
        timestamp: new Date().toISOString()
      });
      return;
    }

    // 增加点赞数
    await run('UPDATE articles SET likes = likes + 1 WHERE id = ?', [id]);
    const newLikes = article.likes + 1;

    res.json({
      success: true,
      message: '点赞成功',
      data: { likes: newLikes },
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

export default router;