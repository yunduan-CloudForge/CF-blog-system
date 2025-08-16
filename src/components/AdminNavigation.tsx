import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { 
  LayoutDashboard, 
  Users, 
  FileText, 
  Settings, 
  LogOut,
  Shield,
  Activity,
  Home,
  FolderOpen,
  Tag
} from 'lucide-react';
import toast from 'react-hot-toast';

interface AdminNavigationProps {
  className?: string;
}

export default function AdminNavigation({ className = '' }: AdminNavigationProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  const handleLogout = () => {
    logout();
    toast.success('已退出登录');
    navigate('/admin/login');
  };

  const navigationItems = [
    {
      name: '返回主页',
      href: '/',
      icon: Home,
      roles: ['admin', 'author']
    },
    {
      name: '仪表板',
      href: '/admin/dashboard',
      icon: LayoutDashboard,
      roles: ['admin', 'author']
    },
    {
      name: '用户管理',
      href: '/admin/users',
      icon: Users,
      roles: ['admin']
    },
    {
      name: '文章管理',
      href: '/admin/articles',
      icon: FileText,
      roles: ['admin', 'author']
    },
    {
      name: '分类管理',
      href: '/admin/categories',
      icon: FolderOpen,
      roles: ['admin']
    },
    {
      name: '标签管理',
      href: '/admin/tags',
      icon: Tag,
      roles: ['admin']
    },
    {
      name: '权限管理',
      href: '/admin/permissions',
      icon: Shield,
      roles: ['admin']
    },
    {
      name: '操作日志',
      href: '/admin/logs',
      icon: Activity,
      roles: ['admin']
    },
    {
      name: '系统监控',
      href: '/admin/system-status',
      icon: Activity,
      roles: ['admin']
    },
    {
      name: '系统设置',
      href: '/admin/settings',
      icon: Settings,
      roles: ['admin']
    }
  ];

  // 过滤用户有权限访问的菜单项
  const filteredItems = navigationItems.filter(item => 
    item.roles.includes(user?.role || '')
  );

  return (
    <nav className={`bg-white shadow-sm border-r border-gray-200 ${className}`}>
      <div className="p-6">
        <div className="flex items-center space-x-3 mb-8">
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">管理后台</h1>
            <p className="text-sm text-gray-500">{user?.email}</p>
          </div>
        </div>

        <div className="space-y-2">
          {filteredItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.href;
            
            return (
              <Link
                key={item.name}
                to={item.href}
                className={`
                  flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors
                  ${
                    isActive
                      ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-600'
                      : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                  }
                `}
              >
                <Icon className="w-5 h-5" />
                <span className="font-medium">{item.name}</span>
              </Link>
            );
          })}
        </div>

        <div className="mt-8 pt-6 border-t border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm text-gray-500">
              角色: <span className="font-medium text-gray-700">
                {user?.role === 'admin' ? '管理员' : '作者'}
              </span>
            </div>
          </div>
          
          <button
            onClick={handleLogout}
            className="flex items-center space-x-3 w-full px-4 py-3 text-gray-700 hover:bg-red-50 hover:text-red-700 rounded-lg transition-colors"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-medium">退出登录</span>
          </button>
        </div>
      </div>
    </nav>
  );
}

// 简化的顶部导航栏组件
export function AdminTopBar() {
  const { user } = useAuthStore();
  
  return (
    <header className="bg-white shadow-sm border-b border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">管理后台</h2>
        </div>
        <div className="flex items-center space-x-4">
          <div className="text-sm text-gray-600">
            欢迎, <span className="font-medium">{user?.email}</span>
          </div>
          <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
            <span className="text-white text-sm font-medium">
              {user?.email?.charAt(0).toUpperCase()}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}