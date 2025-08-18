/**
 * 增强版管理员仪表板页面
 * 模块: 5.2 系统仪表板和数据统计
 */

import React, { useState, useEffect } from 'react';
import { 
  Users, 
  FileText, 
  MessageSquare, 
  Tags, 
  Activity, 
  TrendingUp,
  BarChart3,
  Eye,
  Server,
  Database,
  Cpu,
  RefreshCw
} from 'lucide-react';
import RealtimeMonitor from '../components/RealtimeMonitor';
import { TrendChart, PieChart, StatCard, chartTheme, BarChart } from '../components/charts';
// import { useAuthStore } from '../store/authStore'; // 暂时未使用
import { useAdminStore } from '../store/adminStore';
import { toast } from 'sonner';
import AdminLayout from '../components/AdminLayout';

const AdminDashboardEnhanced: React.FC = () => {
  // const { user, token } = useAuthStore(); // 暂时未使用
  const { 
    dashboardStats, 
    dashboardLoading, 
    fetchDashboardStats 
  } = useAdminStore();
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    initializeData();
  }, []);

  // 初始化数据加载
  const initializeData = async () => {
    try {
      await fetchDashboardStats();
    } catch {
      console.error('初始化数据失败');
      toast.error('加载数据失败');
    } finally {
      setIsLoading(false);
    }
  };

  // 刷新数据
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchDashboardStats();
      toast.success('数据已刷新');
    } catch {
      toast.error('刷新失败');
    } finally {
      setRefreshing(false);
    }
  };

  // const formatDate = (dateString: string) => { // 暂时未使用
  //   return new Date(dateString).toLocaleDateString('zh-CN', {
  //     month: 'short',
  //     day: 'numeric'
  //   });
  // };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${days}天 ${hours}小时 ${minutes}分钟`;
  };



  if (isLoading || dashboardLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">加载仪表板数据中...</p>
        </div>
      </div>
    );
  }

  const overview = dashboardStats?.overview;
  const trends = dashboardStats?.trends;
  const charts = dashboardStats?.charts;
  const systemStatus = dashboardStats?.systemStatus;

  return (
    <AdminLayout title="数据仪表板">
      {/* 头部操作栏 */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">数据仪表板</h1>
          <p className="text-gray-600 mt-1">系统运行状态和数据统计概览</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? '刷新中...' : '刷新数据'}
        </button>
      </div>

      {/* 概览统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="总用户数"
          value={overview?.totalUsers || 0}
          icon={Users}
          iconColor="text-blue-600"
          iconBgColor="bg-blue-50"
          trend={{
            value: overview?.newUsers || 0,
            label: "本周新增",
            isPositive: true
          }}
        />
        
        <StatCard
          title="文章总数"
          value={overview?.totalArticles || 0}
          subtitle={`${overview?.publishedArticles || 0} 已发布`}
          icon={FileText}
          iconColor="text-green-600"
          iconBgColor="bg-green-50"
        />
        
        <StatCard
          title="总阅读量"
          value={overview?.totalViews || 0}
          subtitle={`${overview?.totalLikes || 0} 点赞`}
          icon={Eye}
          iconColor="text-purple-600"
          iconBgColor="bg-purple-50"
        />
        
        <StatCard
          title="评论总数"
          value={overview?.totalComments || 0}
          icon={MessageSquare}
          iconColor="text-orange-600"
          iconBgColor="bg-orange-50"
          trend={{
            value: overview?.newComments || 0,
            label: "本周新增",
            isPositive: true
          }}
        />
      </div>

      {/* 实时监控面板 */}
      <div className="mb-8">
        <RealtimeMonitor showDetails={true} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* 用户注册趋势 */}
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="p-6 border-b">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              用户注册趋势（30天）
            </h2>
          </div>
          <div className="p-6">
            <TrendChart
              data={trends?.users || []}
              type="area"
              color={chartTheme.colors.primary}
              formatTooltip={(value) => [String(value), '新增用户']}
            />
          </div>
        </div>

        {/* 文章发布趋势 */}
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="p-6 border-b">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <FileText className="w-5 h-5" />
              文章发布趋势（30天）
            </h2>
          </div>
          <div className="p-6">
            <TrendChart
              data={trends?.articles || []}
              type="line"
              color={chartTheme.colors.secondary}
              formatTooltip={(value) => [String(value), '发布文章']}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
        {/* 分类文章分布 */}
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="p-6 border-b">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Tags className="w-5 h-5" />
              分类文章分布
            </h2>
          </div>
          <div className="p-6">
            <PieChart
              data={(charts?.categoryDistribution || []).map(item => ({
                name: item.name,
                value: item.count
              }))}
              colors={chartTheme.palette}
              formatTooltip={(value) => [String(value), '文章数']}
              showLegend
            />
          </div>
        </div>

        {/* 热门文章 */}
        <div className="lg:col-span-2 bg-white rounded-lg shadow-sm border">
          <div className="p-6 border-b">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              热门文章（按浏览量）
            </h2>
          </div>
          <div className="p-6">
            <BarChart
              data={(charts?.popularArticles || []).map(article => ({
                name: article.title.length > 15 ? `${article.title.slice(0, 15)}...` : article.title,
                value: article.views
              }))}
              layout="horizontal"
              color={chartTheme.colors.accent}
              formatTooltip={(value) => [String(value), '浏览量']}
            />
          </div>
        </div>
      </div>

      {/* 系统状态监控 */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="p-6 border-b">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Server className="w-5 h-5" />
            系统状态监控
          </h2>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-3">
                <Server className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="font-medium text-gray-900">系统运行时间</h3>
              <p className="text-sm text-gray-600 mt-1">
                {systemStatus ? formatUptime(systemStatus.uptime) : '获取中...'}
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-3">
                <Cpu className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="font-medium text-gray-900">内存使用</h3>
              <p className="text-sm text-gray-600 mt-1">
                {systemStatus?.memoryUsage?.heapUsed ? formatBytes(systemStatus.memoryUsage.heapUsed) : '获取中...'}
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-orange-50 rounded-full flex items-center justify-center mx-auto mb-3">
                <Activity className="w-8 h-8 text-orange-600" />
              </div>
              <h3 className="font-medium text-gray-900">近期活动</h3>
              <p className="text-sm text-gray-600 mt-1">
                {systemStatus?.recentLogs || 0} 条日志
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-purple-50 rounded-full flex items-center justify-center mx-auto mb-3">
                <Database className="w-8 h-8 text-purple-600" />
              </div>
              <h3 className="font-medium text-gray-900">平均阅读量</h3>
              <p className="text-sm text-gray-600 mt-1">
                {systemStatus?.avgViews ? Math.round(systemStatus.avgViews) : 0} 次
              </p>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminDashboardEnhanced;