// 错误监控和上报工具

interface ErrorInfo {
  message: string;
  stack?: string;
  url: string;
  line?: number;
  column?: number;
  timestamp: number;
  userAgent: string;
  userId?: string;
  sessionId: string;
  errorType: 'javascript' | 'promise' | 'resource' | 'network' | 'custom';
  severity: 'low' | 'medium' | 'high' | 'critical';
  context?: Record<string, any>;
}

interface PerformanceInfo {
  url: string;
  loadTime: number;
  domContentLoaded: number;
  firstContentfulPaint?: number;
  largestContentfulPaint?: number;
  firstInputDelay?: number;
  cumulativeLayoutShift?: number;
  timestamp: number;
  userAgent: string;
  userId?: string;
  sessionId: string;
}

interface UserActionInfo {
  action: string;
  element?: string;
  url: string;
  timestamp: number;
  userId?: string;
  sessionId: string;
  context?: Record<string, any>;
}

class ErrorMonitor {
  private sessionId: string;
  private userId?: string;
  private isEnabled: boolean = true;
  private errorQueue: ErrorInfo[] = [];
  private performanceQueue: PerformanceInfo[] = [];
  private userActionQueue: UserActionInfo[] = [];
  private maxQueueSize = 100;
  private flushInterval = 30000; // 30秒
  private apiEndpoint = '/api/monitoring';

  constructor() {
    this.sessionId = this.generateSessionId();
    this.initializeMonitoring();
    this.startPeriodicFlush();
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private initializeMonitoring(): void {
    // JavaScript错误监控
    window.addEventListener('error', (event) => {
      this.captureError({
        message: event.message,
        stack: event.error?.stack,
        url: event.filename || window.location.href,
        line: event.lineno,
        column: event.colno,
        timestamp: Date.now(),
        userAgent: navigator.userAgent,
        userId: this.userId,
        sessionId: this.sessionId,
        errorType: 'javascript',
        severity: 'high'
      });
    });

    // Promise rejection监控
    window.addEventListener('unhandledrejection', (event) => {
      this.captureError({
        message: event.reason?.message || 'Unhandled Promise Rejection',
        stack: event.reason?.stack,
        url: window.location.href,
        timestamp: Date.now(),
        userAgent: navigator.userAgent,
        userId: this.userId,
        sessionId: this.sessionId,
        errorType: 'promise',
        severity: 'high',
        context: { reason: event.reason }
      });
    });

    // 资源加载错误监控
    window.addEventListener('error', (event) => {
      if (event.target !== window) {
        const target = event.target as HTMLElement;
        this.captureError({
          message: `Resource loading failed: ${target.tagName}`,
          url: window.location.href,
          timestamp: Date.now(),
          userAgent: navigator.userAgent,
          userId: this.userId,
          sessionId: this.sessionId,
          errorType: 'resource',
          severity: 'medium',
          context: {
            tagName: target.tagName,
            src: (target as any).src || (target as any).href
          }
        });
      }
    }, true);

    // 性能监控
    this.initializePerformanceMonitoring();

    // 用户行为监控
    this.initializeUserActionMonitoring();
  }

  private initializePerformanceMonitoring(): void {
    // 页面加载性能
    window.addEventListener('load', () => {
      setTimeout(() => {
        const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        const paint = performance.getEntriesByType('paint');
        
        const performanceInfo: PerformanceInfo = {
          url: window.location.href,
          loadTime: navigation.loadEventEnd - navigation.loadEventStart,
          domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
          timestamp: Date.now(),
          userAgent: navigator.userAgent,
          userId: this.userId,
          sessionId: this.sessionId
        };

        // 添加Paint Timing指标
        paint.forEach(entry => {
          if (entry.name === 'first-contentful-paint') {
            performanceInfo.firstContentfulPaint = entry.startTime;
          }
        });

        this.capturePerformance(performanceInfo);
      }, 0);
    });

    // Web Vitals监控
    this.initializeWebVitals();
  }

  private initializeWebVitals(): void {
    // LCP (Largest Contentful Paint)
    new PerformanceObserver((entryList) => {
      const entries = entryList.getEntries();
      const lastEntry = entries[entries.length - 1];
      this.capturePerformance({
        url: window.location.href,
        loadTime: 0,
        domContentLoaded: 0,
        largestContentfulPaint: lastEntry.startTime,
        timestamp: Date.now(),
        userAgent: navigator.userAgent,
        userId: this.userId,
        sessionId: this.sessionId
      });
    }).observe({ entryTypes: ['largest-contentful-paint'] });

    // FID (First Input Delay)
    new PerformanceObserver((entryList) => {
      const entries = entryList.getEntries();
      entries.forEach(entry => {
        this.capturePerformance({
          url: window.location.href,
          loadTime: 0,
          domContentLoaded: 0,
          firstInputDelay: entry.processingStart - entry.startTime,
          timestamp: Date.now(),
          userAgent: navigator.userAgent,
          userId: this.userId,
          sessionId: this.sessionId
        });
      });
    }).observe({ entryTypes: ['first-input'] });

    // CLS (Cumulative Layout Shift)
    let clsValue = 0;
    new PerformanceObserver((entryList) => {
      for (const entry of entryList.getEntries()) {
        if (!(entry as any).hadRecentInput) {
          clsValue += (entry as any).value;
        }
      }
      this.capturePerformance({
        url: window.location.href,
        loadTime: 0,
        domContentLoaded: 0,
        cumulativeLayoutShift: clsValue,
        timestamp: Date.now(),
        userAgent: navigator.userAgent,
        userId: this.userId,
        sessionId: this.sessionId
      });
    }).observe({ entryTypes: ['layout-shift'] });
  }

  private initializeUserActionMonitoring(): void {
    // 点击事件监控
    document.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      this.captureUserAction({
        action: 'click',
        element: this.getElementSelector(target),
        url: window.location.href,
        timestamp: Date.now(),
        userId: this.userId,
        sessionId: this.sessionId,
        context: {
          tagName: target.tagName,
          className: target.className,
          id: target.id,
          text: target.textContent?.slice(0, 100)
        }
      });
    });

