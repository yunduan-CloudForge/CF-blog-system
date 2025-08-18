/**
 * 管理员权限状态管理
 * 管理管理员相关的权限检查、用户管理、操作日志等功能
 */
import { create } from 'zustand';
import { authAPI } from './authStore';

// 权限接口
export interface Permission {
  id: number;
  name: string;
  description: string;
  category: string;
}

// 用户管理接口
export interface AdminUser {
  id: number;
  email: string;
  username: string;
  role: 'admin' | 'author' | 'user';
  avatar?: string;
  bio?: string;
  createdAt: string;
  updatedAt: string;
}

// 操作日志接口
export interface AdminLog {
  id: number;
  userId: number;
  action: string;
  resource: string;
  resourceId?: number;
  details?: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
  userEmail: string;
  result: 'success' | 'failed' | 'pending';
  user?: {
    email: string;
    username: string;
  };
}

// 系统统计接口
export interface SystemStats {
  totalUsers: number;
  totalArticles: number;
  totalComments: number;
  totalLogs: number;
  recentUsers: number;
  recentArticles: number;
  recentComments: number;
}

// 仪表板详细统计接口
export interface DashboardStats {
  overview: {
    totalUsers: number;
    newUsers: number;
    totalArticles: number;
    publishedArticles: number;
    newArticles: number;
    totalComments: number;
    newComments: number;
    totalViews: number;
    totalLikes: number;
  };
  trends: {
    users: Array<{ date: string; count: number }>;
    articles: Array<{ date: string; count: number }>;
    comments: Array<{ date: string; count: number }>;
  };
  charts: {
    categoryDistribution: Array<{ name: string; count: number }>;
    popularArticles: Array<{
      id: number;
      title: string;
      views: number;
      likes: number;
      comments_count: number;
      author: string;
    }>;
    activeUsers: Array<{
      id: number;
      username: string;
      email: string;
      articleCount: number;
      created_at: string;
    }>;
  };
  systemStatus: {
    recentLogs: number;
    errorCount: number;
    recentUsers: number;
    avgViews: number;
    uptime: number;
    memoryUsage: {
      rss: number;
      heapTotal: number;
      heapUsed: number;
      external: number;
      arrayBuffers: number;
    };
    timestamp: string;
  };
}

// 管理员状态接口
interface AdminState {
  // 权限相关
  permissions: Permission[];
  userPermissions: string[];
  
  // 用户管理
  users: AdminUser[];
  usersLoading: boolean;
  
  // 操作日志
  logs: AdminLog[];
  logsLoading: boolean;
  
  // 系统统计
  stats: SystemStats | null;
  statsLoading: boolean;
  
  // 仪表板数据
  dashboardStats: DashboardStats | null;
  dashboardLoading: boolean;
  
  // 操作方法
  // 权限相关
  fetchPermissions: () => Promise<void>;
  fetchUserPermissions: () => Promise<void>;
  updateRolePermissions: (role: string, permissions: string[]) => Promise<boolean>;
  
  // 用户管理
  fetchUsers: (page?: number, limit?: number) => Promise<void>;
  createUser: (userData: Partial<AdminUser> & { password: string }) => Promise<boolean>;
  updateUser: (id: number, userData: Partial<AdminUser>) => Promise<boolean>;
  deleteUser: (id: number) => Promise<boolean>;
  resetUserPassword: (id: number, newPassword: string) => Promise<boolean>;
  
  // 操作日志
  fetchLogs: (page?: number, limit?: number, filters?: Record<string, unknown>) => Promise<void>;
  
  // 系统统计
  fetchStats: () => Promise<void>;
  
  // 仪表板数据
  fetchDashboardStats: () => Promise<void>;
  
  // 权限检查
  hasPermission: (permission: string) => boolean;
  hasRole: (role: string | string[]) => boolean;
  canAccessResource: (resource: string, action: string) => boolean;
}

