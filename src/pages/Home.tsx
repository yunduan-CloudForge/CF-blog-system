import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useParams, useLocation, useNavigate } from 'react-router-dom';
import { articleApi, categoryApi, tagApi, userApi } from '@/utils/api';
import { Article, Category, Tag, User } from '@/types';
import { Search, Calendar, User as UserIcon, Eye, MessageCircle, Tag as TagIcon } from 'lucide-react';
import { toast } from 'sonner';
import { ArticleListSkeleton } from '@/components/skeletons';
import { ErrorBoundary, ErrorDisplay } from '@/components/ui/ErrorBoundary';
import { useAsyncState } from '@/components/ui/LoadingState';
import { useKeyboardNavigation } from '@/hooks/useKeyboardNavigation';
import { useScreenReader } from '@/hooks/useAccessibility';
import { ListItemTransition } from '@/components/ui/PageTransition';
import MetaTags from '@/components/SEO/MetaTags';
import StructuredData, { createWebSiteSchema } from '@/components/SEO/StructuredData';
import { LazyImage } from '@/components/LazyLoad/LazyImage';
import { useVirtualScroll } from '@/hooks/usePerformance';
import { usePerformanceMonitor } from '../hooks/usePerformanceMonitor';
import { useBehaviorAnalytics } from '../hooks/useBehaviorAnalytics';
import { FilterOptions, convertFiltersToApiParams } from '@/types/filter';
import SearchFilter from '@/components/SearchFilter';

