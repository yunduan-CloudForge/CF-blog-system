import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User } from '@/types/schemas';

// 定义认证状态接口
interface AuthState {
  readonly user: User | null;
  readonly token: string | null;
  readonly isAuthenticated: boolean;
  readonly isLoading: boolean;
  
  // 状态更新方法
  login: (user: User, token: string) => void;
  logout: () => void;
  updateUser: (user: User) => void;
  setLoading: (loading: boolean) => void;
}



export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      login: (user: User, token: string) => {
        set({
          token,
          user,
          isAuthenticated: true,
          isLoading: false
        });
      },
      logout: () => {
        set({
          token: null,
          user: null,
          isAuthenticated: false,
          isLoading: false
        });
      },
      updateUser: (user: User) => {
        set({ user });
      },
      setLoading: (loading: boolean) => {
        set({ isLoading: loading });
      }
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        token: state.token,
        user: state.user,
        isAuthenticated: state.isAuthenticated
      })
    }
  )
);