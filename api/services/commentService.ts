import { query, queryOne, execute, beginTransaction, commitTransaction, rollbackTransaction } from '../database/database.js';
import { Comment, CommentWithUser, CreateCommentData, UpdateCommentData, CommentListQuery, CommentListResponse } from '../models/Comment.js';
import { Article } from '../models/Article.js';

// 创建评论
export const createComment = async (userId: string, commentData: CreateCommentData): Promise<CommentWithUser> => {
  const { article_id, content, parent_id } = commentData;
  
  // 验证文章是否存在且已发布
  const article = await queryOne<Article>(
    'SELECT * FROM articles WHERE id = ? AND status = ?',
    [article_id, 'published']
  );
  
  if (!article) {
    throw new Error('文章不存在或未发布');
  }
  
  // 如果是回复评论，验证父评论是否存在
  if (parent_id) {
    const parentComment = await queryOne<Comment>(
      'SELECT * FROM comments WHERE id = ? AND article_id = ?',
      [parent_id, article_id]
    );
    
    if (!parentComment) {
      throw new Error('父评论不存在');
    }
  }
  
  const result = await execute(
    'INSERT INTO comments (article_id, user_id, parent_id, content, status) VALUES (?, ?, ?, ?, ?)',
    [article_id, userId, parent_id || null, content, 'pending']
  );
  
  const commentId = await queryOne<{ id: string }>(
    'SELECT id FROM comments WHERE rowid = ?',
    [result.lastID]
  );
  
  if (!commentId) {
    throw new Error('评论创建失败');
  }
  
  const newComment = await getCommentById(commentId.id);
  if (!newComment) {
    throw new Error('评论创建失败');
  }
  
  return newComment;
};

// 根据ID获取评论
export const getCommentById = async (commentId: string): Promise<CommentWithUser | null> => {
  return await queryOne<CommentWithUser>(
    `SELECT 
      c.*,
      u.name as user_name,
      u.email as user_email
     FROM comments c
     JOIN users u ON c.user_id = u.id
     WHERE c.id = ?`,
    [commentId]
  );
};

// 获取评论列表
export const getComments = async (queryParams: CommentListQuery): Promise<CommentListResponse> => {
  const {
    page = 1,
    limit = 20,
    article_id,
    user_id,
    status,
    parent_id
  } = queryParams;
  
  const offset = (page - 1) * limit;
  
  let whereConditions: string[] = [];
  let queryValues: any[] = [];
  
  // 构建查询条件
  if (article_id) {
    whereConditions.push('c.article_id = ?');
    queryValues.push(article_id);
  }
  
  if (user_id) {
    whereConditions.push('c.user_id = ?');
    queryValues.push(user_id);
  }
  
  if (status) {
    whereConditions.push('c.status = ?');
    queryValues.push(status);
  } else {
    // 默认只显示已审核通过的评论
    whereConditions.push('c.status = ?');
    queryValues.push('approved');
  }
  
  if (parent_id !== undefined) {
    if (parent_id === null || parent_id === '') {
      whereConditions.push('c.parent_id IS NULL');
    } else {
      whereConditions.push('c.parent_id = ?');
      queryValues.push(parent_id);
    }
  }
  
  const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
  
  // 获取总数
  const countQuery = `
    SELECT COUNT(*) as total
    FROM comments c
    JOIN users u ON c.user_id = u.id
    ${whereClause}
  `;
  
  const countResult = await queryOne<{ total: number }>(countQuery, queryValues);
  const total = countResult?.total || 0;
  
  // 获取评论列表
  const commentsQuery = `
    SELECT 
      c.*,
      u.name as user_name,
      u.email as user_email
    FROM comments c
    JOIN users u ON c.user_id = u.id
    ${whereClause}
    ORDER BY c.created_at DESC
    LIMIT ? OFFSET ?
  `;
  
  const comments = await query<CommentWithUser>(commentsQuery, [...queryValues, limit, offset]);
  
  const totalPages = Math.ceil(total / limit);
  
  return {
    comments,
    total,
    page,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1
  };
};

