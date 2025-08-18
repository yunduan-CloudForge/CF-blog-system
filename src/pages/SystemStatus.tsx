/**
 * 系统状态监控页面
 * 提供完整的系统监控和状态查看功能
 */

import React from 'react';
import { Activity, Server, BarChart3, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import SystemStatusPanel from '../components/SystemStatusPanel';
import RealtimeMonitor from '../components/RealtimeMonitor';

export default function SystemStatus() {
  const navigate = useNavigate();

  const handleBackToAdmin = () => {
    navigate('/admin/dashboard');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 页面标题 */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <Activity className="w-8 h-8 text-blue-600" />
              <h1 className="text-3xl font-bold text-gray-900">系统状态监控</h1>
            </div>
            <button
              onClick={handleBackToAdmin}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              返回管理后台
            </button>
          </div>
          <p className="text-gray-600">
            实时监控系统运行状态、性能指标和服务健康状况
          </p>
        </div>

        {/* 快速状态概览 */}
        <div className="mb-8">
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              快速概览
            </h2>
            <RealtimeMonitor showDetails={false} className="justify-center" />
          </div>
        </div>

        {/* 详细系统状态面板 */}
        <div className="mb-8">
          <SystemStatusPanel />
        </div>

        {/* 实时数据监控 */}
        <div className="mb-8">
          <RealtimeMonitor showDetails={true} />
        </div>

        {/* 系统信息 */}
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="p-4 border-b">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Server className="w-5 h-5" />
              系统信息
            </h3>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="text-sm text-gray-600 mb-1">服务器时间</div>
                <div className="font-medium text-gray-900">
                  {new Date().toLocaleString('zh-CN', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit'
                  })}
                </div>
              </div>
              
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="text-sm text-gray-600 mb-1">系统版本</div>
                <div className="font-medium text-gray-900">Blog System v1.0.0</div>
              </div>
              
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="text-sm text-gray-600 mb-1">运行环境</div>
                <div className="font-medium text-gray-900">Node.js + SQLite</div>
              </div>
              
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="text-sm text-gray-600 mb-1">数据库状态</div>
                <div className="font-medium text-green-600">正常运行</div>
              </div>
              
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="text-sm text-gray-600 mb-1">WebSocket状态</div>
                <div className="font-medium text-green-600">已连接</div>
              </div>
              
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="text-sm text-gray-600 mb-1">监控状态</div>
                <div className="font-medium text-green-600">活跃</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}