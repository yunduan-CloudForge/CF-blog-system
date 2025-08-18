import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';

// 文章统计数据接口
export interface ArticleStats {
  total: number;
  published: number;
  draft: number;
  archived: number;
  totalViews: number;
  totalLikes: number;
  totalComments: number;
  trendData: Array<{ date: string; count: number }>;
  categoryStats: Array<{ category_name: string; article_count: number }>;
  popularArticles: Array<{
    id: number;
    title: string;
    views: number;
    likes: number;
    created_at: string;
  }>;
}

// 我的文章列表接口
export interface MyArticle {
  id: number;
  title: string;
  content: string;
  excerpt: string;
  status: 'draft' | 'published' | 'archived';
  views: number;
  likes: number;
  created_at: string;
  updated_at: string;
  category_id: number;
  category_name?: string;
  tags?: Array<{ id: number; name: string }>;
}

// 文章列表查询参数
export interface MyArticlesQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  category?: string;
  sortBy?: 'created_at' | 'updated_at' | 'views' | 'likes';
  sortOrder?: 'asc' | 'desc';
}

// 文章列表响应
export interface MyArticlesResponse {
  articles: MyArticle[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// 获取文章统计数据的hook
export const useArticleStats = () => {
  const [stats, setStats] = useState<ArticleStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { token } = useAuthStore();

  const fetchStats = async () => {
    if (!token) {
      setError('未登录');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/articles/stats', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.success) {
        setStats(data.data);
      } else {
        throw new Error(data.message || '获取统计数据失败');
      }
    } catch (err) {
      console.error('获取文章统计失败:', err);
      setError(err instanceof Error ? err.message : '获取统计数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [token]);

  return { stats, loading, error, refetch: fetchStats };
};

// 获取我的文章列表的hook
export const useMyArticles = (query: MyArticlesQuery = {}) => {
  const [articles, setArticles] = useState<MyArticle[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { token, user } = useAuthStore();

  const fetchArticles = async () => {
    if (!token || !user) {
      setError('未登录');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      // 构建查询参数
      const params = new URLSearchParams({
        author: user.id.toString(),
        page: (query.page || 1).toString(),
        limit: (query.limit || 10).toString(),
        ...(query.search && { search: query.search }),
        ...(query.status && { status: query.status }),
        ...(query.category && { category: query.category }),
        ...(query.sortBy && { sortBy: query.sortBy }),
        ...(query.sortOrder && { sortOrder: query.sortOrder })
      });

      const response = await fetch(`/api/articles?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.success) {
        setArticles(data.data.articles);
        setTotal(data.data.total);
      } else {
        throw new Error(data.message || '获取文章列表失败');
      }
    } catch (err) {
      console.error('获取文章列表失败:', err);
      setError(err instanceof Error ? err.message : '获取文章列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchArticles();
  }, [token, user, JSON.stringify(query)]);

  return { articles, total, loading, error, refetch: fetchArticles };
};

// 删除文章的hook
export const useDeleteArticle = () => {
  const [loading, setLoading] = useState(false);
  const { token } = useAuthStore();

  const deleteArticle = async (articleId: number): Promise<boolean> => {
    if (!token) {
      throw new Error('未登录');
    }

    try {
      setLoading(true);
      
      const response = await fetch(`/api/articles/${articleId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.success) {
        return true;
      } else {
        throw new Error(data.message || '删除文章失败');
      }
    } catch (err) {
      console.error('删除文章失败:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { deleteArticle, loading };
};

// 批量操作文章的hook
export const useBatchArticleOperations = () => {
  const [loading, setLoading] = useState(false);
  const { token } = useAuthStore();

  const batchUpdateStatus = async (articleIds: number[], status: string): Promise<boolean> => {
    if (!token) {
      throw new Error('未登录');
    }

    try {
      setLoading(true);
      
      // 批量更新文章状态
      const promises = articleIds.map(async (id) => {
        // 先获取文章详情
        const getResponse = await fetch(`/api/articles/${id}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (!getResponse.ok) {
          throw new Error(`获取文章详情失败: ${getResponse.status}`);
        }
        
        const articleData = await getResponse.json();
        if (!articleData.success) {
          throw new Error(articleData.message || '获取文章详情失败');
        }
        
        const article = articleData.data;
        
        // 更新文章状态
        return fetch(`/api/articles/${id}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            title: article.title,
            content: article.content,
            summary: article.summary || article.excerpt,
            status: status,
            category_id: article.category_id,
            tag_ids: article.tags ? article.tags.map((tag: { id: number; name: string }) => tag.id) : []
          })
        });
      });

      const responses = await Promise.all(promises);
      
      // 检查所有请求是否成功
      for (const response of responses) {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        if (!data.success) {
          throw new Error(data.message || '批量更新失败');
        }
      }

      return true;
    } catch (err) {
      console.error('批量更新文章状态失败:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const batchDelete = async (articleIds: number[]): Promise<boolean> => {
    if (!token) {
      throw new Error('未登录');
    }

    try {
      setLoading(true);
      
      // 批量删除文章
      const promises = articleIds.map(id => 
        fetch(`/api/articles/${id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        })
      );

      const responses = await Promise.all(promises);
      
      // 检查所有请求是否成功
      for (const response of responses) {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        if (!data.success) {
          throw new Error(data.message || '批量删除失败');
        }
      }

      return true;
    } catch (err) {
      console.error('批量删除文章失败:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { batchUpdateStatus, batchDelete, loading };
};