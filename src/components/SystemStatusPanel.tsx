/**
 * 系统状态监控面板组件
 * 显示详细的系统运行状态和性能指标
 */

import React, { useState, useEffect } from 'react';
import {
  Server,
  Database,
  Cpu,
  HardDrive,
  AlertTriangle,
  CheckCircle,
  Activity,
  Zap,
  Globe,
  Users,
  RefreshCw
} from 'lucide-react';
import { useRealtime } from '../hooks/useRealtime';

interface SystemMetric {
  name: string;
  value: number;
  unit: string;
  status: 'good' | 'warning' | 'critical';
  threshold: {
    warning: number;
    critical: number;
  };
}

interface ServiceStatus {
  name: string;
  status: 'online' | 'offline' | 'degraded';
  uptime: number;
  lastCheck: number;
  responseTime?: number;
}

export default function SystemStatusPanel() {
  const { realtimeStats, isConnected, refreshStats } = useRealtime();
  const [lastRefresh, setLastRefresh] = useState(Date.now());
  const [autoRefresh, setAutoRefresh] = useState(true);

  // 模拟系统指标数据
  const [systemMetrics, setSystemMetrics] = useState<SystemMetric[]>([
    {
      name: 'CPU使用率',
      value: 0,
      unit: '%',
      status: 'good',
      threshold: { warning: 70, critical: 90 }
    },
    {
      name: '内存使用率',
      value: 0,
      unit: '%',
      status: 'good',
      threshold: { warning: 80, critical: 95 }
    },
    {
      name: '磁盘使用率',
      value: 0,
      unit: '%',
      status: 'good',
      threshold: { warning: 85, critical: 95 }
    },
    {
      name: '网络延迟',
      value: Math.floor(Math.random() * 50) + 10,
      unit: 'ms',
      status: 'good',
      threshold: { warning: 100, critical: 200 }
    }
  ]);

  // 模拟服务状态数据
  const [services, setServices] = useState<ServiceStatus[]>([
    {
      name: 'Web服务器',
      status: 'online',
      uptime: Date.now() - (Math.random() * 86400000 * 7), // 随机7天内的启动时间
      lastCheck: Date.now(),
      responseTime: Math.floor(Math.random() * 100) + 50
    },
    {
      name: '数据库',
      status: 'online',
      uptime: Date.now() - (Math.random() * 86400000 * 30), // 随机30天内的启动时间
      lastCheck: Date.now(),
      responseTime: Math.floor(Math.random() * 50) + 20
    },
    {
      name: 'WebSocket服务',
      status: isConnected ? 'online' : 'offline',
      uptime: Date.now() - (Math.random() * 86400000 * 1), // 随机1天内的启动时间
      lastCheck: Date.now(),
      responseTime: Math.floor(Math.random() * 30) + 10
    },
    {
      name: '文件存储',
      status: 'online',
      uptime: Date.now() - (Math.random() * 86400000 * 15), // 随机15天内的启动时间
      lastCheck: Date.now(),
      responseTime: Math.floor(Math.random() * 80) + 30
    }
  ]);

  // 更新系统指标
  useEffect(() => {
    if (realtimeStats?.systemStatus) {
      setSystemMetrics(prev => prev.map(metric => {
        let value = metric.value;
        let status: 'good' | 'warning' | 'critical' = 'good';

        switch (metric.name) {
          case 'CPU使用率':
            value = realtimeStats.systemStatus.cpuUsage;
            break;
          case '内存使用率':
            value = realtimeStats.systemStatus.memoryUsage;
            break;
          case '磁盘使用率':
            value = realtimeStats.systemStatus.diskUsage;
            break;
          default:
            // 保持原值
            break;
        }

        // 确定状态
        if (value >= metric.threshold.critical) {
          status = 'critical';
        } else if (value >= metric.threshold.warning) {
          status = 'warning';
        }

        return { ...metric, value, status };
      }));
    }
  }, [realtimeStats]);

  // 自动刷新
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      setLastRefresh(Date.now());
      // 模拟更新网络延迟
      setSystemMetrics(prev => prev.map(metric => {
        if (metric.name === '网络延迟') {
          const value = Math.floor(Math.random() * 50) + 10;
          let status: 'good' | 'warning' | 'critical' = 'good';
          if (value >= metric.threshold.critical) {
            status = 'critical';
          } else if (value >= metric.threshold.warning) {
            status = 'warning';
          }
          return { ...metric, value, status };
        }
        return metric;
      }));

      // 更新服务状态
      setServices(prev => prev.map(service => ({
        ...service,
        lastCheck: Date.now(),
        status: service.name === 'WebSocket服务' ? (isConnected ? 'online' : 'offline') : service.status,
        responseTime: Math.floor(Math.random() * 100) + 20
      })));
    }, 30000); // 30秒刷新一次

    return () => clearInterval(interval);
  }, [autoRefresh, isConnected]);

  const getMetricColor = (status: string) => {
    switch (status) {
      case 'good':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'warning':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'critical':
        return 'text-red-600 bg-red-50 border-red-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getServiceStatusColor = (status: string) => {
    switch (status) {
      case 'online':
        return 'text-green-600 bg-green-100';
      case 'degraded':
        return 'text-yellow-600 bg-yellow-100';
      case 'offline':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getServiceIcon = (serviceName: string) => {
    switch (serviceName) {
      case 'Web服务器':
        return <Server className="w-5 h-5" />;
      case '数据库':
        return <Database className="w-5 h-5" />;
      case 'WebSocket服务':
        return <Zap className="w-5 h-5" />;
      case '文件存储':
        return <HardDrive className="w-5 h-5" />;
      default:
        return <Globe className="w-5 h-5" />;
    }
  };

  const formatUptime = (uptime: number) => {
    const now = Date.now();
    const diff = now - uptime;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (days > 0) {
      return `${days}天 ${hours}小时`;
    } else if (hours > 0) {
      return `${hours}小时 ${minutes}分钟`;
    } else {
      return `${minutes}分钟`;
    }
  };

  const handleRefresh = () => {
    setLastRefresh(Date.now());
    refreshStats();
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border">
      <div className="p-4 border-b">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Activity className="w-5 h-5" />
            系统状态监控
          </h3>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                  className="rounded border-gray-300"
                />
                自动刷新
              </label>
            </div>
            <button
              onClick={handleRefresh}
              className="flex items-center gap-2 px-3 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              刷新
            </button>
          </div>
        </div>
        <div className="text-sm text-gray-500 mt-1">
          最后更新: {new Date(lastRefresh).toLocaleTimeString()}
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* 系统指标 */}
        <div>
          <h4 className="text-md font-medium text-gray-900 mb-3 flex items-center gap-2">
            <Cpu className="w-4 h-4" />
            系统指标
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {systemMetrics.map((metric, index) => (
              <div key={index} className={`border rounded-lg p-4 ${getMetricColor(metric.status)}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">{metric.name}</span>
                  {metric.status === 'critical' && <AlertTriangle className="w-4 h-4" />}
                  {metric.status === 'warning' && <AlertTriangle className="w-4 h-4" />}
                  {metric.status === 'good' && <CheckCircle className="w-4 h-4" />}
                </div>
                <div className="text-2xl font-bold mb-1">
                  {metric.value}{metric.unit}
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full transition-all duration-300 ${
                      metric.status === 'critical' ? 'bg-red-500' :
                      metric.status === 'warning' ? 'bg-yellow-500' : 'bg-green-500'
                    }`}
                    style={{ width: `${Math.min(metric.value, 100)}%` }}
                  ></div>
                </div>
                <div className="text-xs mt-1">
                  警告: {metric.threshold.warning}{metric.unit} | 严重: {metric.threshold.critical}{metric.unit}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 服务状态 */}
        <div>
          <h4 className="text-md font-medium text-gray-900 mb-3 flex items-center gap-2">
            <Server className="w-4 h-4" />
            服务状态
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {services.map((service, index) => (
              <div key={index} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    {getServiceIcon(service.name)}
                    <span className="font-medium text-gray-900">{service.name}</span>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getServiceStatusColor(service.status)}`}>
                    {service.status === 'online' ? '在线' : service.status === 'offline' ? '离线' : '降级'}
                  </span>
                </div>
                
                <div className="space-y-2 text-sm text-gray-600">
                  <div className="flex items-center justify-between">
                    <span>运行时间:</span>
                    <span className="font-medium">{formatUptime(service.uptime)}</span>
                  </div>
                  
                  {service.responseTime && (
                    <div className="flex items-center justify-between">
                      <span>响应时间:</span>
                      <span className="font-medium">{service.responseTime}ms</span>
                    </div>
                  )}
                  
                  <div className="flex items-center justify-between">
                    <span>最后检查:</span>
                    <span className="font-medium">{new Date(service.lastCheck).toLocaleTimeString()}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 系统概览 */}
        {realtimeStats && (
          <div>
            <h4 className="text-md font-medium text-gray-900 mb-3 flex items-center gap-2">
              <Users className="w-4 h-4" />
              系统概览
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {realtimeStats.overview.totalUsers.toLocaleString()}
                </div>
                <div className="text-sm text-blue-600">注册用户</div>
              </div>
              
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-green-600">
                  {realtimeStats.overview.totalArticles.toLocaleString()}
                </div>
                <div className="text-sm text-green-600">发布文章</div>
              </div>
              
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {realtimeStats.overview.totalComments.toLocaleString()}
                </div>
                <div className="text-sm text-purple-600">用户评论</div>
              </div>
              
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-orange-600">
                  {realtimeStats.overview.totalViews.toLocaleString()}
                </div>
                <div className="text-sm text-orange-600">页面浏览</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}