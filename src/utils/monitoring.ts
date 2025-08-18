/**
 * 前端错误监控和性能监控系统
 * 实现错误收集、性能监控、用户行为追踪等功能
 */

// 错误类型定义
interface ErrorReport {
  id: string;
  type: 'javascript' | 'promise' | 'resource' | 'network' | 'custom';
  message: string;
  stack?: string;
  filename?: string;
  lineno?: number;
  colno?: number;
  timestamp: string;
  url: string;
  userAgent: string;
  userId?: string;
  sessionId: string;
  breadcrumbs: Breadcrumb[];
  context?: Record<string, unknown>;
}

// 性能指标定义
interface PerformanceMetrics {
  id: string;
  type: 'navigation' | 'resource' | 'paint' | 'layout' | 'custom';
  name: string;
  value: number;
  unit: string;
  timestamp: string;
  url: string;
  userId?: string;
  sessionId: string;
  context?: Record<string, unknown>;
}

// 用户行为追踪
interface Breadcrumb {
  timestamp: string;
  category: 'navigation' | 'user' | 'http' | 'console' | 'dom';
  message: string;
  level: 'info' | 'warning' | 'error';
  data?: Record<string, unknown>;
}

// 监控配置
interface MonitoringConfig {
  enabled: boolean;
  apiEndpoint: string;
  maxBreadcrumbs: number;
  sampleRate: number;
  enablePerformanceMonitoring: boolean;
  enableUserTracking: boolean;
  enableConsoleCapture: boolean;
  enableNetworkCapture: boolean;
  blacklistUrls: RegExp[];
  beforeSend?: (data: ErrorReport | PerformanceMetrics) => ErrorReport | PerformanceMetrics | null;
}

/**
 * 错误监控和性能监控类
 */
class MonitoringSystem {
  private config: MonitoringConfig;
  private breadcrumbs: Breadcrumb[] = [];
  private sessionId: string;
  private userId?: string;
  private isInitialized = false;
  private performanceObserver?: PerformanceObserver;
  private mutationObserver?: MutationObserver;

  constructor(config: Partial<MonitoringConfig> = {}) {
    this.config = {
      enabled: true,
      apiEndpoint: '/api/monitoring',
      maxBreadcrumbs: 50,
      sampleRate: 1.0,
      enablePerformanceMonitoring: true,
      enableUserTracking: true,
      enableConsoleCapture: true,
      enableNetworkCapture: true,
      blacklistUrls: [],
      ...config
    };

    this.sessionId = this.generateSessionId();
    this.loadUserId();
  }

  /**
   * 初始化监控系统
   */
  init(): void {
    if (!this.config.enabled || this.isInitialized) {
      return;
    }

    try {
      // 设置全局错误处理
      this.setupGlobalErrorHandlers();

      // 设置性能监控
      if (this.config.enablePerformanceMonitoring) {
        this.setupPerformanceMonitoring();
      }

      // 设置用户行为追踪
      if (this.config.enableUserTracking) {
        this.setupUserTracking();
      }

      // 设置控制台捕获
      if (this.config.enableConsoleCapture) {
        this.setupConsoleCapture();
      }

      // 设置网络请求监控
      if (this.config.enableNetworkCapture) {
        this.setupNetworkCapture();
      }

      // 监控页面可见性变化
      this.setupVisibilityTracking();

      // 监控内存使用
      this.setupMemoryMonitoring();

      this.isInitialized = true;
      this.addBreadcrumb({
        category: 'console',
        message: 'Monitoring system initialized',
        level: 'info'
      });

      console.log('🔍 Monitoring system initialized');
    } catch (error) {
      console.error('Failed to initialize monitoring system:', error);
    }
  }

  /**
   * 设置全局错误处理
   */
  private setupGlobalErrorHandlers(): void {
    // JavaScript错误
    window.addEventListener('error', (event) => {
      this.captureError({
        type: 'javascript',
        message: event.message,
        stack: event.error?.stack,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno
      });
    });

    // Promise拒绝
    window.addEventListener('unhandledrejection', (event) => {
      this.captureError({
        type: 'promise',
        message: event.reason?.message || 'Unhandled Promise Rejection',
        stack: event.reason?.stack
      });
    });

    // 资源加载错误
    window.addEventListener('error', (event) => {
      if (event.target !== window) {
        const target = event.target as HTMLElement;
        let filename = '';
        if ('src' in target && typeof target.src === 'string') {
          filename = target.src;
        } else if ('href' in target && typeof target.href === 'string') {
          filename = target.href;
        }
        this.captureError({
          type: 'resource',
          message: `Failed to load resource: ${target.tagName}`,
          filename
        });
      }
    }, true);
  }

