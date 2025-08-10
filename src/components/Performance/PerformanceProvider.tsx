import React, { createContext, useContext, useEffect, ReactNode } from 'react';
import { PerformanceMonitor } from '@/utils/performance';
import { useNetworkStatus, useMemoryMonitor, usePageVisibility } from '@/hooks/usePerformance';

interface PerformanceContextType {
  monitor: PerformanceMonitor;
  networkInfo: Record<string, any>;
  memoryInfo: Record<string, number>;
  isOnline: boolean;
  isPageVisible: boolean;
}

const PerformanceContext = createContext<PerformanceContextType | null>(null);

interface PerformanceProviderProps {
  children: ReactNode;
  enableMonitoring?: boolean;
  enableNetworkOptimization?: boolean;
}

export const PerformanceProvider: React.FC<PerformanceProviderProps> = ({
  children,
  enableMonitoring = true,
  enableNetworkOptimization = true
}) => {
  const monitor = PerformanceMonitor.getInstance();
  const { isOnline, networkInfo } = useNetworkStatus();
  const memoryInfo = useMemoryMonitor();
  const isPageVisible = usePageVisibility();

  useEffect(() => {
    if (!enableMonitoring) return;

    // 启动性能监控
    monitor.monitorLongTasks();

    // 监控页面加载性能
    const logPageMetrics = () => {
      const metrics = monitor.getPageLoadMetrics();
      console.log('Page Load Metrics:', metrics);
      
      // 如果页面加载时间过长，发出警告
      if (metrics.pageLoad > 3000) {
        console.warn('Page load time is too long:', metrics.pageLoad + 'ms');
      }
    };

    // 页面加载完成后记录指标
    if (document.readyState === 'complete') {
      logPageMetrics();
    } else {
      window.addEventListener('load', logPageMetrics);
    }

    // 监控内存使用
    const checkMemoryUsage = () => {
      const memory = monitor.getMemoryUsage();
      if (memory.usedJSHeapSize && memory.jsHeapSizeLimit) {
        const usagePercentage = (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100;
        if (usagePercentage > 80) {
          console.warn('High memory usage detected:', usagePercentage.toFixed(2) + '%');
        }
      }
    };

    const memoryCheckInterval = setInterval(checkMemoryUsage, 30000); // 每30秒检查一次

    return () => {
      window.removeEventListener('load', logPageMetrics);
      clearInterval(memoryCheckInterval);
      monitor.cleanup();
    };
  }, [enableMonitoring, monitor]);

  useEffect(() => {
    if (!enableNetworkOptimization) return;

    // 根据网络状况调整资源加载策略
    if (networkInfo.effectiveType) {
      const connectionType = networkInfo.effectiveType;
      
      // 慢速网络优化
      if (connectionType === 'slow-2g' || connectionType === '2g') {
        // 禁用自动播放视频
        document.querySelectorAll('video[autoplay]').forEach(video => {
          (video as HTMLVideoElement).autoplay = false;
        });
        
        // 延迟加载非关键图片
        document.querySelectorAll('img[loading="eager"]').forEach(img => {
          img.setAttribute('loading', 'lazy');
        });
        
        console.log('Slow network detected, optimizing resource loading');
      }
      
      // 数据节省模式
      if (networkInfo.saveData) {
        // 降低图片质量
        document.querySelectorAll('img').forEach(img => {
          const src = img.src;
          if (src && !src.includes('quality=')) {
            img.src = src + (src.includes('?') ? '&' : '?') + 'quality=60';
          }
        });
        
        console.log('Data saver mode detected, reducing image quality');
      }
    }
  }, [networkInfo, enableNetworkOptimization]);

  useEffect(() => {
    // 页面不可见时暂停非关键操作
    if (!isPageVisible) {
      // 暂停动画
      document.querySelectorAll('.animate-spin, .animate-pulse').forEach(el => {
        el.classList.add('animation-paused');
      });
      
      // 暂停视频播放
      document.querySelectorAll('video').forEach(video => {
        if (!video.paused) {
          video.pause();
          video.dataset.wasPlaying = 'true';
        }
      });
    } else {
      // 恢复动画
      document.querySelectorAll('.animation-paused').forEach(el => {
        el.classList.remove('animation-paused');
      });
      
      // 恢复视频播放
      document.querySelectorAll('video[data-was-playing="true"]').forEach(video => {
        (video as HTMLVideoElement).play();
        delete video.dataset.wasPlaying;
      });
    }
  }, [isPageVisible]);

  const contextValue: PerformanceContextType = {
    monitor,
    networkInfo,
    memoryInfo,
    isOnline,
    isPageVisible
  };

  return (
    <PerformanceContext.Provider value={contextValue}>
      {children}
      
      {/* 添加CSS样式用于动画暂停 */}
      <style>{`
        .animation-paused {
          animation-play-state: paused !important;
        }
      `}</style>
    </PerformanceContext.Provider>
  );
};

export const usePerformanceContext = (): PerformanceContextType => {
  const context = useContext(PerformanceContext);
  if (!context) {
    throw new Error('usePerformanceContext must be used within a PerformanceProvider');
  }
  return context;
};