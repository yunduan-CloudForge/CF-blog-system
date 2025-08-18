/**
 * 评论系统API路由
 * 实现评论的创建、查询、回复、点赞和删除功能
 */

import { Router, Request, Response } from 'express';
import { authMiddleware, optionalAuthMiddleware } from '../middleware/auth';
import { query, run, get } from '../database/connection';

const router = Router();

// 文章接口定义
interface Article {
  id: number;
  author_id: number;
  title: string;
  content: string;
}

// 接口响应类型定义
interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  error?: {
    code: string;
    details: string;
  };
  timestamp: string;
}

// 评论数据类型定义
interface Comment {
  id: number;
  content: string;
  user_id: number;
  article_id: number;
  parent_id: number | null;
  likes: number;
  created_at: string;
  updated_at: string;
  user?: {
    id: number;
    username: string;
    avatar: string | null;
  };
  replies?: Comment[];
  is_liked?: boolean;
  deleted?: boolean;
}

/**
 * 创建统一的API响应
 */
function createResponse<T>(success: boolean, message: string, data?: T, error?: { code: string; details: string }): ApiResponse<T> {
  return {
    success,
    message,
    data,
    error,
    timestamp: new Date().toISOString()
  };
}

/**
 * 内容安全过滤
 */
function sanitizeContent(content: string): string {
  // 移除HTML标签，保留纯文本
  return content.replace(/<[^>]*>/g, '').trim();
}

/**
 * 检查内容是否包含敏感词
 */
function containsSensitiveWords(content: string): boolean {
  const sensitiveWords = ['垃圾', '傻逼', '操你妈', '草泥马', '去死', '滚蛋'];
  const lowerContent = content.toLowerCase();
  return sensitiveWords.some(word => lowerContent.includes(word.toLowerCase()));
}

/**
 * 验证评论内容
 */
function validateCommentContent(content: string): { valid: boolean; error?: string } {
  if (!content || typeof content !== 'string') {
    return { valid: false, error: '评论内容不能为空' };
  }

  const trimmed = content.trim();
  if (trimmed.length < 1) {
    return { valid: false, error: '评论内容至少需要1个字符' };
  }

  if (trimmed.length > 10000) {
    return { valid: false, error: '评论内容不能超过10000个字符' };
  }

  return { valid: true };
}

/**
 * 检查评论删除权限
 */
function canDeleteComment(user: { role: string; userId: number }, comment: Comment, article: Article): boolean {
  // 管理员可以删除任何评论
  if (user.role === 'admin') {
    return true;
  }
  
  // 文章作者可以删除文章下的任何评论
  if (article.author_id === user.userId) {
    return true;
  }
  
  // 评论作者可以删除自己的评论
  if (comment.user_id === user.userId) {
    return true;
  }
  
  return false;
}

/**
 * 构建嵌套评论结构
 */
function buildCommentTree(comments: Comment[]): Comment[] {
  const commentMap = new Map<number, Comment>();
  const rootComments: Comment[] = [];

  // 初始化所有评论
  comments.forEach(comment => {
    comment.replies = [];
    commentMap.set(comment.id, comment);
  });

  // 构建树形结构
  comments.forEach(comment => {
    if (comment.parent_id === null) {
      rootComments.push(comment);
    } else {
      const parent = commentMap.get(comment.parent_id);
      if (parent) {
        parent.replies!.push(comment);
      }
    }
  });

  return rootComments;
}

/**
 * 获取评论列表
 * GET /api/comments
 */
