import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { authApi } from '@/utils/api';
import { Eye, EyeOff, Mail, Lock } from 'lucide-react';
import { ButtonLoading } from '@/components/ui/LoadingState';
import { useToastActions } from '@/components/ui/Toast';
import { useScreenReader } from '@/hooks/useAccessibility';
import { PageTransition } from '@/components/ui/PageTransition';
import { useFormValidation, commonValidationRules } from '@/hooks/useFormValidation';
import { FormInput } from '@/components/ui/FormInput';

export default function Login() {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const {
    errors,
    touched,
    validateField,
    validateForm,
    handleBlur,
    handleChange,
    hasError
  } = useFormValidation({
    email: commonValidationRules.email,
    password: commonValidationRules.password
  });

  const hasFormError = useCallback((): boolean => {
    return Object.keys(errors).some(key => touched[key] && errors[key]);
  }, [errors, touched]);
  const [error, setError] = useState('');
  const { login, isAuthenticated } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToastActions();
  
  const emailInputRef = useRef<HTMLInputElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);
  const { announce } = useScreenReader();
  
  const from = location.state?.from?.pathname || '/';

  useEffect(() => {
    if (isAuthenticated) {
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, from]);

  useEffect(() => {
    // 页面加载时聚焦到邮箱输入框
    if (emailInputRef.current) {
      emailInputRef.current.focus();
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const isValid = validateForm(formData);
    if (!isValid) {
      toast.error('请检查表单中的错误');
      return;
    }

    setIsLoading(true);
    
    try {
      const response = await authApi.login(formData.email, formData.password);
      login(response.user, response.accessToken);
      announce('登录成功，正在跳转');
      toast.success('登录成功', '欢迎回来！');
    } catch (error: any) {
      console.error('登录失败:', error);
      const errorMessage = error.response?.data?.message || '登录失败，请检查邮箱和密码';
      setError(errorMessage);
      announce(`登录失败：${errorMessage}`);
      toast.error('登录失败', errorMessage);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleInputChange = (name: string, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }));
    handleChange(name, value);
  };

  return (
    <PageTransition type="fade">
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-8 sm:py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-6 sm:space-y-8">
        <div>
          <div className="mx-auto h-10 w-10 sm:h-12 sm:w-12 bg-blue-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-lg sm:text-xl">B</span>
          </div>
          <h2 className="mt-4 sm:mt-6 text-center text-2xl sm:text-3xl font-extrabold text-gray-900">
            登录您的账户
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            还没有账户？{' '}
            <Link
              to="/register"
              className="font-medium text-blue-600 hover:text-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-md"
            >
              立即注册
            </Link>
          </p>
        </div>
        
        <form className="mt-6 sm:mt-8 space-y-5 sm:space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4 sm:space-y-4">
            <FormInput
              ref={emailInputRef}
              id="email"
              name="email"
              type="email"
              label="邮箱地址"
              value={formData.email}
              onChange={(e) => handleInputChange('email', e.target.value)}
              onBlur={() => handleBlur('email', formData.email)}
              error={touched.email ? errors.email : undefined}
              placeholder="请输入邮箱地址"
              autoComplete="email"
              required
              aria-label="邮箱地址"
            />

            <FormInput
              ref={passwordInputRef}
              id="password"
              name="password"
              type="password"
              label="密码"
              value={formData.password}
              onChange={(e) => handleInputChange('password', e.target.value)}
              onBlur={() => handleBlur('password', formData.password)}
              error={touched.password ? errors.password : undefined}
              placeholder="请输入密码"
              autoComplete="current-password"
              required
              showPasswordToggle
              aria-label="密码"
            />
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0">
            <div className="flex items-center">
              <input
                id="remember-me"
                name="remember-me"
                type="checkbox"
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-900">
                记住我
              </label>
            </div>

            <div className="text-sm">
              <a href="#" className="font-medium text-blue-600 hover:text-blue-500">
                忘记密码？
              </a>
            </div>
          </div>

          <div>
            <ButtonLoading
              type="submit"
              loading={isLoading}
              disabled={!formData.email || !formData.password || hasFormError()}
              className="group relative w-full flex justify-center py-2.5 sm:py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label={isLoading ? '正在登录' : '登录'}
            >
              登录
            </ButtonLoading>
          </div>
        </form>
      </div>
      </div>
    </PageTransition>
  );
}