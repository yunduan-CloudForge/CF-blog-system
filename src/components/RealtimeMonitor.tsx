/**
 * 实时数据监控组件
 * 显示WebSocket连接状态和实时数据更新
 */

import React from 'react';
import { 
  Wifi, 
  WifiOff, 
  RefreshCw, 
  Clock, 
  Activity,
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import { useRealtime } from '../hooks/useRealtime';

interface RealtimeMonitorProps {
  className?: string;
  showDetails?: boolean;
}

export default function RealtimeMonitor({ 
  className = '', 
  showDetails = false 
}: RealtimeMonitorProps) {
  const {
    connectionState,
    isConnected,
    lastUpdate,
    realtimeStats,
    userActivities,
    connect,
    refreshStats,
    formatLastUpdate
  } = useRealtime();

  const getStatusIcon = () => {
    switch (connectionState.status) {
      case 'CONNECTED':
        return <Wifi className="w-4 h-4 text-green-500" />;
      case 'CONNECTING':
        return <RefreshCw className="w-4 h-4 text-yellow-500 animate-spin" />;
      case 'DISCONNECTED':
      case 'CLOSING':
      default:
        return <WifiOff className="w-4 h-4 text-red-500" />;
    }
  };

  const getStatusText = () => {
    switch (connectionState.status) {
      case 'CONNECTED':
        return '实时连接';
      case 'CONNECTING':
        return '连接中...';
      case 'DISCONNECTED':
        return '已断开';
      case 'CLOSING':
        return '断开中...';
      default:
        return '未知状态';
    }
  };

  const getStatusColor = () => {
    switch (connectionState.status) {
      case 'CONNECTED':
        return 'text-green-600 bg-green-50';
      case 'CONNECTING':
        return 'text-yellow-600 bg-yellow-50';
      case 'DISCONNECTED':
      case 'CLOSING':
      default:
        return 'text-red-600 bg-red-50';
    }
  };

  if (!showDetails) {
    // 简化版本 - 只显示连接状态
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        {getStatusIcon()}
        <span className={`text-sm font-medium ${getStatusColor().split(' ')[0]}`}>
          {getStatusText()}
        </span>
        {lastUpdate > 0 && (
          <span className="text-xs text-gray-500">
            {formatLastUpdate(lastUpdate)}
          </span>
        )}
      </div>
    );
  }

  // 详细版本 - 显示完整的监控面板
  return (
    <div className={`bg-white rounded-lg shadow-sm border ${className}`}>
      <div className="p-4 border-b">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Activity className="w-5 h-5" />
            实时数据监控
          </h3>
          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${getStatusColor()}`}>
              {getStatusIcon()}
              {getStatusText()}
            </div>
            {!isConnected && (
              <button
                onClick={connect}
                className="px-3 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                重新连接
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* 连接信息 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
              <Clock className="w-4 h-4" />
              最后更新
            </div>
            <div className="font-medium text-gray-900">
              {formatLastUpdate(lastUpdate)}
            </div>
          </div>
          
          {connectionState.lastConnected && (
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                <CheckCircle className="w-4 h-4" />
                连接时间
              </div>
              <div className="font-medium text-gray-900">
                {new Date(connectionState.lastConnected).toLocaleTimeString()}
              </div>
            </div>
          )}
          
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
              <RefreshCw className="w-4 h-4" />
              手动刷新
            </div>
            <button
              onClick={refreshStats}
              disabled={!isConnected}
              className="text-sm bg-blue-600 text-white px-3 py-1 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              刷新数据
            </button>
          </div>
        </div>

        {/* 实时统计数据 */}
        {realtimeStats && (
          <div>
            <h4 className="text-md font-medium text-gray-900 mb-3">实时统计</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-blue-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {realtimeStats.overview.totalUsers.toLocaleString()}
                </div>
                <div className="text-sm text-blue-600">总用户数</div>
              </div>
              
              <div className="bg-green-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-green-600">
                  {realtimeStats.overview.totalArticles.toLocaleString()}
                </div>
                <div className="text-sm text-green-600">总文章数</div>
              </div>
              
              <div className="bg-purple-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {realtimeStats.overview.totalComments.toLocaleString()}
                </div>
                <div className="text-sm text-purple-600">总评论数</div>
              </div>
              
              <div className="bg-orange-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-orange-600">
                  {realtimeStats.overview.totalViews.toLocaleString()}
                </div>
                <div className="text-sm text-orange-600">总浏览量</div>
              </div>
            </div>
          </div>
        )}

        {/* 系统状态 */}
        {realtimeStats?.systemStatus && (
          <div>
            <h4 className="text-md font-medium text-gray-900 mb-3">系统状态</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">CPU使用率</span>
                  <span className="text-sm font-medium">{realtimeStats.systemStatus.cpuUsage}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${realtimeStats.systemStatus.cpuUsage}%` }}
                  ></div>
                </div>
              </div>
              
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">内存使用率</span>
                  <span className="text-sm font-medium">{realtimeStats.systemStatus.memoryUsage}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-green-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${realtimeStats.systemStatus.memoryUsage}%` }}
                  ></div>
                </div>
              </div>
              
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">磁盘使用率</span>
                  <span className="text-sm font-medium">{realtimeStats.systemStatus.diskUsage}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${realtimeStats.systemStatus.diskUsage}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 用户活动 */}
        {userActivities.length > 0 && (
          <div>
            <h4 className="text-md font-medium text-gray-900 mb-3">最近活动</h4>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {userActivities.slice(0, 5).map((activity, index) => (
                <div key={index} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900">
                      {activity.action}
                    </div>
                    <div className="text-xs text-gray-500">
                      用户 {activity.userId} • {new Date(activity.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 连接失败提示 */}
        {!isConnected && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-center gap-2 text-yellow-800">
              <AlertCircle className="w-5 h-5" />
              <span className="font-medium">实时连接已断开</span>
            </div>
            <p className="text-sm text-yellow-700 mt-1">
              数据可能不是最新的。请检查网络连接或点击重新连接。
            </p>
          </div>
        )}
      </div>
    </div>
  );
}