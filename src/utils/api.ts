import { useAuthStore } from '@/store/authStore';
import { errorMonitor } from '@/utils/errorMonitor';
import {
  User,
  Article,
  Category,
  Tag,
  Comment,
  CreateUser,
  CreateArticle,
  UpdateArticle,
  CreateCategory,
  CreateTag,
  CreateComment,
  ApiResponse,
  PaginatedResponse
} from '@/types/schemas';
import {
  validateUser,
  validateArticle,
  validateCategory,
  validateTag,
  validateComment,
  validateApiResponse,
  validatePaginatedResponse
} from '@/utils/typeGuards';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

class ApiClient {
  private baseURL: string;
  private isRefreshing = false;
  private refreshPromise: Promise<string> | null = null;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
  }

  private async refreshToken(): Promise<string> {
    if (this.isRefreshing && this.refreshPromise) {
      return this.refreshPromise;
    }

    this.isRefreshing = true;
    this.refreshPromise = this.performTokenRefresh();

    try {
      const newToken = await this.refreshPromise;
      return newToken;
    } finally {
      this.isRefreshing = false;
      this.refreshPromise = null;
    }
  }

  private async performTokenRefresh(): Promise<string> {
    try {
      const response = await fetch(`${this.baseURL}/auth/refresh`, {
        method: 'POST',
        credentials: 'include', // 发送HttpOnly cookies
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Token refresh failed');
      }

      const data = await response.json();
      if (data.success && data.data?.accessToken) {
        // 更新store中的token
        const authStore = useAuthStore.getState();
        if (authStore.user) {
          authStore.login(authStore.user, data.data.accessToken);
        }
        return data.data.accessToken;
      }

      throw new Error('Invalid refresh response');
    } catch (error) {
      // 刷新失败，清除认证状态
      useAuthStore.getState().logout();
      throw error;
    }
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    retryCount = 0
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;
    const token = useAuthStore.getState().token;
    const startTime = performance.now();
    const requestId = `${options.method || 'GET'}_${endpoint}_${Date.now()}`;

    const config: RequestInit = {
      credentials: 'include', // 发送cookies
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(url, config);
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      // 记录API性能
      errorMonitor.capturePerformance({
        url: endpoint,
        loadTime: duration,
        domContentLoaded: 0,
        timestamp: Date.now(),
        userAgent: navigator.userAgent,
        sessionId: errorMonitor.getSessionId()
      });
      
      if (!response.ok) {
        if (response.status === 401 && retryCount === 0) {
          // Token可能过期，尝试刷新
          try {
            await this.refreshToken();
            // 重试请求
            return this.request<T>(endpoint, options, retryCount + 1);
          } catch (refreshError) {
            throw new Error('认证失败，请重新登录');
          }
        }
        
        const errorData = await response.json().catch(() => ({ error: '请求失败' }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      // 处理204 No Content响应
      if (response.status === 204) {
        return {} as T;
      }

      const data = await response.json();
      return data as T;
    } catch (error) {
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      // 记录API错误
      errorMonitor.capturePerformance({
        url: endpoint,
        loadTime: duration,
        domContentLoaded: 0,
        timestamp: Date.now(),
        userAgent: navigator.userAgent,
        sessionId: errorMonitor.getSessionId()
      });
      
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('网络请求失败');
    }
  }

  async get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  async post<T>(endpoint: string, data?: Record<string, unknown>): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : null
    });
  }

  async put<T>(endpoint: string, data?: Record<string, unknown>): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : null
    });
  }

  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }

  async upload<T>(endpoint: string, formData: FormData): Promise<T> {
    const token = useAuthStore.getState().token;
    
    const config: RequestInit = {
      method: 'POST',
      headers: {
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: formData,
    };

    try {
      const response = await fetch(`${this.baseURL}${endpoint}`, config);
      
      if (!response.ok) {
        if (response.status === 401) {
          useAuthStore.getState().logout();
          throw new Error('认证失败，请重新登录');
        }
        
        const errorData = await response.json().catch(() => ({ error: '上传失败' }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      return data as T;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('上传失败');
    }
  }
}

export const api = new ApiClient(API_BASE_URL);

// 认证相关API
export const authApi = {
  login: async (email: string, password: string): Promise<{ accessToken: string; user: User }> => {
    const response = await api.post<ApiResponse<{ accessToken: string; user: unknown }>>('/auth/login', { email, password });
    const validatedResponse = validateApiResponse(response);
    if (!validatedResponse.success || !validatedResponse.data) {
      throw new Error(validatedResponse.message || '登录失败');
    }
    const user = validatedResponse.data.user as any;
    return { 
      accessToken: validatedResponse.data.accessToken, 
      user: {
        ...user,
        name: user.username,
        createdAt: user.created_at,
        updatedAt: user.updated_at
      }
    };
  },
  
  register: async (userData: CreateUser): Promise<{ user: User }> => {
    const response = await api.post<ApiResponse<{ user: unknown }>>('/auth/register', userData);
    const validatedResponse = validateApiResponse(response);
    if (!validatedResponse.success || !validatedResponse.data) {
      throw new Error(validatedResponse.message || '注册失败');
    }
    const user = validatedResponse.data.user as any;
    return { 
      user: {
        ...user,
        name: user.username,
        createdAt: user.created_at,
        updatedAt: user.updated_at
      }
    };
  },
  
  getCurrentUser: async (): Promise<User> => {
    const response = await api.get<{ success: boolean; user: any }>('/auth/me');
    if (!response.success || !response.user) {
      throw new Error('获取用户信息失败');
    }
    const user = response.user;
    return {
      ...user,
      name: user.username,
      createdAt: user.created_at,
      updatedAt: user.updated_at
    };
  },

  updateProfile: async (data: { username?: string; email?: string; bio?: string }): Promise<User> => {
    const response = await api.put<ApiResponse<{ user: unknown }>>('/auth/profile', data);
    const validatedResponse = validateApiResponse(response);
    if (!validatedResponse.success || !validatedResponse.data) {
      throw new Error(validatedResponse.message || '更新资料失败');
    }
    const user = validatedResponse.data.user as any;
    return {
      ...user,
      name: user.username,
      createdAt: user.created_at,
      updatedAt: user.updated_at
    };
  },

  changePassword: async (data: { currentPassword: string; newPassword: string }): Promise<void> => {
    const response = await api.put<ApiResponse<null>>('/auth/change-password', data);
    const validatedResponse = validateApiResponse(response);
    if (!validatedResponse.success) {
      throw new Error(validatedResponse.message || '修改密码失败');
    }
  },
};

// 用户相关API
export const userApi = {
  getUsers: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
    role?: string;
  }): Promise<PaginatedResponse<User>> => {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          searchParams.append(key, String(value));
        }
      });
    }
    const queryString = searchParams.toString();
    const response = await api.get<PaginatedResponse<unknown>>(`/users${queryString ? `?${queryString}` : ''}`);
    const paginatedResponse = validatePaginatedResponse(response);
    // 转换每个用户项的字段
    if (paginatedResponse.data) {
      paginatedResponse.data = paginatedResponse.data.map((user: any) => ({
        ...user,
        name: user.username,
        createdAt: user.created_at,
        updatedAt: user.updated_at
      }));
    } else {
      paginatedResponse.data = [];
    }
    return paginatedResponse;
  },
  
  getAuthors: async (): Promise<User[]> => {
    const response = await api.get<ApiResponse<{ authors: unknown[] }>>('/users/authors');
    const validatedResponse = validateApiResponse(response);
    if (!validatedResponse.success || !validatedResponse.data) {
      throw new Error(validatedResponse.message || '获取作者列表失败');
    }
    return validatedResponse.data.authors.map((user: any) => ({
      ...user,
      name: user.username,
      createdAt: user.created_at,
      updatedAt: user.updated_at
    }));
  },
};

