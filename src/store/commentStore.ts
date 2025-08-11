import { create } from 'zustand';
import { toast } from 'sonner';

// 评论数据接口
export interface Comment {
  id: number;
  content: string;
  user_id: number;
  article_id: number;
  parent_id: number | null;
  likes: number;
  created_at: string;
  updated_at: string;
  user: {
    id: number;
    username: string;
    avatar?: string;
  };
  replies?: Comment[];
  isLiked?: boolean; // 当前用户是否已点赞
  canDelete?: boolean; // 当前用户是否可删除
}

// 评论表单数据
export interface CommentFormData {
  content: string;
  article_id: number;
  parent_id?: number;
}

// 评论列表查询参数
export interface CommentQuery {
  article_id: number;
  page?: number;
  limit?: number;
  sort?: 'created_at' | 'likes';
  order?: 'asc' | 'desc';
}

// 分页信息接口
export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

// 评论状态接口
interface CommentState {
  // 状态
  commentsByArticle: Record<number, Comment[]>;
  loading: boolean;
  error: string | null;
  pagination: Record<number, PaginationInfo>;
  
  // 操作方法
  fetchComments: (articleId: number, query?: Partial<CommentQuery>) => Promise<void>;
  addComment: (commentData: CommentFormData) => Promise<Comment | null>;
  replyToComment: (articleId: number, parentId: number, content: string) => Promise<Comment | null>;
  likeComment: (articleId: number, commentId: number) => Promise<void>;
  deleteComment: (articleId: number, commentId: number) => Promise<void>;
  
  // 辅助方法
  getComments: (articleId: number) => Comment[];
  getCommentById: (articleId: number, commentId: number) => Comment | null;
  updateComment: (articleId: number, commentId: number, updates: Partial<Comment>) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearComments: (articleId: number) => void;
}

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
const handleCommentError = (error: any): string => {
  if (error.response) {
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
    return '网络连接失败，请检查网络设置';
  } else {
    return error.message || '未知错误，请重试';
  }
};

// 构建评论树结构
const buildCommentTree = (comments: Comment[]): Comment[] => {
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
  
  return rootComments;
};

