/**
 * WebSocket客户端服务
 * 用于实时数据监控连接
 */

import { useAuthStore } from '../store/authStore';

interface RealtimeData {
  type: 'stats_update' | 'user_activity' | 'system_status' | 'connection_success' | 'pong';
  data: Record<string, unknown>;
  timestamp: number;
}

type MessageHandler = (data: RealtimeData) => void;

class WebSocketService {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private messageHandlers: Map<string, MessageHandler[]> = new Map();
  private isConnecting = false;
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor() {
    // 不在构造函数中自动连接，等待手动调用
  }

  public connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.isConnecting || (this.ws && this.ws.readyState === WebSocket.OPEN)) {
        resolve();
        return;
      }

      this.isConnecting = true;
      const authStore = useAuthStore.getState();
      
      if (!authStore.isAuthenticated || !authStore.token) {
        this.isConnecting = false;
        reject(new Error('用户未认证'));
        return;
      }

      const wsUrl = `ws://localhost:3001/ws/realtime?token=${encodeURIComponent(authStore.token)}`;
      
      try {
        this.ws = new WebSocket(wsUrl);
        
        this.ws.onopen = () => {
          console.log('WebSocket连接已建立');
          this.isConnecting = false;
          this.reconnectAttempts = 0;
          this.startHeartbeat();
          resolve();
        };
        
        this.ws.onmessage = (event) => {
          try {
            const data: RealtimeData = JSON.parse(event.data);
            this.handleMessage(data);
          } catch (error) {
            console.error('WebSocket消息解析错误:', error);
          }
        };
        
        this.ws.onclose = (event) => {
          console.log('WebSocket连接已关闭:', event.code, event.reason);
          this.isConnecting = false;
          this.stopHeartbeat();
          
          // 如果不是主动关闭，尝试重连
          if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.scheduleReconnect();
          }
        };
        
        this.ws.onerror = (error) => {
          console.error('WebSocket错误:', error);
          this.isConnecting = false;
          reject(error);
        };
        
      } catch (error) {
        this.isConnecting = false;
        reject(error);
      }
    });
  }

  private handleMessage(data: RealtimeData) {
    console.log('收到WebSocket消息:', data.type, data);
    
    // 调用注册的消息处理器
    const handlers = this.messageHandlers.get(data.type) || [];
    handlers.forEach(handler => {
      try {
        handler(data);
      } catch (error) {
        console.error('消息处理器执行错误:', error);
      }
    });
  }

  private scheduleReconnect() {
    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    console.log(`${delay}ms后尝试第${this.reconnectAttempts}次重连...`);
    
    setTimeout(() => {
      this.connect().catch(error => {
        console.error('重连失败:', error);
      });
    }, delay);
  }

  private startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.send({ type: 'heartbeat', timestamp: Date.now() });
      }
    }, 25000); // 25秒发送一次心跳
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  public send(data: Record<string, unknown>) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    } else {
      console.warn('WebSocket未连接，无法发送消息');
    }
  }

  public subscribe(messageType: string, handler: MessageHandler) {
    if (!this.messageHandlers.has(messageType)) {
      this.messageHandlers.set(messageType, []);
    }
    this.messageHandlers.get(messageType)!.push(handler);
    
    // 返回取消订阅函数
    return () => {
      const handlers = this.messageHandlers.get(messageType);
      if (handlers) {
        const index = handlers.indexOf(handler);
        if (index > -1) {
          handlers.splice(index, 1);
        }
      }
    };
  }

  public subscribeToStats(handler: MessageHandler) {
    const unsubscribe = this.subscribe('stats_update', handler);
    
    // 订阅后立即请求当前统计数据
    this.send({ type: 'subscribe_stats' });
    
    return unsubscribe;
  }

  public subscribeToUserActivity(handler: MessageHandler) {
    return this.subscribe('user_activity', handler);
  }

  public subscribeToSystemStatus(handler: MessageHandler) {
    return this.subscribe('system_status', handler);
  }

  public disconnect() {
    this.stopHeartbeat();
    
    if (this.ws) {
      this.ws.close(1000, '主动断开连接');
      this.ws = null;
    }
    
    this.messageHandlers.clear();
    this.reconnectAttempts = 0;
  }

  public isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  public getConnectionState(): string {
    if (!this.ws) return 'DISCONNECTED';
    
    switch (this.ws.readyState) {
      case WebSocket.CONNECTING:
        return 'CONNECTING';
      case WebSocket.OPEN:
        return 'CONNECTED';
      case WebSocket.CLOSING:
        return 'CLOSING';
      case WebSocket.CLOSED:
        return 'DISCONNECTED';
      default:
        return 'UNKNOWN';
    }
  }
}

// 创建单例实例
const websocketService = new WebSocketService();

export default websocketService;
export type { RealtimeData, MessageHandler };