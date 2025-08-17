import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FileText,
  Eye,
  Heart,
  Edit,
  Trash2,
  Plus,
  Search,
  CheckSquare,
  Square,
  TrendingUp,
  Calendar,
  Tag,
  ArrowLeft
} from 'lucide-react';
import {
  useArticleStats,
  useMyArticles,
  useDeleteArticle,
  useBatchArticleOperations,
  type MyArticlesQuery
} from '../hooks/useMyArticles';
import { useAuthStore } from '../store/authStore';

/**
 * 模块 6.2: 文章管理面板
 * 
 * 功能说明:
 * - 我的文章列表页面
 * - 文章状态管理
 * - 文章统计功能
 * - 文章编辑入口
 * - 批量操作功能
 */
const MyArticles: React.FC = () => {
  const { user } = useAuthStore();
  const [query, setQuery] = useState<MyArticlesQuery>({
    page: 1,
    limit: 10,
    sortBy: 'updated_at',
    sortOrder: 'desc'
  });
  const [selectedArticles, setSelectedArticles] = useState<number[]>([]);
  const [showBatchActions, setShowBatchActions] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // 使用自定义hooks
  const { stats, loading: statsLoading } = useArticleStats();
  const { articles, total, loading: articlesLoading, error: articlesError, refetch } = useMyArticles(query);
  const { deleteArticle, loading: deleteLoading } = useDeleteArticle();
  const { batchUpdateStatus, batchDelete, loading: batchLoading } = useBatchArticleOperations();

  // 处理搜索
  const handleSearch = () => {
    setQuery(prev => ({ ...prev, search: searchTerm, page: 1 }));
  };

  // 处理状态筛选
  const handleStatusFilter = (status: string) => {
    setStatusFilter(status);
    setQuery(prev => ({ ...prev, status: status || undefined, page: 1 }));
  };

  // 处理排序
  const handleSort = (sortBy: string) => {
    setQuery(prev => ({
      ...prev,
      sortBy: sortBy as 'created_at' | 'updated_at' | 'views' | 'likes',
      sortOrder: prev.sortBy === sortBy && prev.sortOrder === 'desc' ? 'asc' : 'desc'
    }));
  };

  // 处理分页
  const handlePageChange = (page: number) => {
    setQuery(prev => ({ ...prev, page }));
  };

  // 处理文章选择
  const handleSelectArticle = (articleId: number) => {
    setSelectedArticles(prev => {
      const newSelected = prev.includes(articleId)
        ? prev.filter(id => id !== articleId)
        : [...prev, articleId];
      setShowBatchActions(newSelected.length > 0);
      return newSelected;
    });
  };

  // 全选/取消全选
  const handleSelectAll = () => {
    if (selectedArticles.length === articles.length) {
      setSelectedArticles([]);
      setShowBatchActions(false);
    } else {
      const allIds = articles.map(article => article.id);
      setSelectedArticles(allIds);
      setShowBatchActions(true);
    }
  };

  // 删除单篇文章
  const handleDeleteArticle = async (articleId: number) => {
    if (window.confirm('确定要删除这篇文章吗？')) {
      try {
        await deleteArticle(articleId);
        refetch();
        alert('文章删除成功');
      } catch (error) {
        alert('删除失败: ' + (error as Error).message);
      }
    }
  };

  // 批量更新状态
  const handleBatchUpdateStatus = async (status: string) => {
    try {
      await batchUpdateStatus(selectedArticles, status);
      setSelectedArticles([]);
      setShowBatchActions(false);
      refetch();
      alert('批量更新成功');
    } catch (error) {
      alert('批量更新失败: ' + (error as Error).message);
    }
  };

  // 批量删除
  const handleBatchDelete = async () => {
    if (window.confirm(`确定要删除选中的 ${selectedArticles.length} 篇文章吗？`)) {
      try {
        await batchDelete(selectedArticles);
        setSelectedArticles([]);
        setShowBatchActions(false);
        refetch();
        alert('批量删除成功');
      } catch (error) {
        alert('批量删除失败: ' + (error as Error).message);
      }
    }
  };

  // 获取状态显示样式
  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'published':
        return 'bg-green-100 text-green-800';
      case 'draft':
        return 'bg-yellow-100 text-yellow-800';
      case 'archived':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // 获取状态显示文本
  const getStatusText = (status: string) => {
    switch (status) {
      case 'published':
        return '已发布';
      case 'draft':
        return '草稿';
      case 'archived':
        return '已归档';
      default:
        return status;
    }
  };

  // 格式化日期
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // 计算总页数
  const totalPages = Math.ceil(total / (query.limit || 10));

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <p className="text-gray-500">请先登录</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-4">
          <Link
            to="/user/center"
            className="text-gray-600 hover:text-blue-600 transition-colors flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-50"
          >
            <ArrowLeft className="w-4 h-4" />
            返回用户中心
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">我的文章管理</h1>
        </div>
        <Link
          to="/write"
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          新建文章
        </Link>
      </div>
      
      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-700 mb-2">总文章数</h3>
              <p className="text-3xl font-bold text-blue-600">
                {statsLoading ? '...' : stats?.total || 0}
              </p>
            </div>
            <FileText className="w-8 h-8 text-blue-600" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-700 mb-2">已发布</h3>
              <p className="text-3xl font-bold text-green-600">
                {statsLoading ? '...' : stats?.published || 0}
              </p>
            </div>
            <TrendingUp className="w-8 h-8 text-green-600" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-700 mb-2">草稿</h3>
              <p className="text-3xl font-bold text-yellow-600">
                {statsLoading ? '...' : stats?.draft || 0}
              </p>
            </div>
            <Edit className="w-8 h-8 text-yellow-600" />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-700 mb-2">总浏览量</h3>
              <p className="text-3xl font-bold text-purple-600">
                {statsLoading ? '...' : stats?.totalViews || 0}
              </p>
            </div>
            <Eye className="w-8 h-8 text-purple-600" />
          </div>
        </div>
      </div>

      {/* 搜索和筛选 */}
      <div className="bg-white rounded-lg shadow mb-6">
        <div className="p-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="搜索文章标题或内容..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <select
                value={statusFilter}
                onChange={(e) => handleStatusFilter(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">全部状态</option>
                <option value="published">已发布</option>
                <option value="draft">草稿</option>
                <option value="archived">已归档</option>
              </select>
              <button
                onClick={handleSearch}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
              >
                <Search className="w-4 h-4" />
                搜索
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 批量操作栏 */}
      {showBatchActions && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between">
            <span className="text-blue-800">
              已选择 {selectedArticles.length} 篇文章
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => handleBatchUpdateStatus('published')}
                disabled={batchLoading}
                className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700 disabled:opacity-50"
              >
                批量发布
              </button>
              <button
                onClick={() => handleBatchUpdateStatus('draft')}
                disabled={batchLoading}
                className="bg-yellow-600 text-white px-3 py-1 rounded text-sm hover:bg-yellow-700 disabled:opacity-50"
              >
                批量转草稿
              </button>
              <button
                onClick={() => handleBatchUpdateStatus('archived')}
                disabled={batchLoading}
                className="bg-gray-600 text-white px-3 py-1 rounded text-sm hover:bg-gray-700 disabled:opacity-50"
              >
                批量归档
              </button>
              <button
                onClick={handleBatchDelete}
                disabled={batchLoading}
                className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700 disabled:opacity-50"
              >
                批量删除
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 文章列表 */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold text-gray-900">文章列表</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={handleSelectAll}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-800"
              >
                {selectedArticles.length === articles.length && articles.length > 0 ? (
                  <CheckSquare className="w-4 h-4" />
                ) : (
                  <Square className="w-4 h-4" />
                )}
                全选
              </button>
            </div>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          {articlesLoading ? (
            <div className="p-8 text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="mt-2 text-gray-500">加载中...</p>
            </div>
          ) : articlesError ? (
            <div className="p-8 text-center">
              <p className="text-red-500">加载失败: {articlesError}</p>
              <button
                onClick={() => refetch()}
                className="mt-2 text-blue-600 hover:text-blue-800"
              >
                重试
              </button>
            </div>
          ) : articles.length === 0 ? (
            <div className="p-8 text-center">
              <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 mb-4">暂无文章</p>
              <Link
                to="/write"
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 inline-flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                创建第一篇文章
              </Link>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    选择
                  </th>
                  <th 
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('title')}
                  >
                    标题
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    状态
                  </th>
                  <th 
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('views')}
                  >
                    浏览量
                  </th>
                  <th 
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('likes')}
                  >
                    点赞数
                  </th>
                  <th 
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('updated_at')}
                  >
                    更新时间
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {articles.map((article) => (
                  <tr key={article.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => handleSelectArticle(article.id)}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        {selectedArticles.includes(article.id) ? (
                          <CheckSquare className="w-4 h-4 text-blue-600" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <div className="text-sm font-medium text-gray-900 line-clamp-2">
                          {article.title}
                        </div>
                        {article.excerpt && (
                          <div className="text-sm text-gray-500 line-clamp-1 mt-1">
                            {article.excerpt}
                          </div>
                        )}
                        {article.category_name && (
                          <div className="flex items-center gap-1 mt-1">
                            <Tag className="w-3 h-3 text-gray-400" />
                            <span className="text-xs text-gray-500">{article.category_name}</span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusStyle(article.status)}`}>
                        {getStatusText(article.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-1 text-sm text-gray-500">
                        <Eye className="w-4 h-4" />
                        {article.views}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-1 text-sm text-gray-500">
                        <Heart className="w-4 h-4" />
                        {article.likes}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-1 text-sm text-gray-500">
                        <Calendar className="w-4 h-4" />
                        {formatDate(article.updated_at)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Link
                          to={`/write?id=${article.id}`}
                          className="text-blue-600 hover:text-blue-800"
                          title="编辑"
                        >
                          <Edit className="w-4 h-4" />
                        </Link>
                        <Link
                          to={`/article/${article.id}`}
                          className="text-green-600 hover:text-green-800"
                          title="查看"
                        >
                          <Eye className="w-4 h-4" />
                        </Link>
                        <button
                          onClick={() => handleDeleteArticle(article.id)}
                          disabled={deleteLoading}
                          className="text-red-600 hover:text-red-800 disabled:opacity-50"
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
          )}
        </div>

        {/* 分页 */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-500">
                显示第 {((query.page || 1) - 1) * (query.limit || 10) + 1} - {Math.min((query.page || 1) * (query.limit || 10), total)} 条，共 {total} 条
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handlePageChange((query.page || 1) - 1)}
                  disabled={(query.page || 1) <= 1}
                  className="px-3 py-1 border border-gray-300 rounded text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  上一页
                </button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const page = Math.max(1, (query.page || 1) - 2) + i;
                  if (page > totalPages) return null;
                  return (
                    <button
                      key={page}
                      onClick={() => handlePageChange(page)}
                      className={`px-3 py-1 border rounded text-sm ${
                        page === (query.page || 1)
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {page}
                    </button>
                  );
                })}
                <button
                  onClick={() => handlePageChange((query.page || 1) + 1)}
                  disabled={(query.page || 1) >= totalPages}
                  className="px-3 py-1 border border-gray-300 rounded text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  下一页
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MyArticles;