// 创建管理员store
export const useAdminStore = create<AdminState>((set, get) => ({
  // 初始状态
  permissions: [],
  userPermissions: [],
  users: [],
  usersLoading: false,
  logs: [],
  logsLoading: false,
  stats: null,
  statsLoading: false,
  dashboardStats: null,
  dashboardLoading: false,

  // 获取所有权限
  fetchPermissions: async () => {
    try {
      const response = await authAPI.authenticatedFetch('/admin/permissions');
      const data = await response.json();
      
      if (data.success) {
        set({ permissions: data.data });
      }
    } catch (error) {
      console.error('获取权限列表失败:', error);
    }
  },

  // 获取用户权限
  fetchUserPermissions: async () => {
    try {
      const response = await authAPI.authenticatedFetch('/admin/user-permissions');
      const data = await response.json();
      
      if (data.success) {
        set({ userPermissions: data.data });
      }
    } catch (error) {
      console.error('获取用户权限失败:', error);
    }
  },

  // 更新角色权限
  updateRolePermissions: async (role: string, permissions: string[]): Promise<boolean> => {
    try {
      const response = await authAPI.authenticatedFetch(`/admin/roles/${role}/permissions`, {
        method: 'PUT',
        body: JSON.stringify({ permissions }),
      });
      
      const data = await response.json();
      return data.success;
    } catch (error) {
      console.error('更新角色权限失败:', error);
      return false;
    }
  },

  // 获取用户列表
  fetchUsers: async (page = 1, limit = 10) => {
    try {
      set({ usersLoading: true });
      
      const response = await authAPI.authenticatedFetch(`/users?page=${page}&limit=${limit}`);
      const data = await response.json();
      
      if (data.success) {
        set({ users: data.data.users });
      }
    } catch (error) {
      console.error('获取用户列表失败:', error);
    } finally {
      set({ usersLoading: false });
    }
  },

  // 创建用户
  createUser: async (userData): Promise<boolean> => {
    try {
      const response = await authAPI.authenticatedFetch('/users', {
        method: 'POST',
        body: JSON.stringify(userData),
      });
      
      const data = await response.json();
      
      if (data.success) {
        // 重新获取用户列表
        get().fetchUsers();
        return true;
      }
      return false;
    } catch (error) {
      console.error('创建用户失败:', error);
      return false;
    }
  },

  // 更新用户
  updateUser: async (id: number, userData): Promise<boolean> => {
    try {
      const response = await authAPI.authenticatedFetch(`/users/${id}`, {
        method: 'PUT',
        body: JSON.stringify(userData),
      });
      
      const data = await response.json();
      
      if (data.success) {
        // 更新本地用户列表
        const users = get().users.map(user => 
          user.id === id ? { ...user, ...userData } : user
        );
        set({ users });
        return true;
      }
      return false;
    } catch (error) {
      console.error('更新用户失败:', error);
      return false;
    }
  },

  // 删除用户
  deleteUser: async (id: number): Promise<boolean> => {
    try {
      const response = await authAPI.authenticatedFetch(`/users/${id}`, {
        method: 'DELETE',
      });
      
      const data = await response.json();
      
      if (data.success) {
        // 从本地列表中移除用户
        const users = get().users.filter(user => user.id !== id);
        set({ users });
        return true;
      }
      return false;
    } catch (error) {
      console.error('删除用户失败:', error);
      return false;
    }
  },

  // 重置用户密码
  resetUserPassword: async (id: number, newPassword: string): Promise<boolean> => {
    try {
      const response = await authAPI.authenticatedFetch(`/users/${id}/password`, {
        method: 'PUT',
        body: JSON.stringify({ password: newPassword }),
      });
      
      const data = await response.json();
      return data.success;
    } catch (error) {
      console.error('重置密码失败:', error);
      return false;
    }
  },

  // 获取操作日志
  fetchLogs: async (page = 1, limit = 20, filters: Record<string, unknown> = {}) => {
    try {
      set({ logsLoading: true });
      
      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        ...filters,
      });
      
      const response = await authAPI.authenticatedFetch(`/admin/logs?${queryParams}`);
      const data = await response.json();
      
      if (data.success) {
        set({ logs: data.data.logs });
      }
    } catch (error) {
      console.error('获取操作日志失败:', error);
    } finally {
      set({ logsLoading: false });
    }
  },

  // 获取系统统计
  fetchStats: async () => {
    try {
      set({ statsLoading: true });
      
      const response = await authAPI.authenticatedFetch('/admin/stats');
      const data = await response.json();
      
      if (data.success) {
        set({ stats: data.stats });
      }
    } catch (error) {
      console.error('获取系统统计失败:', error);
    } finally {
      set({ statsLoading: false });
    }
  },

  // 获取仪表板详细统计
  fetchDashboardStats: async () => {
    try {
      set({ dashboardLoading: true });
      
      const response = await authAPI.authenticatedFetch('/admin/dashboard/stats');
      const data = await response.json();
      
      if (response.ok && data.success) {
        // 确保数据结构完整，添加默认值
        const safeData = {
          overview: {
            totalUsers: 0,
            newUsers: 0,
            totalArticles: 0,
            publishedArticles: 0,
            newArticles: 0,
            totalComments: 0,
            newComments: 0,
            totalViews: 0,
            totalLikes: 0,
            ...data.data.overview
          },
          trends: data.data.trends || { users: [], articles: [], comments: [] },
          charts: data.data.charts || { categoryDistribution: [], popularArticles: [], activeUsers: [] },
          systemStatus: {
            uptime: 0,
            memoryUsage: { heapUsed: 0, heapTotal: 0, external: 0, rss: 0, arrayBuffers: 0 },
            recentLogs: 0,
            errorCount: 0,
            recentUsers: 0,
            avgViews: 0,
            timestamp: new Date().toISOString(),
            ...data.data.systemStatus
          }
        };
        set({ dashboardStats: safeData });
      } else {
        console.error('获取仪表板统计失败:', data);
        // 设置默认的空数据结构
        set({ 
          dashboardStats: {
            overview: {
              totalUsers: 0,
              newUsers: 0,
              totalArticles: 0,
              publishedArticles: 0,
              newArticles: 0,
              totalComments: 0,
              newComments: 0,
              totalViews: 0,
              totalLikes: 0
            },
            trends: { users: [], articles: [], comments: [] },
            charts: { categoryDistribution: [], popularArticles: [], activeUsers: [] },
            systemStatus: {
              uptime: 0,
              memoryUsage: { heapUsed: 0, heapTotal: 0, external: 0, rss: 0, arrayBuffers: 0 },
              recentLogs: 0,
              errorCount: 0,
              recentUsers: 0,
              avgViews: 0,
              timestamp: new Date().toISOString()
            }
          }
        });
      }
    } catch (error) {
      console.error('获取仪表板统计失败:', error);
      // 设置默认的空数据结构
      set({ 
        dashboardStats: {
          overview: {
            totalUsers: 0,
            newUsers: 0,
            totalArticles: 0,
            publishedArticles: 0,
            newArticles: 0,
            totalComments: 0,
            newComments: 0,
            totalViews: 0,
            totalLikes: 0
          },
          trends: { users: [], articles: [], comments: [] },
          charts: { categoryDistribution: [], popularArticles: [], activeUsers: [] },
          systemStatus: {
            uptime: 0,
            memoryUsage: { heapUsed: 0, heapTotal: 0, external: 0, rss: 0, arrayBuffers: 0 },
            recentLogs: 0,
            errorCount: 0,
            recentUsers: 0,
            avgViews: 0,
            timestamp: new Date().toISOString()
          }
        }
      });
    } finally {
      set({ dashboardLoading: false });
    }
  },

  // 权限检查方法
  hasPermission: (permission: string): boolean => {
    const { userPermissions } = get();
    return userPermissions.includes(permission);
  },

  hasRole: (): boolean => {
    // 这里需要从authStore获取用户角色
    // 由于store之间的依赖，我们通过导入useAuthStore来获取
    return true; // 临时返回，实际实现需要检查用户角色
  },

  canAccessResource: (resource: string, action: string): boolean => {
    const permission = `${resource}:${action}`;
    return get().hasPermission(permission);
  },
}));

// 导出管理员API工具函数
export const adminAPI = {
  // 检查用户权限
  checkPermission: async (permission: string): Promise<boolean> => {
    try {
      const response = await authAPI.authenticatedFetch(`/admin/check-permission?permission=${permission}`);
      const data = await response.json();
      return data.success && data.data.hasPermission;
    } catch (error) {
      console.error('检查权限失败:', error);
      return false;
    }
  },

  // 记录操作日志
  logAction: async (action: string, resource: string, details?: Record<string, unknown>): Promise<void> => {
    try {
      await authAPI.authenticatedFetch('/admin/log-action', {
        method: 'POST',
        body: JSON.stringify({ action, resource, details }),
      });
    } catch {
      console.error('记录操作日志失败');
    }
  },
};

// 权限检查Hook
export const usePermission = (permission: string) => {
  const hasPermission = useAdminStore(state => state.hasPermission);
  return hasPermission(permission);
};

// 角色检查Hook
export const useRole = (role: string | string[]) => {
  const hasRole = useAdminStore(state => state.hasRole);
  return hasRole(role);
};