    // 页面访问监控
    this.captureUserAction({
      action: 'page_view',
      url: window.location.href,
      timestamp: Date.now(),
      userId: this.userId,
      sessionId: this.sessionId,
      context: {
        referrer: document.referrer,
        title: document.title
      }
    });

    // 页面离开监控
    window.addEventListener('beforeunload', () => {
      this.captureUserAction({
        action: 'page_leave',
        url: window.location.href,
        timestamp: Date.now(),
        userId: this.userId,
        sessionId: this.sessionId
      });
      // 在页面卸载时不发送监控数据，避免请求被中止的错误
      // 数据会在下次页面加载时或定期刷新时发送
    });
  }

  private getElementSelector(element: HTMLElement): string {
    if (element.id) {
      return `#${element.id}`;
    }
    if (element.className && typeof element.className === 'string') {
      return `.${element.className.split(' ').join('.')}`;
    }
    return element.tagName.toLowerCase();
  }

  public captureError(error: ErrorInfo): void {
    if (!this.isEnabled) return;

    this.errorQueue.push(error);
    
    // 如果是严重错误，立即发送
    if (error.severity === 'critical') {
      this.flush();
    } else if (this.errorQueue.length >= this.maxQueueSize) {
      this.flush();
    }
  }

  public capturePerformance(performance: PerformanceInfo): void {
    if (!this.isEnabled) return;

    this.performanceQueue.push(performance);
    
    if (this.performanceQueue.length >= this.maxQueueSize) {
      this.flush();
    }
  }

  public captureUserAction(action: UserActionInfo): void {
    if (!this.isEnabled) return;

    this.userActionQueue.push(action);
    
    if (this.userActionQueue.length >= this.maxQueueSize) {
      this.flush();
    }
  }

  public captureCustomError(message: string, context?: Record<string, any>, severity: ErrorInfo['severity'] = 'medium'): void {
    this.captureError({
      message,
      url: window.location.href,
      timestamp: Date.now(),
      userAgent: navigator.userAgent,
      userId: this.userId,
      sessionId: this.sessionId,
      errorType: 'custom',
      severity,
      context
    });
  }

  public setUserId(userId: string): void {
    this.userId = userId;
  }

  public enable(): void {
    this.isEnabled = true;
  }

  public disable(): void {
    this.isEnabled = false;
  }

  private async flush(): Promise<void> {
    if (!this.isEnabled) return;

    const data = {
      errors: [...this.errorQueue],
      performance: [...this.performanceQueue],
      userActions: [...this.userActionQueue]
    };

    // 清空队列
    this.errorQueue = [];
    this.performanceQueue = [];
    this.userActionQueue = [];

    try {
      await fetch(this.apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(data)
      });
    } catch (error) {
      // 发送失败时，将数据重新加入队列
      this.errorQueue.unshift(...data.errors);
      this.performanceQueue.unshift(...data.performance);
      this.userActionQueue.unshift(...data.userActions);
      
      console.warn('Failed to send monitoring data:', error);
    }
  }

  private flushWithBeacon(): void {
    if (!this.isEnabled) return;

    const data = {
      errors: [...this.errorQueue],
      performance: [...this.performanceQueue],
      userActions: [...this.userActionQueue]
    };

    // 如果没有数据，直接返回
    if (data.errors.length === 0 && data.performance.length === 0 && data.userActions.length === 0) {
      return;
    }

    // 清空队列
    this.errorQueue = [];
    this.performanceQueue = [];
    this.userActionQueue = [];

    try {
      // 使用 sendBeacon API，在页面卸载时可靠发送数据
      if (navigator.sendBeacon) {
        // sendBeacon 需要绝对URL，构建完整的API地址
        const absoluteUrl = new URL(this.apiEndpoint, window.location.origin).href;
        const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
        navigator.sendBeacon(absoluteUrl, blob);
      } else {
        // 降级到同步 XMLHttpRequest（不推荐，但作为备选）
        const xhr = new XMLHttpRequest();
        xhr.open('POST', this.apiEndpoint, false);
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.send(JSON.stringify(data));
      }
    } catch (error) {
      console.warn('Failed to send monitoring data with beacon:', error);
    }
  }

  private startPeriodicFlush(): void {
    setInterval(() => {
      this.flush();
    }, this.flushInterval);
  }

  public getSessionId(): string {
    return this.sessionId;
  }

  public getQueueSizes(): { errors: number; performance: number; userActions: number } {
    return {
      errors: this.errorQueue.length,
      performance: this.performanceQueue.length,
      userActions: this.userActionQueue.length
    };
  }
}

// 创建全局实例
export const errorMonitor = new ErrorMonitor();

// 导出类型
export type { ErrorInfo, PerformanceInfo, UserActionInfo };