router.get('/', optionalAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const { article_id, page = 1, limit = 20, sort = 'created_at', order = 'desc' } = req.query;

    // 验证必需参数
    if (!article_id) {
      return res.status(400).json(createResponse(false, '文章ID不能为空', null, {
        code: 'COMMENT_ARTICLE_ID_REQUIRED',
        details: '请提供有效的文章ID'
      }));
    }

    // 验证分页参数
    const pageNum = Math.max(1, parseInt(page as string) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string) || 20));
    const sortField = ['created_at', 'likes'].includes(sort as string) ? sort as string : 'created_at';
    const orderDir = order === 'asc' ? 'ASC' : 'DESC';

    // 验证文章是否存在
    const article = await get('SELECT id, author_id FROM articles WHERE id = ?', [article_id]);
    if (!article) {
      return res.status(404).json(createResponse(false, '文章不存在', null, {
        code: 'COMMENT_ARTICLE_NOT_FOUND',
        details: '指定的文章不存在'
      }));
    }

    // 获取评论总数
    const totalResult = await get('SELECT COUNT(*) as total FROM comments WHERE article_id = ?', [article_id]);
    const total = totalResult.total;
    const totalPages = Math.ceil(total / limitNum);

    // 获取顶级评论（分页）
    const offset = (pageNum - 1) * limitNum;
    const topLevelComments = await query(`
      SELECT 
        c.id, c.content, c.user_id, c.article_id, c.parent_id, c.likes,
        c.created_at, c.updated_at,
        u.username, u.avatar
      FROM comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.article_id = ? AND c.parent_id IS NULL
      ORDER BY c.${sortField} ${orderDir}
      LIMIT ? OFFSET ?
    `, [article_id, limitNum, offset]);

    // 获取所有回复（不分页）
    const allReplies = await query(`
      SELECT 
        c.id, c.content, c.user_id, c.article_id, c.parent_id, c.likes,
        c.created_at, c.updated_at,
        u.username, u.avatar
      FROM comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.article_id = ? AND c.parent_id IS NOT NULL
      ORDER BY c.created_at ASC
    `, [article_id]);

    // 合并所有评论
    const allComments: Comment[] = [...topLevelComments, ...allReplies].map(comment => ({
      id: comment.id as number,
      content: comment.content as string,
      user_id: comment.user_id as number,
      article_id: comment.article_id as number,
      parent_id: comment.parent_id as number | null,
      likes: comment.likes as number,
      created_at: comment.created_at as string,
      updated_at: comment.updated_at as string,
      user: {
        id: comment.user_id as number,
        username: comment.username as string,
        avatar: comment.avatar as string
      },
      is_liked: false,
      deleted: false
    }));

    // 如果用户已登录，检查点赞状态
    if (req.user) {
      const commentIds = allComments.map(c => c.id);
      if (commentIds.length > 0) {
        const likedComments = await query(`
          SELECT comment_id FROM comment_likes 
          WHERE user_id = ? AND comment_id IN (${commentIds.map(() => '?').join(',')})
        `, [req.user.userId, ...commentIds]);
        
        const likedSet = new Set(likedComments.map(l => l.comment_id));
        allComments.forEach(comment => {
          comment.is_liked = likedSet.has(comment.id);
        });
      }
    }

    // 构建嵌套结构
    const nestedComments = buildCommentTree(allComments);
    
    // 调试日志：检查buildCommentTree的结果
    console.log('=== 后端调试日志 ===');
    console.log('原始评论数量:', allComments.length);
    console.log('嵌套后根评论数量:', nestedComments.length);
    nestedComments.forEach(comment => {
      console.log(`评论 ${comment.id} 的回复数量:`, comment.replies?.length || 0);
      if (comment.replies && comment.replies.length > 0) {
        console.log(`  回复IDs:`, comment.replies.map(r => r.id));
      }
    });
    console.log('===================');

    res.json(createResponse(true, '获取评论列表成功', {
      comments: nestedComments,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages
      }
    }));
  } catch (error) {
    console.error('获取评论列表失败:', error);
    res.status(500).json(createResponse(false, '服务器内部错误', null, {
      code: 'INTERNAL_SERVER_ERROR',
      details: '获取评论列表时发生错误'
    }));
  }
});

/**
 * 创建评论
 * POST /api/comments
 */
