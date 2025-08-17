import { Comment, CommentFormData, CommentQuery, PaginationInfo } from '../store/commentStore';

// API基础URL
const API_BASE_URL = 'http://localhost:3001/api';

// 获取认证token
const getAuthToken = () => {
  return localStorage.getItem('token');
};

// 创建认证请求
const createAuthenticatedRequest = (url: string, options: RequestInit = {}) => {
  const token = getAuthToken();
  return fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
  });
};

// 错误处理工具
export const handleCommentError = (error: {response?: {status: number; data?: {message?: string}}; request?: unknown; message?: string}): string => {
  if (error.response) {
    // API返回的错误
    switch (error.response.status) {
      case 401:
        return '请先登录后再进行操作';
      case 403:
        return '您没有权限进行此操作';
      case 404:
        return '评论不存在或已被删除';
      case 429:
        return '操作过于频繁，请稍后再试';
      default:
        return error.response.data?.message || '操作失败，请重试';
    }
  } else if (error.request) {
    // 网络错误
    return '网络连接失败，请检查网络设置';
  } else {
    // 其他错误
    return error.message || '未知错误，请重试';
  }
};

// 重试机制
export const withRetry = async <T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> => {
  let lastError: Error;
  
  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (i < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
      }
    }
  }
  
  throw lastError;
};

// 评论API服务
export const commentAPI = {
  // 获取评论列表
  getComments: async (query: CommentQuery): Promise<{ comments: Comment[], pagination: PaginationInfo }> => {
    const params = new URLSearchParams();
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined) {
        params.append(key, value.toString());
      }
    });
    
    const response = await fetch(`${API_BASE_URL}/comments?${params}`);
    const data = await response.json();
    
    // 前端调试日志：检查API响应
    console.log('=== 前端API调试日志 ===');
    console.log('API响应成功:', data.success);
    console.log('评论数量:', data.data?.comments?.length || 0);
    if (data.data?.comments) {
      data.data.comments.forEach(comment => {
        console.log(`评论 ${comment.id} 的回复数量:`, comment.replies?.length || 0);
        if (comment.replies && comment.replies.length > 0) {
          console.log(`  回复IDs:`, comment.replies.map(r => r.id));
        }
      });
    }
    console.log('========================');
    
    if (!data.success) {
      throw new Error(data.message || '获取评论失败');
    }
    
    return data.data;
  },
  
  // 创建评论
  createComment: async (commentData: CommentFormData): Promise<Comment> => {
    const response = await createAuthenticatedRequest(`${API_BASE_URL}/comments`, {
      method: 'POST',
      body: JSON.stringify(commentData),
    });
    
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.message || '发表评论失败');
    }
    
    return data.data.comment;
  },
  
  // 回复评论
  replyComment: async (commentId: number, content: string): Promise<Comment> => {
    const response = await createAuthenticatedRequest(`${API_BASE_URL}/comments/${commentId}/reply`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
    
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.message || '回复评论失败');
    }
    
    return data.data.comment;
  },
  
  // 点赞评论
  likeComment: async (commentId: number): Promise<{ liked: boolean, likes: number }> => {
    const response = await createAuthenticatedRequest(`${API_BASE_URL}/comments/${commentId}/like`, {
      method: 'POST',
    });
    
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.message || '点赞操作失败');
    }
    
    return data.data;
  },
  
  // 删除评论
  deleteComment: async (commentId: number): Promise<void> => {
    const response = await createAuthenticatedRequest(`${API_BASE_URL}/comments/${commentId}`, {
      method: 'DELETE',
    });
    
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.message || '删除评论失败');
    }
  },
  
  // 编辑评论
  editComment: async (commentId: number, content: string): Promise<Comment> => {
    const response = await createAuthenticatedRequest(`${API_BASE_URL}/comments/${commentId}`, {
      method: 'PUT',
      body: JSON.stringify({ content }),
    });
    
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.message || '编辑评论失败');
    }
    
    return data.data.comment;
  },
  
  // 举报评论
  reportComment: async (commentId: number, reason: string, description?: string): Promise<void> => {
    const response = await createAuthenticatedRequest(`${API_BASE_URL}/comments/${commentId}/report`, {
      method: 'POST',
      body: JSON.stringify({ reason, description }),
    });
    
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.message || '举报评论失败');
    }
  },
  
  // 获取评论详情
  getCommentById: async (commentId: number): Promise<Comment> => {
    const response = await fetch(`${API_BASE_URL}/comments/${commentId}`);
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.message || '获取评论详情失败');
    }
    
    return data.data.comment;
  },
  
  // 检查用户是否已点赞评论
  checkCommentLike: async (commentId: number): Promise<boolean> => {
    try {
      const response = await createAuthenticatedRequest(`${API_BASE_URL}/comments/${commentId}/like/status`);
      const data = await response.json();
      
      if (!data.success) {
        return false;
      }
      
      return data.data.liked;
    } catch {
      return false;
    }
  },
  
  // 批量检查评论点赞状态
  checkCommentsLike: async (commentIds: number[]): Promise<Record<number, boolean>> => {
    try {
      const response = await createAuthenticatedRequest(`${API_BASE_URL}/comments/likes/batch`, {
        method: 'POST',
        body: JSON.stringify({ commentIds }),
      });
      
      const data = await response.json();
      
      if (!data.success) {
        return {};
      }
      
      return data.data.likes;
    } catch {
      return {};
    }
  }
};

