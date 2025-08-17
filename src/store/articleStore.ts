/**
 * 文章状态管理
 * 使用Zustand管理文章数据和相关操作
 */
import { create } from 'zustand';
import { useAuthStore } from './authStore';

// 文章接口
export interface Article {
  id: number;
  title: string;
  content: string;
  summary: string;
  status: 'draft' | 'published' | 'archived';
  author_id: number;
  category_id: number | null;
  views: number;
  likes: number;
  created_at: string;
  updated_at: string;
  cover_image?: string;
  isLiked?: boolean;
  author?: {
    id: number;
    username: string;
    avatar?: string;
  };
  category?: {
    id: number;
    name: string;
    description?: string;
  };
  tags?: Tag[];
}

// 分类接口
export interface Category {
  id: number;
  name: string;
  description: string;
  created_at: string;
}

// 标签接口
export interface Tag {
  id: number;
  name: string;
  color: string;
  created_at: string;
}

// 分页信息接口
export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// 文章列表查询参数
export interface ArticleQuery {
  page?: number;
  limit?: number;
  search?: string;
  category?: number;
  tag?: number;
  status?: string;
  author?: number;
}

// 文章状态接口
interface ArticleState {
  // 状态
  articles: Article[];
  currentArticle: Article | null;
  categories: Category[];
  tags: Tag[];
  pagination: PaginationInfo;
  isLoading: boolean;
  error: string | null;
  
  // 操作方法
  setArticles: (articles: Article[]) => void;
  setCurrentArticle: (article: Article | null) => void;
  setCategories: (categories: Category[]) => void;
  setTags: (tags: Tag[]) => void;
  setPagination: (pagination: PaginationInfo) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  
  // API调用方法
  fetchArticles: (query?: ArticleQuery) => Promise<boolean>;
  fetchArticleById: (id: number) => Promise<boolean>;
  createArticle: (articleData: Partial<Article>) => Promise<boolean>;
  updateArticle: (id: number, articleData: Partial<Article>) => Promise<boolean>;
  deleteArticle: (id: number) => Promise<boolean>;
  fetchCategories: () => Promise<boolean>;
  fetchTags: () => Promise<boolean>;
  likeArticle: (id: number) => Promise<boolean>;
  checkArticleLikeStatus: (id: number) => Promise<boolean>;
}

// API基础URL
const API_BASE_URL = 'http://localhost:3001/api';

