/**
 * 标签页面 - 展示特定标签的文章
 */
import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { 
  Search, 
  Plus, 
  Eye, 
  Heart, 
  Calendar, 
  User, 
  Tag, 
  ChevronLeft, 
  ChevronRight,
  Edit,
  Trash2,
  LogOut,
  BookOpen,
  ArrowLeft
} from 'lucide-react';
import { useArticleStore } from '../store/articleStore';
import { useAuthStore, authAPI } from '../store/authStore';

const TagPage: React.FC = () => {
  const navigate = useNavigate();
  const { tagId } = useParams<{ tagId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  
  // 状态管理
  const {
    articles,
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
  const [currentTag, setCurrentTag] = useState<{id: number; name: string; description?: string; color?: string} | null>(null);
  
  // 页面加载时获取数据
  useEffect(() => {
    const loadData = async () => {
      await Promise.all([
        fetchCategories(),
        fetchTags()
      ]);
    };
    
    loadData();
  }, [fetchCategories, fetchTags]);
  
  // 获取当前标签信息
  useEffect(() => {
    if (tags.length > 0 && tagId) {
      const tag = tags.find(t => t.id === parseInt(tagId));
      setCurrentTag(tag || null);
    }
  }, [tags, tagId]);

  // 获取标签文章
  useEffect(() => {
    if (tagId) {
      fetchArticles({
        page: parseInt(searchParams.get('page') || '1'),
        search: searchParams.get('search') || undefined,
        tag: parseInt(tagId),
        status: 'published' // 只显示已发布的文章
      });
    }
  }, [tagId, searchParams, fetchArticles]);
  
  // 搜索处理
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    updateSearchParams({ search: searchTerm, page: '1' });
  };
  
  // 更新URL参数
  const updateSearchParams = (params: Record<string, string>) => {
    const newParams = new URLSearchParams(searchParams);
    
    Object.entries(params).forEach(([key, value]) => {
      if (value) {
        newParams.set(key, value);
      } else {
        newParams.delete(key);
      }
    });
    
    setSearchParams(newParams);
  };
  
  // 分页处理
  const handlePageChange = (page: number) => {
    updateSearchParams({ page: page.toString() });
  };
  
  // 删除文章
  const handleDeleteArticle = async (id: number) => {
    if (window.confirm('确定要删除这篇文章吗？')) {
      await deleteArticle(id);
    }
  };
  
  // 点赞文章
  const handleLikeArticle = async (id: number) => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    await likeArticle(id);
  };
  
  // 格式化日期
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };
  
  // 检查是否可以编辑/删除文章
  const canEditArticle = (article: {author_id: number}) => {
    return isAuthenticated && (user?.role === 'admin' || user?.id === article.author_id);
  };

  const handleLogout = async () => {
    await authAPI.logout();
    navigate('/');
  };

  if (!tagId) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">标签不存在</h1>
          <Link to="/articles" className="text-blue-600 hover:text-blue-800">
            返回文章列表
          </Link>
        </div>
      </div>
    );
  }

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
                className="flex items-center space-x-1 text-gray-600 hover:text-gray-900"
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
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link
                to="/articles"
                className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
                <span>返回文章列表</span>
              </Link>
              <div className="border-l border-gray-300 pl-4">
                <div className="flex items-center space-x-2">
                  <div 
                    className="w-6 h-6 rounded flex items-center justify-center"
                    style={{ backgroundColor: currentTag?.color || '#6B7280' }}
                  >
                    <Tag className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <h1 className="text-3xl font-bold text-gray-900">
                      #{currentTag?.name || '标签文章'}
                    </h1>
                    {currentTag?.description && (
                      <p className="mt-2 text-gray-600">{currentTag.description}</p>
                    )}
                  </div>
                </div>
              </div>
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
      
      {/* 搜索区域 */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          {/* 搜索框 */}
          <form onSubmit={handleSearch}>
            <div className="flex gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="在此标签中搜索文章..."
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
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchTerm('');
                    updateSearchParams({ search: '' });
                  }}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                >
                  清除
                </button>
              )}
            </div>
          </form>
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
            {articles.length === 0 ? (
              <div className="text-center py-12">
                <div 
                  className="w-16 h-16 rounded-lg mx-auto mb-4 flex items-center justify-center"
                  style={{ backgroundColor: (currentTag?.color || '#6B7280') + '20' }}
                >
                  <Tag className="w-8 h-8" style={{ color: currentTag?.color || '#6B7280' }} />
                </div>
                <p className="text-gray-500 text-lg mb-2">
                  {searchTerm ? '没有找到相关文章' : '此标签暂无文章'}
                </p>
                {searchTerm && (
                  <button
                    onClick={() => {
                      setSearchTerm('');
                      updateSearchParams({ search: '' });
                    }}
                    className="text-blue-600 hover:text-blue-800"
                  >
                    查看所有文章
                  </button>
                )}
                {isAuthenticated && !searchTerm && (
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
              <>
                {/* 文章统计 */}
                <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
                  <p className="text-gray-600">
                    找到 <span className="font-semibold text-gray-900">{pagination.total}</span> 篇文章
                    {searchTerm && (
                      <span> 包含 &quot;<span className="font-semibold">{searchTerm}</span>&quot;</span>
                    )}
                  </p>
                </div>
                
                {/* 文章列表 */}
                {articles.map(article => (
                  <div key={article.id} className="bg-white rounded-lg shadow-sm border hover:shadow-md transition-shadow">
                    <div className="p-6">
                      {/* 文章头部信息 */}
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex-1">
                          <Link
                            to={`/articles/${article.id}`}
                            className="text-xl font-semibold text-gray-900 hover:text-blue-600 transition-colors"
                          >
                            {article.title}
                          </Link>
                          
                          {/* 文章元信息 */}
                          <div className="flex items-center mt-2 text-sm text-gray-500 space-x-4">
                            <div className="flex items-center">
                              <User className="w-4 h-4 mr-1" />
                              {article.author?.username || '未知作者'}
                            </div>
                            <div className="flex items-center">
                              <Calendar className="w-4 h-4 mr-1" />
                              {formatDate(article.created_at)}
                            </div>
                            <div className="flex items-center">
                              <Eye className="w-4 h-4 mr-1" />
                              {article.views} 次浏览
                            </div>
                            <div className="flex items-center">
                              <Heart className="w-4 h-4 mr-1" />
                              {article.likes} 个赞
                            </div>
                          </div>
                        </div>
                        
                        {/* 操作按钮 */}
                        {canEditArticle(article) && (
                          <div className="flex items-center space-x-2 ml-4">
                            <Link
                              to={`/articles/${article.id}/edit`}
                              className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                              title="编辑"
                            >
                              <Edit className="w-4 h-4" />
                            </Link>
                            <button
                              onClick={() => handleDeleteArticle(article.id)}
                              className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                              title="删除"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>
                      
                      {/* 文章摘要 */}
                      <p className="text-gray-600 mb-4 line-clamp-3">
                        {article.summary}
                      </p>
                      
                      {/* 分类、标签和点赞 */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          {/* 分类 */}
                          {article.category && (
                            <Link
                              to={`/categories/${article.category.id}`}
                              className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800 hover:bg-blue-200 transition-colors"
                            >
                              {article.category.name}
                            </Link>
                          )}
                          
                          {/* 其他标签 */}
                          {article.tags && article.tags.length > 0 && (
                            <div className="flex items-center space-x-1">
                              <Tag className="w-4 h-4 text-gray-400" />
                              <div className="flex space-x-1">
                                {article.tags
                                  .filter(tag => tag.id !== parseInt(tagId!))
                                  .slice(0, 2)
                                  .map(tag => (
                                    <Link
                                      key={tag.id}
                                      to={`/tags/${tag.id}`}
                                      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium hover:opacity-80 transition-opacity"
                                      style={{ backgroundColor: tag.color + '20', color: tag.color }}
                                    >
                                      {tag.name}
                                    </Link>
                                  ))}
                                {article.tags.filter(tag => tag.id !== parseInt(tagId!)).length > 2 && (
                                  <span className="text-xs text-gray-500">
                                    +{article.tags.filter(tag => tag.id !== parseInt(tagId!)).length - 2}
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                        
                        {/* 点赞按钮 */}
                        <button
                          onClick={() => handleLikeArticle(article.id)}
                          className="flex items-center space-x-1 text-gray-500 hover:text-red-500 transition-colors"
                        >
                          <Heart className="w-4 h-4" />
                          <span className="text-sm">{article.likes}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </>
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

export default TagPage;