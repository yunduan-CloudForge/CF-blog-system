/**
 * 实时数据监控Hook
 * 用于管理WebSocket连接和实时数据更新
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import websocketService, { type RealtimeData } from '../services/websocket';
import { useAuthStore } from '../store/authStore';

interface RealtimeStats {
  overview: {
    totalUsers: number;
    totalArticles: number;
    totalComments: number;
    totalViews: number;
  };
  systemStatus: {
    cpuUsage: number;
    memoryUsage: number;
    diskUsage: number;
    uptime: number;
  };
}

interface UserActivity {
  type: string;
  userId: number;
  action: string;
  timestamp: number;
  details?: Record<string, unknown>;
}

interface ConnectionState {
  status: 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'CLOSING';
  lastConnected?: number;
  reconnectAttempts?: number;
}

// 全局状态管理，确保只有一个WebSocket连接
let globalConnectionState: ConnectionState = { status: 'DISCONNECTED' };
let globalRealtimeStats: RealtimeStats | null = null;
let globalUserActivities: UserActivity[] = [];
let globalLastUpdate: number = 0;
const globalListeners: Set<() => void> = new Set();
let isGlobalConnected = false;
let globalConnectionPromise: Promise<void> | null = null;
let globalUnsubscribeFunctions: (() => void)[] = [];

// 通知所有监听器状态更新
function notifyListeners() {
  globalListeners.forEach(listener => listener());
}

// 设置全局订阅（只在连接成功后调用一次）
function setupGlobalSubscriptions(userRole?: string) {
  // 清理之前的订阅
  globalUnsubscribeFunctions.forEach(unsubscribe => unsubscribe());
  globalUnsubscribeFunctions = [];
  
  // 订阅统计数据
  const statsUnsubscribe = websocketService.subscribeToStats((data: RealtimeData) => {
    if (data.type === 'stats_update') {
      globalRealtimeStats = data.data as unknown as RealtimeStats;
      globalLastUpdate = data.timestamp;
      notifyListeners();
    }
  });
  globalUnsubscribeFunctions.push(statsUnsubscribe);
  
  // 如果是管理员，订阅用户活动和系统状态
  if (userRole === 'admin') {
    const userActivityUnsubscribe = websocketService.subscribeToUserActivity((data: RealtimeData) => {
      if (data.type === 'user_activity') {
        globalUserActivities = [data.data as unknown as UserActivity, ...globalUserActivities].slice(0, 50);
        notifyListeners();
      }
    });
    globalUnsubscribeFunctions.push(userActivityUnsubscribe);
    
    const systemStatusUnsubscribe = websocketService.subscribeToSystemStatus((data: RealtimeData) => {
      if (data.type === 'system_status') {
        globalRealtimeStats = globalRealtimeStats ? {
          ...globalRealtimeStats,
          systemStatus: { ...globalRealtimeStats.systemStatus, ...data.data }
        } : null;
        globalLastUpdate = data.timestamp;
        notifyListeners();
      }
    });
    globalUnsubscribeFunctions.push(systemStatusUnsubscribe);
  }
}

export function useRealtime() {
  const { isAuthenticated, user } = useAuthStore();
  const [, forceUpdate] = useState({});
  
  const unsubscribeRefs = useRef<(() => void)[]>([]);
  
  // 强制组件重新渲染
  const triggerUpdate = useCallback(() => {
    forceUpdate({});
  }, []);
  
  // 注册监听器
  useEffect(() => {
    globalListeners.add(triggerUpdate);
    return () => {
      globalListeners.delete(triggerUpdate);
    };
  }, [triggerUpdate]);

  // 连接WebSocket（全局单例）
  const connect = useCallback(async () => {
    if (!isAuthenticated || !user?.role || !['admin', 'author'].includes(user.role)) {
      return;
    }

    // 如果已经连接或正在连接，直接返回现有的Promise
    if (isGlobalConnected || globalConnectionState.status === 'CONNECTED') {
      return;
    }
    
    if (globalConnectionPromise) {
      return globalConnectionPromise;
    }

    globalConnectionPromise = (async () => {
      try {
        globalConnectionState = { ...globalConnectionState, status: 'CONNECTING' };
        notifyListeners();
        
        await websocketService.connect();
        
        globalConnectionState = {
          status: 'CONNECTED',
          lastConnected: Date.now()
        };
        isGlobalConnected = true;
        
        // 连接成功后，统一设置所有订阅
        setupGlobalSubscriptions(user?.role);
        
        notifyListeners();
      } catch (error) {
        console.error('WebSocket连接失败:', error);
        globalConnectionState = { ...globalConnectionState, status: 'DISCONNECTED' };
        isGlobalConnected = false;
        notifyListeners();
      } finally {
        globalConnectionPromise = null;
      }
    })();
    
    return globalConnectionPromise;
  }, [isAuthenticated, user]);

  // 断开连接（全局单例）
  const disconnect = useCallback(() => {
    // 清理所有全局订阅
    globalUnsubscribeFunctions.forEach(unsubscribe => unsubscribe());
    globalUnsubscribeFunctions = [];
    
    // 清理本地订阅
    unsubscribeRefs.current.forEach(unsubscribe => unsubscribe());
    unsubscribeRefs.current = [];
    
    websocketService.disconnect();
    globalConnectionState = { status: 'DISCONNECTED' };
    isGlobalConnected = false;
    globalConnectionPromise = null;
    notifyListeners();
  }, []);

  // 注意：订阅方法已移至全局setupGlobalSubscriptions函数中统一管理

  // 获取连接状态
  const getConnectionStatus = useCallback(() => {
    return websocketService.getConnectionState();
  }, []);

  // 手动刷新统计数据
  const refreshStats = useCallback(() => {
    if (websocketService.isConnected()) {
      websocketService.send({ type: 'subscribe_stats' });
    }
  }, []);

  // 初始化连接（只在第一个组件挂载时执行）
  useEffect(() => {
    if (isAuthenticated && user?.role && ['admin', 'author'].includes(user.role)) {
      connect();
    }
    // 注意：这里不调用disconnect，因为其他组件可能还在使用连接
  }, [isAuthenticated, user?.role, connect]);

  // 定期检查连接状态（全局状态）
  useEffect(() => {
    const interval = setInterval(() => {
      const currentStatus = getConnectionStatus() as ConnectionState['status'];
      if (globalConnectionState.status !== currentStatus) {
        globalConnectionState = { ...globalConnectionState, status: currentStatus };
        isGlobalConnected = currentStatus === 'CONNECTED';
        notifyListeners();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [getConnectionStatus]);

  return {
    // 连接状态（全局状态）
    connectionState: globalConnectionState,
    isConnected: globalConnectionState.status === 'CONNECTED',
    
    // 数据（全局状态）
    realtimeStats: globalRealtimeStats,
    userActivities: globalUserActivities,
    lastUpdate: globalLastUpdate,
    
    // 方法
    connect,
    disconnect,
    refreshStats,
    
    // 工具函数
    formatUptime: (uptime: number) => {
      const seconds = Math.floor((Date.now() - uptime) / 1000);
      const days = Math.floor(seconds / 86400);
      const hours = Math.floor((seconds % 86400) / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      return `${days}天 ${hours}小时 ${minutes}分钟`;
    },
    
    formatLastUpdate: (timestamp: number) => {
      if (!timestamp) return '从未更新';
      const diff = Date.now() - timestamp;
      if (diff < 60000) return '刚刚更新';
      if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
      return new Date(timestamp).toLocaleTimeString();
    }
  };
}

export type { RealtimeStats, UserActivity, ConnectionState };