import { useCallback, useRef } from 'react';
import { errorMonitor } from '../utils/errorMonitor';

interface ApiMetrics {
  url: string;
  method: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  status?: number;
  success: boolean;
  error?: string;
  requestSize?: number;
  responseSize?: number;
}

interface UseApiMonitoringOptions {
  enablePerformanceTracking?: boolean;
  enableErrorTracking?: boolean;
  slowRequestThreshold?: number; // 慢请求阈值（毫秒）
}

export function useApiMonitoring(options: UseApiMonitoringOptions = {}) {
  const {
    enablePerformanceTracking = true,
    enableErrorTracking = true,
    slowRequestThreshold = 3000
  } = options;

  const activeRequests = useRef<Map<string, ApiMetrics>>(new Map());

  // 开始监控API请求
  const startApiMonitoring = useCallback((requestId: string, url: string, method: string, requestData?: any) => {
    if (!enablePerformanceTracking && !enableErrorTracking) return;

    const metrics: ApiMetrics = {
      url,
      method: method.toUpperCase(),
      startTime: performance.now(),
      success: false,
      requestSize: requestData ? JSON.stringify(requestData).length : 0
    };

    activeRequests.current.set(requestId, metrics);

    // 记录API请求开始
    errorMonitor.captureUserAction({
      action: 'api_request_start',
      url: window.location.href,
      timestamp: Date.now(),
      context: {
        apiUrl: url,
        method,
        requestId
      }
    });
  }, [enablePerformanceTracking, enableErrorTracking]);

  // 结束监控API请求（成功）
  const endApiMonitoring = useCallback((requestId: string, status: number, responseData?: any) => {
    const metrics = activeRequests.current.get(requestId);
    if (!metrics) return;

    const endTime = performance.now();
    const duration = endTime - metrics.startTime;

    const updatedMetrics: ApiMetrics = {
      ...metrics,
      endTime,
      duration,
      status,
      success: status >= 200 && status < 300,
      responseSize: responseData ? JSON.stringify(responseData).length : 0
    };

    // 记录性能数据
    if (enablePerformanceTracking) {
      errorMonitor.capturePerformance({
        url: window.location.href,
        loadTime: duration,
        domContentLoaded: 0,
        timestamp: Date.now(),
        userAgent: navigator.userAgent,
        sessionId: errorMonitor.getSessionId()
      });

      // 记录API请求完成
      errorMonitor.captureUserAction({
        action: 'api_request_complete',
        url: window.location.href,
        timestamp: Date.now(),
        context: {
          apiUrl: metrics.url,
          method: metrics.method,
          duration,
          status,
          success: updatedMetrics.success,
          requestId,
          requestSize: metrics.requestSize,
          responseSize: updatedMetrics.responseSize
        }
      });

      // 检查是否为慢请求
      if (duration > slowRequestThreshold) {
        errorMonitor.captureCustomError(
          `Slow API Request: ${metrics.method} ${metrics.url}`,
          {
            duration,
            threshold: slowRequestThreshold,
            status,
            requestId,
            apiUrl: metrics.url,
            method: metrics.method
          },
          'medium'
        );
      }
    }

    // 如果请求失败，记录错误
    if (enableErrorTracking && !updatedMetrics.success) {
      errorMonitor.captureCustomError(
        `API Request Failed: ${metrics.method} ${metrics.url}`,
        {
          status,
          duration,
          requestId,
          apiUrl: metrics.url,
          method: metrics.method,
          requestSize: metrics.requestSize,
          responseSize: updatedMetrics.responseSize
        },
        status >= 500 ? 'high' : 'medium'
      );
    }

    activeRequests.current.delete(requestId);
  }, [enablePerformanceTracking, enableErrorTracking, slowRequestThreshold]);

  // 记录API请求错误
  const recordApiError = useCallback((requestId: string, error: Error | string) => {
    const metrics = activeRequests.current.get(requestId);
    if (!metrics || !enableErrorTracking) return;

    const endTime = performance.now();
    const duration = endTime - metrics.startTime;
    const errorMessage = typeof error === 'string' ? error : error.message;
    const errorStack = typeof error === 'object' ? error.stack : undefined;

    // 记录API错误
    errorMonitor.captureCustomError(
      `API Request Error: ${metrics.method} ${metrics.url}`,
      {
        error: errorMessage,
        stack: errorStack,
        duration,
        requestId,
        apiUrl: metrics.url,
        method: metrics.method,
        requestSize: metrics.requestSize
      },
      'high'
    );

    // 记录用户行为
    errorMonitor.captureUserAction({
      action: 'api_request_error',
      url: window.location.href,
      timestamp: Date.now(),
      context: {
        apiUrl: metrics.url,
        method: metrics.method,
        error: errorMessage,
        duration,
        requestId
      }
    });

    activeRequests.current.delete(requestId);
  }, [enableErrorTracking]);

  // 生成请求ID
  const generateRequestId = useCallback(() => {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  // 获取当前活跃请求数量
  const getActiveRequestsCount = useCallback(() => {
    return activeRequests.current.size;
  }, []);

  // 清理超时的请求
  const cleanupTimeoutRequests = useCallback((timeoutMs: number = 30000) => {
    const now = performance.now();
    const timeoutRequests: string[] = [];

    activeRequests.current.forEach((metrics, requestId) => {
      if (now - metrics.startTime > timeoutMs) {
        timeoutRequests.push(requestId);
      }
    });

    timeoutRequests.forEach(requestId => {
      const metrics = activeRequests.current.get(requestId);
      if (metrics) {
        errorMonitor.captureCustomError(
          `API Request Timeout: ${metrics.method} ${metrics.url}`,
          {
            duration: now - metrics.startTime,
            timeout: timeoutMs,
            requestId,
            apiUrl: metrics.url,
            method: metrics.method
          },
          'high'
        );
        activeRequests.current.delete(requestId);
      }
    });

    return timeoutRequests.length;
  }, []);

  return {
    startApiMonitoring,
    endApiMonitoring,
    recordApiError,
    generateRequestId,
    getActiveRequestsCount,
    cleanupTimeoutRequests
  };
}

// 装饰器函数，用于自动监控API调用
export function withApiMonitoring<T extends (...args: any[]) => Promise<any>>(
  apiFunction: T,
  options: UseApiMonitoringOptions & { url: string; method: string } = { url: '', method: 'GET' }
): T {
  return (async (...args: Parameters<T>) => {
    const { url, method, ...monitoringOptions } = options;
    const monitoring = useApiMonitoring(monitoringOptions);
    const requestId = monitoring.generateRequestId();

    try {
      monitoring.startApiMonitoring(requestId, url, method, args[0]);
      const result = await apiFunction(...args);
      monitoring.endApiMonitoring(requestId, 200, result);
      return result;
    } catch (error) {
      monitoring.recordApiError(requestId, error as Error);
      throw error;
    }
  }) as T;
}