// 文章相关API
export const articleApi = {
  getArticles: async (params?: {
    page?: number;
    limit?: number;
    category?: string;
    tag?: string;
    search?: string;
    status?: string;
    author?: string;
  }): Promise<PaginatedResponse<Article>> => {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          searchParams.append(key, String(value));
        }
      });
    }
    const queryString = searchParams.toString();
    const response = await api.get<PaginatedResponse<unknown>>(`/articles${queryString ? `?${queryString}` : ''}`);
    const paginatedResponse = validatePaginatedResponse(response);
    // 验证每个文章项
    if (paginatedResponse.data) {
      paginatedResponse.data = paginatedResponse.data.map(validateArticle);
    } else {
      paginatedResponse.data = [];
    }
    return paginatedResponse;
  },
  
  getArticle: async (id: string): Promise<Article> => {
    const response = await api.get<ApiResponse<{ article: unknown }>>(`/articles/${id}`);
    const validatedResponse = validateApiResponse(response);
    if (!validatedResponse.success || !validatedResponse.data) {
      throw new Error(validatedResponse.message || '获取文章失败');
    }
    return validateArticle(validatedResponse.data.article);
  },
  
  createArticle: async (data: CreateArticle): Promise<Article> => {
    const response = await api.post<ApiResponse<{ article: unknown }>>('/articles', data);
    const validatedResponse = validateApiResponse(response);
    if (!validatedResponse.success || !validatedResponse.data) {
      throw new Error(validatedResponse.message || '创建文章失败');
    }
    return validateArticle(validatedResponse.data.article);
  },
  
  updateArticle: async (id: string, data: UpdateArticle): Promise<Article> => {
    const response = await api.put<ApiResponse<{ article: unknown }>>(`/articles/${id}`, data);
    const validatedResponse = validateApiResponse(response);
    if (!validatedResponse.success || !validatedResponse.data) {
      throw new Error(validatedResponse.message || '更新文章失败');
    }
    return validateArticle(validatedResponse.data.article);
  },
  
  deleteArticle: async (id: string): Promise<void> => {
    const response = await api.delete<ApiResponse<null>>(`/articles/${id}`);
    const validatedResponse = validateApiResponse(response);
    if (!validatedResponse.success) {
      throw new Error(validatedResponse.message || '删除文章失败');
    }
  },
  
  getCategories: async (): Promise<Category[]> => {
    const response = await api.get<ApiResponse<{ categories: unknown[] }>>('/articles/categories');
    const validatedResponse = validateApiResponse(response);
    if (!validatedResponse.success || !validatedResponse.data) {
      throw new Error(validatedResponse.message || '获取分类失败');
    }
    return validatedResponse.data.categories.map((category: any) => ({
      ...category,
      createdAt: category.created_at,
      updatedAt: category.updated_at
    }));
  },
  
  getTags: async (): Promise<Tag[]> => {
    const response = await api.get<ApiResponse<{ tags: unknown[] }>>('/articles/tags');
    const validatedResponse = validateApiResponse(response);
    if (!validatedResponse.success || !validatedResponse.data) {
      throw new Error(validatedResponse.message || '获取标签失败');
    }
    return validatedResponse.data.tags.map((tag: any) => ({
      ...tag,
      createdAt: tag.created_at,
      updatedAt: tag.updated_at
    }));
  },
};

