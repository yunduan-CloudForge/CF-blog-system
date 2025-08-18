/**
 * 实时数据监控WebSocket服务
 * 模块: 5.2 系统仪表板和数据统计 - 实时数据监控
 */

import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
// import { authMiddleware } from '../middleware/auth'; // 暂时注释，未来可能需要
import jwt from 'jsonwebtoken';

interface AuthenticatedWebSocket extends WebSocket {
  userId?: number;
  userRole?: string;
  isAlive?: boolean;
}

interface RealtimeData {
  type: 'stats_update' | 'user_activity' | 'system_status' | 'connection_success' | 'pong';
  data: Record<string, unknown>;
  timestamp: number;
}

class RealtimeService {
  private wss: WebSocketServer;
  private clients: Set<AuthenticatedWebSocket> = new Set();
  private statsUpdateInterval: NodeJS.Timeout | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor(server: Server) {
    this.wss = new WebSocketServer({ 
      server,
      path: '/ws/realtime'
    });

    this.setupWebSocketServer();
    this.startStatsUpdates();
    this.startHeartbeat();
  }

  private setupWebSocketServer() {
    this.wss.on('connection', (ws: AuthenticatedWebSocket, request) => {
      console.log('新的WebSocket连接');
      
      // 设置连接为活跃状态
      ws.isAlive = true;
      
      // 处理认证
      this.authenticateConnection(ws, request as { url: string; headers: { host?: string; authorization?: string; } });
      
      // 处理消息
      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message.toString());
          this.handleMessage(ws, data);
        } catch (error) {
          console.error('WebSocket消息解析错误:', error);
        }
      });
      
      // 处理心跳
      ws.on('pong', () => {
        ws.isAlive = true;
      });
      
      // 处理连接关闭
      ws.on('close', () => {
        console.log('WebSocket连接关闭');
        this.clients.delete(ws);
      });
      
      // 处理错误
      ws.on('error', (error) => {
        console.error('WebSocket错误:', error);
        this.clients.delete(ws);
      });
    });
  }

  private async authenticateConnection(ws: AuthenticatedWebSocket, request: { url: string; headers: { host?: string; authorization?: string } }) {
    try {
      // 从查询参数或头部获取token
      const url = new URL(request.url, `http://${request.headers.host}`);
      const token = url.searchParams.get('token') || request.headers.authorization?.replace('Bearer ', '');
      
      if (!token) {
        ws.close(1008, '未提供认证token');
        return;
      }
      
      // 验证JWT token
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key') as { userId: number; role: string };
      
      if (!decoded || !decoded.userId) {
        ws.close(1008, '无效的认证token');
        return;
      }
      
      // 设置用户信息
      ws.userId = decoded.userId;
      ws.userRole = decoded.role;
      
      // 只允许管理员和作者连接
      if (!['admin', 'author'].includes(decoded.role)) {
        ws.close(1008, '权限不足');
        return;
      }
      
      // 添加到客户端列表
      this.clients.add(ws);
      
      // 发送连接成功消息
      this.sendToClient(ws, {
        type: 'connection_success',
        data: { message: '实时数据连接成功' },
        timestamp: Date.now()
      });
      
      console.log(`用户 ${decoded.userId} (${decoded.role}) 连接到实时数据服务`);
      
    } catch (error) {
      console.error('WebSocket认证失败:', error);
      ws.close(1008, '认证失败');
    }
  }

  private handleMessage(ws: AuthenticatedWebSocket, data: { type: string; [key: string]: unknown }) {
    console.log('收到WebSocket消息:', data);
    
    switch (data.type) {
      case 'subscribe_stats':
        // 发送当前统计数据
        this.sendCurrentStats(ws);
        break;
      
      case 'heartbeat':
        // 响应心跳，更新连接状态
        ws.isAlive = true;
        this.sendToClient(ws, {
          type: 'pong',
          data: { timestamp: Date.now() },
          timestamp: Date.now()
        });
        break;
      
      case 'ping':
        // 兼容旧的ping消息
        ws.isAlive = true;
        this.sendToClient(ws, {
          type: 'pong',
          data: { timestamp: Date.now() },
          timestamp: Date.now()
        });
        break;
      
      default:
        console.log('未知消息类型:', data.type);
    }
  }

  private sendToClient(ws: AuthenticatedWebSocket, data: RealtimeData) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
    }
  }

  private broadcast(data: RealtimeData, roleFilter?: string[]) {
    this.clients.forEach(client => {
      if (roleFilter && !roleFilter.includes(client.userRole || '')) {
        return;
      }
      this.sendToClient(client, data);
    });
  }

  private async sendCurrentStats(ws: AuthenticatedWebSocket) {
    try {
      // 这里可以调用现有的统计API获取数据
      const statsData = await this.getCurrentStats();
      
      this.sendToClient(ws, {
        type: 'stats_update',
        data: statsData,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('获取当前统计数据失败:', error);
    }
  }

  private async getCurrentStats() {
    try {
      const { query } = await import('../database/connection.js');
      
      // 获取真实的统计数据
      const [userStats, articleStats, commentStats, viewStats] = await Promise.all([
        query('SELECT COUNT(*) as total FROM users'),
        query('SELECT COUNT(*) as total FROM articles'),
        query('SELECT COUNT(*) as total FROM comments'),
        query('SELECT SUM(views) as total FROM articles')
      ]);
      
      // 获取系统状态
      const memoryUsage = process.memoryUsage();
      const uptime = process.uptime() * 1000; // 转换为毫秒
      
      return {
        overview: {
          totalUsers: userStats[0]?.total || 0,
          totalArticles: articleStats[0]?.total || 0,
          totalComments: commentStats[0]?.total || 0,
          totalViews: viewStats[0]?.total || 0
        },
        systemStatus: {
          cpuUsage: Math.round((process.cpuUsage().user / 1000000) * 100) / 100, // 转换为百分比
          memoryUsage: Math.round((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100),
          diskUsage: 0, // 磁盘使用率需要额外的库来获取，暂时设为0
          uptime: Date.now() - uptime
        }
      };
    } catch (error) {
      console.error('获取统计数据失败:', error);
      // 返回默认值
      return {
        overview: {
          totalUsers: 0,
          totalArticles: 0,
          totalComments: 0,
          totalViews: 0
        },
        systemStatus: {
          cpuUsage: 0,
          memoryUsage: 0,
          diskUsage: 0,
          uptime: Date.now()
        }
      };
    }
  }

  private startStatsUpdates() {
    // 每30秒更新一次统计数据
    this.statsUpdateInterval = setInterval(async () => {
      try {
        const statsData = await this.getCurrentStats();
        
        this.broadcast({
          type: 'stats_update',
          data: statsData,
          timestamp: Date.now()
        }, ['admin', 'author']);
        
      } catch (error) {
        console.error('定时更新统计数据失败:', error);
      }
    }, 30000); // 30秒
  }

  private startHeartbeat() {
    // 每60秒检查连接状态（给客户端更多时间响应）
    this.heartbeatInterval = setInterval(() => {
      this.clients.forEach(client => {
        if (!client.isAlive) {
          console.log('移除无响应的WebSocket连接');
          this.clients.delete(client);
          client.terminate();
          return;
        }
        
        // 标记为未响应，等待客户端发送heartbeat
        client.isAlive = false;
      });
    }, 60000);
  }

  // 公共方法：广播用户活动
  public broadcastUserActivity(activity: Record<string, unknown>) {
    this.broadcast({
      type: 'user_activity',
      data: activity,
      timestamp: Date.now()
    }, ['admin']);
  }

  // 公共方法：广播系统状态
  public broadcastSystemStatus(status: Record<string, unknown>) {
    this.broadcast({
      type: 'system_status',
      data: status,
      timestamp: Date.now()
    }, ['admin']);
  }

  // 清理资源
  public cleanup() {
    if (this.statsUpdateInterval) {
      clearInterval(this.statsUpdateInterval);
    }
    
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    
    this.clients.forEach(client => {
      client.close();
    });
    
    this.wss.close();
  }
}

export default RealtimeService;