// 创建评论store
export const useCommentStore = create<CommentState>((set, get) => ({
  // 初始状态
  commentsByArticle: {},
  loading: false,
  error: null,
  pagination: {},
  
  // 获取评论列表
  fetchComments: async (articleId: number, query: Partial<CommentQuery> = {}) => {
    set({ loading: true, error: null });
    
    try {
      const params = new URLSearchParams();
      params.append('article_id', articleId.toString());
      
      if (query.page) params.append('page', query.page.toString());
      if (query.limit) params.append('limit', query.limit.toString());
      if (query.sort) params.append('sort', query.sort);
      if (query.order) params.append('order', query.order);
      
      const response = await fetch(`${API_BASE_URL}/comments?${params}`);
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.message || '获取评论失败');
      }
      
      const { comments, pagination } = data.data;
      const commentTree = buildCommentTree(comments);
      
      set(state => ({
        commentsByArticle: {
          ...state.commentsByArticle,
          [articleId]: commentTree
        },
        pagination: {
          ...state.pagination,
          [articleId]: pagination
        },
        loading: false
      }));
    } catch (error: any) {
      const errorMessage = handleCommentError(error);
      set({ error: errorMessage, loading: false });
      toast.error(errorMessage);
    }
  },
  
  // 添加评论
  addComment: async (commentData: CommentFormData) => {
    set({ loading: true, error: null });
    
    try {
      const response = await createAuthenticatedRequest(`${API_BASE_URL}/comments`, {
        method: 'POST',
        body: JSON.stringify(commentData),
      });
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.message || '发表评论失败');
      }
      
      const newComment = data.data.comment;
      
      set(state => {
        const articleComments = state.commentsByArticle[commentData.article_id] || [];
        const updatedComments = [...articleComments, newComment];
        
        return {
          commentsByArticle: {
            ...state.commentsByArticle,
            [commentData.article_id]: buildCommentTree(updatedComments.flat())
          },
          loading: false
        };
      });
      
      toast.success('评论发表成功');
      return newComment;
    } catch (error: any) {
      const errorMessage = handleCommentError(error);
      set({ error: errorMessage, loading: false });
      toast.error(errorMessage);
      return null;
    }
  },
  
  // 回复评论
  replyToComment: async (articleId: number, parentId: number, content: string) => {
    set({ loading: true, error: null });
    
    try {
      const response = await createAuthenticatedRequest(`${API_BASE_URL}/comments/${parentId}/reply`, {
        method: 'POST',
        body: JSON.stringify({ content }),
      });
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.message || '回复评论失败');
      }
      
      const newReply = data.data.comment;
      
      set(state => {
        const articleComments = state.commentsByArticle[articleId] || [];
        const flatComments = articleComments.flatMap(comment => {
          const allComments = [comment];
          if (comment.replies) {
            allComments.push(...comment.replies);
          }
          return allComments;
        });
        
        const updatedComments = [...flatComments, newReply];
        
        return {
          commentsByArticle: {
            ...state.commentsByArticle,
            [articleId]: buildCommentTree(updatedComments)
          },
          loading: false
        };
      });
      
      toast.success('回复发表成功');
      return newReply;
    } catch (error: any) {
      const errorMessage = handleCommentError(error);
      set({ error: errorMessage, loading: false });
      toast.error(errorMessage);
      return null;
    }
  },
  
  // 点赞评论
  likeComment: async (articleId: number, commentId: number) => {
    try {
      const response = await createAuthenticatedRequest(`${API_BASE_URL}/comments/${commentId}/like`, {
        method: 'POST',
      });
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.message || '点赞操作失败');
      }
      
      const { liked, likes } = data.data;
      
      // 更新评论的点赞状态
      get().updateComment(articleId, commentId, { isLiked: liked, likes });
      
      toast.success(liked ? '点赞成功' : '取消点赞');
    } catch (error: any) {
      const errorMessage = handleCommentError(error);
      toast.error(errorMessage);
    }
  },
  
  // 删除评论
  deleteComment: async (articleId: number, commentId: number) => {
    try {
      const response = await createAuthenticatedRequest(`${API_BASE_URL}/comments/${commentId}`, {
        method: 'DELETE',
      });
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.message || '删除评论失败');
      }
      
      // 重新获取评论列表
      await get().fetchComments(articleId);
      
      toast.success('评论删除成功');
    } catch (error: any) {
      const errorMessage = handleCommentError(error);
      toast.error(errorMessage);
    }
  },
  
  // 获取指定文章的评论
  getComments: (articleId: number) => {
    return get().commentsByArticle[articleId] || [];
  },
  
  // 根据ID获取评论
  getCommentById: (articleId: number, commentId: number) => {
    const comments = get().commentsByArticle[articleId] || [];
    
    const findComment = (commentList: Comment[]): Comment | null => {
      for (const comment of commentList) {
        if (comment.id === commentId) {
          return comment;
        }
        if (comment.replies) {
          const found = findComment(comment.replies);
          if (found) return found;
        }
      }
      return null;
    };
    
    return findComment(comments);
  },
  
  // 更新评论
  updateComment: (articleId: number, commentId: number, updates: Partial<Comment>) => {
    set(state => {
      const comments = state.commentsByArticle[articleId] || [];
      
      const updateCommentInTree = (commentList: Comment[]): Comment[] => {
        return commentList.map(comment => {
          if (comment.id === commentId) {
            return { ...comment, ...updates };
          }
          if (comment.replies) {
            return {
              ...comment,
              replies: updateCommentInTree(comment.replies)
            };
          }
          return comment;
        });
      };
      
      return {
        commentsByArticle: {
          ...state.commentsByArticle,
          [articleId]: updateCommentInTree(comments)
        }
      };
    });
  },
  
  // 设置加载状态
  setLoading: (loading: boolean) => {
    set({ loading });
  },
  
  // 设置错误信息
  setError: (error: string | null) => {
    set({ error });
  },
  
  // 清空指定文章的评论
  clearComments: (articleId: number) => {
    set(state => {
      const { [articleId]: removed, ...rest } = state.commentsByArticle;
      return { commentsByArticle: rest };
    });
  }
}));

// 导出类型
export type { CommentState };