export default function Home() {
  const { category: categoryParam, tag: tagParam } = useParams<{ category?: string; tag?: string }>();
  const location = useLocation();
  const [articles, setArticles] = useState<Article[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [authors, setAuthors] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterOptions>({
    search: '',
    category: '',
    author: '',
    tags: [],
    dateRange: { start: '', end: '' },
    status: ''
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalArticles, setTotalArticles] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { measureAsyncFunction, recordMetric } = usePerformanceMonitor({
    componentName: 'Home',
    trackPageLoad: true,
    trackComponentRender: true,
    trackWebVitals: true
  });

  // 初始化用户行为分析
  const { trackCustomEvent, trackSearch } = useBehaviorAnalytics({
    trackClicks: true,
    trackScrolling: true,
    trackPageViews: true,
    trackFormInteractions: true,
    scrollThreshold: 25
  });
  const { announce } = useScreenReader();

  const navigate = useNavigate();
  
  // 键盘导航配置
  const keyboardNavigation = useKeyboardNavigation({
    itemCount: articles.length || 0,
    onEnter: () => {
      // 简化处理，使用当前选中的文章
      if (articles.length > 0) {
        navigate(`/article/${articles[0].id}`);
      }
    }
  });
  
  // 移除未使用的异步状态管理
  // const categoriesState = useAsyncState<Category[]>([]);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1, page: 1, limit: 10 });

  const fetchArticles = async () => {
    try {
      setIsLoading(true);
      const apiParams = convertFiltersToApiParams(filters);
      const params = {
        page: currentPage,
        limit: 10,
        status: 'published' as const,
        ...apiParams
      };
      
      const response = await measureAsyncFunction(async () => 
        await articleApi.getArticles(params), 'fetchArticles'
      );
      
      // 处理不同的响应数据结构
      let articlesData: Article[] = [];
      let paginationData = { total: 0, totalPages: 1, page: 1, limit: 10 };
      
      if (response && typeof response === 'object' && 'articles' in response) {
        articlesData = (response as any).articles;
        paginationData = (response as any).pagination || paginationData;
      } else if (Array.isArray(response)) {
        articlesData = response as Article[];
        paginationData = { total: response.length, totalPages: 1, page: 1, limit: 10 };
      } else {
        articlesData = [];
      }
      
      setPagination(paginationData);
      
      setArticles(articlesData);
      setTotalPages(paginationData.totalPages);
      setTotalArticles(paginationData.total);
      setError(null);
    } catch (error) {
      console.error('获取文章失败:', error);
      setError('获取文章失败');
      toast.error('获取文章失败');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await categoryApi.getCategories();
      // 处理返回的数据结构
      const categoriesData = (response as any).categories || response || [];
      setCategories(categoriesData);
    } catch (error) {
      console.error('获取分类失败:', error);
      // 分类获取失败不显示错误提示，使用空数组
      setCategories([]);
    }
  };

  // 获取标签数据
  const fetchTags = async () => {
    try {
      const response = await tagApi.getTags();
      // 处理返回的数据结构
      const tagsData = (response as any).tags || response || [];
      setTags(tagsData);
    } catch (error) {
      console.error('获取标签失败:', error);
      // 标签获取失败不显示错误提示，使用空数组
      setTags([]);
    }
  };

  // 获取作者数据
  const fetchAuthors = async () => {
    try {
      const response = await userApi.getAuthors();
      // 处理返回的数据结构
      const authorsData = (response as any).authors || response || [];
      setAuthors(authorsData);
    } catch (error) {
      console.error('获取作者失败:', error);
      // 作者获取失败不显示错误提示，使用空数组
      setAuthors([]);
    }
  };

  // 初始化路由参数
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const searchQuery = searchParams.get('search') || '';
    
    setFilters(prev => ({
      ...prev,
      search: searchQuery,
      category: categoryParam || '',
      tags: tagParam ? [tagParam] : []
    }));
    
    if (categoryParam) {
      setSelectedCategory(categoryParam);
    }
  }, [categoryParam, tagParam, location.search]);

  useEffect(() => {
    fetchCategories();
    fetchTags();
    fetchAuthors();
  }, []);

  useEffect(() => {
    fetchArticles();
  }, [filters, currentPage]);

  // 处理筛选器变化
  const handleFilterChange = useCallback((newFilters: FilterOptions) => {
    setFilters(newFilters);
    setCurrentPage(1);
    
    // 跟踪搜索行为
    if (newFilters.search) {
      trackSearch(newFilters.search, articles.length || 0, newFilters);
    }
    
    // 跟踪筛选行为
    trackCustomEvent('filter_change', {
      filters: newFilters,
      resultCount: articles.length || 0
    });
  }, [articles.length, trackSearch, trackCustomEvent]);

  // 处理分类选择（保留兼容性）
  // const handleCategorySelect = (categoryId: string | null) => {
  //   setSelectedCategory(categoryId);
  //   setFilters(prev => ({ ...prev, category: categoryId || '' }));
  //   setCurrentPage(1);
  // };

  const handleCategoryChange = (categorySlug: string) => {
    setSelectedCategory(categorySlug);
    setCurrentPage(1);
    const categoryName = categorySlug ? categories.find(c => c.slug === categorySlug)?.name : '全部';
    announce(`已选择分类：${categoryName}`);
  };

  const handleCategoryKeyDown = (e: React.KeyboardEvent, categorySlug: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleCategoryChange(categorySlug);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // SEO数据
  const siteUrl = window.location.origin;
  const currentCategory = categories.find(c => c.slug === categoryParam);
  const currentTag = tags.find(t => t.slug === tagParam);
  
  const pageTitle = filters.search 
    ? `搜索: ${filters.search} - 博客系统` 
    : categoryParam && currentCategory
    ? `${currentCategory.name}分类 - 博客系统`
    : tagParam && currentTag
    ? `${currentTag.name}标签 - 博客系统`
    : '首页 - 博客系统';
  
  const pageDescription = filters.search
    ? `搜索"${filters.search}"的相关文章，共找到${totalArticles}篇文章`
    : categoryParam && currentCategory
    ? `${currentCategory.name}分类下的文章列表，包含${totalArticles}篇相关文章`
    : tagParam && currentTag
    ? `${currentTag.name}标签下的文章列表，包含${totalArticles}篇相关文章`
    : `个人博客首页，分享技术见解、生活感悟和创意思考，共有${totalArticles}篇文章`;

  const keywords = [
    '个人博客',
    '技术分享',
    '编程',
    '前端开发',
    '后端开发',
    ...(currentCategory ? [currentCategory.name] : []),
    ...(currentTag ? [currentTag.name] : []),
    ...categories.slice(0, 5).map(c => c.name),
    ...tags.slice(0, 10).map(t => t.name)
  ].join(', ');

  return (
    <>
      {/* SEO Meta Tags */}
      <MetaTags
        title={pageTitle}
        description={pageDescription}
        keywords={keywords}
        type="website"
        url={`${siteUrl}${window.location.pathname}${window.location.search}`}
      />
      
      {/* Structured Data */}
      <StructuredData
        type="website"
        data={createWebSiteSchema(siteUrl)}
      />
      
      <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center">
            <h1 className="text-4xl md:text-6xl font-bold mb-4">
              欢迎来到我的博客
            </h1>
            <p className="text-xl md:text-2xl mb-8 text-blue-100">
              分享技术见解，记录成长历程
            </p>
            
            {/* Search Filter */}
            <div className="max-w-4xl mx-auto">
              <SearchFilter
              categories={categories}
              tags={tags}
              authors={authors}
              onFilterChange={handleFilterChange}
            />
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
        <div className="flex flex-col xl:flex-row gap-6 lg:gap-8">
          {/* Main Content */}
          <div className="flex-1 min-w-0">


            {/* Articles List */}
            <ErrorBoundary>
              {isLoading ? (
                <ArticleListSkeleton count={5} />
              ) : error ? (
                <ErrorDisplay 
                  error={error || '获取文章失败'} 
                  onRetry={fetchArticles}
                  className="py-12"
                />
              ) : articles && articles.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-500 text-lg">暂无文章</p>
                </div>
              ) : (
                <div className="space-y-4 sm:space-y-6">
                  {articles.map((article, index) => (
                  <ListItemTransition key={article.id} index={index} delay={100}>
                    <article 
                      className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-offset-2"
                      role="article"
                      aria-labelledby={`article-title-${article.id}`}
                    >
                    <div className="p-4 sm:p-6">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-3 sm:mb-4 space-y-2 sm:space-y-0">
                        <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs sm:text-sm text-gray-500">
                          <div className="flex items-center">
                            <UserIcon className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                            <span className="truncate max-w-20 sm:max-w-none">{article.author?.username || '匿名'}</span>
                          </div>
                          <div className="flex items-center">
                            <Calendar className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                            <span className="hidden sm:inline">{formatDate(article.createdAt)}</span>
                            <span className="sm:hidden">{formatDate(article.createdAt).split(' ')[0]}</span>
                          </div>
                        </div>
                        {article.category && (
                          <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs self-start sm:self-auto">
                            {article.category.name}
                          </span>
                        )}
                      </div>
                      
                      <h2 id={`article-title-${article.id}`} className="text-lg sm:text-xl font-bold text-gray-900 mb-2 sm:mb-3 hover:text-blue-600 transition-colors line-clamp-2">
                        <Link 
                          to={`/articles/${article.slug}`}
                          className="focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-md"
                          aria-describedby={`article-excerpt-${article.id}`}
                        >
                          {article.title}
                        </Link>
                      </h2>
                      
                      <p id={`article-excerpt-${article.id}`} className="text-gray-600 mb-3 sm:mb-4 line-clamp-2 sm:line-clamp-3 text-sm sm:text-base">
                        {article.excerpt || article.content.substring(0, 150) + '...'}
                      </p>
                      
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0">
                        <div className="flex items-center space-x-3 sm:space-x-4 text-xs sm:text-sm text-gray-500">
                          <div className="flex items-center">
                            <Eye className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                            {article.viewCount || 0}
                          </div>
                          <div className="flex items-center">
                            <MessageCircle className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                            {article.commentCount || 0}
                          </div>
                        </div>
                        
                        {article.tags && article.tags.length > 0 && (
                          <div className="flex items-center space-x-1 sm:space-x-2">
                            <TagIcon className="h-3 w-3 sm:h-4 sm:w-4 text-gray-400" />
                            <div className="flex flex-wrap gap-1">
                              {article.tags.slice(0, 2).map((tag) => (
                                <span
                                  key={tag.id}
                                  className="bg-gray-100 text-gray-600 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-xs"
                                >
                                  {tag.name}
                                </span>
                              ))}
                              {article.tags.length > 2 && (
                                <span className="text-gray-400 text-xs">+{article.tags.length - 2}</span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    </article>
                  </ListItemTransition>
                ))}
                </div>
              )}
            </ErrorBoundary>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-6 sm:mt-8 flex justify-center">
                <nav className="flex flex-wrap justify-center gap-1 sm:gap-2">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="px-2 sm:px-3 py-1.5 sm:py-2 rounded-md text-xs sm:text-sm font-medium text-gray-500 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                    aria-label="上一页"
                  >
                    <span className="hidden sm:inline">上一页</span>
                    <span className="sm:hidden">‹</span>
                  </button>
                  
                  {[...Array(totalPages)].map((_, i) => {
                    const page = i + 1;
                    // 移动端显示更少的页码
                    const isMobile = window.innerWidth < 640;
                    const range = isMobile ? 1 : 2;
                    
                    if (
                      page === 1 ||
                      page === totalPages ||
                      (page >= currentPage - range && page <= currentPage + range)
                    ) {
                      return (
                        <button
                          key={page}
                          onClick={() => setCurrentPage(page)}
                          className={`px-2 sm:px-3 py-1.5 sm:py-2 rounded-md text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                            currentPage === page
                              ? 'bg-blue-600 text-white'
                              : 'text-gray-500 hover:text-gray-700'
                          }`}
                          aria-label={`第${page}页`}
                          aria-current={currentPage === page ? 'page' : undefined}
                        >
                          {page}
                        </button>
                      );
                    } else if (
                      page === currentPage - (range + 1) ||
                      page === currentPage + (range + 1)
                    ) {
                      return (
                        <span key={page} className="px-1 sm:px-3 py-1.5 sm:py-2 text-gray-400 text-xs sm:text-sm">
                          ...
                        </span>
                      );
                    }
                    return null;
                  })}
                  
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="px-2 sm:px-3 py-1.5 sm:py-2 rounded-md text-xs sm:text-sm font-medium text-gray-500 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                    aria-label="下一页"
                  >
                    <span className="hidden sm:inline">下一页</span>
                    <span className="sm:hidden">›</span>
                  </button>
                </nav>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="xl:w-80 w-full">
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-1 gap-4 sm:gap-6">
              {/* Stats */}
              <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
                <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">博客统计</h3>
                <div className="space-y-2 sm:space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600 text-sm sm:text-base">文章总数</span>
                    <span className="font-semibold text-sm sm:text-base">{pagination.total}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 text-sm sm:text-base">分类数量</span>
                    <span className="font-semibold text-sm sm:text-base">{categories.length}</span>
                  </div>
                </div>
              </div>

              {/* Categories */}
              {categories.length > 0 && (
                <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
                  <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">文章分类</h3>
                  <div className="space-y-1 sm:space-y-2 max-h-48 xl:max-h-none overflow-y-auto">
                    {categories.map((category) => (
                      <button
                        key={category.id}
                        onClick={() => handleCategoryChange(category.slug)}
                        onKeyDown={(e) => handleCategoryKeyDown(e, category.slug)}
                        className={`w-full text-left px-2 sm:px-3 py-1.5 sm:py-2 rounded-md text-xs sm:text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                          selectedCategory === category.slug
                            ? 'bg-blue-100 text-blue-800'
                            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                        }`}
                        aria-pressed={selectedCategory === category.slug}
                      >
                        {category.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}