// 创建文章store
export const useArticleStore = create<ArticleState>()(
  (set, get) => ({
    // 初始状态
    articles: [],
    currentArticle: null,
    categories: [],
    tags: [],
    pagination: {
      page: 1,
      limit: 10,
      total: 0,
      totalPages: 0
    },
    isLoading: false,
    error: null,

    // 设置文章列表
    setArticles: (articles: Article[]) => {
      set({ articles });
    },

    // 设置当前文章
    setCurrentArticle: (article: Article | null) => {
      set({ currentArticle: article });
    },

    // 设置分类列表
    setCategories: (categories: Category[]) => {
      set({ categories });
    },

    // 设置标签列表
    setTags: (tags: Tag[]) => {
      set({ tags });
    },

    // 设置分页信息
    setPagination: (pagination: PaginationInfo) => {
      set({ pagination });
    },

    // 设置加载状态
    setLoading: (loading: boolean) => {
      set({ isLoading: loading });
    },

    // 设置错误信息
    setError: (error: string | null) => {
      set({ error });
    },

    // 获取文章列表
    fetchArticles: async (query: ArticleQuery = {}): Promise<boolean> => {
      try {
        set({ isLoading: true, error: null });
        
        const params = new URLSearchParams();
        if (query.page) params.append('page', query.page.toString());
        if (query.limit) params.append('limit', query.limit.toString());
        if (query.search) params.append('search', query.search);
        if (query.category) params.append('category', query.category.toString());
        if (query.tag) params.append('tag', query.tag.toString());
        if (query.status) params.append('status', query.status);
        if (query.author) params.append('author', query.author.toString());

        const response = await fetch(`${API_BASE_URL}/articles?${params.toString()}`);
        const data = await response.json();

        if (data.success) {
          set({
            articles: data.data.articles,
            pagination: data.data.pagination,
            isLoading: false
          });
          return true;
        } else {
          set({ error: data.message || '获取文章列表失败', isLoading: false });
          return false;
        }
      } catch (error) {
        console.error('获取文章列表失败:', error);
        set({ error: '网络请求失败', isLoading: false });
        return false;
      }
    },

    // 根据ID获取文章详情
    fetchArticleById: async (id: number): Promise<boolean> => {
      try {
        set({ isLoading: true, error: null });
        
        const response = await fetch(`${API_BASE_URL}/articles/${id}`);
        const data = await response.json();

        if (data.success) {
          set({ currentArticle: data.data, isLoading: false });
          return true;
        } else {
          set({ error: data.message || '获取文章详情失败', isLoading: false });
          return false;
        }
      } catch {
        console.error('获取文章详情失败');
        set({ error: '网络请求失败', isLoading: false });
        return false;
      }
    },

    // 创建文章
    createArticle: async (articleData: Partial<Article>): Promise<boolean> => {
      try {
        set({ isLoading: true, error: null });
        
        const token = useAuthStore.getState().token;
        if (!token) {
          set({ error: '请先登录', isLoading: false });
          return false;
        }

        const response = await articleAPI.authenticatedFetch('/articles', {
          method: 'POST',
          body: JSON.stringify(articleData),
        });

        const data = await response.json();

        if (data.success) {
          // 刷新文章列表
          await get().fetchArticles();
          set({ isLoading: false });
          return true;
        } else {
          set({ error: data.message || '创建文章失败', isLoading: false });
          return false;
        }
      } catch {
        console.error('创建文章失败');
        set({ error: '网络请求失败', isLoading: false });
        return false;
      }
    },

    // 更新文章
    updateArticle: async (id: number, articleData: Partial<Article>): Promise<boolean> => {
      try {
        set({ isLoading: true, error: null });
        
        const token = useAuthStore.getState().token;
        if (!token) {
          set({ error: '请先登录', isLoading: false });
          return false;
        }

        const response = await articleAPI.authenticatedFetch(`/articles/${id}`, {
          method: 'PUT',
          body: JSON.stringify(articleData),
        });

        const data = await response.json();

        if (data.success) {
          // 更新当前文章和文章列表
          if (get().currentArticle?.id === id) {
            set({ currentArticle: data.data });
          }
          await get().fetchArticles();
          set({ isLoading: false });
          return true;
        } else {
          set({ error: data.message || '更新文章失败', isLoading: false });
          return false;
        }
      } catch {
        console.error('更新文章失败');
        set({ error: '网络请求失败', isLoading: false });
        return false;
      }
    },

    // 删除文章
    deleteArticle: async (id: number): Promise<boolean> => {
      try {
        set({ isLoading: true, error: null });
        
        const token = useAuthStore.getState().token;
        if (!token) {
          set({ error: '请先登录', isLoading: false });
          return false;
        }

        const response = await fetch(`${API_BASE_URL}/articles/${id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        const data = await response.json();

        if (data.success) {
          // 从列表中移除已删除的文章
          const articles = get().articles.filter(article => article.id !== id);
          set({ articles, isLoading: false });
          
          // 如果删除的是当前文章，清空当前文章
          if (get().currentArticle?.id === id) {
            set({ currentArticle: null });
          }
          
          return true;
        } else {
          set({ error: data.message || '删除文章失败', isLoading: false });
          return false;
        }
      } catch {
        console.error('删除文章失败');
        set({ error: '网络请求失败', isLoading: false });
        return false;
      }
    },

    // 获取分类列表
    fetchCategories: async (): Promise<boolean> => {
      try {
        const response = await fetch(`${API_BASE_URL}/categories`);
        const data = await response.json();

        if (data.success) {
          set({ categories: Array.isArray(data.data) ? data.data : [] });
          return true;
        } else {
          console.error('获取分类列表失败:', data.message);
          set({ categories: [] });
          return false;
        }
      } catch {
        console.error('获取分类列表失败');
        set({ categories: [] });
        return false;
      }
    },

    // 获取标签列表
    fetchTags: async (): Promise<boolean> => {
      try {
        const response = await fetch(`${API_BASE_URL}/tags`);
        const data = await response.json();

        if (data.success) {
          set({ tags: Array.isArray(data.data) ? data.data : [] });
          return true;
        } else {
          console.error('获取标签列表失败:', data.message);
          set({ tags: [] });
          return false;
        }
      } catch {
        console.error('获取标签列表失败');
        set({ tags: [] });
        return false;
      }
    },

    // 点赞/取消点赞文章
    likeArticle: async (id: number): Promise<boolean> => {
      try {
        const token = useAuthStore.getState().token;
        if (!token) {
          set({ error: '请先登录' });
          return false;
        }

        const response = await fetch(`${API_BASE_URL}/articles/${id}/like`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        const data = await response.json();

        if (data.success) {
          // 更新文章的点赞数和点赞状态
          const articles = get().articles.map(article => 
            article.id === id ? { 
              ...article, 
              likes: data.data.likes,
              isLiked: data.data.liked 
            } : article
          );
          set({ articles });
          
          // 如果是当前文章，也更新当前文章的点赞数和状态
          if (get().currentArticle?.id === id) {
            set({ 
              currentArticle: { 
                ...get().currentArticle!, 
                likes: data.data.likes,
                isLiked: data.data.liked
              } 
            });
          }
          
          return true;
        } else {
          set({ error: data.message || '点赞操作失败' });
          return false;
        }
      } catch {
        console.error('点赞操作失败');
        set({ error: '网络请求失败' });
        return false;
      }
    },

    // 检查文章点赞状态
    checkArticleLikeStatus: async (id: number): Promise<boolean> => {
      try {
        const token = useAuthStore.getState().token;
        if (!token) {
          return false;
        }

        const response = await fetch(`${API_BASE_URL}/articles/${id}/like/status`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        const data = await response.json();

        if (data.success) {
          // 更新文章的点赞状态
          const articles = get().articles.map(article => 
            article.id === id ? { ...article, isLiked: data.data.liked } : article
          );
          set({ articles });
          
          // 如果是当前文章，也更新当前文章的点赞状态
          if (get().currentArticle?.id === id) {
            set({ 
              currentArticle: { 
                ...get().currentArticle!, 
                isLiked: data.data.liked
              } 
            });
          }
          
          return data.data.liked;
        }
        
        return false;
      } catch {
        console.error('检查点赞状态失败');
        return false;
      }
    },
  })
);

// 导出API调用工具函数
export const articleAPI = {
  // 带认证的请求
  authenticatedFetch: async (url: string, options: RequestInit = {}) => {
    const token = useAuthStore.getState().token;
    
    return fetch(`${API_BASE_URL}${url}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
        ...options.headers,
      },
    });
  },
};