// 分类相关API
export const categoryApi = {
  getCategories: async (withStats = false): Promise<Category[]> => {
    const params = withStats ? '?withStats=true' : '';
    const response = await api.get<ApiResponse<{ categories: unknown[] }>>(`/categories${params}`);
    const validatedResponse = validateApiResponse(response);
    if (!validatedResponse.success || !validatedResponse.data) {
      throw new Error(validatedResponse.message || '获取分类失败');
    }
    return validatedResponse.data.categories.map(category => {
      const cat = category as any;
      return {
        id: cat.id,
        name: cat.name,
        slug: cat.slug,
        description: cat.description,
        createdAt: cat.created_at,
        updatedAt: cat.updated_at
      } as Category;
    });
  },
  
  getCategory: async (id: string): Promise<Category> => {
    const response = await api.get<ApiResponse<{ category: unknown }>>(`/categories/${id}`);
    const validatedResponse = validateApiResponse(response);
    if (!validatedResponse.success || !validatedResponse.data) {
      throw new Error(validatedResponse.message || '获取分类失败');
    }
    const cat = validatedResponse.data.category as any;
    return {
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      description: cat.description,
      createdAt: cat.created_at,
      updatedAt: cat.updated_at
    } as Category;
  },
  
  createCategory: async (data: CreateCategory): Promise<Category> => {
    const response = await api.post<ApiResponse<{ category: unknown }>>('/categories', data);
    const validatedResponse = validateApiResponse(response);
    if (!validatedResponse.success || !validatedResponse.data) {
      throw new Error(validatedResponse.message || '创建分类失败');
    }
    const cat = validatedResponse.data.category as any;
    return {
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      description: cat.description,
      createdAt: cat.created_at,
      updatedAt: cat.updated_at
    } as Category;
  },
  
  updateCategory: async (id: string, data: Partial<CreateCategory>): Promise<Category> => {
    const response = await api.put<ApiResponse<{ category: unknown }>>(`/categories/${id}`, data);
    const validatedResponse = validateApiResponse(response);
    if (!validatedResponse.success || !validatedResponse.data) {
      throw new Error(validatedResponse.message || '更新分类失败');
    }
    const cat = validatedResponse.data.category as any;
    return {
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      description: cat.description,
      createdAt: cat.created_at,
      updatedAt: cat.updated_at
    } as Category;
  },
  
  deleteCategory: async (id: string): Promise<void> => {
    const response = await api.delete<ApiResponse<null>>(`/categories/${id}`);
    const validatedResponse = validateApiResponse(response);
    if (!validatedResponse.success) {
      throw new Error(validatedResponse.message || '删除分类失败');
    }
  },
};

