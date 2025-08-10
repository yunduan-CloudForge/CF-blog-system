import { useState, useEffect, useCallback, useRef } from 'react';
import { IMAGE_CONFIG, logImagePerformance } from '../config/imageConfig';

export interface ImageLoadState {
  loading: boolean;
  loaded: boolean;
  error: boolean;
  progress: number;
  retryCount: number;
}

export interface UseImageLoaderOptions {
  src: string;
  fallbackSrc?: string;
  maxRetries?: number;
  retryDelay?: number;
  onLoad?: (event: Event) => void;
  onError?: (error: Error) => void;
  onProgress?: (progress: number) => void;
  enablePerformanceLogging?: boolean;
}

export const useImageLoader = (options: UseImageLoaderOptions) => {
  const {
    src,
    fallbackSrc = IMAGE_CONFIG.fallback.error,
    maxRetries = IMAGE_CONFIG.fallback.retryCount,
    retryDelay = IMAGE_CONFIG.fallback.retryDelay,
    onLoad,
    onError,
    onProgress,
    enablePerformanceLogging = IMAGE_CONFIG.performance.enabled,
  } = options;

  const [state, setState] = useState<ImageLoadState>({
    loading: false,
    loaded: false,
    error: false,
    progress: 0,
    retryCount: 0,
  });

  const [currentSrc, setCurrentSrc] = useState<string>(src);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const startTimeRef = useRef<number>(0);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 重置状态
  const resetState = useCallback(() => {
    setState({
      loading: false,
      loaded: false,
      error: false,
      progress: 0,
      retryCount: 0,
    });
  }, []);

  // 重试加载
  const retryLoad = useCallback(() => {
    if (state.retryCount >= maxRetries) {
      setState(prev => ({ ...prev, loading: false, error: true }));
      setCurrentSrc(fallbackSrc);
      return;
    }

    setState(prev => ({ 
      ...prev, 
      retryCount: prev.retryCount + 1,
      loading: true,
      error: false 
    }));

    retryTimeoutRef.current = setTimeout(() => {
      // 直接在这里执行加载逻辑，避免循环依赖
      if (!src) return;

      // 清理之前的超时
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }

      setState(prev => ({ ...prev, loading: true, error: false }));
      startTimeRef.current = performance.now();

      const img = new Image();
      imageRef.current = img;

      // 进度模拟
      let progress = 0;
      const progressInterval = setInterval(() => {
        progress += Math.random() * 30;
        if (progress > 90) {
          clearInterval(progressInterval);
          return;
        }
        setState(prev => ({ ...prev, progress }));
        onProgress?.(progress);
      }, 100);

      img.onload = (event) => {
        clearInterval(progressInterval);
        const loadTime = performance.now() - startTimeRef.current;
        
        setState(prev => ({ 
          ...prev, 
          loading: false, 
          loaded: true, 
          error: false,
          progress: 100 
        }));

        if (enablePerformanceLogging) {
          logImagePerformance(src, loadTime);
        }

        onLoad?.(event);
        onProgress?.(100);
      };

      img.onerror = () => {
        clearInterval(progressInterval);
        const error = new Error(`Failed to load image: ${src}`);
        
        setState(prev => ({ 
          ...prev, 
          loading: false, 
          error: true,
          progress: 0 
        }));
        setCurrentSrc(fallbackSrc);
        onError?.(error);
      };

      img.src = currentSrc;
    }, retryDelay * (state.retryCount + 1));
  }, [state.retryCount, maxRetries, fallbackSrc, retryDelay, src, currentSrc, onLoad, onError, onProgress, enablePerformanceLogging]);

  // 加载图片
  const loadImage = useCallback(() => {
    if (!src) return;

    // 清理之前的超时
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }

    setState(prev => ({ ...prev, loading: true, error: false }));
    startTimeRef.current = performance.now();

    const img = new Image();
    imageRef.current = img;

    // 进度模拟（真实进度需要服务器支持）
    let progress = 0;
    const progressInterval = setInterval(() => {
      progress += Math.random() * 30;
      if (progress > 90) {
        clearInterval(progressInterval);
        return;
      }
      setState(prev => ({ ...prev, progress }));
      onProgress?.(progress);
    }, 100);

    img.onload = (event) => {
      clearInterval(progressInterval);
      const loadTime = performance.now() - startTimeRef.current;
      
      setState(prev => ({ 
        ...prev, 
        loading: false, 
        loaded: true, 
        error: false,
        progress: 100 
      }));

      // 性能日志
      if (enablePerformanceLogging) {
        logImagePerformance(src, loadTime);
      }

      onLoad?.(event);
      onProgress?.(100);
    };

    img.onerror = () => {
      clearInterval(progressInterval);
      const error = new Error(`Failed to load image: ${src}`);
      
      if (state.retryCount < maxRetries) {
        // 直接处理重试，避免循环依赖
        setState(prev => ({ 
          ...prev, 
          retryCount: prev.retryCount + 1,
          loading: true,
          error: false 
        }));

        retryTimeoutRef.current = setTimeout(() => {
          // 重新调用加载逻辑
          if (!src) return;

          setState(prev => ({ ...prev, loading: true, error: false }));
          startTimeRef.current = performance.now();

          const retryImg = new Image();
          imageRef.current = retryImg;

          let retryProgress = 0;
          const retryProgressInterval = setInterval(() => {
            retryProgress += Math.random() * 30;
            if (retryProgress > 90) {
              clearInterval(retryProgressInterval);
              return;
            }
            setState(prev => ({ ...prev, progress: retryProgress }));
            onProgress?.(retryProgress);
          }, 100);

          retryImg.onload = (event) => {
            clearInterval(retryProgressInterval);
            const loadTime = performance.now() - startTimeRef.current;
            
            setState(prev => ({ 
              ...prev, 
              loading: false, 
              loaded: true, 
              error: false,
              progress: 100 
            }));

            if (enablePerformanceLogging) {
              logImagePerformance(src, loadTime);
            }

            onLoad?.(event);
            onProgress?.(100);
          };

          retryImg.onerror = () => {
            clearInterval(retryProgressInterval);
            const retryError = new Error(`Failed to load image: ${src}`);
            
            setState(prev => ({ 
              ...prev, 
              loading: false, 
              error: true,
              progress: 0 
            }));
            setCurrentSrc(fallbackSrc);
            onError?.(retryError);
          };

          retryImg.src = currentSrc;
        }, retryDelay * (state.retryCount + 1));
      } else {
        setState(prev => ({ 
          ...prev, 
          loading: false, 
          error: true,
          progress: 0 
        }));
        setCurrentSrc(fallbackSrc);
        onError?.(error);
      }
    };

    img.src = currentSrc;
  }, [src, currentSrc, maxRetries, fallbackSrc, onLoad, onError, onProgress, enablePerformanceLogging, retryDelay]);

  // 手动重试
  const manualRetry = useCallback(() => {
    resetState();
    setCurrentSrc(src);
    
    // 直接执行加载逻辑
    if (!src) return;

    setState(prev => ({ ...prev, loading: true, error: false }));
    startTimeRef.current = performance.now();

    const img = new Image();
    imageRef.current = img;

    let progress = 0;
    const progressInterval = setInterval(() => {
      progress += Math.random() * 30;
      if (progress > 90) {
        clearInterval(progressInterval);
        return;
      }
      setState(prev => ({ ...prev, progress }));
      onProgress?.(progress);
    }, 100);

    img.onload = (event) => {
      clearInterval(progressInterval);
      const loadTime = performance.now() - startTimeRef.current;
      
      setState(prev => ({ 
        ...prev, 
        loading: false, 
        loaded: true, 
        error: false,
        progress: 100 
      }));

      if (enablePerformanceLogging) {
        logImagePerformance(src, loadTime);
      }

      onLoad?.(event);
      onProgress?.(100);
    };

    img.onerror = () => {
      clearInterval(progressInterval);
      const error = new Error(`Failed to load image: ${src}`);
      
      setState(prev => ({ 
        ...prev, 
        loading: false, 
        error: true,
        progress: 0 
      }));
      setCurrentSrc(fallbackSrc);
      onError?.(error);
    };

    img.src = src;
  }, [src, resetState, onLoad, onError, onProgress, enablePerformanceLogging, fallbackSrc]);

  // 预加载图片
  const preload = useCallback(() => {
    if (state.loaded || state.loading) return;
    
    // 直接执行加载逻辑
    if (!src) return;

    setState(prev => ({ ...prev, loading: true, error: false }));
    startTimeRef.current = performance.now();

    const img = new Image();
    imageRef.current = img;

    let progress = 0;
    const progressInterval = setInterval(() => {
      progress += Math.random() * 30;
      if (progress > 90) {
        clearInterval(progressInterval);
        return;
      }
      setState(prev => ({ ...prev, progress }));
      onProgress?.(progress);
    }, 100);

    img.onload = (event) => {
      clearInterval(progressInterval);
      const loadTime = performance.now() - startTimeRef.current;
      
      setState(prev => ({ 
        ...prev, 
        loading: false, 
        loaded: true, 
        error: false,
        progress: 100 
      }));

      if (enablePerformanceLogging) {
        logImagePerformance(src, loadTime);
      }

      onLoad?.(event);
      onProgress?.(100);
    };

    img.onerror = () => {
      clearInterval(progressInterval);
      const error = new Error(`Failed to load image: ${src}`);
      
      setState(prev => ({ 
        ...prev, 
        loading: false, 
        error: true,
        progress: 0 
      }));
      setCurrentSrc(fallbackSrc);
      onError?.(error);
    };

    img.src = currentSrc;
  }, [state.loaded, state.loading, src, currentSrc, onLoad, onError, onProgress, enablePerformanceLogging, fallbackSrc]);

  // 取消加载
  const cancel = useCallback(() => {
    if (imageRef.current) {
      imageRef.current.onload = null;
      imageRef.current.onerror = null;
      imageRef.current = null;
    }
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
    resetState();
  }, [resetState]);

  // 当 src 改变时重新加载
  useEffect(() => {
    if (src !== currentSrc) {
      cancel();
      setCurrentSrc(src);
    }
  }, [src, currentSrc, cancel]);

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      cancel();
    };
  }, [cancel]);

  return {
    ...state,
    currentSrc,
    loadImage,
    retryLoad: manualRetry,
    preload,
    cancel,
    resetState,
  };
};

export default useImageLoader;