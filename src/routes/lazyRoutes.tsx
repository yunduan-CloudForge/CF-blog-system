import React from 'react';
import { withLazyLoading } from '@/components/LazyLoad/LazyRoute';

// 懒加载页面组件
export const LazyHome = withLazyLoading(
  () => import('@/pages/Home'),
  <div className="min-h-screen flex items-center justify-center">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
      <p className="text-gray-600">加载首页中...</p>
    </div>
  </div>
);

export const LazyArticleDetail = withLazyLoading(
  () => import('@/pages/ArticleDetail'),
  <div className="min-h-screen flex items-center justify-center">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
      <p className="text-gray-600">加载文章中...</p>
    </div>
  </div>
);

export const LazyCreateArticle = withLazyLoading(
  () => import('@/pages/CreateArticle'),
  <div className="min-h-screen flex items-center justify-center">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
      <p className="text-gray-600">加载编辑器中...</p>
    </div>
  </div>
);

export const LazyLogin = withLazyLoading(
  () => import('@/pages/Login'),
  <div className="min-h-screen flex items-center justify-center">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
      <p className="text-gray-600">加载登录页面中...</p>
    </div>
  </div>
);

export const LazyRegister = withLazyLoading(
  () => import('@/pages/Register'),
  <div className="min-h-screen flex items-center justify-center">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
      <p className="text-gray-600">加载注册页面中...</p>
    </div>
  </div>
);

export const LazyProfile = withLazyLoading(
  () => import('@/pages/Profile'),
  <div className="min-h-screen flex items-center justify-center">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
      <p className="text-gray-600">加载个人资料中...</p>
    </div>
  </div>
);

export const LazyDashboard = withLazyLoading(
  () => import('@/pages/Dashboard'),
  <div className="min-h-screen flex items-center justify-center">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
      <p className="text-gray-600">加载仪表板中...</p>
    </div>
  </div>
);

export const LazySEOManagement = withLazyLoading(
  () => import('@/pages/SEOManagement'),
  <div className="min-h-screen flex items-center justify-center">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
      <p className="text-gray-600">加载SEO管理中...</p>
    </div>
  </div>
);

export const LazyEditArticle = withLazyLoading(
  () => import('@/pages/EditArticle'),
  <div className="min-h-screen flex items-center justify-center">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
      <p className="text-gray-600">加载编辑器中...</p>
    </div>
  </div>
);

export const LazyImageOptimizationTest = withLazyLoading(
  () => import('@/pages/ImageOptimizationTest'),
  <div className="min-h-screen flex items-center justify-center">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
      <p className="text-gray-600">加载测试页面中...</p>
    </div>
  </div>
);

export const LazyMonitoringDashboard = withLazyLoading(
  () => import('@/pages/MonitoringDashboard'),
  <div className="min-h-screen flex items-center justify-center">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
      <p className="text-gray-600">加载监控仪表板中...</p>
    </div>
  </div>
);

export const LazyNotFound = withLazyLoading(
  () => import('@/pages/NotFound'),
  <div className="min-h-screen flex items-center justify-center">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
      <p className="text-gray-600">加载页面中...</p>
    </div>
  </div>
);