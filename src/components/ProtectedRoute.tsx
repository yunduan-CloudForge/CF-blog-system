import React, { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAuth?: boolean;
  requiredRole?: 'admin' | 'author' | 'user';
  redirectTo?: string;
}

export default function ProtectedRoute({
  children,
  requireAuth = true,
  requiredRole,
  redirectTo = '/login'
}: ProtectedRouteProps) {
  const { isAuthenticated, user, isLoading, getCurrentUser } = useAuthStore();
  const location = useLocation();

  // 页面加载时检查用户登录状态
  useEffect(() => {
    if (isAuthenticated && !user) {
      getCurrentUser();
    }
  }, [isAuthenticated, user, getCurrentUser]);

  // 如果正在加载，显示加载状态
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  // 如果需要认证但用户未登录
  if (requireAuth && !isAuthenticated) {
    return <Navigate to={redirectTo} state={{ from: location }} replace />;
  }

  // 如果需要特定角色但用户角色不匹配
  if (requiredRole && user && !hasRequiredRole(user.role, requiredRole)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">访问被拒绝</h1>
          <p className="text-gray-600 mb-4">
            您没有访问此页面的权限。需要 {getRoleDisplayName(requiredRole)} 权限。
          </p>
          <button
            onClick={() => window.history.back()}
            className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition-colors"
          >
            返回上一页
          </button>
        </div>
      </div>
    );
  }

  // 如果不需要认证或用户已通过验证，渲染子组件
  return <>{children}</>;
}

// 检查用户是否具有所需角色
function hasRequiredRole(userRole: string, requiredRole: string): boolean {
  const roleHierarchy = {
    admin: 3,
    author: 2,
    user: 1
  };

  const userLevel = roleHierarchy[userRole as keyof typeof roleHierarchy] || 0;
  const requiredLevel = roleHierarchy[requiredRole as keyof typeof roleHierarchy] || 0;

  return userLevel >= requiredLevel;
}

// 获取角色显示名称
function getRoleDisplayName(role: string): string {
  const roleNames = {
    admin: '管理员',
    author: '作者',
    user: '用户'
  };

  return roleNames[role as keyof typeof roleNames] || role;
}

// 反向保护路由：已登录用户不应访问的页面（如登录、注册页面）
export function GuestRoute({ children, redirectTo = '/' }: { children: React.ReactNode; redirectTo?: string }) {
  const { isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to={redirectTo} replace />;
  }

  return <>{children}</>;
}