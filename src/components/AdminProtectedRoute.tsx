import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { ReactNode } from 'react';

interface AdminProtectedRouteProps {
  children: ReactNode;
  requiredRole?: 'admin' | 'author';
}

export default function AdminProtectedRoute({ 
  children, 
  requiredRole = 'author' 
}: AdminProtectedRouteProps) {
  const { user, isAuthenticated } = useAuthStore();

  // 如果未登录，重定向到管理员登录页面
  if (!isAuthenticated || !user) {
    return <Navigate to="/admin/login" replace />;
  }

  // 检查用户角色权限
  const hasPermission = () => {
    if (requiredRole === 'admin') {
      return user.role === 'admin';
    }
    if (requiredRole === 'author') {
      return user.role === 'admin' || user.role === 'author';
    }
    return false;
  };

  // 如果权限不足，显示无权限页面
  if (!hasPermission()) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8 text-center">
          <div className="text-red-500 text-6xl mb-4">🚫</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">访问被拒绝</h1>
          <p className="text-gray-600 mb-6">
            您没有权限访问此页面。需要 {requiredRole === 'admin' ? '管理员' : '作者或管理员'} 权限。
          </p>
          <div className="space-y-3">
            <button
              onClick={() => window.history.back()}
              className="w-full px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors"
            >
              返回上一页
            </button>
            <Navigate to="/" replace />
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

// 便捷的管理员专用组件
export function AdminOnlyRoute({ children }: { children: ReactNode }) {
  return (
    <AdminProtectedRoute requiredRole="admin">
      {children}
    </AdminProtectedRoute>
  );
}

// 便捷的作者及以上权限组件
export function AuthorRoute({ children }: { children: ReactNode }) {
  return (
    <AdminProtectedRoute requiredRole="author">
      {children}
    </AdminProtectedRoute>
  );
}