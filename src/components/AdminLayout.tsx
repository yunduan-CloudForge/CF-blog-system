import { ReactNode } from 'react';
import AdminNavigation, { AdminTopBar } from './AdminNavigation';

interface AdminLayoutProps {
  children: ReactNode;
  title?: string;
  showTopBar?: boolean;
}

export default function AdminLayout({ 
  children, 
  title,
  showTopBar = true 
}: AdminLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* 侧边导航栏 */}
      <div className="w-64 flex-shrink-0">
        <AdminNavigation className="h-full" />
      </div>
      
      {/* 主内容区域 */}
      <div className="flex-1 flex flex-col">
        {/* 顶部栏 */}
        {showTopBar && <AdminTopBar />}
        
        {/* 页面内容 */}
        <main className="flex-1 p-6">
          {title && (
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}

// 简化的管理员页面包装器
export function AdminPage({ 
  title, 
  children, 
  className = '' 
}: { 
  title?: string; 
  children: ReactNode; 
  className?: string; 
}) {
  return (
    <AdminLayout title={title}>
      <div className={`bg-white rounded-lg shadow-sm p-6 ${className}`}>
        {children}
      </div>
    </AdminLayout>
  );
}