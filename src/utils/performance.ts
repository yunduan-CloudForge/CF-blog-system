// 性能监控工具
export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics: Map<string, number> = new Map();
  private observers: PerformanceObserver[] = [];

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  // 测量函数执行时间
  measureFunction<T>(name: string, fn: () => T): T {
    const start = performance.now();
    const result = fn();
    const end = performance.now();
    this.metrics.set(name, end - start);
    return result;
  }

  // 测量异步函数执行时间
  async measureAsyncFunction<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const start = performance.now();
    const result = await fn();
    const end = performance.now();
    this.metrics.set(name, end - start);
    return result;
  }

  // 开始计时
  startTimer(name: string): void {
    performance.mark(`${name}-start`);
  }

  // 结束计时
  endTimer(name: string): number {
    performance.mark(`${name}-end`);
    performance.measure(name, `${name}-start`, `${name}-end`);
    
    const measure = performance.getEntriesByName(name, 'measure')[0];
    const duration = measure?.duration || 0;
    this.metrics.set(name, duration);
    
    return duration;
  }

  // 获取页面加载性能指标
  getPageLoadMetrics(): Record<string, number> {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    
    if (!navigation) return {};

    return {
      // DNS查询时间
      dnsLookup: navigation.domainLookupEnd - navigation.domainLookupStart,
      // TCP连接时间
      tcpConnect: navigation.connectEnd - navigation.connectStart,
      // 请求响应时间
      request: navigation.responseEnd - navigation.requestStart,
      // DOM解析时间
      domParse: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
      // 页面完全加载时间
      pageLoad: navigation.loadEventEnd - navigation.loadEventStart,
      // 首次内容绘制时间
      firstContentfulPaint: this.getFirstContentfulPaint(),
      // 最大内容绘制时间
      largestContentfulPaint: this.getLargestContentfulPaint()
    };
  }

  // 获取首次内容绘制时间
  private getFirstContentfulPaint(): number {
    const fcpEntry = performance.getEntriesByName('first-contentful-paint')[0];
    return fcpEntry?.startTime || 0;
  }

  // 获取最大内容绘制时间
  private getLargestContentfulPaint(): number {
    return new Promise((resolve) => {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        resolve(lastEntry?.startTime || 0);
      });
      
      observer.observe({ entryTypes: ['largest-contentful-paint'] });
      
      // 10秒后停止观察
      setTimeout(() => {
        observer.disconnect();
        resolve(0);
      }, 10000);
    }) as any;
  }

  // 监控长任务
  monitorLongTasks(): void {
    if ('PerformanceObserver' in window) {
      const observer = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          console.warn(`Long task detected: ${entry.duration}ms`, entry);
        });
      });
      
      observer.observe({ entryTypes: ['longtask'] });
      this.observers.push(observer);
    }
  }

  // 监控内存使用
  getMemoryUsage(): Record<string, number> {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      return {
        usedJSHeapSize: memory.usedJSHeapSize,
        totalJSHeapSize: memory.totalJSHeapSize,
        jsHeapSizeLimit: memory.jsHeapSizeLimit
      };
    }
    return {};
  }

  // 获取所有指标
  getAllMetrics(): Record<string, number> {
    const customMetrics = Object.fromEntries(this.metrics);
    const pageMetrics = this.getPageLoadMetrics();
    const memoryMetrics = this.getMemoryUsage();
    
    return {
      ...customMetrics,
      ...pageMetrics,
      ...memoryMetrics
    };
  }

  // 清理观察者
  cleanup(): void {
    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];
  }
}

// 防抖函数
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

// 节流函数
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

// 图片预加载
export function preloadImages(urls: string[]): Promise<void[]> {
  return Promise.all(
    urls.map(url => 
      new Promise<void>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve();
        img.onerror = reject;
        img.src = url;
      })
    )
  );
}

// 资源预加载
export function preloadResource(url: string, as: string = 'fetch'): void {
  const link = document.createElement('link');
  link.rel = 'preload';
  link.href = url;
  link.as = as;
  document.head.appendChild(link);
}

// 检查网络连接质量
export function getNetworkInfo(): Record<string, any> {
  if ('connection' in navigator) {
    const connection = (navigator as any).connection;
    return {
      effectiveType: connection.effectiveType,
      downlink: connection.downlink,
      rtt: connection.rtt,
      saveData: connection.saveData
    };
  }
  return {};
}

// 虚拟滚动优化
export class VirtualScroller {
  private container: HTMLElement;
  private itemHeight: number;
  private visibleCount: number;
  private scrollTop: number = 0;
  private totalItems: number = 0;

  constructor(container: HTMLElement, itemHeight: number) {
    this.container = container;
    this.itemHeight = itemHeight;
    this.visibleCount = Math.ceil(container.clientHeight / itemHeight) + 2;
  }

  getVisibleRange(totalItems: number, scrollTop: number): { start: number; end: number } {
    this.totalItems = totalItems;
    this.scrollTop = scrollTop;
    
    const start = Math.floor(scrollTop / this.itemHeight);
    const end = Math.min(start + this.visibleCount, totalItems);
    
    return { start: Math.max(0, start), end };
  }

  getOffsetY(): number {
    return Math.floor(this.scrollTop / this.itemHeight) * this.itemHeight;
  }

  getTotalHeight(): number {
    return this.totalItems * this.itemHeight;
  }
}