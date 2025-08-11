/**
 * 用户认证状态管理
 * 使用Zustand管理用户登录状态和用户信息
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// 用户信息接口
export interface User {
  id: number;
  email: string;
  username: string;
  role: string;
  avatar?: string;
  bio?: string;
  createdAt?: string;
}

// 认证状态接口
interface AuthState {
  // 状态
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  
  // 操作方法
  login: (token: string, user: User) => void;
  logout: () => void;
  updateUser: (user: Partial<User>) => void;
  setLoading: (loading: boolean) => void;
  
  // API调用方法
  loginWithCredentials: (email: string, password: string) => Promise<boolean>;
  registerUser: (email: string, password: string, username: string) => Promise<boolean>;
  getCurrentUser: () => Promise<boolean>;
}

// API基础URL
const API_BASE_URL = 'http://localhost:3001/api';

// 创建认证store
export const useAuthStore = create<AuthState>()(persist(
  (set, get) => ({
    // 初始状态
    user: null,
    token: null,
    isAuthenticated: false,
    isLoading: false,

    // 登录操作
    login: (token: string, user: User) => {
      set({
        token,
        user,
        isAuthenticated: true,
        isLoading: false
      });
    },

    // 登出操作
    logout: () => {
      set({
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false
      });
    },

    // 更新用户信息
    updateUser: (userData: Partial<User>) => {
      const currentUser = get().user;
      if (currentUser) {
        set({
          user: { ...currentUser, ...userData }
        });
      }
    },

    // 设置加载状态
    setLoading: (loading: boolean) => {
      set({ isLoading: loading });
    },

    // 使用邮箱密码登录
    loginWithCredentials: async (email: string, password: string): Promise<boolean> => {
      try {
        set({ isLoading: true });
        
        const response = await fetch(`${API_BASE_URL}/auth/login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email, password }),
        });

        const data = await response.json();

        if (data.success && data.data) {
          get().login(data.data.token, data.data.user);
          return true;
        } else {
          console.error('登录失败:', data.message);
          return false;
        }
      } catch (error) {
        console.error('登录请求失败:', error);
        return false;
      } finally {
        set({ isLoading: false });
      }
    },

    // 用户注册
    registerUser: async (email: string, password: string, username: string): Promise<boolean> => {
      try {
        set({ isLoading: true });
        
        const response = await fetch(`${API_BASE_URL}/auth/register`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email, password, username }),
        });

        const data = await response.json();

        if (data.success && data.data) {
          get().login(data.data.token, data.data.user);
          return true;
        } else {
          console.error('注册失败:', data.message);
          return false;
        }
      } catch (error) {
        console.error('注册请求失败:', error);
        return false;
      } finally {
        set({ isLoading: false });
      }
    },

    // 获取当前用户信息
    getCurrentUser: async (): Promise<boolean> => {
      try {
        const token = get().token;
        if (!token) {
          return false;
        }

        set({ isLoading: true });
        
        const response = await fetch(`${API_BASE_URL}/auth/me`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        const data = await response.json();

        if (data.success && data.data) {
          set({
            user: data.data.user,
            isAuthenticated: true,
            isLoading: false
          });
          return true;
        } else {
          // 令牌无效，清除认证状态
          get().logout();
          return false;
        }
      } catch (error) {
        console.error('获取用户信息失败:', error);
        get().logout();
        return false;
      } finally {
        set({ isLoading: false });
      }
    },
  }),
  {
    name: 'auth-storage', // 本地存储的key
    partialize: (state) => ({ 
      token: state.token, 
      user: state.user,
      isAuthenticated: state.isAuthenticated 
    }), // 只持久化这些字段
  }
));

// 导出API调用工具函数
export const authAPI = {
  // 带认证的请求
  authenticatedFetch: async (url: string, options: RequestInit = {}) => {
    const token = useAuthStore.getState().token;
    
    return fetch(`${API_BASE_URL}${url}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
        ...options.headers,
      },
    });
  },

  // 登出API调用
  logout: async () => {
    try {
      await authAPI.authenticatedFetch('/auth/logout', {
        method: 'POST',
      });
    } catch (error) {
      console.error('登出API调用失败:', error);
    } finally {
      useAuthStore.getState().logout();
    }
  },
};