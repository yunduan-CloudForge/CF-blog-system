/**
 * 操作日志页面
 * 模块: 5.1 管理员权限系统 - 操作日志
 */

import React, { useState, useEffect } from 'react';
import {
  Activity,
  Search,
  Filter,
  Calendar,
  User,
  FileText,
  Shield,
  Trash2,
  Edit,
  Plus,
  Eye,
  Download,
  RefreshCw
} from 'lucide-react';
import { useAdminStore } from '@/store/adminStore';
import { authAPI } from '@/store/authStore';
import { toast } from 'sonner';
import AdminNavigation from '@/components/AdminNavigation';

interface AdminLog {
  id: number;
  user_id: number;
  user_email: string;
  action: string;
  resource: string;
  resource_id: number | null;
  details: string;
  ip_address: string;
  user_agent: string;
  status: 'success' | 'failed' | 'pending';
  created_at: string;
}

export default function AdminLogs() {
  const { logs, fetchLogs } = useAdminStore();
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState<string>('7');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedLogs, setSelectedLogs] = useState<number[]>([]);
  const [showDetails, setShowDetails] = useState<number | null>(null);

  // 获取日志列表
  const loadLogs = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '20',
        ...(searchTerm && { search: searchTerm }),
        ...(actionFilter !== 'all' && { action: actionFilter }),
        ...(statusFilter !== 'all' && { status: statusFilter }),
        ...(dateRange !== 'all' && { days: dateRange })
      });

      const response = await authAPI.authenticatedFetch(`/admin/logs?${params}`);

      if (response.ok) {
        const data = await response.json();
        await fetchLogs(); // 使用store方法更新状态
        setTotalPages(data.data?.totalPages || 1);
      } else {
        toast.error('获取操作日志失败');
      }
    } catch (error) {
      console.error('获取操作日志失败:', error);
      toast.error('获取操作日志失败');
    } finally {
      setLoading(false);
    }
  };

  // 导出日志
  const handleExportLogs = async () => {
    try {
      const params = new URLSearchParams({
        ...(searchTerm && { search: searchTerm }),
        ...(actionFilter !== 'all' && { action: actionFilter }),
        ...(statusFilter !== 'all' && { status: statusFilter }),
        ...(dateRange !== 'all' && { days: dateRange }),
        format: 'csv'
      });

      const response = await authAPI.authenticatedFetch(`/admin/logs/export?${params}`);

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `admin_logs_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        toast.success('日志导出成功');
      } else {
        toast.error('导出日志失败');
      }
    } catch (error) {
      console.error('导出日志失败:', error);
      toast.error('导出日志失败');
    }
  };

  // 清理旧日志
  const handleCleanOldLogs = async () => {
    if (!confirm('确定要清理30天前的日志吗？此操作无法撤销。')) return;

    try {
      const response = await authAPI.authenticatedFetch('/admin/logs/cleanup', {
        method: 'DELETE',
        body: JSON.stringify({ days: 30 })
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(`已清理 ${data.data.deletedCount} 条旧日志`);
        loadLogs();
      } else {
        toast.error('清理日志失败');
      }
    } catch (error) {
      console.error('清理日志失败:', error);
      toast.error('清理日志失败');
    }
  };

  useEffect(() => {
    loadLogs();
  }, [currentPage, searchTerm, actionFilter, statusFilter, dateRange]);

  const getActionIcon = (action: string) => {
    const icons = {
      create_article: FileText,
      update_article: Edit,
      delete_article: Trash2,
      create_user: User,
      update_user: Edit,
      delete_user: Trash2,
      login: Shield,
      logout: Shield,
      create_comment: Plus,
      delete_comment: Trash2,
      update_permission: Shield
    };
    const IconComponent = icons[action as keyof typeof icons] || Activity;
    return <IconComponent className="w-4 h-4" />;
  };

  const getActionColor = (action: string) => {
    if (action.includes('create')) return 'text-green-600 bg-green-100';
    if (action.includes('update')) return 'text-blue-600 bg-blue-100';
    if (action.includes('delete')) return 'text-red-600 bg-red-100';
    if (action.includes('login') || action.includes('logout')) return 'text-purple-600 bg-purple-100';
    return 'text-gray-600 bg-gray-100';
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      success: { label: '成功', className: 'bg-green-100 text-green-800' },
      failed: { label: '失败', className: 'bg-red-100 text-red-800' },
      pending: { label: '处理中', className: 'bg-yellow-100 text-yellow-800' }
    };
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.success;
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${config.className}`}>
        {config.label}
      </span>
    );
  };

  const formatDetails = (details: string) => {
    try {
      const parsed = JSON.parse(details);
      return Object.entries(parsed).map(([key, value]) => (
        <div key={key} className="text-sm">
          <span className="font-medium text-gray-600">{key}:</span>
          <span className="ml-2 text-gray-900">{String(value)}</span>
        </div>
      ));
    } catch {
      return <div className="text-sm text-gray-900">{details}</div>;
    }
  };

  const filteredLogs = logs.filter(log => {
    const matchesSearch = !searchTerm || 
      log.userEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.resource.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesAction = actionFilter === 'all' || log.action === actionFilter;
    const matchesStatus = statusFilter === 'all' || log.result === statusFilter;
    
    return matchesSearch && matchesAction && matchesStatus;
  });

  return (
    <div className="flex h-screen bg-gray-50">
      <AdminNavigation className="w-64 flex-shrink-0" />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white shadow-sm border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">操作日志</h1>
            <div className="flex items-center gap-3">
              <button
                onClick={loadLogs}
                className="flex items-center gap-2 px-3 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                <RefreshCw className="w-4 h-4" />
                刷新
              </button>
              <button
                onClick={handleExportLogs}
                className="flex items-center gap-2 px-3 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                <Download className="w-4 h-4" />
                导出
              </button>
              <button
                onClick={handleCleanOldLogs}
                className="flex items-center gap-2 px-3 py-2 text-red-600 border border-red-300 rounded-lg hover:bg-red-50"
              >
                <Trash2 className="w-4 h-4" />
                清理旧日志
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-6">
          {/* 筛选器 */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  搜索
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="搜索用户、操作或资源..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  操作类型
                </label>
                <select
                  value={actionFilter}
                  onChange={(e) => setActionFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">所有操作</option>
                  <option value="create_article">创建文章</option>
                  <option value="update_article">更新文章</option>
                  <option value="delete_article">删除文章</option>
                  <option value="create_user">创建用户</option>
                  <option value="update_user">更新用户</option>
                  <option value="delete_user">删除用户</option>
                  <option value="login">登录</option>
                  <option value="logout">登出</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  状态
                </label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">所有状态</option>
                  <option value="success">成功</option>
                  <option value="failed">失败</option>
                  <option value="pending">处理中</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  时间范围
                </label>
                <select
                  value={dateRange}
                  onChange={(e) => setDateRange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="1">今天</option>
                  <option value="7">最近7天</option>
                  <option value="30">最近30天</option>
                  <option value="90">最近90天</option>
                  <option value="all">全部</option>
                </select>
              </div>
              <div className="flex items-end">
                <div className="text-sm text-gray-500">
                  共 {filteredLogs.length} 条记录
                </div>
              </div>
            </div>
          </div>

          {/* 日志列表 */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            {loading ? (
              <div className="p-8 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-2 text-gray-500">加载中...</p>
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="p-8 text-center">
                <Activity className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">暂无操作日志</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        操作信息
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        用户
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        资源
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        状态
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        IP地址
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        时间
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        操作
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div className="flex items-center">
                            <div className={`p-2 rounded-lg mr-3 ${getActionColor(log.action)}`}>
                              {getActionIcon(log.action)}
                            </div>
                            <div>
                              <div className="text-sm font-medium text-gray-900">
                                {log.action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                              </div>
                              <div className="text-sm text-gray-500">
                                {log.resource}
                                {log.resourceId && ` #${log.resourceId}`}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center">
                            <User className="w-4 h-4 text-gray-400 mr-2" />
                            <span className="text-sm text-gray-900">{log.userEmail}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm text-gray-900">{log.resource}</span>
                          {log.resourceId && (
                            <span className="text-sm text-gray-500 ml-1">#{log.resourceId}</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {getStatusBadge(log.result)}
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm text-gray-900 font-mono">{log.ipAddress}</span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900">
                            {new Date(log.createdAt).toLocaleString()}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <button
                            onClick={() => setShowDetails(showDetails === log.id ? null : log.id)}
                            className="text-blue-600 hover:text-blue-800 p-1 rounded"
                            title="查看详情"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* 分页 */}
            {totalPages > 1 && (
              <div className="px-6 py-4 border-t border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-500">
                    第 {currentPage} 页，共 {totalPages} 页
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                      disabled={currentPage === 1}
                      className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      上一页
                    </button>
                    <button
                      onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                      disabled={currentPage === totalPages}
                      className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      下一页
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 详情展开 */}
          {showDetails && (
            <div className="mt-4 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">操作详情</h3>
              {(() => {
                const log = filteredLogs.find(l => l.id === showDetails);
                if (!log) return null;
                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-2">基本信息</h4>
                      <div className="space-y-2">
                        <div className="text-sm">
                          <span className="font-medium text-gray-600">操作:</span>
                          <span className="ml-2 text-gray-900">{log.action}</span>
                        </div>
                        <div className="text-sm">
                          <span className="font-medium text-gray-600">用户:</span>
                          <span className="ml-2 text-gray-900">{log.userEmail}</span>
                        </div>
                        <div className="text-sm">
                          <span className="font-medium text-gray-600">资源:</span>
                          <span className="ml-2 text-gray-900">{log.resource}</span>
                        </div>
                        <div className="text-sm">
                          <span className="font-medium text-gray-600">状态:</span>
                          <span className="ml-2">{getStatusBadge(log.result)}</span>
                        </div>
                      </div>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-2">技术信息</h4>
                      <div className="space-y-2">
                        <div className="text-sm">
                          <span className="font-medium text-gray-600">IP地址:</span>
                          <span className="ml-2 text-gray-900 font-mono">{log.ipAddress}</span>
                        </div>
                        <div className="text-sm">
                          <span className="font-medium text-gray-600">用户代理:</span>
                          <span className="ml-2 text-gray-900 text-xs break-all">{log.userAgent}</span>
                        </div>
                        <div className="text-sm">
                          <span className="font-medium text-gray-600">时间:</span>
                          <span className="ml-2 text-gray-900">{new Date(log.createdAt).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                    {log.details && (
                      <div className="md:col-span-2">
                        <h4 className="text-sm font-medium text-gray-700 mb-2">操作详情</h4>
                        <div className="bg-gray-50 rounded-lg p-4">
                          {formatDetails(log.details)}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}