router.post('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { content, article_id } = req.body;
    const user = req.user;

    // 验证评论内容
    const contentValidation = validateCommentContent(content);
    if (!contentValidation.valid) {
      return res.status(400).json(createResponse(false, contentValidation.error!, null, {
        code: 'COMMENT_CONTENT_INVALID',
        details: contentValidation.error!
      }));
    }

    // 验证文章ID
    if (!article_id || typeof article_id !== 'number') {
      return res.status(400).json(createResponse(false, '文章ID无效', null, {
        code: 'COMMENT_ARTICLE_ID_INVALID',
        details: '请提供有效的文章ID'
      }));
    }

    // 验证文章是否存在
    const article = await get('SELECT id, author_id FROM articles WHERE id = ?', [article_id]);
    if (!article) {
      return res.status(404).json(createResponse(false, '文章不存在', null, {
        code: 'COMMENT_ARTICLE_NOT_FOUND',
        details: '指定的文章不存在'
      }));
    }

    // 过滤内容
    const sanitizedContent = sanitizeContent(content);

    // 插入评论
    const result = await run(`
      INSERT INTO comments (content, user_id, article_id, likes)
      VALUES (?, ?, ?, 0)
    `, [sanitizedContent, user.userId, article_id]);

    // 获取新创建的评论详情
    const newComment = await get(`
      SELECT 
        c.id, c.content, c.user_id, c.article_id, c.parent_id, c.likes,
        c.created_at, c.updated_at,
        u.username, u.avatar
      FROM comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.id = ?
    `, [result.lastID]);

    const commentResponse = {
      id: newComment.id,
      content: newComment.content,
      user_id: newComment.user_id,
      article_id: newComment.article_id,
      parent_id: newComment.parent_id,
      likes: newComment.likes,
      is_liked: false,
      deleted: false,
      created_at: newComment.created_at,
      updated_at: newComment.updated_at,
      user: {
        id: newComment.user_id,
        username: newComment.username,
        avatar: newComment.avatar
      }
    };

    res.status(201).json(createResponse(true, '评论发布成功', {
      comment: commentResponse
    }));
  } catch (error) {
    console.error('创建评论失败:', error);
    res.status(500).json(createResponse(false, '服务器内部错误', null, {
      code: 'INTERNAL_SERVER_ERROR',
      details: '创建评论时发生错误'
    }));
  }
});

/**
 * 回复评论
 * POST /api/comments/:id/reply
 */
router.post('/:id/reply', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { content } = req.body;
    const user = req.user;

    // 验证父评论ID
    const parentId = parseInt(id);
    if (isNaN(parentId)) {
      return res.status(400).json(createResponse(false, '评论ID无效', null, {
        code: 'COMMENT_ID_INVALID',
        details: '请提供有效的评论ID'
      }));
    }

    // 验证评论内容
    const contentValidation = validateCommentContent(content);
    if (!contentValidation.valid) {
      return res.status(400).json(createResponse(false, contentValidation.error!, null, {
        code: 'COMMENT_CONTENT_INVALID',
        details: contentValidation.error!
      }));
    }

    // 验证父评论是否存在
    const parentComment = await get('SELECT id, article_id FROM comments WHERE id = ?', [parentId]);
    if (!parentComment) {
      return res.status(404).json(createResponse(false, '父评论不存在', null, {
        code: 'COMMENT_PARENT_NOT_FOUND',
        details: '指定的父评论不存在'
      }));
    }

    // 验证文章是否存在
    const article = await get('SELECT id, author_id FROM articles WHERE id = ?', [parentComment.article_id]);
    if (!article) {
      return res.status(404).json(createResponse(false, '文章不存在', null, {
        code: 'COMMENT_ARTICLE_NOT_FOUND',
        details: '关联的文章不存在'
      }));
    }

    // 过滤内容
    const sanitizedContent = sanitizeContent(content);

    // 插入回复
    const result = await run(`
      INSERT INTO comments (content, user_id, article_id, parent_id, likes)
      VALUES (?, ?, ?, ?, 0)
    `, [sanitizedContent, user.userId, parentComment.article_id, parentId]);

    // 获取新创建的回复详情
    const newReply = await get(`
      SELECT 
        c.id, c.content, c.user_id, c.article_id, c.parent_id, c.likes,
        c.created_at, c.updated_at,
        u.username, u.avatar
      FROM comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.id = ?
    `, [result.lastID]);

    const replyResponse = {
      id: newReply.id,
      content: newReply.content,
      user_id: newReply.user_id,
      article_id: newReply.article_id,
      parent_id: newReply.parent_id,
      likes: newReply.likes,
      is_liked: false,
      deleted: false,
      created_at: newReply.created_at,
      updated_at: newReply.updated_at,
      user: {
        id: newReply.user_id,
        username: newReply.username,
        avatar: newReply.avatar
      }
    };

    res.status(201).json(createResponse(true, '回复发布成功', {
      comment: replyResponse
    }));
  } catch (error) {
    console.error('回复评论失败:', error);
    res.status(500).json(createResponse(false, '服务器内部错误', null, {
      code: 'INTERNAL_SERVER_ERROR',
      details: '回复评论时发生错误'
    }));
  }
});

