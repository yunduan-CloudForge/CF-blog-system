import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { LogIn, UserPlus, LogOut, User, BookOpen, PenTool, Shield } from 'lucide-react';
import { useAuthStore, authAPI } from '../store/authStore';

export default function Home() {
  const { user, isAuthenticated, isLoading, getCurrentUser } = useAuthStore();

  // 页面加载时检查用户登录状态
  useEffect(() => {
    if (isAuthenticated && !user) {
      getCurrentUser();
    }
  }, [isAuthenticated, user, getCurrentUser]);

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

      {/* 主要内容 */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              欢迎来到博客系统
            </h1>
            <p className="text-xl text-gray-600 mb-8">
              这是一个基于 React + Express + SQLite 的现代博客系统
            </p>
            
            {isAuthenticated && user ? (
              <div className="space-y-6">
                {/* 快速操作 */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl mx-auto">
                  <Link
                    to="/articles"
                    className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center space-x-3">
                      <BookOpen className="h-8 w-8 text-indigo-600" />
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">浏览文章</h3>
                        <p className="text-gray-600">查看所有发布的文章</p>
                      </div>
                    </div>
                  </Link>
                  
                  {(user.role === 'admin' || user.role === 'author') && (
                    <Link
                      to="/articles/new"
                      className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-center space-x-3">
                        <PenTool className="h-8 w-8 text-green-600" />
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900">写文章</h3>
                          <p className="text-gray-600">创建新的博客文章</p>
                        </div>
                      </div>
                    </Link>
                  )}
                  
                  {(user.role === 'admin' || user.role === 'author') && (
                    <Link
                      to="/admin/dashboard"
                      className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-center space-x-3">
                        <Shield className="h-8 w-8 text-purple-600" />
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900">管理面板</h3>
                          <p className="text-gray-600">访问系统管理仪表盘</p>
                        </div>
                      </div>
                    </Link>
                  )}
                </div>
                
                {/* 用户信息 */}
                <div className="bg-white rounded-lg shadow p-6 max-w-md mx-auto">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">用户信息</h2>
                  <div className="space-y-2 text-left">
                    <p><strong>用户名：</strong> {user.username}</p>
                    <p><strong>邮箱：</strong> {user.email}</p>
                    <p><strong>角色：</strong> {user.role === 'admin' ? '管理员' : user.role === 'author' ? '作者' : '用户'}</p>
                    {user.bio && <p><strong>简介：</strong> {user.bio}</p>}
                    {user.createdAt && (
                      <p><strong>注册时间：</strong> {new Date(user.createdAt).toLocaleDateString('zh-CN')}</p>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {/* 访客快速操作 */}
                <div className="max-w-md mx-auto">
                  <Link
                    to="/articles"
                    className="block bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center space-x-3">
                      <BookOpen className="h-8 w-8 text-indigo-600" />
                      <div className="text-left">
                        <h3 className="text-lg font-semibold text-gray-900">浏览文章</h3>
                        <p className="text-gray-600">查看所有发布的文章</p>
                      </div>
                    </div>
                  </Link>
                </div>
                
                {/* 登录注册 */}
                <div className="bg-white rounded-lg shadow p-6 max-w-md mx-auto">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">开始使用</h2>
                  <p className="text-gray-600 mb-4">
                    请登录或注册账户以开始使用博客系统的完整功能。
                  </p>
                  <div className="space-y-3">
                    <Link
                      to="/login"
                      className="block w-full bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 transition-colors"
                    >
                      登录账户
                    </Link>
                    <Link
                      to="/register"
                      className="block w-full bg-gray-200 text-gray-900 py-2 px-4 rounded-md hover:bg-gray-300 transition-colors"
                    >
                      注册新账户
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}