// 获取文章的评论树（包含回复）
export const getArticleCommentsTree = async (articleId: string): Promise<CommentWithUser[]> => {
  // 获取所有已审核的评论
  const allComments = await query<CommentWithUser>(
    `SELECT 
      c.*,
      u.name as user_name,
      u.email as user_email
     FROM comments c
     JOIN users u ON c.user_id = u.id
     WHERE c.article_id = ? AND c.status = 'approved'
     ORDER BY c.created_at ASC`,
    [articleId]
  );
  
  // 构建评论树
  const commentMap = new Map<string, CommentWithUser>();
  const rootComments: CommentWithUser[] = [];
  
  // 初始化所有评论
  allComments.forEach(comment => {
    comment.replies = [];
    commentMap.set(comment.id, comment);
  });
  
  // 构建树结构
  allComments.forEach(comment => {
    if (comment.parent_id) {
      const parent = commentMap.get(comment.parent_id);
      if (parent) {
        parent.replies!.push(comment);
      }
    } else {
      rootComments.push(comment);
    }
  });
  
  return rootComments;
};

// 更新评论
export const updateComment = async (commentId: string, userId: string, updateData: UpdateCommentData): Promise<CommentWithUser> => {
  const { content, status } = updateData;
  
  // 检查评论是否存在且属于当前用户
  const existingComment = await queryOne<Comment>(
    'SELECT * FROM comments WHERE id = ? AND user_id = ?',
    [commentId, userId]
  );
  
  if (!existingComment) {
    throw new Error('评论不存在或无权限修改');
  }
  
  const updates: string[] = [];
  const values: any[] = [];
  
  if (content !== undefined) {
    updates.push('content = ?');
    values.push(content);
  }
  
  if (status !== undefined) {
    updates.push('status = ?');
    values.push(status);
  }
  
  if (updates.length === 0) {
    throw new Error('没有提供更新数据');
  }
  
  updates.push('updated_at = CURRENT_TIMESTAMP');
  values.push(commentId);
  
  await execute(
    `UPDATE comments SET ${updates.join(', ')} WHERE id = ?`,
    values
  );
  
  const updatedComment = await getCommentById(commentId);
  if (!updatedComment) {
    throw new Error('评论更新失败');
  }
  
  return updatedComment;
};

// 管理员更新评论状态
export const updateCommentStatus = async (commentId: string, status: 'pending' | 'approved' | 'rejected'): Promise<CommentWithUser> => {
  // 检查评论是否存在
  const existingComment = await queryOne<Comment>(
    'SELECT * FROM comments WHERE id = ?',
    [commentId]
  );
  
  if (!existingComment) {
    throw new Error('评论不存在');
  }
  
  await execute(
    'UPDATE comments SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [status, commentId]
  );
  
  const updatedComment = await getCommentById(commentId);
  if (!updatedComment) {
    throw new Error('评论更新失败');
  }
  
  return updatedComment;
};

// 删除评论
export const deleteComment = async (commentId: string, userId: string): Promise<void> => {
  // 检查评论是否存在且属于当前用户
  const existingComment = await queryOne<Comment>(
    'SELECT * FROM comments WHERE id = ? AND user_id = ?',
    [commentId, userId]
  );
  
  if (!existingComment) {
    throw new Error('评论不存在或无权限删除');
  }
  
  try {
    await beginTransaction();
    
    // 删除所有子评论
    await execute(
      'DELETE FROM comments WHERE parent_id = ?',
      [commentId]
    );
    
    // 删除评论
    await execute(
      'DELETE FROM comments WHERE id = ?',
      [commentId]
    );
    
    await commitTransaction();
  } catch (error) {
    await rollbackTransaction();
    throw error;
  }
};

// 管理员删除评论
export const deleteCommentByAdmin = async (commentId: string): Promise<void> => {
  // 检查评论是否存在
  const existingComment = await queryOne<Comment>(
    'SELECT * FROM comments WHERE id = ?',
    [commentId]
  );
  
  if (!existingComment) {
    throw new Error('评论不存在');
  }
  
  try {
    await beginTransaction();
    
    // 删除所有子评论
    await execute(
      'DELETE FROM comments WHERE parent_id = ?',
      [commentId]
    );
    
    // 删除评论
    await execute(
      'DELETE FROM comments WHERE id = ?',
      [commentId]
    );
    
    await commitTransaction();
  } catch (error) {
    await rollbackTransaction();
    throw error;
  }
};

// 获取待审核评论数量
export const getPendingCommentsCount = async (): Promise<number> => {
  const result = await queryOne<{ count: number }>(
    'SELECT COUNT(*) as count FROM comments WHERE status = ?',
    ['pending']
  );
  
  return result?.count || 0;
};