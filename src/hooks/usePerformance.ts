import { useEffect, useCallback, useRef, useState } from 'react';
import { PerformanceMonitor, debounce, throttle } from '@/utils/performance';

// 使用性能监控
export function usePerformanceMonitor() {
  const monitor = useRef(PerformanceMonitor.getInstance());
  
  const measureFunction = useCallback(<T>(name: string, fn: () => T): T => {
    return monitor.current.measureFunction(name, fn);
  }, []);
  
  const measureAsyncFunction = useCallback(<T>(name: string, fn: () => Promise<T>): Promise<T> => {
    return monitor.current.measureAsyncFunction(name, fn);
  }, []);
  
  const startTimer = useCallback((name: string) => {
    monitor.current.startTimer(name);
  }, []);
  
  const endTimer = useCallback((name: string) => {
    return monitor.current.endTimer(name);
  }, []);
  
  const getMetrics = useCallback(() => {
    return monitor.current.getAllMetrics();
  }, []);
  
  useEffect(() => {
    monitor.current.monitorLongTasks();
    
    return () => {
      monitor.current.cleanup();
    };
  }, []);
  
  return {
    measureFunction,
    measureAsyncFunction,
    startTimer,
    endTimer,
    getMetrics
  };
}

// 防抖Hook
export function useDebounce<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): (...args: Parameters<T>) => void {
  const debouncedCallback = useRef(debounce(callback, delay));
  
  useEffect(() => {
    debouncedCallback.current = debounce(callback, delay);
  }, [callback, delay]);
  
  return debouncedCallback.current;
}

// 节流Hook
export function useThrottle<T extends (...args: any[]) => any>(
  callback: T,
  limit: number
): (...args: Parameters<T>) => void {
  const throttledCallback = useRef(throttle(callback, limit));
  
  useEffect(() => {
    throttledCallback.current = throttle(callback, limit);
  }, [callback, limit]);
  
  return throttledCallback.current;
}

// 虚拟滚动Hook
export function useVirtualScroll<T>({
  items,
  itemHeight,
  containerHeight,
  overscan = 5
}: {
  items: T[];
  itemHeight: number;
  containerHeight: number;
  overscan?: number;
}) {
  const [scrollTop, setScrollTop] = useState(0);
  
  const visibleCount = Math.ceil(containerHeight / itemHeight);
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const endIndex = Math.min(items.length, startIndex + visibleCount + overscan * 2);
  
  const visibleItems = items.slice(startIndex, endIndex);
  const offsetY = startIndex * itemHeight;
  const totalHeight = items.length * itemHeight;
  
  const handleScroll = useThrottle((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, 16); // 60fps
  
  return {
    visibleItems,
    startIndex,
    offsetY,
    totalHeight,
    handleScroll
  };
}

// 图片懒加载Hook
export function useLazyLoad({
  threshold = 0.1,
  rootMargin = '50px'
} = {}) {
  const [isInView, setIsInView] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const elementRef = useRef<HTMLElement>(null);
  
  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;
    
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { threshold, rootMargin }
    );
    
    observer.observe(element);
    
    return () => observer.disconnect();
  }, [threshold, rootMargin]);
  
  const handleLoad = useCallback(() => {
    setIsLoaded(true);
  }, []);
  
  const handleError = useCallback(() => {
    setIsLoaded(false);
  }, []);
  
  return {
    elementRef,
    isInView,
    isLoaded,
    handleLoad,
    handleError
  };
}

// 网络状态Hook
export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [networkInfo, setNetworkInfo] = useState<Record<string, any>>({});
  
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // 获取网络信息
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      setNetworkInfo({
        effectiveType: connection.effectiveType,
        downlink: connection.downlink,
        rtt: connection.rtt,
        saveData: connection.saveData
      });
      
      const handleConnectionChange = () => {
        setNetworkInfo({
          effectiveType: connection.effectiveType,
          downlink: connection.downlink,
          rtt: connection.rtt,
          saveData: connection.saveData
        });
      };
      
      connection.addEventListener('change', handleConnectionChange);
      
      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
        connection.removeEventListener('change', handleConnectionChange);
      };
    }
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  
  return { isOnline, networkInfo };
}

// 内存使用监控Hook
export function useMemoryMonitor() {
  const [memoryInfo, setMemoryInfo] = useState<Record<string, number>>({});
  
  useEffect(() => {
    const updateMemoryInfo = () => {
      if ('memory' in performance) {
        const memory = (performance as any).memory;
        setMemoryInfo({
          usedJSHeapSize: memory.usedJSHeapSize,
          totalJSHeapSize: memory.totalJSHeapSize,
          jsHeapSizeLimit: memory.jsHeapSizeLimit,
          usagePercentage: (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100
        });
      }
    };
    
    updateMemoryInfo();
    const interval = setInterval(updateMemoryInfo, 5000); // 每5秒更新一次
    
    return () => clearInterval(interval);
  }, []);
  
  return memoryInfo;
}

// 页面可见性Hook
export function usePageVisibility() {
  const [isVisible, setIsVisible] = useState(!document.hidden);
  
  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsVisible(!document.hidden);
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);
  
  return isVisible;
}

// 预加载Hook
export function usePreload() {
  const preloadImage = useCallback((src: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve();
      img.onerror = reject;
      img.src = src;
    });
  }, []);
  
  const preloadImages = useCallback((urls: string[]): Promise<void[]> => {
    return Promise.all(urls.map(preloadImage));
  }, [preloadImage]);
  
  const preloadResource = useCallback((url: string, as: string = 'fetch') => {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.href = url;
    link.as = as;
    document.head.appendChild(link);
  }, []);
  
  return {
    preloadImage,
    preloadImages,
    preloadResource
  };
}