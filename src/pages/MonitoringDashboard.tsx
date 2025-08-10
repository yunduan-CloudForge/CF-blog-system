import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Clock,
  Database,
  Eye,
  RefreshCw,
  Server,
  TrendingUp,
  Users,
  Zap
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { api } from '../utils/api';

interface SystemStats {
  totalErrors: number;
  errorRate: number;
  avgResponseTime: number;
  activeUsers: number;
  totalRequests: number;
  uptime: string;
  memoryUsage: number;
  cpuUsage: number;
}

interface ErrorLog {
  id: string;
  timestamp: string;
  level: string;
  message: string;
  stack?: string;
  userId?: string;
  url?: string;
}

interface PerformanceMetric {
  timestamp: string;
  responseTime: number;
  requests: number;
  errors: number;
}

interface HealthStatus {
  status: 'healthy' | 'warning' | 'critical';
  database: boolean;
  redis: boolean;
  storage: boolean;
  lastCheck: string;
}

const MonitoringDashboard: React.FC = () => {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [errors, setErrors] = useState<ErrorLog[]>([]);
  const [performance, setPerformance] = useState<PerformanceMetric[]>([]);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchData = async () => {
    try {
      setRefreshing(true);
      
      const [statsRes, errorsRes, performanceRes, healthRes] = await Promise.all([
        api.get('/monitoring/stats'),
        api.get('/monitoring/errors?limit=10'),
        api.get('/monitoring/performance?hours=24'),
        api.get('/monitoring/health')
      ]);

      setStats(statsRes.data);
      setErrors(errorsRes.data);
      setPerformance(performanceRes.data);
      setHealth(healthRes.data);
    } catch (error) {
      console.error('Failed to fetch monitoring data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(fetchData, 30000); // 30秒刷新一次
    return () => clearInterval(interval);
  }, [autoRefresh]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-600';
      case 'warning': return 'text-yellow-600';
      case 'critical': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getErrorLevelColor = (level: string) => {
    switch (level.toLowerCase()) {
      case 'error': return 'destructive';
      case 'warn': return 'secondary';
      case 'info': return 'default';
      default: return 'outline';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900">监控仪表板</h1>
        <div className="flex items-center space-x-4">
          <Button
            variant={autoRefresh ? 'default' : 'outline'}
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            <Activity className="h-4 w-4 mr-2" />
            自动刷新
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            刷新
          </Button>
        </div>
      </div>

      {/* 系统状态概览 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">系统状态</CardTitle>
            <Server className={`h-4 w-4 ${getStatusColor(health?.status || 'unknown')}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold capitalize">
              {health?.status || 'Unknown'}
            </div>
            <p className="text-xs text-muted-foreground">
              最后检查: {health?.lastCheck ? new Date(health.lastCheck).toLocaleTimeString() : 'N/A'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">错误率</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.errorRate?.toFixed(2) || 0}%
            </div>
            <p className="text-xs text-muted-foreground">
              总错误数: {stats?.totalErrors || 0}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">响应时间</CardTitle>
            <Clock className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.avgResponseTime || 0}ms
            </div>
            <p className="text-xs text-muted-foreground">
              平均响应时间
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">活跃用户</CardTitle>
            <Users className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.activeUsers || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              当前在线用户
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 详细监控数据 */}
      <Tabs defaultValue="performance" className="space-y-6">
        <TabsList>
          <TabsTrigger value="performance">性能监控</TabsTrigger>
          <TabsTrigger value="errors">错误日志</TabsTrigger>
          <TabsTrigger value="health">健康检查</TabsTrigger>
          <TabsTrigger value="system">系统资源</TabsTrigger>
        </TabsList>

        <TabsContent value="performance">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <TrendingUp className="h-5 w-5 mr-2" />
                性能趋势 (24小时)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={performance}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="timestamp" 
                      tickFormatter={(value) => new Date(value).toLocaleTimeString()}
                    />
                    <YAxis />
                    <Tooltip 
                      labelFormatter={(value) => new Date(value).toLocaleString()}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="responseTime" 
                      stroke="#3b82f6" 
                      strokeWidth={2}
                      name="响应时间(ms)"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="errors">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <AlertTriangle className="h-5 w-5 mr-2" />
                最近错误日志
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {errors.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    暂无错误日志
                  </p>
                ) : (
                  errors.map((error) => (
                    <div key={error.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <Badge variant={getErrorLevelColor(error.level)}>
                          {error.level.toUpperCase()}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {new Date(error.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-sm font-medium mb-1">{error.message}</p>
                      {error.url && (
                        <p className="text-xs text-muted-foreground mb-1">
                          URL: {error.url}
                        </p>
                      )}
                      {error.userId && (
                        <p className="text-xs text-muted-foreground mb-1">
                          用户ID: {error.userId}
                        </p>
                      )}
                      {error.stack && (
                        <details className="mt-2">
                          <summary className="text-xs cursor-pointer text-blue-600">
                            查看堆栈跟踪
                          </summary>
                          <pre className="text-xs bg-gray-100 p-2 mt-1 rounded overflow-x-auto">
                            {error.stack}
                          </pre>
                        </details>
                      )}
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="health">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Database className="h-5 w-5 mr-2" />
                  数据库
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-lg font-semibold ${health?.database ? 'text-green-600' : 'text-red-600'}`}>
                  {health?.database ? '正常' : '异常'}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Zap className="h-5 w-5 mr-2" />
                  Redis
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-lg font-semibold ${health?.redis ? 'text-green-600' : 'text-red-600'}`}>
                  {health?.redis ? '正常' : '异常'}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Server className="h-5 w-5 mr-2" />
                  存储
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-lg font-semibold ${health?.storage ? 'text-green-600' : 'text-red-600'}`}>
                  {health?.storage ? '正常' : '异常'}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="system">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>内存使用率</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold mb-2">
                  {stats?.memoryUsage?.toFixed(1) || 0}%
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full" 
                    style={{ width: `${stats?.memoryUsage || 0}%` }}
                  ></div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>CPU使用率</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold mb-2">
                  {stats?.cpuUsage?.toFixed(1) || 0}%
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-green-600 h-2 rounded-full" 
                    style={{ width: `${stats?.cpuUsage || 0}%` }}
                  ></div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default MonitoringDashboard;