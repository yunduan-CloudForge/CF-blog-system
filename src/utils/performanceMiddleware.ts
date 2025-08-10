import React from 'react';
import { errorMonitor } from './errorMonitor';

interface RouteChangeMetrics {
  from: string;
  to: string;
  duration: number;
  timestamp: number;
}

interface PageLoadMetrics {
  url: string;
  loadTime: number;
  domContentLoaded: number;
  firstContentfulPaint?: number;
  largestContentfulPaint?: number;
  timestamp: number;
}

class PerformanceMiddleware {
  private routeStartTime: number = 0;
  private currentRoute: string = '';
  private pageLoadStartTime: number = 0;

  constructor() {
    this.initializePageLoadMonitoring();
    this.initializeResourceMonitoring();
  }

  // 初始化页面加载监控
  private initializePageLoadMonitoring() {
    if (typeof window === 'undefined') return;

    // 监控页面加载完成
    window.addEventListener('load', () => {
      this.trackPageLoadMetrics();
    });

    // 监控DOM内容加载完成
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        this.trackDOMContentLoaded();
      });
    } else {
      this.trackDOMContentLoaded();
    }
  }

  // 初始化资源监控
  private initializeResourceMonitoring() {
    if (typeof window === 'undefined') return;

    // 监控资源加载性能
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.entryType === 'resource') {
          this.trackResourceLoad(entry as PerformanceResourceTiming);
        }
      }
    });

    try {
      observer.observe({ entryTypes: ['resource'] });
    } catch (error) {
      console.warn('Resource performance monitoring not supported:', error);
    }
  }

  // 开始路由切换监控
  startRouteChange(to: string) {
    this.routeStartTime = performance.now();
    this.currentRoute = window.location.pathname;
    
    errorMonitor.trackUserBehavior({
      type: 'route_change_start',
      data: {
        from: this.currentRoute,
        to,
        timestamp: Date.now()
      }
    });
  }

  // 结束路由切换监控
  endRouteChange(to: string) {
    if (this.routeStartTime === 0) return;

    const duration = performance.now() - this.routeStartTime;
    const metrics: RouteChangeMetrics = {
      from: this.currentRoute,
      to,
      duration,
      timestamp: Date.now()
    };

    errorMonitor.capturePerformance({
      url: to,
      loadTime: duration,
      domContentLoaded: duration,
      timestamp: Date.now(),
      userAgent: navigator.userAgent,
      sessionId: errorMonitor.getSessionId()
    });

    errorMonitor.trackUserBehavior({
      type: 'route_change_complete',
      data: metrics
    });

    this.routeStartTime = 0;
  }

  // 监控页面加载指标
  private trackPageLoadMetrics() {
    if (typeof window === 'undefined') return;

    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    if (!navigation) return;

    const metrics: PageLoadMetrics = {
      url: window.location.href,
      loadTime: navigation.loadEventEnd - navigation.fetchStart,
      domContentLoaded: navigation.domContentLoadedEventEnd - navigation.fetchStart,
      timestamp: Date.now()
    };

    // 获取First Contentful Paint
    const paintEntries = performance.getEntriesByType('paint');
    const fcpEntry = paintEntries.find(entry => entry.name === 'first-contentful-paint');
    if (fcpEntry) {
      metrics.firstContentfulPaint = fcpEntry.startTime;
    }

    // 获取Largest Contentful Paint
    const lcpEntries = performance.getEntriesByType('largest-contentful-paint');
    if (lcpEntries.length > 0) {
      const lcpEntry = lcpEntries[lcpEntries.length - 1];
      metrics.largestContentfulPaint = lcpEntry.startTime;
    }

    errorMonitor.capturePerformance({
      url: metrics.url,
      loadTime: metrics.loadTime,
      domContentLoaded: metrics.domContentLoaded,
      timestamp: metrics.timestamp,
      userAgent: navigator.userAgent,
      sessionId: errorMonitor.getSessionId()
    });
  }

  // 监控DOM内容加载
  private trackDOMContentLoaded() {
    if (typeof window === 'undefined') return;

    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    if (!navigation) return;

    const domContentLoadedTime = navigation.domContentLoadedEventEnd - navigation.fetchStart;

    errorMonitor.capturePerformance({
      url: window.location.href,
      loadTime: domContentLoadedTime,
      domContentLoaded: domContentLoadedTime,
      timestamp: Date.now(),
      userAgent: navigator.userAgent,
      sessionId: errorMonitor.getSessionId()
    });
  }

  // 监控资源加载
  private trackResourceLoad(entry: PerformanceResourceTiming) {
    const duration = entry.responseEnd - entry.startTime;
    const resourceType = this.getResourceType(entry.name);

    // 只监控重要资源和慢加载资源
    if (duration > 1000 || this.isImportantResource(entry.name)) {
      errorMonitor.capturePerformance({
        url: entry.name,
        loadTime: duration,
        domContentLoaded: duration,
        timestamp: Date.now(),
        userAgent: navigator.userAgent,
        sessionId: errorMonitor.getSessionId()
      });
    }
  }

  // 获取资源类型
  private getResourceType(url: string): string {
    const extension = url.split('.').pop()?.toLowerCase();
    
    if (['js', 'jsx', 'ts', 'tsx'].includes(extension || '')) return 'script';
    if (['css', 'scss', 'sass'].includes(extension || '')) return 'stylesheet';
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(extension || '')) return 'image';
    if (['woff', 'woff2', 'ttf', 'otf'].includes(extension || '')) return 'font';
    if (url.includes('/api/')) return 'api';
    
    return 'other';
  }

  // 判断是否为重要资源
  private isImportantResource(url: string): boolean {
    const importantPatterns = [
      '/api/',
      'main.',
      'vendor.',
      'chunk.',
      '.css',
      'font'
    ];
    
    return importantPatterns.some(pattern => url.includes(pattern));
  }

  // 监控用户交互性能
  trackInteraction(type: string, target: string, duration?: number) {
    errorMonitor.capturePerformance({
      url: window.location.href,
      loadTime: duration || 0,
      domContentLoaded: 0,
      timestamp: Date.now(),
      userAgent: navigator.userAgent,
      sessionId: errorMonitor.getSessionId()
    });

    errorMonitor.trackUserBehavior({
      type: 'interaction',
      data: {
        type,
        target,
        duration,
        timestamp: Date.now()
      }
    });
  }

  // 监控内存使用情况
  trackMemoryUsage() {
    if (typeof window === 'undefined' || !(performance as any).memory) return;

    const memory = (performance as any).memory;
    
    errorMonitor.capturePerformance({
      url: window.location.href,
      loadTime: 0,
      domContentLoaded: 0,
      timestamp: Date.now(),
      userAgent: navigator.userAgent,
      sessionId: errorMonitor.getSessionId()
    });
  }

  // 监控网络状态
  trackNetworkStatus() {
    if (typeof window === 'undefined' || !navigator.connection) return;

    const connection = navigator.connection;
    
    errorMonitor.capturePerformance({
      url: window.location.href,
      loadTime: 0,
      domContentLoaded: 0,
      timestamp: Date.now(),
      userAgent: navigator.userAgent,
      sessionId: errorMonitor.getSessionId()
    });
  }

  // 开始性能监控会话
  startSession() {
    // 定期收集内存和网络状态
    setInterval(() => {
      this.trackMemoryUsage();
      this.trackNetworkStatus();
    }, 30000); // 每30秒收集一次
  }
}

export const performanceMiddleware = new PerformanceMiddleware();

// React Router集成
export const withPerformanceMonitoring = (WrappedComponent: React.ComponentType<any>) => {
  return (props: any) => {
    const location = props.location || window.location;
    
    React.useEffect(() => {
      performanceMiddleware.endRouteChange(location.pathname);
    }, [location.pathname]);

    return React.createElement(WrappedComponent, props);
  };
};