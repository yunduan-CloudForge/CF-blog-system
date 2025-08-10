import React from 'react';
import { Link } from 'react-router-dom';
import MetaTags from '@/components/SEO/MetaTags';

const NotFound: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <MetaTags
        title="页面未找到 - 404错误"
        description="抱歉，您访问的页面不存在。请检查URL或返回首页。"
        keywords="404,页面未找到,错误页面"
        url="/404"
      />
      
      <div className="text-center">
        <div className="mb-8">
          <h1 className="text-9xl font-bold text-gray-300 mb-4">404</h1>
          <div className="w-24 h-1 bg-blue-600 mx-auto mb-8"></div>
        </div>
        
        <h2 className="text-3xl font-bold text-gray-900 mb-4">
          页面未找到
        </h2>
        
        <p className="text-lg text-gray-600 mb-8 max-w-md mx-auto">
          抱歉，您访问的页面不存在。可能是链接错误或页面已被移动。
        </p>
        
        <div className="space-y-4">
          <Link
            to="/"
            className="inline-block px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            返回首页
          </Link>
          
          <div className="text-sm text-gray-500">
            或者尝试以下链接：
          </div>
          
          <div className="flex flex-wrap justify-center gap-4 text-sm">
            <Link to="/articles" className="text-blue-600 hover:text-blue-800">
              文章列表
            </Link>
            <Link to="/categories" className="text-blue-600 hover:text-blue-800">
              分类浏览
            </Link>
            <Link to="/tags" className="text-blue-600 hover:text-blue-800">
              标签云
            </Link>
          </div>
        </div>
        
        {/* 装饰性元素 */}
        <div className="mt-12 opacity-20">
          <svg className="w-32 h-32 mx-auto text-gray-400" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        </div>
      </div>
    </div>
  );
};

export default NotFound;