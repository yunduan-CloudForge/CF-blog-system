import express from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import {
  createComment,
  getComments,
  getArticleCommentsTree,
  updateComment,
  updateCommentStatus,
  deleteComment,
  deleteCommentByAdmin,
  getPendingCommentsCount
} from '../services/commentService.js';

const router = express.Router();

// 获取评论列表
router.get('/', async (req, res) => {
  try {
    const queryParams = {
      page: req.query.page ? parseInt(req.query.page as string) : 1,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
      article_id: req.query.article_id as string,
      user_id: req.query.user_id as string,
      status: req.query.status as 'pending' | 'approved' | 'rejected',
      parent_id: req.query.parent_id as string
    };

    const result = await getComments(queryParams);
    res.json(result);
  } catch (error) {
    console.error('获取评论列表失败:', error);
    res.status(500).json({ error: '获取评论列表失败' });
  }
});

// 获取文章评论树
router.get('/article/:articleId/tree', async (req, res) => {
  try {
    const { articleId } = req.params;
    const comments = await getArticleCommentsTree(articleId);
    res.json(comments);
  } catch (error) {
    console.error('获取文章评论失败:', error);
    res.status(500).json({ error: '获取文章评论失败' });
  }
});

// 获取待审核评论数量（管理员）
router.get('/pending/count', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const count = await getPendingCommentsCount();
    res.json({ count });
  } catch (error) {
    console.error('获取待审核评论数量失败:', error);
    res.status(500).json({ error: '获取待审核评论数量失败' });
  }
});

// 创建评论
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { article_id, content, parent_id } = req.body;
    const userId = req.user!.id;

    // 验证必填字段
    if (!article_id || !content) {
      return res.status(400).json({ error: '文章ID和评论内容不能为空' });
    }

    // 验证内容长度
    if (content.length < 1 || content.length > 1000) {
      return res.status(400).json({ error: '评论内容长度必须在1-1000字符之间' });
    }

    const commentData = {
      article_id,
      content: content.trim(),
      parent_id: parent_id || undefined
    };

    const comment = await createComment(userId, commentData);
    res.status(201).json(comment);
  } catch (error) {
    console.error('创建评论失败:', error);
    if (error instanceof Error) {
      if (error.message === '文章不存在或未发布' || error.message === '父评论不存在') {
        return res.status(404).json({ error: error.message });
      }
    }
    res.status(500).json({ error: '创建评论失败' });
  }
});

// 更新评论
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { content } = req.body;
    const userId = req.user!.id;

    // 验证内容
    if (content && (content.length < 1 || content.length > 1000)) {
      return res.status(400).json({ error: '评论内容长度必须在1-1000字符之间' });
    }

    const updateData = {
      content: content ? content.trim() : undefined
    };

    const comment = await updateComment(id, userId, updateData);
    res.json(comment);
  } catch (error) {
    console.error('更新评论失败:', error);
    if (error instanceof Error) {
      if (error.message === '评论不存在或无权限修改') {
        return res.status(404).json({ error: error.message });
      }
      if (error.message === '没有提供更新数据') {
        return res.status(400).json({ error: error.message });
      }
    }
    res.status(500).json({ error: '更新评论失败' });
  }
});

// 更新评论状态（管理员）
router.put('/:id/status', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    // 验证状态值
    if (!['pending', 'approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: '无效的状态值' });
    }

    const comment = await updateCommentStatus(id, status);
    res.json(comment);
  } catch (error) {
    console.error('更新评论状态失败:', error);
    if (error instanceof Error) {
      if (error.message === '评论不存在') {
        return res.status(404).json({ error: error.message });
      }
    }
    res.status(500).json({ error: '更新评论状态失败' });
  }
});

// 删除评论
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    await deleteComment(id, userId);
    res.status(204).send();
  } catch (error) {
    console.error('删除评论失败:', error);
    if (error instanceof Error) {
      if (error.message === '评论不存在或无权限删除') {
        return res.status(404).json({ error: error.message });
      }
    }
    res.status(500).json({ error: '删除评论失败' });
  }
});

// 管理员删除评论
router.delete('/:id/admin', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    await deleteCommentByAdmin(id);
    res.status(204).send();
  } catch (error) {
    console.error('删除评论失败:', error);
    if (error instanceof Error) {
      if (error.message === '评论不存在') {
        return res.status(404).json({ error: error.message });
      }
    }
    res.status(500).json({ error: '删除评论失败' });
  }
});

export default router;