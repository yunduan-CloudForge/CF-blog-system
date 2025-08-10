import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { Menu, X, User, LogOut, Edit, Settings } from 'lucide-react';
import { useKeyboardNavigation, useFocusManagement } from '@/hooks/useKeyboardNavigation';
import { useSkipLinks } from '@/hooks/useAccessibility';

export default function Header() {
  const { isAuthenticated, user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const userMenuButtonRef = useRef<HTMLButtonElement>(null);
  const mobileMenuButtonRef = useRef<HTMLButtonElement>(null);
  const { trapFocus } = useFocusManagement();
  
  useSkipLinks();

  const handleLogout = () => {
    logout();
    navigate('/');
    setIsUserMenuOpen(false);
  };

  const closeMobileMenu = () => {
    setIsMenuOpen(false);
    mobileMenuButtonRef.current?.focus();
  };

  const closeUserMenu = () => {
    setIsUserMenuOpen(false);
    userMenuButtonRef.current?.focus();
  };

  // Keyboard navigation for mobile menu
  useKeyboardNavigation({
    onEscape: () => {
      if (isMenuOpen) closeMobileMenu();
      if (isUserMenuOpen) closeUserMenu();
    },
    enabled: isMenuOpen || isUserMenuOpen
  });

  // Focus management for mobile menu
  useEffect(() => {
    if (isMenuOpen && mobileMenuRef.current) {
      const cleanup = trapFocus(mobileMenuRef.current);
      return cleanup;
    }
  }, [isMenuOpen, trapFocus]);

  // Focus management for user menu
  useEffect(() => {
    if (isUserMenuOpen && userMenuRef.current) {
      const cleanup = trapFocus(userMenuRef.current);
      return cleanup;
    }
  }, [isUserMenuOpen, trapFocus]);

  // Handle click outside to close menus
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node) && 
          !userMenuButtonRef.current?.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };

    if (isUserMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isUserMenuOpen]);

  return (
    <header className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">B</span>
            </div>
            <span className="text-xl font-bold text-gray-900">博客系统</span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-8">
            <Link
              to="/"
              className="text-gray-700 hover:text-blue-600 transition-colors"
            >
              首页
            </Link>
            
            {isAuthenticated && (
              <Link
                to="/create"
                className="text-gray-700 hover:text-blue-600 transition-colors flex items-center space-x-1"
              >
                <Edit className="w-4 h-4" />
                <span>写文章</span>
              </Link>
            )}
            
            {user?.role === 'admin' && (
              <Link
                to="/admin/dashboard"
                className="text-gray-700 hover:text-blue-600 transition-colors flex items-center space-x-1"
              >
                <Settings className="w-4 h-4" />
                <span>管理后台</span>
              </Link>
            )}
          </nav>

          {/* User Menu */}
          <div className="flex items-center space-x-4">
            {isAuthenticated ? (
              <div className="relative">
                <button
                  ref={userMenuButtonRef}
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  className="flex items-center space-x-2 text-gray-700 hover:text-blue-600 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-md p-1"
                  aria-expanded={isUserMenuOpen}
                  aria-controls="user-menu"
                  aria-label="用户菜单"
                >
                  <User className="w-5 h-5" />
                  <span className="hidden sm:block">{user?.name}</span>
                </button>
                
                {isUserMenuOpen && (
                  <div 
                    ref={userMenuRef}
                    id="user-menu"
                    className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50 border"
                    role="menu"
                    aria-orientation="vertical"
                    aria-labelledby="user-menu-button"
                  >
                    <Link
                      to="/profile"
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 focus:bg-gray-100 focus:outline-none"
                      onClick={() => setIsUserMenuOpen(false)}
                      role="menuitem"
                    >
                      个人资料
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 focus:bg-gray-100 focus:outline-none flex items-center space-x-2"
                      role="menuitem"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>退出登录</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center space-x-4">
                <Link
                  to="/login"
                  className="text-gray-700 hover:text-blue-600 transition-colors"
                >
                  登录
                </Link>
                <Link
                  to="/register"
                  className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
                >
                  注册
                </Link>
              </div>
            )}

            {/* Mobile menu button */}
            <button
              ref={mobileMenuButtonRef}
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="md:hidden p-2 rounded-md text-gray-700 hover:text-blue-600 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              aria-expanded={isMenuOpen}
              aria-controls="mobile-menu"
              aria-label={isMenuOpen ? '关闭菜单' : '打开菜单'}
            >
              {isMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div 
            ref={mobileMenuRef}
            id="mobile-menu"
            className="md:hidden py-4 border-t"
            role="navigation"
            aria-label="移动端导航菜单"
          >
            <div className="flex flex-col space-y-4">
              <Link
                to="/"
                className="text-gray-700 hover:text-blue-600 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-md p-2"
                onClick={closeMobileMenu}
              >
                首页
              </Link>
              
              {isAuthenticated && (
                <Link
                  to="/create"
                  className="text-gray-700 hover:text-blue-600 transition-colors flex items-center space-x-1 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-md p-2"
                  onClick={closeMobileMenu}
                >
                  <Edit className="w-4 h-4" />
                  <span>写文章</span>
                </Link>
              )}
              
              {user?.role === 'admin' && (
                <Link
                  to="/admin/dashboard"
                  className="text-gray-700 hover:text-blue-600 transition-colors flex items-center space-x-1 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-md p-2"
                  onClick={closeMobileMenu}
                >
                  <Settings className="w-4 h-4" />
                  <span>管理后台</span>
                </Link>
              )}
              
              {!isAuthenticated && (
                <div className="flex flex-col space-y-2 pt-4 border-t">
                  <Link
                    to="/login"
                    className="text-gray-700 hover:text-blue-600 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-md p-2"
                    onClick={closeMobileMenu}
                  >
                    登录
                  </Link>
                  <Link
                    to="/register"
                    className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors text-center focus:outline-none focus:ring-2 focus:ring-blue-300 focus:ring-offset-2"
                    onClick={closeMobileMenu}
                  >
                    注册
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      

    </header>
  );
}