// 评论工具函数
export const commentUtils = {
  // 格式化评论时间
  formatCommentTime: (timestamp: string): string => {
    const now = new Date();
    const commentTime = new Date(timestamp);
    const diffInSeconds = Math.floor((now.getTime() - commentTime.getTime()) / 1000);
    
    if (diffInSeconds < 60) {
      return '刚刚';
    } else if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60);
      return `${minutes}分钟前`;
    } else if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600);
      return `${hours}小时前`;
    } else if (diffInSeconds < 604800) { // 7天内
      const days = Math.floor(diffInSeconds / 86400);
      return `${days}天前`;
    } else if (diffInSeconds < 2592000) { // 30天内
      const weeks = Math.floor(diffInSeconds / 604800);
      return `${weeks}周前`;
    } else {
      return commentTime.toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
  },
  
  // 获取详细时间信息
  getDetailedTimeInfo: (timestamp: string): { relative: string; absolute: string; tooltip: string } => {
    const commentTime = new Date(timestamp);
    const relative = commentUtils.formatCommentTime(timestamp);
    const absolute = commentTime.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    const tooltip = `发表于 ${absolute}`;
    
    return { relative, absolute, tooltip };
  },
  
  // 验证评论内容
  validateCommentContent: (content: string): { isValid: boolean; error?: string } => {
    if (!content || content.trim().length === 0) {
      return { isValid: false, error: '评论内容不能为空' };
    }
    
    if (content.trim().length < 2) {
      return { isValid: false, error: '评论内容至少需要2个字符' };
    }
    
    if (content.length > 1000) {
      return { isValid: false, error: '评论内容不能超过1000个字符' };
    }
    
    // 检查是否包含敏感词（简单示例）
    const sensitiveWords = ['垃圾', '傻逼', '操你妈'];
    const hasSensitiveWord = sensitiveWords.some(word => content.includes(word));
    
    if (hasSensitiveWord) {
      return { isValid: false, error: '评论内容包含敏感词汇，请修改后重试' };
    }
    
    return { isValid: true };
  },
  
  // 构建评论树结构
  buildCommentTree: (comments: Comment[]): Comment[] => {
    const commentMap = new Map<number, Comment>();
    const rootComments: Comment[] = [];
    
    // 创建评论映射
    comments.forEach(comment => {
      commentMap.set(comment.id, { ...comment, replies: [] });
    });
    
    // 构建树结构
    comments.forEach(comment => {
      const commentWithReplies = commentMap.get(comment.id)!;
      
      if (comment.parent_id === null) {
        rootComments.push(commentWithReplies);
      } else {
        const parent = commentMap.get(comment.parent_id);
        if (parent) {
          parent.replies!.push(commentWithReplies);
        }
      }
    });
    
    // 按时间排序
    const sortByTime = (comments: Comment[]): Comment[] => {
      return comments
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
        .map(comment => ({
          ...comment,
          replies: comment.replies ? sortByTime(comment.replies) : []
        }));
    };
    
    return sortByTime(rootComments);
  },
  
  // 扁平化评论树
  flattenCommentTree: (comments: Comment[]): Comment[] => {
    const result: Comment[] = [];
    
    const flatten = (commentList: Comment[]) => {
      commentList.forEach(comment => {
        result.push(comment);
        if (comment.replies && comment.replies.length > 0) {
          flatten(comment.replies);
        }
      });
    };
    
    flatten(comments);
    return result;
  },
  
  // 计算评论总数
  countComments: (comments: Comment[]): number => {
    let count = 0;
    
    const countRecursive = (commentList: Comment[]) => {
      commentList.forEach(comment => {
        count++;
        if (comment.replies && comment.replies.length > 0) {
          countRecursive(comment.replies);
        }
      });
    };
    
    countRecursive(comments);
    return count;
  },
  
  // 生成用户头像占位符
  generateAvatarPlaceholder: (username: string): string => {
    const colors = [
      '#f56565', '#ed8936', '#ecc94b', '#48bb78',
      '#38b2ac', '#4299e1', '#667eea', '#9f7aea',
      '#ed64a6', '#f687b3'
    ];
    
    const charCode = username.charCodeAt(0) || 0;
    const colorIndex = charCode % colors.length;
    
    return colors[colorIndex];
  }
};

// 导出默认API
export default commentAPI;