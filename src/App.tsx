import React, { useEffect, lazy, Suspense } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { useAuthStore } from "@/store/authStore";
import { authApi } from "@/utils/api";
import { PerformanceProvider } from "@/components/Performance/PerformanceProvider";
import Layout from "@/components/Layout";
import { PageLoadingSpinner } from "@/components/LoadingSpinner";
import ErrorBoundary from "@/components/ErrorBoundary";
import ProtectedRoute from "@/components/ProtectedRoute";
import { ToastProvider } from "@/components/ui/Toast";
import { ConfirmDialogProvider } from "@/components/ui/ConfirmDialog";
import { RouteTransition } from "@/components/ui/PageTransition";
import { URLRedirect } from "@/components/SEO/URLRedirect";
import { errorMonitor } from "@/utils/errorMonitor";
import { performanceMiddleware } from '@/utils/performanceMiddleware';


import {
  LazyHome,
  LazyLogin,
  LazyRegister,
  LazyArticleDetail,
  LazyCreateArticle,
  LazyEditArticle,
  LazyProfile,
  LazyDashboard,
  LazySEOManagement,
  LazyImageOptimizationTest,
  LazyMonitoringDashboard,
  LazyNotFound
} from './routes/lazyRoutes';

// 预加载策略 - 在用户可能访问前预加载重要页面
const preloadRoutes = () => {
  // 延迟预加载常用页面
  setTimeout(() => {
    import("@/pages/ArticleDetail");
    import("@/pages/Login");
  }, 2000);
  
  // 进一步延迟预加载其他页面
  setTimeout(() => {
    import("@/pages/CreateArticle");
    import("@/pages/Profile");
  }, 5000);
};

export default function App() {
  const { token, setLoading, login, logout, user } = useAuthStore();

  useEffect(() => {
    // 如果有token，验证用户身份
    if (token) {
      setLoading(true);
      authApi.getCurrentUser()
        .then((user) => {
          login(user, token);
          // 设置错误监控的用户ID
          errorMonitor.setUserId(user.id.toString());
          console.log('用户认证成功:', user);
        })
        .catch((error) => {
          console.error('用户认证失败:', error);
          logout();
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [token, setLoading, login, logout]);

  // 初始化错误监控和性能监控
  useEffect(() => {
    if (user) {
      errorMonitor.setUserId(user.id.toString());
    }
    
    // 启动性能监控会话
    performanceMiddleware.startSession();
  }, [user]);

  // 启动预加载策略
  useEffect(() => {
    preloadRoutes();
  }, []);

  return (
    <HelmetProvider>
      <PerformanceProvider enableMonitoring={true} enableNetworkOptimization={true}>
        <ToastProvider>
          <ConfirmDialogProvider>
            <Router>
            <ErrorBoundary>
              <Layout>
                <URLRedirect />
                <RouteTransition>
                  <Suspense fallback={<PageLoadingSpinner />}>
                  <Routes>
              {/* 公开路由 */}
              <Route path="/" element={<LazyHome />} />
              <Route path="/login" element={<LazyLogin />} />
              <Route path="/register" element={<LazyRegister />} />
              
              {/* 文章相关路由 - SEO友好 */}
              <Route path="/articles" element={<LazyHome />} />
              <Route path="/articles/:slug" element={<LazyArticleDetail />} />
              <Route path="/article/:slug" element={<LazyArticleDetail />} /> {/* 兼容旧路由 */}
              
              {/* 分类和标签路由 - SEO友好 */}
              <Route path="/categories" element={<LazyHome />} />
              <Route path="/categories/:category" element={<LazyHome />} />
              <Route path="/tags" element={<LazyHome />} />
              <Route path="/tags/:tag" element={<LazyHome />} />
              
              {/* 测试页面 */}
              <Route path="/image-test" element={<LazyImageOptimizationTest />} />
              
              {/* 图片优化测试页面 */}
              <Route path="/test/image-optimization" element={
                <LazyImageOptimizationTest />
              } />
              
              {/* 需要认证的路由 */}
              <Route path="/articles/create" element={
                <ProtectedRoute>
                  <LazyCreateArticle />
                </ProtectedRoute>
              } />
              <Route path="/create" element={ /* 兼容旧路由 */
                <ProtectedRoute>
                  <LazyCreateArticle />
                </ProtectedRoute>
              } />
              <Route path="/articles/:id/edit" element={
                <ProtectedRoute>
                  <LazyEditArticle />
                </ProtectedRoute>
              } />
              <Route path="/edit/:id" element={ /* 兼容旧路由 */
                <ProtectedRoute>
                  <LazyEditArticle />
                </ProtectedRoute>
              } />
              <Route path="/profile" element={
                <ProtectedRoute>
                  <LazyProfile />
                </ProtectedRoute>
              } />
              
              {/* 管理员路由 */}
              <Route path="/admin" element={
                <ProtectedRoute requiredRole="admin">
                  <LazyDashboard />
                </ProtectedRoute>
              } />
              <Route path="/admin/dashboard" element={
                <ProtectedRoute requiredRole="admin">
                  <LazyDashboard />
                </ProtectedRoute>
              } />
              <Route path="/admin/seo" element={
                <ProtectedRoute requiredRole="admin">
                  <LazySEOManagement />
                </ProtectedRoute>
              } />
              <Route path="/admin/monitoring" element={
                <ProtectedRoute requiredRole="admin">
                  <LazyMonitoringDashboard />
                </ProtectedRoute>
              } />
              <Route path="/dashboard" element={ /* 兼容旧路由 */
                <ProtectedRoute requiredRole="admin">
                  <LazyDashboard />
                </ProtectedRoute>
              } />
              
              {/* 404页面 */}
              <Route path="*" element={<LazyNotFound />} />
                  </Routes>
                  </Suspense>
                </RouteTransition>
              </Layout>
            </ErrorBoundary>
            </Router>
          </ConfirmDialogProvider>
        </ToastProvider>
      </PerformanceProvider>

    </HelmetProvider>
  );
}
