import React, { useEffect, useRef, useCallback } from 'react';
import { errorMonitor } from '../utils/errorMonitor';

interface PerformanceMetrics {
  pageLoadTime?: number;
  domContentLoadedTime?: number;
  firstContentfulPaint?: number;
  largestContentfulPaint?: number;
  firstInputDelay?: number;
  cumulativeLayoutShift?: number;
  componentRenderTime?: number;
}

interface UsePerformanceMonitorOptions {
  componentName?: string;
  trackPageLoad?: boolean;
  trackComponentRender?: boolean;
  trackWebVitals?: boolean;
}

export const usePerformanceMonitor = (options: UsePerformanceMonitorOptions = {}) => {
  const {
    componentName = 'Unknown',
    trackPageLoad = true,
    trackComponentRender = true,
    trackWebVitals = true
  } = options;

  const renderStartTime = useRef<number>(Date.now());
  const isFirstRender = useRef<boolean>(true);

  // 监控页面加载性能
  const trackPageLoadMetrics = useCallback(() => {
    if (!trackPageLoad || typeof window === 'undefined') return;

    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    if (!navigation) return;

    const metrics: PerformanceMetrics = {
      pageLoadTime: navigation.loadEventEnd - navigation.fetchStart,
      domContentLoadedTime: navigation.domContentLoadedEventEnd - navigation.fetchStart
    };

    // 上报页面加载性能
    errorMonitor.capturePerformance({
      url: window.location.href,
      loadTime: metrics.pageLoadTime || 0,
      domContentLoaded: metrics.domContentLoadedTime || 0,
      timestamp: Date.now(),
      userAgent: navigator.userAgent,
      sessionId: errorMonitor.getSessionId()
    });
  }, [trackPageLoad]);

  // 监控Web Vitals
  const trackWebVitalsMetrics = useCallback(() => {
    if (!trackWebVitals || typeof window === 'undefined') return;

    // First Contentful Paint
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.name === 'first-contentful-paint') {
          errorMonitor.capturePerformance({
            url: window.location.href,
            loadTime: entry.startTime,
            domContentLoaded: 0,
            timestamp: Date.now(),
            userAgent: navigator.userAgent,
            sessionId: errorMonitor.getSessionId()
          });
        }
      }
    });

    try {
      observer.observe({ entryTypes: ['paint'] });
    } catch (error) {
      console.warn('Performance Observer not supported:', error);
    }

    // Largest Contentful Paint
    const lcpObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const lastEntry = entries[entries.length - 1];
      if (lastEntry) {
        errorMonitor.capturePerformance({
          url: window.location.href,
          loadTime: lastEntry.startTime,
          domContentLoaded: 0,
          timestamp: Date.now(),
          userAgent: navigator.userAgent,
          sessionId: errorMonitor.getSessionId()
        });
      }
    });

    try {
      lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
    } catch (error) {
      console.warn('LCP Observer not supported:', error);
    }

    // Cumulative Layout Shift
    const clsObserver = new PerformanceObserver((list) => {
      let clsValue = 0;
      for (const entry of list.getEntries()) {
        if (!(entry as any).hadRecentInput) {
          clsValue += (entry as any).value;
        }
      }
      if (clsValue > 0) {
        errorMonitor.capturePerformance({
          url: window.location.href,
          loadTime: clsValue,
          domContentLoaded: 0,
          timestamp: Date.now(),
          userAgent: navigator.userAgent,
          sessionId: errorMonitor.getSessionId()
        });
      }
    });

    try {
      clsObserver.observe({ entryTypes: ['layout-shift'] });
    } catch (error) {
      console.warn('CLS Observer not supported:', error);
    }

    return () => {
      observer.disconnect();
      lcpObserver.disconnect();
      clsObserver.disconnect();
    };
  }, [trackWebVitals]);

  // 监控组件渲染性能
  const trackComponentRenderTime = useCallback(() => {
    if (!trackComponentRender) return;

    const renderEndTime = Date.now();
    const renderTime = renderEndTime - renderStartTime.current;

    if (renderTime > 16) { // 超过一帧的时间
      errorMonitor.capturePerformance({
        url: window.location.href,
        loadTime: renderTime,
        domContentLoaded: 0,
        timestamp: Date.now(),
        userAgent: navigator.userAgent,
        sessionId: errorMonitor.getSessionId()
      });
    }

    renderStartTime.current = Date.now();
  }, [trackComponentRender, componentName]);

  // 页面加载时监控
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleLoad = () => {
      setTimeout(() => {
        trackPageLoadMetrics();
      }, 0);
    };

    if (document.readyState === 'complete') {
      handleLoad();
    } else {
      window.addEventListener('load', handleLoad);
      return () => window.removeEventListener('load', handleLoad);
    }
  }, [trackPageLoadMetrics]);

  // Web Vitals监控
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const cleanup = trackWebVitalsMetrics();
    return cleanup;
  }, [trackWebVitalsMetrics]);

  // 组件渲染监控
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    trackComponentRenderTime();
  });

  // 手动记录性能指标
  const recordMetric = useCallback((name: string, value: number, unit: string = 'ms') => {
    errorMonitor.capturePerformance({
      url: window.location.href,
      loadTime: value,
      domContentLoaded: 0,
      timestamp: Date.now(),
      userAgent: navigator.userAgent,
      sessionId: errorMonitor.getSessionId()
    });
  }, []);

  // 测量函数执行时间
  const measureFunction = useCallback(<T extends any[], R>(
    fn: (...args: T) => R,
    name?: string
  ) => {
    return (...args: T): R => {
      const start = performance.now();
      const result = fn(...args);
      const end = performance.now();
      const duration = end - start;

      if (duration > 1) { // 只记录超过1ms的操作
        recordMetric(name || fn.name || 'anonymous', duration);
      }

      return result;
    };
  }, [recordMetric]);

  // 测量异步函数执行时间
  const measureAsyncFunction = useCallback(<T extends any[], R>(
    fn: (...args: T) => Promise<R>,
    name?: string
  ) => {
    return async (...args: T): Promise<R> => {
      const start = performance.now();
      const result = await fn(...args);
      const end = performance.now();
      const duration = end - start;

      if (duration > 1) {
        recordMetric(name || fn.name || 'async-anonymous', duration);
      }

      return result;
    };
  }, [recordMetric]);

  // 开始性能标记
  const startMark = useCallback((name: string) => {
    if (typeof performance !== 'undefined' && performance.mark) {
      performance.mark(`${name}-start`);
    }
  }, []);

  // 结束性能标记并测量
  const endMark = useCallback((name: string) => {
    if (typeof performance !== 'undefined' && performance.mark && performance.measure) {
      performance.mark(`${name}-end`);
      performance.measure(name, `${name}-start`, `${name}-end`);
      
      const measure = performance.getEntriesByName(name, 'measure')[0];
      if (measure) {
        recordMetric(name, measure.duration);
      }
    }
  }, [recordMetric]);

  return {
    recordMetric,
    measureFunction,
    measureAsyncFunction,
    startMark,
    endMark
  };
};

// HOC for automatic performance monitoring
export const withPerformanceMonitor = <P extends object>(
  Component: React.ComponentType<P>,
  componentName?: string
) => {
  return React.forwardRef<any, P>((props, ref) => {
    usePerformanceMonitor({ 
      componentName: componentName || Component.displayName || Component.name,
      trackComponentRender: true 
    });
    
    return React.createElement(Component, { ...props, ref });
  });
};