  /**
   * 设置性能监控
   */
  private setupPerformanceMonitoring(): void {
    // 监控导航性能
    this.captureNavigationMetrics();

    // 监控资源加载性能
    if ('PerformanceObserver' in window) {
      this.performanceObserver = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          this.capturePerformanceMetric({
            type: 'resource',
            name: entry.name,
            value: entry.duration,
            unit: 'ms',
            context: {
              entryType: entry.entryType,
              startTime: entry.startTime,
              transferSize: (entry as PerformanceResourceTiming).transferSize,
              encodedBodySize: (entry as PerformanceResourceTiming).encodedBodySize
            }
          });
        });
      });

      this.performanceObserver.observe({ entryTypes: ['resource', 'navigation', 'paint'] });
    }

    // 监控长任务
    if ('PerformanceObserver' in window) {
      try {
        const longTaskObserver = new PerformanceObserver((list) => {
          list.getEntries().forEach((entry) => {
            this.capturePerformanceMetric({
              type: 'custom',
              name: 'long-task',
              value: entry.duration,
              unit: 'ms',
              context: {
                startTime: entry.startTime
              }
            });
          });
        });
        longTaskObserver.observe({ entryTypes: ['longtask'] });
      } catch {
        // longtask可能不被支持
      }
    }

    // 监控Core Web Vitals
    this.setupWebVitalsMonitoring();
  }

  /**
   * 设置Web Vitals监控
   */
  private setupWebVitalsMonitoring(): void {
    // FCP (First Contentful Paint)
    this.observePerformanceEntry('paint', (entry) => {
      if (entry.name === 'first-contentful-paint') {
        this.capturePerformanceMetric({
          type: 'paint',
          name: 'FCP',
          value: entry.startTime,
          unit: 'ms'
        });
      }
    });

    // LCP (Largest Contentful Paint)
    this.observePerformanceEntry('largest-contentful-paint', (entry) => {
      this.capturePerformanceMetric({
        type: 'paint',
        name: 'LCP',
        value: entry.startTime,
        unit: 'ms'
      });
    });

    // CLS (Cumulative Layout Shift)
    this.observePerformanceEntry('layout-shift', (entry) => {
      const layoutShiftEntry = entry as PerformanceEntry & { hadRecentInput?: boolean; value: number };
      if (!layoutShiftEntry.hadRecentInput) {
        this.capturePerformanceMetric({
          type: 'layout',
          name: 'CLS',
          value: layoutShiftEntry.value,
          unit: 'score'
        });
      }
    });
  }

  /**
   * 观察性能条目
   */
  private observePerformanceEntry(entryType: string, callback: (entry: PerformanceEntry) => void): void {
    if ('PerformanceObserver' in window) {
      try {
        const observer = new PerformanceObserver((list) => {
          list.getEntries().forEach(callback);
        });
        observer.observe({ entryTypes: [entryType] });
      } catch {
        // 某些entryType可能不被支持
      }
    }
  }

  /**
   * 设置用户行为追踪
   */
  private setupUserTracking(): void {
    // 点击事件
    document.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      this.addBreadcrumb({
        category: 'user',
        message: 'User clicked',
        level: 'info',
        data: {
          tagName: target.tagName,
          className: target.className,
          id: target.id,
          text: target.textContent?.slice(0, 100)
        }
      });
    });

    // 路由变化
    this.trackRouteChanges();

    // 表单提交
    document.addEventListener('submit', (event) => {
      const form = event.target as HTMLFormElement;
      this.addBreadcrumb({
        category: 'user',
        message: 'Form submitted',
        level: 'info',
        data: {
          action: form.action,
          method: form.method
        }
      });
    });
  }

  /**
   * 追踪路由变化
   */
  private trackRouteChanges(): void {
    let currentUrl = window.location.href;

    // 监听popstate事件
    window.addEventListener('popstate', () => {
      const newUrl = window.location.href;
      if (newUrl !== currentUrl) {
        this.addBreadcrumb({
          category: 'navigation',
          message: 'Route changed',
          level: 'info',
          data: {
            from: currentUrl,
            to: newUrl
          }
        });
        currentUrl = newUrl;
      }
    });

    // 监听pushState和replaceState
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = function(...args) {
      originalPushState.apply(history, args);
      const newUrl = window.location.href;
      if (newUrl !== currentUrl) {
        monitoring.addBreadcrumb({
          category: 'navigation',
          message: 'Route changed (pushState)',
          level: 'info',
          data: {
            from: currentUrl,
            to: newUrl
          }
        });
        currentUrl = newUrl;
      }
    };

    history.replaceState = function(...args) {
      originalReplaceState.apply(history, args);
      const newUrl = window.location.href;
      if (newUrl !== currentUrl) {
        monitoring.addBreadcrumb({
          category: 'navigation',
          message: 'Route changed (replaceState)',
          level: 'info',
          data: {
            from: currentUrl,
            to: newUrl
          }
        });
        currentUrl = newUrl;
      }
    };
  }

  /**
   * 设置控制台捕获
   */
  private setupConsoleCapture(): void {
    const originalConsole = {
      log: console.log,
      warn: console.warn,
      error: console.error
    };

    console.error = (...args) => {
      this.addBreadcrumb({
        category: 'console',
        message: args.join(' '),
        level: 'error'
      });
      originalConsole.error.apply(console, args);
    };

    console.warn = (...args) => {
      this.addBreadcrumb({
        category: 'console',
        message: args.join(' '),
        level: 'warning'
      });
      originalConsole.warn.apply(console, args);
    };
  }

  /**
   * 设置网络请求监控
   */
  private setupNetworkCapture(): void {
    // 监控fetch请求
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const startTime = Date.now();
      const url = args[0] as string;
      
      try {
        const response = await originalFetch.apply(window, args);
        const duration = Date.now() - startTime;
        
        this.addBreadcrumb({
          category: 'http',
          message: `HTTP ${response.status} ${url}`,
          level: response.ok ? 'info' : 'warning',
          data: {
            url,
            method: (args[1] as RequestInit)?.method || 'GET',
            status: response.status,
            duration
          }
        });

        // 记录慢请求
        if (duration > 1000) {
          this.capturePerformanceMetric({
            type: 'custom',
            name: 'slow-request',
            value: duration,
            unit: 'ms',
            context: { url, status: response.status }
          });
        }

        return response;
      } catch (error) {
        const duration = Date.now() - startTime;
        this.addBreadcrumb({
          category: 'http',
          message: `HTTP Error ${url}`,
          level: 'error',
          data: {
            url,
            method: (args[1] as RequestInit)?.method || 'GET',
            error: (error as Error).message,
            duration
          }
        });
        throw error;
      }
    };
  }

  /**
   * 设置页面可见性追踪
   */
  private setupVisibilityTracking(): void {
    document.addEventListener('visibilitychange', () => {
      this.addBreadcrumb({
        category: 'user',
        message: `Page ${document.hidden ? 'hidden' : 'visible'}`,
        level: 'info'
      });
    });
  }

  /**
   * 设置内存监控
   */
  private setupMemoryMonitoring(): void {
    if ('memory' in performance) {
      setInterval(() => {
        const memory = (performance as Performance & { memory: { usedJSHeapSize: number; totalJSHeapSize: number; jsHeapSizeLimit: number } }).memory;
        this.capturePerformanceMetric({
          type: 'custom',
          name: 'memory-usage',
          value: memory.usedJSHeapSize / 1024 / 1024,
          unit: 'MB',
          context: {
            totalJSHeapSize: memory.totalJSHeapSize / 1024 / 1024,
            jsHeapSizeLimit: memory.jsHeapSizeLimit / 1024 / 1024
          }
        });
      }, 30000); // 每30秒检查一次
    }
  }

  /**
   * 捕获导航性能指标
   */
  private captureNavigationMetrics(): void {
    window.addEventListener('load', () => {
      setTimeout(() => {
        const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        if (navigation) {
          // DNS查询时间
          this.capturePerformanceMetric({
            type: 'navigation',
            name: 'DNS',
            value: navigation.domainLookupEnd - navigation.domainLookupStart,
            unit: 'ms'
          });

          // TCP连接时间
          this.capturePerformanceMetric({
            type: 'navigation',
            name: 'TCP',
            value: navigation.connectEnd - navigation.connectStart,
            unit: 'ms'
          });

          // 页面加载时间
          this.capturePerformanceMetric({
            type: 'navigation',
            name: 'Load',
            value: navigation.loadEventEnd - navigation.fetchStart,
            unit: 'ms'
          });

          // DOM解析时间
          this.capturePerformanceMetric({
            type: 'navigation',
            name: 'DOM',
            value: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
            unit: 'ms'
          });
        }
      }, 0);
    });
  }

  /**
   * 捕获错误
   */
  captureError(error: Partial<ErrorReport>): void {
    if (!this.config.enabled || !this.shouldSample()) {
      return;
    }

    const errorReport: ErrorReport = {
      id: this.generateId(),
      type: error.type || 'custom',
      message: error.message || 'Unknown error',
      stack: error.stack,
      filename: error.filename,
      lineno: error.lineno,
      colno: error.colno,
      timestamp: new Date().toISOString(),
      url: window.location.href,
      userAgent: navigator.userAgent,
      userId: this.userId,
      sessionId: this.sessionId,
      breadcrumbs: [...this.breadcrumbs],
      context: error.context
    };

    // 应用beforeSend钩子
    const processedError = this.config.beforeSend ? this.config.beforeSend(errorReport) : errorReport;
    if (!processedError) return;

    this.sendToServer(processedError);
  }

  /**
   * 捕获性能指标
   */
  capturePerformanceMetric(metric: Partial<PerformanceMetrics>): void {
    if (!this.config.enabled || !this.config.enablePerformanceMonitoring || !this.shouldSample()) {
      return;
    }

    const performanceMetric: PerformanceMetrics = {
      id: this.generateId(),
      type: metric.type || 'custom',
      name: metric.name || 'unknown',
      value: metric.value || 0,
      unit: metric.unit || 'ms',
      timestamp: new Date().toISOString(),
      url: window.location.href,
      userId: this.userId,
      sessionId: this.sessionId,
      context: metric.context
    };

    // 应用beforeSend钩子
    const processedMetric = this.config.beforeSend ? this.config.beforeSend(performanceMetric) : performanceMetric;
    if (!processedMetric) return;

    this.sendToServer(processedMetric);
  }

  /**
   * 添加面包屑
   */
  addBreadcrumb(breadcrumb: Omit<Breadcrumb, 'timestamp'>): void {
    const fullBreadcrumb: Breadcrumb = {
      ...breadcrumb,
      timestamp: new Date().toISOString()
    };

    this.breadcrumbs.push(fullBreadcrumb);

    // 保持面包屑数量在限制内
    if (this.breadcrumbs.length > this.config.maxBreadcrumbs) {
      this.breadcrumbs = this.breadcrumbs.slice(-this.config.maxBreadcrumbs);
    }
  }

  /**
   * 发送数据到服务器
   */
  private async sendToServer(data: ErrorReport | PerformanceMetrics): Promise<void> {
    try {
      await fetch(this.config.apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });
    } catch (error) {
      console.error('Failed to send monitoring data:', error);
    }
  }

  /**
   * 检查是否应该采样
   */
  private shouldSample(): boolean {
    return Math.random() < this.config.sampleRate;
  }

  /**
   * 生成会话ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 生成唯一ID
   */
  private generateId(): string {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 加载用户ID
   */
  private loadUserId(): void {
    try {
      const authData = localStorage.getItem('auth');
      if (authData) {
        const parsed = JSON.parse(authData);
        this.userId = parsed.user?.id;
      }
    } catch {
      // 忽略解析错误
    }
  }

  /**
   * 设置用户ID
   */
  setUserId(userId: string): void {
    this.userId = userId;
  }

  /**
   * 获取监控统计
   */
  getStats(): {
    sessionId: string;
    userId?: string;
    breadcrumbsCount: number;
    isInitialized: boolean;
  } {
    return {
      sessionId: this.sessionId,
      userId: this.userId,
      breadcrumbsCount: this.breadcrumbs.length,
      isInitialized: this.isInitialized
    };
  }

  /**
   * 销毁监控系统
   */
  destroy(): void {
    if (this.performanceObserver) {
      this.performanceObserver.disconnect();
    }
    if (this.mutationObserver) {
      this.mutationObserver.disconnect();
    }
    this.isInitialized = false;
  }
}

// 创建全局监控实例
export const monitoring = new MonitoringSystem({
  enabled: process.env.NODE_ENV === 'production',
  apiEndpoint: '/api/monitoring',
  sampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0, // 生产环境10%采样
  beforeSend: (data) => {
    // 过滤敏感信息
    if ('message' in data && data.message.includes('password')) {
      return null;
    }
    return data;
  }
});

// 自动初始化
if (typeof window !== 'undefined') {
  monitoring.init();
}

export default monitoring;

// 导出类型
export type { ErrorReport, PerformanceMetrics, Breadcrumb, MonitoringConfig };