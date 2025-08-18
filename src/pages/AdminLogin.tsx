/**
 * 管理员登录页面
 * 模块: 5.1 管理员权限系统 - 管理员登录
 */

import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff, Shield, AlertCircle } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import toast from 'react-hot-toast';

const AdminLogin: React.FC = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{[key: string]: string}>({});
  
  const { loginWithCredentials, user } = useAuthStore();
  const navigate = useNavigate();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // 清除对应字段的错误
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors: {[key: string]: string} = {};
    
    if (!formData.email.trim()) {
      newErrors.email = '请输入邮箱地址';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = '请输入有效的邮箱地址';
    }
    
    if (!formData.password) {
      newErrors.password = '请输入密码';
    } else if (formData.password.length < 6) {
      newErrors.password = '密码长度至少6位';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    setIsLoading(true);
    
    try {
      const success = await loginWithCredentials(formData.email, formData.password);
      
      if (success && user) {
        // 检查用户是否有管理员权限
        if (user.role === 'admin' || user.role === 'author') {
          toast.success(`管理员登录成功！欢迎回来，${user.username}`, {
          icon: '✅'
        });
          
          // 跳转到管理后台
          navigate('/admin/dashboard');
        } else {
          // 普通用户无法访问管理后台
          toast.error('权限不足：您没有管理员权限，无法访问管理后台', {
          icon: '❌'
        });
          
          // 登出用户
          useAuthStore.getState().logout();
        }
      } else {
        toast.error('登录失败：邮箱或密码错误', {
        icon: '❌'
      });
      }
    } catch (error) {
      console.error('管理员登录错误:', error);
      toast.error('登录失败：网络错误，请稍后重试', {
      icon: '❌'
    });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* 头部 */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-purple-600 rounded-full mb-4">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">管理后台</h1>
          <p className="text-slate-300">请使用管理员账号登录</p>
        </div>

        {/* 登录表单 */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* 邮箱输入 */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-white mb-2">
                邮箱地址
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                className={`w-full px-4 py-3 bg-white/10 border rounded-lg text-white placeholder-slate-300 focus:outline-none focus:ring-2 transition-colors ${
                  errors.email 
                    ? 'border-red-400 focus:ring-red-400' 
                    : 'border-white/30 focus:ring-purple-400 focus:border-purple-400'
                }`}
                placeholder="请输入管理员邮箱"
                disabled={isLoading}
              />
              {errors.email && (
                <p className="mt-2 text-sm text-red-400 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" />
                  {errors.email}
                </p>
              )}
            </div>

            {/* 密码输入 */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-white mb-2">
                密码
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  className={`w-full px-4 py-3 pr-12 bg-white/10 border rounded-lg text-white placeholder-slate-300 focus:outline-none focus:ring-2 transition-colors ${
                    errors.password 
                      ? 'border-red-400 focus:ring-red-400' 
                      : 'border-white/30 focus:ring-purple-400 focus:border-purple-400'
                  }`}
                  placeholder="请输入密码"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-white transition-colors"
                  disabled={isLoading}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {errors.password && (
                <p className="mt-2 text-sm text-red-400 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" />
                  {errors.password}
                </p>
              )}
            </div>

            {/* 登录按钮 */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-purple-600/50 text-white font-medium py-3 px-4 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-offset-2 focus:ring-offset-transparent"
            >
              {isLoading ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  登录中...
                </div>
              ) : (
                '登录管理后台'
              )}
            </button>
          </form>

          {/* 底部链接 */}
          <div className="mt-6 text-center">
            <Link 
              to="/login" 
              className="text-slate-300 hover:text-white transition-colors text-sm"
            >
              返回普通用户登录
            </Link>
          </div>
        </div>

        {/* 安全提示 */}
        <div className="mt-6 text-center">
          <p className="text-slate-400 text-xs">
            管理后台仅限授权人员访问，所有操作将被记录
          </p>
        </div>
      </div>
    </div>
  );
};

export default AdminLogin;