/**
 * 点赞/取消点赞评论
 * POST /api/comments/:id/like
 */
router.post('/:id/like', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = req.user;

    // 验证评论ID
    const commentId = parseInt(id);
    if (isNaN(commentId)) {
      return res.status(400).json(createResponse(false, '评论ID无效', null, {
        code: 'COMMENT_ID_INVALID',
        details: '请提供有效的评论ID'
      }));
    }

    // 验证评论是否存在
    const comment = await get('SELECT id, likes FROM comments WHERE id = ?', [commentId]);
    if (!comment) {
      return res.status(404).json(createResponse(false, '评论不存在', null, {
        code: 'COMMENT_NOT_FOUND',
        details: '指定的评论不存在'
      }));
    }

    // 检查是否已经点赞
    const existingLike = await get(
      'SELECT id FROM comment_likes WHERE user_id = ? AND comment_id = ?',
      [user.userId, commentId]
    );

    let liked = false;
    let newLikesCount = comment.likes;

    if (existingLike) {
      // 取消点赞
      await run('DELETE FROM comment_likes WHERE user_id = ? AND comment_id = ?', [user.userId, commentId]);
      await run('UPDATE comments SET likes = likes - 1 WHERE id = ?', [commentId]);
      newLikesCount = (comment.likes as number) - 1;
      liked = false;
    } else {
      // 添加点赞
      await run('INSERT INTO comment_likes (user_id, comment_id) VALUES (?, ?)', [user.userId, commentId]);
      await run('UPDATE comments SET likes = likes + 1 WHERE id = ?', [commentId]);
      newLikesCount = (comment.likes as number) + 1;
      liked = true;
    }

    res.json(createResponse(true, liked ? '点赞成功' : '取消点赞成功', {
      is_liked: liked,
      likes: newLikesCount
    }));
  } catch (error) {
    console.error('点赞评论失败:', error);
    res.status(500).json(createResponse(false, '服务器内部错误', null, {
      code: 'INTERNAL_SERVER_ERROR',
      details: '点赞评论时发生错误'
    }));
  }
});

/**
 * 删除评论
 * DELETE /api/comments/:id
 */
router.delete('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = req.user;

    // 验证评论ID
    const commentId = parseInt(id);
    if (isNaN(commentId)) {
      return res.status(400).json(createResponse(false, '评论ID无效', null, {
        code: 'COMMENT_ID_INVALID',
        details: '请提供有效的评论ID'
      }));
    }

    // 获取评论详情
    const comment = await get('SELECT id, user_id, article_id FROM comments WHERE id = ?', [commentId]);
    if (!comment) {
      return res.status(404).json(createResponse(false, '评论不存在', null, {
        code: 'COMMENT_NOT_FOUND',
        details: '指定的评论不存在'
      }));
    }

    // 获取文章详情
    const article = await get('SELECT id, author_id FROM articles WHERE id = ?', [comment.article_id]);
    if (!article) {
      return res.status(404).json(createResponse(false, '关联文章不存在', null, {
        code: 'COMMENT_ARTICLE_NOT_FOUND',
        details: '评论关联的文章不存在'
      }));
    }

    // 检查删除权限
    if (!canDeleteComment(user, comment as unknown as Comment, article as unknown as Article)) {
      return res.status(403).json(createResponse(false, '无权删除此评论', null, {
        code: 'COMMENT_DELETE_FORBIDDEN',
        details: '只有评论作者、文章作者或管理员可以删除评论'
      }));
    }

    // 删除评论（级联删除回复和点赞记录）
    await run('DELETE FROM comments WHERE id = ?', [commentId]);

    res.json(createResponse(true, '评论删除成功'));
  } catch (error) {
    console.error('删除评论失败:', error);
    res.status(500).json(createResponse(false, '服务器内部错误', null, {
      code: 'INTERNAL_SERVER_ERROR',
      details: '删除评论时发生错误'
    }));
  }
});

