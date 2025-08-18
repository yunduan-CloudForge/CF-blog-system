import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { useEffect } from "react";
import Home from "@/pages/Home";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import ArticleList from "@/pages/ArticleList";
import ArticleDetail from "@/pages/ArticleDetail";
import ArticleEditor from "@/pages/ArticleEditor";
import AdminLogin from "@/pages/AdminLogin";
import AdminDashboard from "@/pages/AdminDashboard";
import AdminDashboardEnhanced from "@/pages/AdminDashboardEnhanced";
import AdminUsers from "@/pages/AdminUsers";
import AdminArticles from "@/pages/AdminArticles";
import AdminPermissions from "@/pages/AdminPermissions";
import AdminLogs from "@/pages/AdminLogs";
import AdminSettings from "@/pages/AdminSettings";
import SystemStatus from "@/pages/SystemStatus";
import AdminCategories from "@/pages/AdminCategories";
import AdminTags from "@/pages/AdminTags";
import CategoryPage from "@/pages/CategoryPage";
import TagPage from "@/pages/tagpage";
import UserCenter from "@/pages/UserCenter";
import MyArticles from "@/pages/MyArticles";

import ProtectedRoute, { GuestRoute } from "@/components/ProtectedRoute";
import { AuthorRoute, AdminOnlyRoute } from "@/components/AdminProtectedRoute";
import ToastProvider from "@/components/ToastProvider";
import { useAuthStore } from "@/store/authStore";

export default function App() {
  const { token, getCurrentUser } = useAuthStore();

  // 应用启动时检查认证状态
  useEffect(() => {
    if (token) {
      getCurrentUser();
    }
  }, [token, getCurrentUser]);

  return (
    <ToastProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<GuestRoute><Login /></GuestRoute>} />
          <Route path="/register" element={<GuestRoute><Register /></GuestRoute>} />
          
          {/* 文章相关路由 */}
          <Route path="/articles" element={<ArticleList />} />
          <Route path="/articles/:id" element={<ArticleDetail />} />
          <Route path="/articles/new" element={<ProtectedRoute><ArticleEditor /></ProtectedRoute>} />
          <Route path="/articles/:id/edit" element={<ProtectedRoute><ArticleEditor /></ProtectedRoute>} />
          
          {/* 分类和标签页面 */}
          <Route path="/categories/:categoryId" element={<CategoryPage />} />
          <Route path="/tags/:tagId" element={<TagPage />} />
          
          {/* 用户中心 */}
          <Route path="/user/center" element={<ProtectedRoute><UserCenter /></ProtectedRoute>} />
          <Route path="/my-articles" element={<ProtectedRoute><MyArticles /></ProtectedRoute>} />
          
          {/* 管理员相关路由 */}
          <Route path="/admin/login" element={<GuestRoute><AdminLogin /></GuestRoute>} />
          <Route path="/admin/dashboard" element={<AuthorRoute><AdminDashboardEnhanced /></AuthorRoute>} />
          <Route path="/admin/dashboard/basic" element={<AuthorRoute><AdminDashboard /></AuthorRoute>} />
          <Route path="/admin/users" element={<AdminOnlyRoute><AdminUsers /></AdminOnlyRoute>} />
          <Route path="/admin/articles" element={<AuthorRoute><AdminArticles /></AuthorRoute>} />
          <Route path="/admin/categories" element={<AdminOnlyRoute><AdminCategories /></AdminOnlyRoute>} />
          <Route path="/admin/tags" element={<AdminOnlyRoute><AdminTags /></AdminOnlyRoute>} />
          <Route path="/admin/permissions" element={<AdminOnlyRoute><AdminPermissions /></AdminOnlyRoute>} />
          <Route path="/admin/logs" element={<AdminOnlyRoute><AdminLogs /></AdminOnlyRoute>} />
          <Route path="/admin/settings" element={<AdminOnlyRoute><AdminSettings /></AdminOnlyRoute>} />
          <Route path="/admin/system-status" element={<AdminOnlyRoute><SystemStatus /></AdminOnlyRoute>} />
          
          <Route path="/other" element={<div className="text-center text-xl">Other Page - Coming Soon</div>} />
        </Routes>
      </Router>
    </ToastProvider>
  );
}
