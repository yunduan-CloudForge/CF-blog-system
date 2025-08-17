/**
 * 文章列表页面
 * 支持分页、搜索、筛选功能
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { 
  Search, 
  Filter, 
  Plus, 
  Eye, 
  Heart, 
  Calendar, 
  User, 
  Tag as TagIcon, 
  ChevronLeft, 
  ChevronRight,
  Edit,
  Trash2,
  LogOut,
  BookOpen
} from 'lucide-react';
import { useArticleStore, Article, Tag } from '../store/articleStore';
import { useAuthStore, authAPI } from '../store/authStore';

// 文章卡片组件 - 使用React.memo优化
const ArticleCard = React.memo<{
  article: Article;
  canEdit: boolean;
  onLike: (id: number) => void;
  onDelete: (id: number) => void;
  formatDate: (date: string) => string;
}>(({ article, canEdit, onLike, onDelete, formatDate }) => {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow duration-200">
      {/* 文章封面 */}
      {article.cover_image && (
        <div className="aspect-video w-full overflow-hidden rounded-t-lg">
          <img
            src={article.cover_image}
            alt={article.title}
            className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        </div>
      )}
      
      <div className="p-6">
        {/* 文章标题 */}
        <h2 className="text-xl font-semibold text-gray-900 mb-2 line-clamp-2">
          <Link
            to={`/articles/${article.id}`}
            className="hover:text-blue-600 transition-colors"
          >
            {article.title}
          </Link>
        </h2>
        
        {/* 文章摘要 */}
        {article.summary && (
          <p className="text-gray-600 mb-4 line-clamp-3">
            {article.summary}
          </p>
        )}
        
        {/* 文章元信息 */}
        <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-1">
              <User className="h-4 w-4" />
              <span>{article.author?.username || '未知作者'}</span>
            </div>
            <div className="flex items-center space-x-1">
              <Calendar className="h-4 w-4" />
              <span>{formatDate(article.created_at)}</span>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-1">
              <Eye className="h-4 w-4" />
              <span>{article.views || 0}</span>
            </div>
            <button
              onClick={() => onLike(article.id)}
              className="flex items-center space-x-1 text-red-500 hover:text-red-600 transition-colors"
            >
              <Heart className={`h-4 w-4 ${article.isLiked ? 'fill-current' : ''}`} />
              <span>{article.likes || 0}</span>
            </button>
          </div>
        </div>
        
        {/* 分类和标签 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {article.category && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                {article.category.name}
              </span>
            )}
            {article.tags && article.tags.slice(0, 2).map((tag: Tag) => (
              <span
                key={tag.id}
                className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800"
              >
                <TagIcon className="h-3 w-3 mr-1" />
                {tag.name}
              </span>
            ))}
          </div>
          
          {/* 操作按钮 */}
          {canEdit && (
            <div className="flex items-center space-x-2">
              <Link
                to={`/articles/${article.id}/edit`}
                className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
              >
                <Edit className="h-4 w-4" />
              </Link>
              <button
                onClick={() => onDelete(article.id)}
                className="p-1 text-gray-400 hover:text-red-600 transition-colors"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

ArticleCard.displayName = 'ArticleCard';

const ArticleList: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  
  // 状态管理
  const {
    articles,
    categories,
    tags,
    pagination,
    isLoading,
    error,
    fetchArticles,
    fetchCategories,
    fetchTags,
    deleteArticle,
    likeArticle
  } = useArticleStore();
  
  const { user, isAuthenticated } = useAuthStore();
  
  // 本地状态
  const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || '');
  const [selectedCategory, setSelectedCategory] = useState(searchParams.get('category') || '');
  const [selectedTag, setSelectedTag] = useState(searchParams.get('tag') || '');
  const [selectedStatus, setSelectedStatus] = useState(searchParams.get('status') || '');
  const [showFilters, setShowFilters] = useState(false);
  
  // 页面加载时获取数据
  useEffect(() => {
    const loadData = async () => {
      await Promise.all([
        fetchCategories(),
        fetchTags(),
        fetchArticles({
          page: parseInt(searchParams.get('page') || '1'),
          search: searchParams.get('search') || undefined,
          category: searchParams.get('category') ? parseInt(searchParams.get('category')!) : undefined,
          tag: searchParams.get('tag') ? parseInt(searchParams.get('tag')!) : undefined,
          status: searchParams.get('status') || undefined
        })
      ]);
    };
    
    loadData();
  }, [searchParams, fetchCategories, fetchTags, fetchArticles]);
  
  // 使用useCallback优化函数，避免不必要的重新渲染
  const updateSearchParams = useCallback((params: Record<string, string>) => {
    const newParams = new URLSearchParams(searchParams);
    
    Object.entries(params).forEach(([key, value]) => {
      if (value) {
        newParams.set(key, value);
      } else {
        newParams.delete(key);
      }
    });
    
    setSearchParams(newParams);
  }, [searchParams, setSearchParams]);
  
  // 搜索处理
  const handleSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    updateSearchParams({ search: searchTerm, page: '1' });
  }, [searchTerm, updateSearchParams]);
  
  // 分页处理
  const handlePageChange = useCallback((page: number) => {
    updateSearchParams({ page: page.toString() });
  }, [updateSearchParams]);
  
  // 筛选处理
  const handleFilterChange = useCallback((filterType: string, value: string) => {
    updateSearchParams({ [filterType]: value, page: '1' });
    
    switch (filterType) {
      case 'category':
        setSelectedCategory(value);
        break;
      case 'tag':
        setSelectedTag(value);
        break;
      case 'status':
        setSelectedStatus(value);
        break;
    }
  }, [updateSearchParams]);
  
  // 清除筛选
  const clearFilters = useCallback(() => {
    setSelectedCategory('');
    setSelectedTag('');
    setSelectedStatus('');
    setSearchTerm('');
    setSearchParams({});
  }, [setSearchParams]);
  
  // 删除文章
  const handleDeleteArticle = useCallback(async (id: number) => {
    if (window.confirm('确定要删除这篇文章吗？')) {
      await deleteArticle(id);
    }
  }, [deleteArticle]);
  
  // 点赞文章
  const handleLikeArticle = useCallback(async (id: number) => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    await likeArticle(id);
  }, [isAuthenticated, navigate, likeArticle]);
  
  // 格式化日期 - 使用useMemo缓存函数
  const formatDate = useMemo(() => {
    return (dateString: string) => {
      return new Date(dateString).toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    };
  }, []);
  
  // 检查是否可以编辑/删除文章 - 使用useMemo优化
  const canEditArticle = useMemo(() => {
    return (article: Article) => {
      return isAuthenticated && (user?.role === 'admin' || user?.id === article.author_id);
    };
  }, [isAuthenticated, user?.role, user?.id]);
  
  // 过滤后的文章列表 - 使用useMemo优化
  const filteredArticles = useMemo(() => {
    return articles.filter(article => {
      if (selectedCategory && article.category?.id !== parseInt(selectedCategory)) {
        return false;
      }
      if (selectedTag && !article.tags?.some((tag: Tag) => tag.id === parseInt(selectedTag))) {
        return false;
      }
      if (selectedStatus && article.status !== selectedStatus) {
        return false;
      }
      return true;
    });
  }, [articles, selectedCategory, selectedTag, selectedStatus]);

  const handleLogout = async () => {
    await authAPI.logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 导航栏 */}
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            {/* Logo */}
            <div className="flex items-center">
              <Link to="/" className="text-xl font-bold text-gray-900">
                博客系统
              </Link>
            </div>

            {/* 导航链接 */}
            <div className="flex items-center space-x-6">
              <Link
                to="/articles"
                className="flex items-center space-x-1 text-blue-600 font-medium"
              >
                <BookOpen className="h-4 w-4" />
                <span>文章</span>
              </Link>
              
              {/* 用户菜单 */}
              <div className="flex items-center space-x-4">
              {isAuthenticated && user ? (
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    <User className="h-5 w-5 text-gray-400" />
                    <span className="text-gray-700">欢迎，{user.username}</span>
                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                      {user.role === 'admin' ? '管理员' : user.role === 'author' ? '作者' : '用户'}
                    </span>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="flex items-center space-x-1 text-gray-600 hover:text-gray-900 transition-colors"
                  >
                    <LogOut className="h-4 w-4" />
                    <span>登出</span>
                  </button>
                </div>
              ) : (
                <div className="flex items-center space-x-4">
                  <Link
                    to="/login"
                    className="text-gray-600 hover:text-gray-900 transition-colors"
                  >
                    登录
                  </Link>
                  <Link
                    to="/register"
                    className="bg-blue-600 text-white px-3 py-2 rounded-md hover:bg-blue-700 transition-colors"
                  >
                    注册
                  </Link>
                </div>
              )}
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* 页面头部 */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">文章列表</h1>
              <p className="mt-2 text-gray-600">发现精彩内容，分享知识见解</p>
            </div>
            {isAuthenticated && (
              <Link
                to="/articles/new"
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-5 h-5 mr-2" />
                写文章
              </Link>
            )}
          </div>
        </div>
      </div>
      
      {/* 搜索和筛选区域 */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          {/* 搜索框 */}
          <form onSubmit={handleSearch} className="mb-4">
            <div className="flex gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="搜索文章标题或内容..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <button
                type="submit"
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                搜索
              </button>
              <button
                type="button"
                onClick={() => setShowFilters(!showFilters)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center"
              >
                <Filter className="w-5 h-5 mr-2" />
                筛选
              </button>
            </div>
          </form>
          
          {/* 筛选选项 */}
          {showFilters && (
            <div className="border-t pt-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* 分类筛选 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">分类</label>
                  <select
                    value={selectedCategory}
                    onChange={(e) => handleFilterChange('category', e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">全部分类</option>
                    {categories.map(category => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </div>
                
                {/* 标签筛选 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">标签</label>
                  <select
                    value={selectedTag}
                    onChange={(e) => handleFilterChange('tag', e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">全部标签</option>
                    {tags.map(tag => (
                      <option key={tag.id} value={tag.id}>
                        {tag.name}
                      </option>
                    ))}
                  </select>
                </div>
                
                {/* 状态筛选 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">状态</label>
                  <select
                    value={selectedStatus}
                    onChange={(e) => handleFilterChange('status', e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">全部状态</option>
                    <option value="published">已发布</option>
                    <option value="draft">草稿</option>
                    <option value="archived">已归档</option>
                  </select>
                </div>
              </div>
              
              {/* 清除筛选按钮 */}
              <div className="mt-4 flex justify-end">
                <button
                  onClick={clearFilters}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                >
                  清除筛选
                </button>
              </div>
            </div>
          )}
        </div>
        
        {/* 错误提示 */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-600">{error}</p>
          </div>
        )}
        
        {/* 加载状态 */}
        {isLoading && (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        )}
        
        {/* 文章列表 */}
        {!isLoading && (
          <div className="space-y-6">
            {filteredArticles.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500 text-lg">
                  {articles.length === 0 ? '暂无文章' : '没有符合条件的文章'}
                </p>
                {isAuthenticated && articles.length === 0 && (
                  <Link
                    to="/articles/new"
                    className="inline-flex items-center mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Plus className="w-5 h-5 mr-2" />
                    写第一篇文章
                  </Link>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredArticles.map(article => (
                  <ArticleCard
                    key={article.id}
                    article={article}
                    canEdit={canEditArticle(article)}
                    onLike={handleLikeArticle}
                    onDelete={handleDeleteArticle}
                    formatDate={formatDate}
                  />
                ))}
              </div>
            )}
          </div>
        )}
        
        {/* 分页 */}
        {!isLoading && articles.length > 0 && pagination.totalPages > 1 && (
          <div className="flex justify-center mt-8">
            <div className="flex items-center space-x-2">
              <button
                onClick={() => handlePageChange(pagination.page - 1)}
                disabled={pagination.page <= 1}
                className="p-2 rounded-lg border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              
              {/* 页码 */}
              {Array.from({ length: pagination.totalPages }, (_, i) => i + 1)
                .filter(page => {
                  const current = pagination.page;
                  return page === 1 || page === pagination.totalPages || (page >= current - 2 && page <= current + 2);
                })
                .map((page, index, array) => {
                  const showEllipsis = index > 0 && array[index - 1] !== page - 1;
                  return (
                    <React.Fragment key={page}>
                      {showEllipsis && <span className="px-2 text-gray-500">...</span>}
                      <button
                        onClick={() => handlePageChange(page)}
                        className={`px-3 py-2 rounded-lg border transition-colors ${
                          page === pagination.page
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        {page}
                      </button>
                    </React.Fragment>
                  );
                })}
              
              <button
                onClick={() => handlePageChange(pagination.page + 1)}
                disabled={pagination.page >= pagination.totalPages}
                className="p-2 rounded-lg border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ArticleList;