/**
 * 获取单个评论详情
 * GET /api/comments/:id
 */
router.get('/:id', optionalAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // 验证评论ID
    const commentId = parseInt(id);
    if (isNaN(commentId)) {
      return res.status(400).json(createResponse(false, '评论ID无效', null, {
        code: 'COMMENT_ID_INVALID',
        details: '请提供有效的评论ID'
      }));
    }

    // 获取评论详情
    const comment = await get(`
      SELECT 
        c.id, c.content, c.user_id, c.article_id, c.parent_id, c.likes,
        c.created_at, c.updated_at,
        u.username, u.avatar
      FROM comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.id = ?
    `, [commentId]);

    if (!comment) {
      return res.status(404).json(createResponse(false, '评论不存在', null, {
        code: 'COMMENT_NOT_FOUND',
        details: '指定的评论不存在'
      }));
    }

    const commentResponse = {
      id: comment.id,
      content: comment.content,
      user_id: comment.user_id,
      article_id: comment.article_id,
      parent_id: comment.parent_id,
      likes: comment.likes,
      is_liked: false,
      deleted: false,
      created_at: comment.created_at,
      updated_at: comment.updated_at,
      user: {
        id: comment.user_id,
        username: comment.username,
        avatar: comment.avatar
      }
    };

    // 如果用户已登录，检查点赞状态
    if (req.user) {
      const likedComment = await get(
        'SELECT id FROM comment_likes WHERE user_id = ? AND comment_id = ?',
        [req.user.userId, commentId]
      );
      commentResponse.is_liked = !!likedComment;
    }

    res.json(createResponse(true, '获取评论详情成功', {
      comment: commentResponse
    }));
  } catch (error) {
    console.error('获取评论详情失败:', error);
    res.status(500).json(createResponse(false, '服务器内部错误', null, {
      code: 'INTERNAL_SERVER_ERROR',
      details: '获取评论详情时发生错误'
    }));
  }
});

/**
 * 编辑评论
 * PUT /api/comments/:id
 */
