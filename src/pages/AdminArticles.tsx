/**
 * 文章管理页面
 * 模块: 5.3 内容管理系统 - 文章管理
 */

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Search,
  Plus,
  Edit,
  Trash2,
  Eye,
  Calendar,
  User,
  FileText
} from 'lucide-react';
// import { useAdminStore } from '../store/adminStore'; // 暂时未使用
import { authAPI } from '@/store/authStore';
import { toast } from 'sonner';
import AdminNavigation from '@/components/AdminNavigation';

interface Article {
  id: number;
  title: string;
  content: string;
  excerpt: string;
  author_id: number;
  author_name: string;
  status: 'draft' | 'published' | 'archived';
  views: number;
  likes: number;
  created_at: string;
  updated_at: string;
  tags: Array<{ id: number; name: string; color?: string } | string>;
}

export default function AdminArticles() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedArticles, setSelectedArticles] = useState<number[]>([]);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [articleToDelete, setArticleToDelete] = useState<number | null>(null);

  // 获取文章列表
  const fetchArticles = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '10',
        ...(searchTerm && { search: searchTerm }),
        ...(statusFilter !== 'all' && { status: statusFilter })
      });

      const response = await fetch(`/api/articles?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setArticles(data.data.articles || []);
        setTotalPages(data.data.totalPages || 1);
      } else {
        toast.error('获取文章列表失败');
      }
    } catch (error) {
      console.error('获取文章列表失败:', error);
      toast.error('获取文章列表失败');
    } finally {
      setLoading(false);
    }
  };

  // 删除文章
  const handleDeleteArticle = async (id: number) => {
    try {
      const response = await authAPI.authenticatedFetch(`/articles/${id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        toast.success('文章删除成功');
        fetchArticles();
      } else {
        toast.error('删除文章失败');
      }
    } catch (error) {
      console.error('删除文章失败:', error);
      toast.error('删除文章失败');
    }
    setShowDeleteModal(false);
    setArticleToDelete(null);
  };

  // 批量删除文章
  const handleBatchDelete = async () => {
    try {
      const promises = selectedArticles.map(id =>
        authAPI.authenticatedFetch(`/articles/${id}`, {
          method: 'DELETE'
        })
      );

      await Promise.all(promises);
      toast.success(`成功删除 ${selectedArticles.length} 篇文章`);
      setSelectedArticles([]);
      fetchArticles();
    } catch (error) {
      console.error('批量删除失败:', error);
      toast.error('批量删除失败');
    }
  };

  // 更新文章状态
  const handleStatusChange = async (id: number, status: string) => {
    try {
      // 先获取文章详情
      const getResponse = await authAPI.authenticatedFetch(`/articles/${id}`);
      
      if (!getResponse.ok) {
        toast.error('获取文章详情失败');
        return;
      }
      
      const articleData = await getResponse.json();
      if (!articleData.success) {
        toast.error(articleData.message || '获取文章详情失败');
        return;
      }
      
      const article = articleData.data;
      
      // 更新文章状态
      const response = await authAPI.authenticatedFetch(`/articles/${id}`, {
        method: 'PUT',
        body: JSON.stringify({
          title: article.title,
          content: article.content,
          summary: article.summary || article.excerpt,
          status: status,
          category_id: article.category_id,
          tag_ids: article.tags ? article.tags.map((tag: { id: number; name: string; color?: string } | string) => 
            typeof tag === 'string' ? tag : tag.id
          ) : []
        })
      });

      if (response.ok) {
        toast.success('文章状态更新成功');
        fetchArticles();
      } else {
        toast.error('更新文章状态失败');
      }
    } catch (error) {
      console.error('更新文章状态失败:', error);
      toast.error('更新文章状态失败');
    }
  };

  useEffect(() => {
    fetchArticles();
  }, [currentPage, searchTerm, statusFilter, fetchArticles]);

  // const getStatusBadge = (status: string) => {
  //   const statusConfig = {
  //     draft: { label: '草稿', className: 'bg-gray-100 text-gray-800' },
  //     published: { label: '已发布', className: 'bg-green-100 text-green-800' },
  //     archived: { label: '已归档', className: 'bg-yellow-100 text-yellow-800' }
  //   };
  //   const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.draft;
  //   return (
  //     <span className={`px-2 py-1 text-xs font-medium rounded-full ${config.className}`}>
  //       {config.label}
  //     </span>
  //   );
  // };

  return (
    <div className="flex h-screen bg-gray-50">
      <AdminNavigation className="w-64 flex-shrink-0" />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white shadow-sm border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">文章管理</h1>
            <Link
              to="/articles/new"
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              新建文章
            </Link>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-6">
          {/* 搜索和筛选 */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="搜索文章标题或内容..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">所有状态</option>
                  <option value="draft">草稿</option>
                  <option value="published">已发布</option>
                  <option value="archived">已归档</option>
                </select>
                {selectedArticles.length > 0 && (
                  <button
                    onClick={handleBatchDelete}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    删除选中 ({selectedArticles.length})
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* 文章列表 */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            {loading ? (
              <div className="p-8 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-2 text-gray-500">加载中...</p>
              </div>
            ) : articles.length === 0 ? (
              <div className="p-8 text-center">
                <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">暂无文章</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left">
                        <input
                          type="checkbox"
                          checked={selectedArticles.length === articles.length}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedArticles(articles.map(a => a.id));
                            } else {
                              setSelectedArticles([]);
                            }
                          }}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        文章信息
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        作者
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        状态
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        统计
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        创建时间
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        操作
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {articles.map((article) => (
                      <tr key={article.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <input
                            type="checkbox"
                            checked={selectedArticles.includes(article.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedArticles([...selectedArticles, article.id]);
                              } else {
                                setSelectedArticles(selectedArticles.filter(id => id !== article.id));
                              }
                            }}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                        </td>
                        <td className="px-6 py-4">
                          <div>
                            <h3 className="text-sm font-medium text-gray-900 mb-1">
                              {article.title}
                            </h3>
                            <p className="text-sm text-gray-500 line-clamp-2">
                              {article.excerpt}
                            </p>
                            {article.tags && article.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {article.tags.filter(tag => tag != null).map((tag, index) => {
                                  const tagName = typeof tag === 'object' ? tag.name : tag;
                                  const tagColor = typeof tag === 'object' && tag.color ? tag.color : '#3B82F6';
                                  return (
                                    <span
                                      key={index}
                                      className="px-2 py-1 text-xs text-white rounded-full"
                                      style={{ backgroundColor: tagColor }}
                                    >
                                      {tagName}
                                    </span>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center">
                            <User className="w-4 h-4 text-gray-400 mr-2" />
                            <span className="text-sm text-gray-900">{article.author_name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <select
                            value={article.status || 'draft'}
                            onChange={(e) => handleStatusChange(article.id, e.target.value)}
                            className="text-sm border border-gray-300 rounded px-2 py-1 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          >
                            <option value="draft">草稿</option>
                            <option value="published">已发布</option>
                            <option value="archived">已归档</option>
                          </select>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900">
                            <div className="flex items-center gap-4">
                              <span className="flex items-center gap-1">
                                <Eye className="w-4 h-4 text-gray-400" />
                                {article.views}
                              </span>
                              <span className="flex items-center gap-1">
                                ❤️ {article.likes}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-500">
                            <div className="flex items-center gap-1">
                              <Calendar className="w-4 h-4" />
                              {new Date(article.created_at).toLocaleDateString()}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <Link
                              to={`/articles/${article.id}`}
                              className="text-blue-600 hover:text-blue-800 p-1 rounded"
                              title="查看"
                            >
                              <Eye className="w-4 h-4" />
                            </Link>
                            <Link
                              to={`/articles/${article.id}/edit`}
                              className="text-green-600 hover:text-green-800 p-1 rounded"
                              title="编辑"
                            >
                              <Edit className="w-4 h-4" />
                            </Link>
                            <button
                              onClick={() => {
                                setArticleToDelete(article.id);
                                setShowDeleteModal(true);
                              }}
                              className="text-red-600 hover:text-red-800 p-1 rounded"
                              title="删除"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* 分页 */}
            {totalPages > 1 && (
              <div className="px-6 py-4 border-t border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-500">
                    第 {currentPage} 页，共 {totalPages} 页
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                      disabled={currentPage === 1}
                      className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      上一页
                    </button>
                    <button
                      onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                      disabled={currentPage === totalPages}
                      className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      下一页
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* 删除确认模态框 */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-medium text-gray-900 mb-4">确认删除</h3>
            <p className="text-gray-500 mb-6">
              确定要删除这篇文章吗？此操作无法撤销。
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setArticleToDelete(null);
                }}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={() => articleToDelete && handleDeleteArticle(articleToDelete)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}