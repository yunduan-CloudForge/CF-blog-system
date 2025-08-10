import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { authApi } from '@/utils/api';
import { Eye, EyeOff, Mail, Lock, User } from 'lucide-react';
import { ButtonLoading } from '@/components/ui/LoadingState';
import { useToastActions } from '@/components/ui/Toast';
import { useScreenReader } from '@/hooks/useAccessibility';
import { PageTransition } from '@/components/ui/PageTransition';
import { useFormValidation, commonValidationRules } from '@/hooks/useFormValidation';
import { FormInput } from '@/components/ui/FormInput';

export default function Register() {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const {
    errors,
    touched,
    validateField,
    validateForm,
    handleBlur,
    handleChange,
    hasError
  } = useFormValidation({
    username: commonValidationRules.username,
    email: commonValidationRules.email,
    password: commonValidationRules.password,
    confirmPassword: {
      required: true,
      custom: (value: string) => {
        if (value !== formData.password) {
          return '两次输入的密码不一致';
        }
        return null;
      }
    }
  });

  const hasFormError = () => {
    return Object.keys(errors).some(key => touched[key] && errors[key]);
  };
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const toast = useToastActions();
  
  const usernameInputRef = useRef<HTMLInputElement>(null);
  const emailInputRef = useRef<HTMLInputElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);
  const confirmPasswordInputRef = useRef<HTMLInputElement>(null);
  const { announce } = useScreenReader();

  useEffect(() => {
    if (user) {
      navigate('/', { replace: true });
    }
  }, [user, navigate]);

  useEffect(() => {
    // 页面加载时聚焦到用户名输入框
    if (usernameInputRef.current) {
      usernameInputRef.current.focus();
    }
  }, []);

  // handleChange和validateForm已在useFormValidation中定义

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const isValid = validateForm();
    if (!isValid) {
      toast.error('请检查表单中的错误');
      return;
    }

    if (!agreeToTerms) {
      toast.error('请同意服务条款和隐私政策');
      return;
    }

    try {
      setLoading(true);
      await register(formData.username, formData.email, formData.password);
      announce('注册成功');
      toast.success('注册成功，请登录');
      navigate('/login');
    } catch (error: any) {
      announce('注册失败');
      toast.error(error.response?.data?.message || '注册失败，请重试');
    } finally {
      setLoading(false);
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
            创建新账户
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            已有账户？{' '}
            <Link
              to="/login"
              className="font-medium text-blue-600 hover:text-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-md"
            >
              立即登录
            </Link>
          </p>
        </div>
        
        <form className="mt-6 sm:mt-8 space-y-5 sm:space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <FormInput
              ref={usernameInputRef}
              id="username"
              name="username"
              type="text"
              label="用户名"
              value={formData.username}
              onChange={(e) => handleInputChange('username', e.target.value)}
              onBlur={() => handleBlur('username')}
              error={touched.username ? errors.username : undefined}
              placeholder="请输入用户名（至少3个字符）"
              autoComplete="username"
              required
              aria-label="用户名"
            />
            
            <FormInput
              ref={emailInputRef}
              id="email"
              name="email"
              type="email"
              label="邮箱地址"
              value={formData.email}
              onChange={(e) => handleInputChange('email', e.target.value)}
              onBlur={() => handleBlur('email')}
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
              onBlur={() => handleBlur('password')}
              error={touched.password ? errors.password : undefined}
              placeholder="请输入密码（至少6个字符）"
              autoComplete="new-password"
              required
              showPasswordToggle
              aria-label="密码"
            />
            
            <FormInput
              ref={confirmPasswordInputRef}
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              label="确认密码"
              value={formData.confirmPassword}
              onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
              onBlur={() => handleBlur('confirmPassword')}
              error={touched.confirmPassword ? errors.confirmPassword : undefined}
              placeholder="请再次输入密码"
              autoComplete="new-password"
              required
              showPasswordToggle
              aria-label="确认密码"
            />
          </div>

          <div className="flex items-start sm:items-center">
            <input
              id="agree-terms"
              name="agree-terms"
              type="checkbox"
              required
              checked={agreeToTerms}
              onChange={(e) => setAgreeToTerms(e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded mt-0.5 sm:mt-0 flex-shrink-0 focus:ring-2 focus:ring-offset-2"
              aria-describedby="terms-description"
            />
            <label htmlFor="agree-terms" id="terms-description" className="ml-2 block text-sm text-gray-900 leading-relaxed">
              我同意{' '}
              <a href="#" className="text-blue-600 hover:text-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-md">
                服务条款
              </a>
              {' '}和{' '}
              <a href="#" className="text-blue-600 hover:text-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-md">
                隐私政策
              </a>
            </label>
          </div>

          <div>
            <ButtonLoading
              type="submit"
              loading={loading}
              disabled={!formData.username || !formData.email || !formData.password || !formData.confirmPassword || !agreeToTerms || hasFormError()}
              className="group relative w-full flex justify-center py-2.5 sm:py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label={loading ? '正在注册' : '注册账户'}
            >
              注册账户
            </ButtonLoading>
          </div>
        </form>
      </div>
      </div>
    </PageTransition>
  );
}