router.put('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { content } = req.body;
    const user = req.user;

    // 验证评论ID
    const commentId = parseInt(id);
    if (isNaN(commentId)) {
      return res.status(400).json(createResponse(false, '评论ID无效', null, {
        code: 'COMMENT_ID_INVALID',
        details: '请提供有效的评论ID'
      }));
    }

    // 验证内容
    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return res.status(400).json(createResponse(false, '评论内容不能为空', null, {
        code: 'COMMENT_CONTENT_REQUIRED',
        details: '请提供有效的评论内容'
      }));
    }

    if (content.length > 1000) {
      return res.status(400).json(createResponse(false, '评论内容过长', null, {
        code: 'COMMENT_CONTENT_TOO_LONG',
        details: '评论内容不能超过1000个字符'
      }));
    }

    // 获取评论详情
    const comment = await get('SELECT id, user_id, content FROM comments WHERE id = ?', [commentId]);
    if (!comment) {
      return res.status(404).json(createResponse(false, '评论不存在', null, {
        code: 'COMMENT_NOT_FOUND',
        details: '指定的评论不存在'
      }));
    }

    // 检查编辑权限（只有评论作者可以编辑）
    if (comment.user_id !== user.userId) {
      return res.status(403).json(createResponse(false, '无权编辑此评论', null, {
        code: 'COMMENT_EDIT_FORBIDDEN',
        details: '只有评论作者可以编辑评论'
      }));
    }

    // 内容安全检查
    const trimmedContent = content.trim();
    if (containsSensitiveWords(trimmedContent)) {
      return res.status(400).json(createResponse(false, '评论内容包含敏感词汇', null, {
        code: 'COMMENT_CONTENT_SENSITIVE',
        details: '请修改评论内容后重试'
      }));
    }

    // 更新评论
    await run('UPDATE comments SET content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [trimmedContent, commentId]);

    // 获取更新后的评论详情
    const updatedComment = await get(`
      SELECT 
        c.id, c.content, c.user_id, c.article_id, c.parent_id, c.likes,
        c.created_at, c.updated_at,
        u.username, u.avatar
      FROM comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.id = ?
    `, [commentId]);

    const commentResponse = {
      id: updatedComment.id,
      content: updatedComment.content,
      user_id: updatedComment.user_id,
      article_id: updatedComment.article_id,
      parent_id: updatedComment.parent_id,
      likes: updatedComment.likes,
      is_liked: false,
      deleted: false,
      created_at: updatedComment.created_at,
      updated_at: updatedComment.updated_at,
      user: {
        id: updatedComment.user_id,
        username: updatedComment.username,
        avatar: updatedComment.avatar
      }
    };

    // 检查点赞状态
    const likedComment = await get(
      'SELECT id FROM comment_likes WHERE user_id = ? AND comment_id = ?',
      [user.userId, commentId]
    );
    commentResponse.is_liked = !!likedComment;

    res.json(createResponse(true, '评论编辑成功', {
      comment: commentResponse
    }));
  } catch (error) {
    console.error('编辑评论失败:', error);
    res.status(500).json(createResponse(false, '服务器内部错误', null, {
      code: 'INTERNAL_SERVER_ERROR',
      details: '编辑评论时发生错误'
    }));
  }
});

/**
 * 举报评论
 * POST /api/comments/:id/report
 */
router.post('/:id/report', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { reason, description } = req.body;
    const user = req.user;

    // 验证评论ID
    const commentId = parseInt(id);
    if (isNaN(commentId)) {
      return res.status(400).json(createResponse(false, '评论ID无效', null, {
        code: 'COMMENT_ID_INVALID',
        details: '请提供有效的评论ID'
      }));
    }

    // 验证举报原因
    const validReasons = ['spam', 'harassment', 'inappropriate', 'misinformation', 'other'];
    if (!reason || !validReasons.includes(reason)) {
      return res.status(400).json(createResponse(false, '举报原因无效', null, {
        code: 'REPORT_REASON_INVALID',
        details: '请选择有效的举报原因'
      }));
    }

    // 验证评论是否存在
    const comment = await get('SELECT id, user_id FROM comments WHERE id = ?', [commentId]);
    if (!comment) {
      return res.status(404).json(createResponse(false, '评论不存在', null, {
        code: 'COMMENT_NOT_FOUND',
        details: '指定的评论不存在'
      }));
    }

    // 检查是否已经举报过
    const existingReport = await get(
      'SELECT id FROM comment_reports WHERE user_id = ? AND comment_id = ?',
      [user.userId, commentId]
    );

    if (existingReport) {
      return res.status(400).json(createResponse(false, '您已经举报过此评论', null, {
        code: 'COMMENT_ALREADY_REPORTED',
        details: '每个用户只能举报同一评论一次'
      }));
    }

    // 创建举报记录
    await run(
      'INSERT INTO comment_reports (user_id, comment_id, reason, description, created_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)',
      [user.userId, commentId, reason, description || '']
    );

    res.json(createResponse(true, '举报提交成功', {
      message: '感谢您的举报，我们会尽快处理'
    }));
  } catch (error) {
    console.error('举报评论失败:', error);
    res.status(500).json(createResponse(false, '服务器内部错误', null, {
      code: 'INTERNAL_SERVER_ERROR',
      details: '举报评论时发生错误'
    }));
  }
});

export default router;