/**
 * 管理员仪表板页面
 * 模块: 5.1 管理员权限系统 - 管理仪表板
 */

import React, { useState, useEffect } from 'react';
import { 
  Users, 
  FileText, 
  MessageSquare, 
  Activity, 
  Shield,
  Clock,
  Wifi,
  WifiOff,
  TrendingUp
} from 'lucide-react';
// import { useAuthStore } from '../store/authStore'; // 暂时未使用
import { useAdminStore } from '../store/adminStore';
import { useRealtime } from '../hooks/useRealtime';
import { toast } from 'sonner';
import AdminLayout from '../components/AdminLayout';

// 接口定义已移至adminStore

const AdminDashboard: React.FC = () => {
  // const { user, token } = useAuthStore(); // 暂时未使用
  const { 
    // stats, // 暂时未使用
    logs: recentLogs, 
    statsLoading, 
    logsLoading, 
    fetchStats, 
    fetchLogs 
  } = useAdminStore();
  const {
    // connectionState, // 暂时未使用
    isConnected,
    realtimeStats,
    userActivities,
    lastUpdate,
    // connect,
    // disconnect,
    // refreshStats,
    // formatUptime,
    formatLastUpdate
  } = useRealtime();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    initializeData();
  }, []);

  // 初始化数据加载
  const initializeData = async () => {
    try {
      await Promise.all([
        fetchStats(),
        fetchLogs(1, 10) // 获取最近10条日志
      ]);
    } catch (error: unknown) {
      console.error('初始化数据失败:', error);
      toast.error('加载数据失败');
    } finally {
      setIsLoading(false);
    }
  };

  // 计算显示的统计数据
  const displayStats = realtimeStats?.overview || {
    totalUsers: 0,
    totalArticles: 0,
    totalComments: 0,
    totalViews: 0
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getActionColor = (action: string) => {
    if (action.includes('delete') || action.includes('reset')) {
      return 'text-red-600 bg-red-50';
    }
    if (action.includes('create') || action.includes('add')) {
      return 'text-green-600 bg-green-50';
    }
    if (action.includes('update') || action.includes('edit')) {
      return 'text-blue-600 bg-blue-50';
    }
    return 'text-gray-600 bg-gray-50';
  };

  // const getStatusColor = (status: string) => {
  //   return status === 'success' 
  //     ? 'text-green-600 bg-green-50' 
  //     : 'text-red-600 bg-red-50';
  // };

  if (isLoading || statsLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">加载仪表板数据中...</p>
        </div>
      </div>
    );
  }

  return (
    <AdminLayout title="仪表板概览">
        {/* WebSocket连接状态 */}
        <div className="mb-4">
          <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm ${
            isConnected 
              ? 'bg-green-50 text-green-700' 
              : 'bg-red-50 text-red-700'
          }`}>
            {isConnected ? (
              <>
                <Wifi className="w-4 h-4" />
                实时数据连接正常
              </>
            ) : (
              <>
                <WifiOff className="w-4 h-4" />
                实时数据连接断开
              </>
            )}
            {lastUpdate > 0 && (
              <span className="text-xs opacity-75">
                · 最后更新: {new Date(lastUpdate).toLocaleTimeString()}
              </span>
            )}
          </div>
        </div>

        {/* 统计卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-sm p-6 border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">总用户数</p>
                <p className="text-3xl font-bold text-gray-900">{displayStats?.totalUsers || 0}</p>
                <p className="text-sm text-green-600 mt-1">
                  +0 本周新增
                </p>
              </div>
              <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6 border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">文章总数</p>
                <p className="text-3xl font-bold text-gray-900">{displayStats?.totalArticles || 0}</p>
                <p className="text-sm text-blue-600 mt-1">
                  +0 本月新增
                </p>
              </div>
              <div className="w-12 h-12 bg-green-50 rounded-lg flex items-center justify-center">
                <FileText className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6 border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">评论总数</p>
                <p className="text-3xl font-bold text-gray-900">{displayStats?.totalComments || 0}</p>
                <p className="text-sm text-green-600 mt-1">
                  +0 本月新增
                </p>
              </div>
              <div className="w-12 h-12 bg-purple-50 rounded-lg flex items-center justify-center">
                <MessageSquare className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6 border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">总浏览量</p>
                <p className="text-3xl font-bold text-gray-900">{displayStats?.totalViews || 0}</p>
                <p className="text-sm text-orange-600 mt-1">累计浏览</p>
              </div>
              <div className="w-12 h-12 bg-orange-50 rounded-lg flex items-center justify-center">
                <Activity className="w-6 h-6 text-orange-600" />
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* 最近操作日志 */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-sm border">
              <div className="p-6 border-b">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <Clock className="w-5 h-5" />
                    最近操作日志
                    {lastUpdate && (
                      <p className="text-xs text-gray-500 mt-1">
                         最后更新: {formatLastUpdate(lastUpdate)}
                      </p>
                    )}
                  </h2>
                  <button className="text-blue-600 hover:text-blue-700 text-sm font-medium">
                    查看全部
                  </button>
                </div>
              </div>
              <div className="divide-y">
                {logsLoading ? (
                  <div className="p-6 space-y-4">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="animate-pulse">
                        <div className="flex items-center space-x-4">
                          <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
                          <div className="flex-1">
                            <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                            <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <>
                    {/* 显示实时用户活动 */}
                     {userActivities.slice(0, 3).map((activity, index) => (
                      <div key={`activity-${index}`} className="p-4 hover:bg-gray-50 transition-colors border-l-4 border-blue-500">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-600">
                              {activity.action}
                            </span>
                            <span className="text-sm text-gray-600">
                              用户 {activity.userId} 进行了实时操作
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 animate-pulse">
                              实时
                            </span>
                            <span className="text-xs text-gray-500">
                              {formatLastUpdate(activity.timestamp)}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    {/* 显示历史日志 */}
                     {recentLogs.slice(0, Math.max(0, 5 - userActivities.length)).map((log) => (
                      <div key={log.id} className="p-4 hover:bg-gray-50 transition-colors">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              getActionColor(log.action)
                            }`}>
                              {log.action}
                            </span>
                            <span className="text-sm text-gray-600">
                              {log.user?.email || log.user?.username || '未知用户'} 操作了 {log.resource}
                              {log.resourceId && ` (ID: ${log.resourceId})`}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                              历史记录
                            </span>
                            <span className="text-xs text-gray-500">
                              {formatDate(log.createdAt)}
                            </span>
                          </div>
                        </div>
                        {log.details && (
                          <div className="mt-2 ml-3">
                            <p className="text-xs text-gray-400 truncate">
                              {log.details}
                            </p>
                          </div>
                        )}
                      </div>
                    ))}
                    
                    {userActivities.length === 0 && recentLogs.length === 0 && (
                      <div className="p-8 text-center text-gray-500">
                        <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p>暂无操作日志</p>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          {/* 快速操作 */}
          <div>
            <div className="bg-white rounded-lg shadow-sm border">
              <div className="p-6 border-b">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <Activity className="w-5 h-5" />
                  快速操作
                </h2>
              </div>
              <div className="p-6 space-y-4">
                <button className="w-full flex items-center gap-3 p-3 text-left hover:bg-gray-50 rounded-lg transition-colors">
                  <Users className="w-5 h-5 text-blue-600" />
                  <div>
                    <p className="font-medium text-gray-900">用户管理</p>
                    <p className="text-sm text-gray-500">管理系统用户</p>
                  </div>
                </button>
                
                <button className="w-full flex items-center gap-3 p-3 text-left hover:bg-gray-50 rounded-lg transition-colors">
                  <FileText className="w-5 h-5 text-green-600" />
                  <div>
                    <p className="font-medium text-gray-900">内容管理</p>
                    <p className="text-sm text-gray-500">管理文章和评论</p>
                  </div>
                </button>
                
                <button className="w-full flex items-center gap-3 p-3 text-left hover:bg-gray-50 rounded-lg transition-colors">
                  <Shield className="w-5 h-5 text-purple-600" />
                  <div>
                    <p className="font-medium text-gray-900">权限管理</p>
                    <p className="text-sm text-gray-500">管理角色权限</p>
                  </div>
                </button>
                
                <button className="w-full flex items-center gap-3 p-3 text-left hover:bg-gray-50 rounded-lg transition-colors">
                  <Activity className="w-5 h-5 text-orange-600" />
                  <div>
                    <p className="font-medium text-gray-900">系统日志</p>
                    <p className="text-sm text-gray-500">查看操作记录</p>
                  </div>
                </button>
              </div>
            </div>

            {/* 系统状态 */}
            <div className="bg-white rounded-lg shadow-sm border mt-6">
              <div className="p-6 border-b">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  系统状态
                </h2>
              </div>
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">WebSocket连接</span>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    isConnected 
                      ? 'bg-green-50 text-green-600' 
                      : 'bg-red-50 text-red-600'
                  }`}>
                    {isConnected ? '正常' : '断开'}
                  </span>
                </div>
                
                {realtimeStats?.systemStatus && (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">内存使用率</span>
                      <span className="text-sm font-medium text-gray-900">
                        {realtimeStats.systemStatus.memoryUsage}%
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">CPU使用率</span>
                      <span className="text-sm font-medium text-gray-900">
                        {realtimeStats.systemStatus.cpuUsage}%
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">运行时间</span>
                      <span className="text-sm font-medium text-gray-900">
                        {Math.floor((Date.now() - realtimeStats.systemStatus.uptime) / (1000 * 60 * 60))}小时
                      </span>
                    </div>
                  </>
                )}
                
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">API服务</span>
                  <span className="px-2 py-1 bg-green-50 text-green-600 rounded-full text-xs font-medium">
                    正常
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
    </AdminLayout>
  );
};

export default AdminDashboard;