// 标签相关API
export const tagApi = {
  getTags: async (withStats?: boolean, popular?: boolean): Promise<Tag[]> => {
    const params = new URLSearchParams();
    if (withStats) params.append('withStats', 'true');
    if (popular) params.append('popular', 'true');
    const queryString = params.toString();
    const response = await api.get<ApiResponse<{ tags: unknown[] }>>(`/tags${queryString ? `?${queryString}` : ''}`);
    const validatedResponse = validateApiResponse(response);
    if (!validatedResponse.success || !validatedResponse.data) {
      throw new Error(validatedResponse.message || '获取标签失败');
    }
    return validatedResponse.data.tags.map((tag: any) => ({
      ...tag,
      createdAt: tag.created_at,
      updatedAt: tag.updated_at
    }));
  },
  
  getTag: async (id: string): Promise<Tag> => {
    const response = await api.get<ApiResponse<{ tag: unknown }>>(`/tags/${id}`);
    const validatedResponse = validateApiResponse(response);
    if (!validatedResponse.success || !validatedResponse.data) {
      throw new Error(validatedResponse.message || '获取标签失败');
    }
    const tag = validatedResponse.data.tag as any;
    return {
      ...tag,
      createdAt: tag.created_at,
      updatedAt: tag.updated_at
    };
  },
  
  createTag: async (data: CreateTag): Promise<Tag> => {
    const response = await api.post<ApiResponse<{ tag: unknown }>>('/tags', data);
    const validatedResponse = validateApiResponse(response);
    if (!validatedResponse.success || !validatedResponse.data) {
      throw new Error(validatedResponse.message || '创建标签失败');
    }
    const tag = validatedResponse.data.tag as any;
    return {
      ...tag,
      createdAt: tag.created_at,
      updatedAt: tag.updated_at
    };
  },
  
  updateTag: async (id: string, data: Partial<CreateTag>): Promise<Tag> => {
    const response = await api.put<ApiResponse<{ tag: unknown }>>(`/tags/${id}`, data);
    const validatedResponse = validateApiResponse(response);
    if (!validatedResponse.success || !validatedResponse.data) {
      throw new Error(validatedResponse.message || '更新标签失败');
    }
    const tag = validatedResponse.data.tag as any;
    return {
      ...tag,
      createdAt: tag.created_at,
      updatedAt: tag.updated_at
    };
  },
  
  deleteTag: async (id: string): Promise<void> => {
    const response = await api.delete<ApiResponse<null>>(`/tags/${id}`);
    const validatedResponse = validateApiResponse(response);
    if (!validatedResponse.success) {
      throw new Error(validatedResponse.message || '删除标签失败');
    }
  },
};

