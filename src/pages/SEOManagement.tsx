import React, { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useNavigate } from 'react-router-dom';
import { sitemapGenerator, SitemapUrl } from '@/utils/sitemap';
import MetaTags from '@/components/SEO/MetaTags';
import { Download, RefreshCw, Globe, Search, FileText, Settings } from 'lucide-react';
import { toast } from 'sonner';
import { PageTransition } from '@/components/ui/PageTransition';

export default function SEOManagement() {
  const { user, isAuthenticated } = useAuthStore();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [urlList, setUrlList] = useState<SitemapUrl[]>([]);
  const [sitemapStats, setSitemapStats] = useState({
    totalUrls: 0,
    staticPages: 0,
    articles: 0,
    categories: 0,
    lastGenerated: null as string | null
  });

  useEffect(() => {
    if (!isAuthenticated || user?.role !== 'admin') {
      navigate('/');
      return;
    }
    
    loadSitemapData();
  }, [isAuthenticated, user, navigate]);

  const loadSitemapData = async () => {
    try {
      setLoading(true);
      const urls = await sitemapGenerator.getUrlList();
      setUrlList(urls);
      
      // 计算统计信息
      const stats = {
        totalUrls: urls.length,
        staticPages: urls.filter(url => 
          url.loc.endsWith('/') || 
          url.loc.includes('/about') || 
          url.loc.includes('/contact') ||
          url.loc.includes('/login') ||
          url.loc.includes('/register')
        ).length,
        articles: urls.filter(url => url.loc.includes('/articles/')).length,
        categories: urls.filter(url => url.loc.includes('/categories/')).length,
        lastGenerated: new Date().toISOString()
      };
      
      setSitemapStats(stats);
    } catch (error) {
      console.error('加载sitemap数据失败:', error);
      toast.error('加载SEO数据失败');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateSitemap = async () => {
    try {
      setLoading(true);
      await sitemapGenerator.downloadSitemap();
      toast.success('Sitemap生成成功！文件已下载');
      await loadSitemapData(); // 重新加载数据
    } catch (error) {
      console.error('生成sitemap失败:', error);
      toast.error('生成sitemap失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshData = async () => {
    await loadSitemapData();
    toast.success('SEO数据已刷新');
  };

  if (!isAuthenticated || user?.role !== 'admin') {
    return null;
  }

  return (
    <>
      <MetaTags
        title="SEO管理 - 博客系统"
        description="管理网站SEO设置，生成sitemap，优化搜索引擎收录"
        keywords="SEO管理,sitemap,搜索引擎优化,网站管理"
        url={`${window.location.origin}/admin/seo`}
      />
      
      <PageTransition>
        <div className="min-h-screen bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {/* Header */}
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">SEO管理</h1>
              <p className="text-gray-600">管理网站SEO设置，优化搜索引擎收录</p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Globe className="h-6 w-6 text-blue-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">总URL数</p>
                    <p className="text-2xl font-bold text-gray-900">{sitemapStats.totalUrls}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <FileText className="h-6 w-6 text-green-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">文章页面</p>
                    <p className="text-2xl font-bold text-gray-900">{sitemapStats.articles}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <Settings className="h-6 w-6 text-purple-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">分类页面</p>
                    <p className="text-2xl font-bold text-gray-900">{sitemapStats.categories}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="p-2 bg-orange-100 rounded-lg">
                    <Search className="h-6 w-6 text-orange-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">静态页面</p>
                    <p className="text-2xl font-bold text-gray-900">{sitemapStats.staticPages}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="bg-white rounded-lg shadow p-6 mb-8">
              <h2 className="text-xl font-bold text-gray-900 mb-4">SEO操作</h2>
              <div className="flex flex-wrap gap-4">
                <button
                  onClick={handleGenerateSitemap}
                  disabled={loading}
                  className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Download className="h-5 w-5 mr-2" />
                  {loading ? '生成中...' : '生成Sitemap'}
                </button>
                
                <button
                  onClick={handleRefreshData}
                  disabled={loading}
                  className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <RefreshCw className="h-5 w-5 mr-2" />
                  刷新数据
                </button>
              </div>
            </div>

            {/* URL List */}
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-xl font-bold text-gray-900">Sitemap URL列表</h2>
                <p className="text-sm text-gray-600 mt-1">
                  最后更新: {sitemapStats.lastGenerated ? new Date(sitemapStats.lastGenerated).toLocaleString('zh-CN') : '未知'}
                </p>
              </div>
              
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        URL
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        更新频率
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        优先级
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        最后修改
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {urlList.map((url, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <a
                            href={url.loc}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                          >
                            {url.loc}
                          </a>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {url.changefreq || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {url.priority !== undefined ? url.priority.toFixed(1) : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {url.lastmod || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* SEO Tips */}
            <div className="bg-white rounded-lg shadow p-6 mt-8">
              <h2 className="text-xl font-bold text-gray-900 mb-4">SEO优化建议</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Sitemap优化</h3>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li>• 定期更新sitemap.xml文件</li>
                    <li>• 确保所有重要页面都包含在sitemap中</li>
                    <li>• 设置合适的更新频率和优先级</li>
                    <li>• 在Google Search Console中提交sitemap</li>
                  </ul>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">内容优化</h3>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li>• 为每个页面设置独特的标题和描述</li>
                    <li>• 使用相关的关键词</li>
                    <li>• 优化图片alt标签</li>
                    <li>• 确保内容质量和原创性</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </PageTransition>
    </>
  );
}