import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { LogIn, UserPlus, LogOut, User, BookOpen, PenTool, Shield, Search, Calendar, Eye, Heart, Tag, TrendingUp, Users, FileText, ArrowRight } from 'lucide-react';
import { useAuthStore, authAPI } from '../store/authStore';
import { useArticleStore, type Article, type Category } from '../store/articleStore';

// 扩展Category接口以包含文章数量
interface CategoryWithCount extends Category {
  article_count?: number;
}

export default function Home() {
  const { user, isAuthenticated, isLoading, getCurrentUser } = useAuthStore();
  const { articles, categories, fetchArticles, fetchCategories } = useArticleStore();
  const [featuredArticles, setFeaturedArticles] = useState<Article[]>([]);
  const [popularArticles, setPopularArticles] = useState<Article[]>([]);

  // 页面加载时检查用户登录状态和获取数据
  useEffect(() => {
    if (isAuthenticated && !user) {
      getCurrentUser();
    }
    // 获取文章和分类数据
    fetchArticles({ limit: 6 });
    fetchCategories();
  }, [isAuthenticated, user, getCurrentUser, fetchArticles, fetchCategories]);

  // 处理文章数据
  useEffect(() => {
    if (articles.length > 0) {
      // 获取最新的3篇文章作为推荐文章
      setFeaturedArticles(articles.slice(0, 3));
      // 获取浏览量最高的3篇文章作为热门文章
      const sorted = [...articles].sort((a, b) => (b.views || 0) - (a.views || 0));
      setPopularArticles(sorted.slice(0, 3));
    }
  }, [articles]);

  const handleLogout = async () => {
    await authAPI.logout();
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
                className="flex items-center space-x-1 text-gray-600 hover:text-gray-900 transition-colors"
              >
                <BookOpen className="h-4 w-4" />
                <span>文章</span>
              </Link>
              
              {/* 用户菜单 */}
              <div className="flex items-center space-x-4">
              {isLoading ? (
                <div className="text-gray-500">加载中...</div>
              ) : isAuthenticated && user ? (
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    <User className="h-5 w-5 text-gray-400" />
                    <span className="text-gray-700">欢迎，{user.username}</span>
                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                      {user.role === 'admin' ? '管理员' : user.role === 'author' ? '作者' : '用户'}
                    </span>
                  </div>
                  <Link
                    to="/user/center"
                    className="flex items-center space-x-1 text-gray-600 hover:text-gray-900 transition-colors"
                  >
                    <User className="h-4 w-4" />
                    <span>用户中心</span>
                  </Link>
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
                    className="flex items-center space-x-1 text-gray-600 hover:text-gray-900 transition-colors"
                  >
                    <LogIn className="h-4 w-4" />
                    <span>登录</span>
                  </Link>
                  <Link
                    to="/register"
                    className="flex items-center space-x-1 bg-indigo-600 text-white px-3 py-2 rounded-md hover:bg-indigo-700 transition-colors"
                  >
                    <UserPlus className="h-4 w-4" />
                    <span>注册</span>
                  </Link>
                </div>
              )}
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero 区域 */}
      <section className="relative bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 text-white">
        <div className="absolute inset-0 bg-black/20"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <div className="text-center">
            <h1 className="text-5xl md:text-6xl font-bold mb-6">
              发现精彩
              <span className="bg-gradient-to-r from-yellow-400 to-orange-500 bg-clip-text text-transparent">
                内容
              </span>
            </h1>
            <p className="text-xl md:text-2xl text-gray-200 mb-8 max-w-3xl mx-auto">
              探索知识的海洋，分享思想的火花。在这里，每一篇文章都是一次心灵的旅行。
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/articles"
                className="inline-flex items-center px-8 py-3 bg-white text-gray-900 font-semibold rounded-full hover:bg-gray-100 transition-colors"
              >
                <BookOpen className="w-5 h-5 mr-2" />
                开始阅读
              </Link>
              {isAuthenticated && (user?.role === 'admin' || user?.role === 'author') && (
                <Link
                  to="/articles/new"
                  className="inline-flex items-center px-8 py-3 border-2 border-white text-white font-semibold rounded-full hover:bg-white hover:text-gray-900 transition-colors"
                >
                  <PenTool className="w-5 h-5 mr-2" />
                  开始创作
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* 主要内容 */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* 统计数据 */}
        <section className="mb-16">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="text-center p-6 bg-white rounded-xl shadow-sm border">
              <FileText className="w-8 h-8 text-indigo-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-gray-900">{articles.length}</div>
              <div className="text-gray-600">篇文章</div>
            </div>
            <div className="text-center p-6 bg-white rounded-xl shadow-sm border">
              <Tag className="w-8 h-8 text-green-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-gray-900">{categories.length}</div>
              <div className="text-gray-600">个分类</div>
            </div>
            <div className="text-center p-6 bg-white rounded-xl shadow-sm border">
              <Users className="w-8 h-8 text-purple-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-gray-900">1</div>
              <div className="text-gray-600">位作者</div>
            </div>
            <div className="text-center p-6 bg-white rounded-xl shadow-sm border">
              <TrendingUp className="w-8 h-8 text-orange-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-gray-900">{articles.reduce((sum, article) => sum + (article.views || 0), 0)}</div>
              <div className="text-gray-600">次阅读</div>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          {/* 主内容区域 */}
          <div className="lg:col-span-2 space-y-12">
            {/* 推荐文章 */}
            <section>
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-3xl font-bold text-gray-900">推荐阅读</h2>
                <Link
                  to="/articles"
                  className="inline-flex items-center text-indigo-600 hover:text-indigo-700 font-medium"
                >
                  查看全部
                  <ArrowRight className="w-4 h-4 ml-1" />
                </Link>
              </div>
              <div className="grid gap-8">
                {featuredArticles.map((article, index) => (
                  <article key={article.id} className={`group ${index === 0 ? 'lg:grid lg:grid-cols-2 lg:gap-8' : ''}`}>
                    {article.cover_image && (
                      <div className={`${index === 0 ? 'lg:order-2' : ''} aspect-video overflow-hidden rounded-xl`}>
                        <img
                          src={article.cover_image}
                          alt={article.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      </div>
                    )}
                    <div className={`${index === 0 ? 'lg:order-1 lg:flex lg:flex-col lg:justify-center' : 'mt-4'}`}>
                      {article.category && (
                        <span className="inline-block px-3 py-1 text-xs font-medium bg-indigo-100 text-indigo-800 rounded-full mb-3">
                          {article.category.name}
                        </span>
                      )}
                      <h3 className={`font-bold text-gray-900 group-hover:text-indigo-600 transition-colors mb-3 ${index === 0 ? 'text-2xl' : 'text-xl'}`}>
                        <Link to={`/articles/${article.id}`}>
                          {article.title}
                        </Link>
                      </h3>
                      {article.summary && (
                        <p className="text-gray-600 mb-4 line-clamp-3">
                          {article.summary}
                        </p>
                      )}
                      <div className="flex items-center text-sm text-gray-500 space-x-4">
                        <div className="flex items-center space-x-1">
                          <User className="w-4 h-4" />
                          <span>{article.author?.username || '未知作者'}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Calendar className="w-4 h-4" />
                          <span>{new Date(article.created_at).toLocaleDateString('zh-CN')}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Eye className="w-4 h-4" />
                          <span>{article.views || 0}</span>
                        </div>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </div>

          {/* 侧边栏 */}
          <div className="space-y-8">
            {/* 搜索框 */}
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">搜索文章</h3>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="输入关键词搜索..."
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
            </div>

            {/* 分类导航 */}
            {categories.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">文章分类</h3>
                <div className="space-y-2">
                  {categories.slice(0, 6).map((category) => (
                    <Link
                      key={category.id}
                      to={`/articles?category=${category.id}`}
                      className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <span className="text-gray-700">{category.name}</span>
                      <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded">
                         {(category as CategoryWithCount).article_count || 0}
                       </span>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* 热门文章 */}
            {popularArticles.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">热门文章</h3>
                <div className="space-y-4">
                  {popularArticles.map((article, index) => (
                    <article key={article.id} className="group">
                      <div className="flex space-x-3">
                        <div className="flex-shrink-0 w-8 h-8 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center text-sm font-semibold">
                          {index + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-medium text-gray-900 group-hover:text-indigo-600 transition-colors line-clamp-2">
                            <Link to={`/articles/${article.id}`}>
                              {article.title}
                            </Link>
                          </h4>
                          <div className="flex items-center mt-1 text-xs text-gray-500 space-x-2">
                            <div className="flex items-center space-x-1">
                              <Eye className="w-3 h-3" />
                              <span>{article.views || 0}</span>
                            </div>
                            <div className="flex items-center space-x-1">
                              <Heart className="w-3 h-3" />
                              <span>{article.likes || 0}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            )}

            {/* 用户操作面板 */}
             {isAuthenticated && user ? (
               <div className="bg-white rounded-xl shadow-sm border p-6">
                 <h3 className="text-lg font-semibold text-gray-900 mb-4">快速操作</h3>
                 <div className="space-y-3">
                   {(user.role === 'admin' || user.role === 'author') && (
                     <Link
                       to="/articles/new"
                       className="flex items-center p-3 bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 transition-colors"
                     >
                       <PenTool className="w-5 h-5 mr-3" />
                       <span>写新文章</span>
                     </Link>
                   )}
                   {user.role === 'admin' && (
                     <Link
                       to="/admin/dashboard"
                       className="flex items-center p-3 bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 transition-colors"
                     >
                       <Shield className="w-5 h-5 mr-3" />
                       <span>管理后台</span>
                     </Link>
                   )}
                   <Link
                     to="/user/center"
                     className="flex items-center p-3 bg-gray-50 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
                   >
                     <User className="w-5 h-5 mr-3" />
                     <span>个人中心</span>
                   </Link>
                 </div>
               </div>
             ) : (
               <div className="bg-white rounded-xl shadow-sm border p-6">
                 <h3 className="text-lg font-semibold text-gray-900 mb-4">加入我们</h3>
                 <p className="text-gray-600 mb-4">注册账户，开始您的创作之旅</p>
                 <div className="space-y-3">
                   <Link
                     to="/register"
                     className="block w-full text-center py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                   >
                     立即注册
                   </Link>
                   <Link
                     to="/login"
                     className="block w-full text-center py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                   >
                     已有账户？登录
                   </Link>
                 </div>
               </div>
             )}
           </div>
         </div>
       </main>

       {/* 页脚 */}
       <footer className="bg-gray-900 text-white">
         <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
           <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
             <div className="md:col-span-2">
               <h3 className="text-xl font-bold mb-4">CloudForge-OSS</h3>
               <p className="text-gray-300 mb-4">
                 一个现代化的博客平台，致力于为创作者提供最佳的写作和分享体验。
               </p>
               <div className="flex space-x-4">
                 <div className="text-sm text-gray-400">
                   基于 React + Express + SQLite 构建
                 </div>
               </div>
             </div>
             <div>
               <h4 className="text-lg font-semibold mb-4">快速链接</h4>
               <ul className="space-y-2 text-gray-300">
                 <li><Link to="/articles" className="hover:text-white transition-colors">文章列表</Link></li>
                 <li><Link to="/categories" className="hover:text-white transition-colors">分类浏览</Link></li>
                 <li><Link to="/tags" className="hover:text-white transition-colors">标签云</Link></li>
                 <li><Link to="/about" className="hover:text-white transition-colors">关于我们</Link></li>
               </ul>
             </div>
             <div>
               <h4 className="text-lg font-semibold mb-4">联系方式</h4>
               <ul className="space-y-2 text-gray-300">
                 <li>邮箱：admin@blog.com</li>
                 <li>QQ群：123456789</li>
                 <li>微信：blog_system</li>
               </ul>
             </div>
           </div>
           <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400">
             <p>&copy; 2025 CloudForge-OSS. 保留所有权利.</p>
           </div>
         </div>
       </footer>
     </div>
   );
 }