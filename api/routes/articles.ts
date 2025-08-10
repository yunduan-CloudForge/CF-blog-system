import express from 'express';
import { authenticateToken, requireAuthor } from '../middleware/auth.js';
import {
  createArticle,
  getArticleById,
  getArticleBySlug,
  getArticles,
  updateArticle,
  deleteArticle,
  getCategories,
  getTags,
  getArticleTags
} from '../services/articleService.js';
import { CreateArticleData, UpdateArticleData, ArticleListQuery } from '../models/Article.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// 获取文章列表
router.get('/', async (req, res): Promise<void> => {
  try {
    const query: ArticleListQuery = {
      page: parseInt(req.query.page as string) || 1,
      limit: Math.min(parseInt(req.query.limit as string) || 10, 50), // 限制最大50条
      category: req.query.category as string,
      search: req.query.search as string,
      status: req.query.status as string,
      author_id: req.query.author_id as string
    };
    
    const result = await getArticles(query);
    res.json(result);
  } catch (error) {
    console.error('获取文章列表失败:', error);
    res.status(500).json({ error: '获取文章列表失败' });
  }
});

// 获取分类列表
router.get('/categories', async (req, res): Promise<void> => {
  try {
    const categories = await getCategories();
    res.json({
      success: true,
      message: '获取分类列表成功',
      data: { categories }
    });
  } catch (error) {
    console.error('获取分类列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取分类列表失败',
      error: error instanceof Error ? error.message : '未知错误'
    });
  }
});

// 获取标签列表
router.get('/tags', async (req, res): Promise<void> => {
  try {
    const tags = await getTags();
    res.json({
      success: true,
      message: '获取标签列表成功',
      data: { tags }
    });
  } catch (error) {
    console.error('获取标签列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取标签列表失败',
      error: error instanceof Error ? error.message : '未知错误'
    });
  }
});

// 根据ID获取文章
router.get('/:id', async (req, res): Promise<void> => {
  try {
    const { id } = req.params;
    
    // 判断是ID还是slug
    let article;
    if (id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      // UUID格式，按ID查询
      article = await getArticleById(id);
    } else {
      // 按slug查询
      article = await getArticleBySlug(id);
    }
    
    if (!article) {
      return res.status(404).json({ error: '文章不存在' });
    }
    
    // 获取文章标签
    const tags = await getArticleTags(article.id);
    
    res.json({
      ...article,
      tags
    });
  } catch (error) {
    console.error('获取文章失败:', error);
    res.status(500).json({ error: '获取文章失败' });
  }
});

// 创建文章（需要登录）
router.post('/', authenticateToken, async (req, res): Promise<void> => {
  try {
    const { title, content, excerpt, category_id, tags, status } = req.body;
    
    // 验证必填字段
    if (!title || !content || !category_id) {
      return res.status(400).json({ error: '标题、内容和分类为必填项' });
    }
    
    if (title.length > 200) {
      return res.status(400).json({ error: '标题长度不能超过200字符' });
    }
    
    if (excerpt && excerpt.length > 500) {
      return res.status(400).json({ error: '摘要长度不能超过500字符' });
    }
    
    if (status && !['draft', 'published'].includes(status)) {
      return res.status(400).json({ error: '状态只能是draft或published' });
    }
    
    const articleData: CreateArticleData = {
      title,
      content,
      excerpt,
      category_id,
      tags: Array.isArray(tags) ? tags : [],
      status: status || 'draft'
    };
    
    const article = await createArticle(req.user!.id, articleData);
    
    // 记录文章创建操作日志
    logger.logOperation({
      userId: req.user!.id,
      action: 'ARTICLE_CREATE',
      resource: 'article',
      resourceId: article.id,
      details: {
        title: article.title,
        status: article.status,
        category_id: article.category_id,
        tags: articleData.tags
      },
      ip: req.ip || req.connection.remoteAddress || 'Unknown',
      userAgent: req.get('User-Agent') || 'Unknown'
    });
    
    // 获取文章标签
    const articleTags = await getArticleTags(article.id);
    
    res.status(201).json({
      ...article,
      tags: articleTags
    });
  } catch (error) {
    console.error('创建文章失败:', error);
    if (error instanceof Error) {
      res.status(400).json({ error: error.message });
    } else {
      res.status(500).json({ error: '创建文章失败' });
    }
  }
});

// 更新文章（需要登录且为作者）
router.put('/:id', authenticateToken, async (req, res): Promise<void> => {
  try {
    const { id } = req.params;
    const { title, content, excerpt, category_id, tags, status } = req.body;
    
    // 验证数据
    if (title && title.length > 200) {
      return res.status(400).json({ error: '标题长度不能超过200字符' });
    }
    
    if (excerpt && excerpt.length > 500) {
      return res.status(400).json({ error: '摘要长度不能超过500字符' });
    }
    
    if (status && !['draft', 'published'].includes(status)) {
      return res.status(400).json({ error: '状态只能是draft或published' });
    }
    
    const updateData: UpdateArticleData = {};
    
    if (title !== undefined) updateData.title = title;
    if (content !== undefined) updateData.content = content;
    if (excerpt !== undefined) updateData.excerpt = excerpt;
    if (category_id !== undefined) updateData.category_id = category_id;
    if (tags !== undefined) updateData.tags = Array.isArray(tags) ? tags : [];
    if (status !== undefined) updateData.status = status;
    
    const article = await updateArticle(id, req.user!.id, updateData);
    
    // 记录文章更新操作日志
    logger.logOperation({
      userId: req.user!.id,
      action: 'ARTICLE_UPDATE',
      resource: 'article',
      resourceId: article.id,
      details: {
        title: article.title,
        updatedFields: Object.keys(updateData),
        status: article.status
      },
      ip: req.ip || req.connection.remoteAddress || 'Unknown',
      userAgent: req.get('User-Agent') || 'Unknown'
    });
    
    // 获取文章标签
    const articleTags = await getArticleTags(article.id);
    
    res.json({
      ...article,
      tags: articleTags
    });
  } catch (error) {
    console.error('更新文章失败:', error);
    if (error instanceof Error) {
      if (error.message.includes('不存在或无权限')) {
        res.status(404).json({ error: error.message });
      } else {
        res.status(400).json({ error: error.message });
      }
    } else {
      res.status(500).json({ error: '更新文章失败' });
    }
  }
});

// 删除文章（需要登录且为作者）
router.delete('/:id', authenticateToken, async (req, res): Promise<void> => {
  try {
    const { id } = req.params;
    
    await deleteArticle(id, req.user!.id);
    
    // 记录文章删除操作日志
    logger.logOperation({
      userId: req.user!.id,
      action: 'ARTICLE_DELETE',
      resource: 'article',
      resourceId: id,
      details: {
        articleId: id
      },
      ip: req.ip || req.connection.remoteAddress || 'Unknown',
      userAgent: req.get('User-Agent') || 'Unknown'
    });
    
    res.json({ message: '文章删除成功' });
  } catch (error) {
    console.error('删除文章失败:', error);
    if (error instanceof Error) {
      if (error.message.includes('不存在或无权限')) {
        res.status(404).json({ error: error.message });
      } else {
        res.status(400).json({ error: error.message });
      }
    } else {
      res.status(500).json({ error: '删除文章失败' });
    }
  }
});

export default router;