// 评论相关API
export const commentApi = {
  getComments: async (params?: {
    page?: number;
    limit?: number;
    articleId?: string;
    status?: string;
    author?: string;
  }): Promise<PaginatedResponse<Comment>> => {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          searchParams.append(key, String(value));
        }
      });
    }
    const queryString = searchParams.toString();
    const response = await api.get<PaginatedResponse<unknown>>(`/comments${queryString ? `?${queryString}` : ''}`);
    const paginatedResponse = validatePaginatedResponse(response);
    // 验证每个评论项
    if (paginatedResponse.data) {
      paginatedResponse.data = paginatedResponse.data.map(validateComment);
    } else {
      paginatedResponse.data = [];
    }
    return paginatedResponse;
  },
  
  getArticleComments: async (articleId: string): Promise<Comment[]> => {
    const response = await api.get<ApiResponse<{ comments: unknown[] }>>(`/comments/article/${articleId}/tree`);
    const validatedResponse = validateApiResponse(response);
    if (!validatedResponse.success || !validatedResponse.data) {
      throw new Error(validatedResponse.message || '获取评论失败');
    }
    return validatedResponse.data.comments.map(validateComment);
  },
  
  createComment: async (data: CreateComment): Promise<Comment> => {
    const response = await api.post<ApiResponse<{ comment: unknown }>>('/comments', data);
    const validatedResponse = validateApiResponse(response);
    if (!validatedResponse.success || !validatedResponse.data) {
      throw new Error(validatedResponse.message || '创建评论失败');
    }
    return validateComment(validatedResponse.data.comment);
  },
  
  updateComment: async (id: string, data: Partial<CreateComment>): Promise<Comment> => {
    const response = await api.put<ApiResponse<{ comment: unknown }>>(`/comments/${id}`, data);
    const validatedResponse = validateApiResponse(response);
    if (!validatedResponse.success || !validatedResponse.data) {
      throw new Error(validatedResponse.message || '更新评论失败');
    }
    return validateComment(validatedResponse.data.comment);
  },
  
  deleteComment: async (id: string): Promise<void> => {
    const response = await api.delete<ApiResponse<null>>(`/comments/${id}`);
    const validatedResponse = validateApiResponse(response);
    if (!validatedResponse.success) {
      throw new Error(validatedResponse.message || '删除评论失败');
    }
  },
  
  updateCommentStatus: async (id: string, status: string): Promise<Comment> => {
    const response = await api.put<ApiResponse<{ comment: unknown }>>(`/comments/${id}/status`, { status });
    const validatedResponse = validateApiResponse(response);
    if (!validatedResponse.success || !validatedResponse.data) {
      throw new Error(validatedResponse.message || '更新评论状态失败');
    }
    return validateComment(validatedResponse.data.comment);
  },
  
  deleteCommentByAdmin: async (id: string): Promise<void> => {
    const response = await api.delete<ApiResponse<null>>(`/comments/${id}/admin`);
    const validatedResponse = validateApiResponse(response);
    if (!validatedResponse.success) {
      throw new Error(validatedResponse.message || '删除评论失败');
    }
  },
  
  getPendingCommentsCount: async (): Promise<number> => {
    const response = await api.get<ApiResponse<{ count: number }>>('/comments/pending/count');
    const validatedResponse = validateApiResponse(response);
    if (!validatedResponse.success || !validatedResponse.data) {
      throw new Error(validatedResponse.message || '获取待审核评论数量失败');
    }
    return validatedResponse.data.count;
  },
};

// 监控相关API
export const monitoringApi = {
  // 获取监控统计数据
  getStats: async (params?: { startDate?: string; endDate?: string; type?: string }) => {
    const queryParams = new URLSearchParams();
    if (params?.startDate) queryParams.append('startDate', params.startDate);
    if (params?.endDate) queryParams.append('endDate', params.endDate);
    if (params?.type) queryParams.append('type', params.type);
    
    const url = `/monitoring/stats${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
    const response = await api.get<ApiResponse<any>>(url);
    const validatedResponse = validateApiResponse(response);
    if (!validatedResponse.success) {
      throw new Error(validatedResponse.message || '获取监控统计数据失败');
    }
    return validatedResponse.data;
  },

  // 获取错误日志
  getErrorLogs: async (params?: { limit?: number; offset?: number }) => {
    const queryParams = new URLSearchParams();
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.offset) queryParams.append('offset', params.offset.toString());
    
    const url = `/monitoring/errors${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
    const response = await api.get<ApiResponse<any>>(url);
    const validatedResponse = validateApiResponse(response);
    if (!validatedResponse.success) {
      throw new Error(validatedResponse.message || '获取错误日志失败');
    }
    return validatedResponse.data;
  },

  // 获取健康状态
  getHealth: async () => {
    const response = await api.get<ApiResponse<any>>('/monitoring/health');
    const validatedResponse = validateApiResponse(response);
    if (!validatedResponse.success) {
      throw new Error(validatedResponse.message || '获取健康状态失败');
    }
    return validatedResponse.data;
  },

  // 发送监控数据
  sendMonitoringData: async (data: { errors?: any[]; performance?: any[]; userActions?: any[] }) => {
    const response = await api.post<ApiResponse<any>>('/monitoring', data);
    const validatedResponse = validateApiResponse(response);
    if (!validatedResponse.success) {
      throw new Error(validatedResponse.message || '发送监控数据失败');
    }
    return validatedResponse.data;
  },
};