import React, { useState, useRef, useEffect } from 'react';
import { useImageLoader } from '../hooks/useImageLoader';
import { ImageLoadingIndicator } from './ImageLoadingIndicator';
import { IMAGE_CONFIG } from '../config/imageConfig';
import { checkWebPSupport, generateImageUrls, generateSrcSet } from '../utils/imageUtils';

export interface EnhancedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  // 图片优化选项
  formats?: ('avif' | 'webp' | 'jpg' | 'png')[];
  quality?: number;
  responsiveSizes?: number[];
  // 懒加载选项
  lazy?: boolean;
  priority?: boolean;
  preload?: boolean;
  // 占位符选项
  placeholder?: string | 'blur' | 'color' | 'none';
  blurDataURL?: string;
  // 加载状态选项
  showLoadingIndicator?: boolean;
  showProgress?: boolean;
  showRetryButton?: boolean;
  loadingIndicatorVariant?: 'overlay' | 'inline' | 'minimal';
  // 错误处理
  fallbackSrc?: string;
  maxRetries?: number;
  retryDelay?: number;
  // 回调函数
  onLoadStart?: () => void;
  onLoadComplete?: (event: Event) => void;
  onLoadError?: (error: Error) => void;
  onRetry?: () => void;
  // 样式选项
  containerClassName?: string;
  imageClassName?: string;
}

export const EnhancedImage: React.FC<EnhancedImageProps> = ({
  src,
  alt,
  formats = ['avif', 'webp', 'jpg'],
  quality = 80,
  responsiveSizes,
  lazy = true,
  priority = false,
  preload = false,
  placeholder = 'blur',
  blurDataURL,
  showLoadingIndicator = true,
  showProgress = true,
  showRetryButton = true,
  loadingIndicatorVariant = 'overlay',
  fallbackSrc,
  maxRetries = IMAGE_CONFIG.fallback.retryCount,
  retryDelay = IMAGE_CONFIG.fallback.retryDelay,
  onLoadStart,
  onLoadComplete,
  onLoadError,
  onRetry,
  containerClassName = '',
  imageClassName = '',
  className,
  style,
  ...imgProps
}) => {
  const [isInView, setIsInView] = useState(!lazy || priority);
  const [webpSupported, setWebpSupported] = useState<boolean | null>(null);
  const [optimizedSrc, setOptimizedSrc] = useState<string>(src);
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  // 图片加载状态管理
  const imageLoader = useImageLoader({
    src: optimizedSrc,
    fallbackSrc: fallbackSrc || IMAGE_CONFIG.fallback.error,
    maxRetries,
    retryDelay,
    onLoad: (event) => {
      onLoadComplete?.(event);
    },
    onError: (error) => {
      onLoadError?.(error);
    },
    onProgress: (progress) => {
      // 进度回调可以在这里处理
    },
  });

  // 检测 WebP 支持
  useEffect(() => {
    checkWebPSupport().then(setWebpSupported);
  }, []);

  // 生成优化后的图片 URL
  useEffect(() => {
    if (webpSupported === null) return;

    const basePath = src.substring(0, src.lastIndexOf('.'));
    const filename = src.split('/').pop() || '';
    const imageUrls = generateImageUrls(basePath, filename);

    // 根据支持的格式选择最佳图片
    let bestSrc = src;
    for (const format of formats) {
      if (format === 'avif' && imageUrls.avif) {
        bestSrc = imageUrls.avif;
        break;
      }
      if (format === 'webp' && webpSupported && imageUrls.webp) {
        bestSrc = imageUrls.webp;
        break;
      }
    }

    setOptimizedSrc(bestSrc);
  }, [src, formats, webpSupported]);

  // 懒加载观察器
  useEffect(() => {
    if (!lazy || priority || isInView) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true);
            observer.disconnect();
          }
        });
      },
      {
        rootMargin: IMAGE_CONFIG.lazyLoading.rootMargin,
        threshold: IMAGE_CONFIG.lazyLoading.threshold,
      }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, [lazy, priority, isInView]);

  // 预加载
  useEffect(() => {
    if (preload && isInView) {
      imageLoader.preload();
    }
  }, [preload, isInView, imageLoader]);

  // 开始加载
  useEffect(() => {
    if (isInView && !imageLoader.loaded && !imageLoader.loading) {
      onLoadStart?.();
      imageLoader.loadImage();
    }
  }, [isInView, imageLoader, onLoadStart]);

  // 获取占位符
  const getPlaceholder = (): string => {
    if (placeholder === 'none') return '';
    if (typeof placeholder === 'string' && placeholder !== 'blur' && placeholder !== 'color') {
      return placeholder;
    }
    if (placeholder === 'blur' && blurDataURL) {
      return blurDataURL;
    }
    if (placeholder === 'blur') {
      return IMAGE_CONFIG.placeholder.blur;
    }
    if (placeholder === 'color') {
      return IMAGE_CONFIG.placeholder.color;
    }
    return IMAGE_CONFIG.placeholder.blur;
  };

  // 重试处理
  const handleRetry = () => {
    onRetry?.();
    imageLoader.retryLoad();
  };

  // 生成 srcSet
  const srcSet = responsiveSizes ? generateSrcSet(
    optimizedSrc.substring(0, optimizedSrc.lastIndexOf('.')),
    optimizedSrc.split('/').pop()?.replace(/\.[^.]+$/, '') || '',
    responsiveSizes
  ) : undefined;

  const placeholderSrc = getPlaceholder();
  const shouldShowPlaceholder = !imageLoader.loaded && placeholderSrc;
  const shouldShowIndicator = showLoadingIndicator && (imageLoader.loading || imageLoader.error);

  return (
    <div 
      ref={containerRef}
      className={`relative overflow-hidden ${containerClassName}`}
      style={style}
    >
      {/* 占位符图片 */}
      {shouldShowPlaceholder && (
        <img
          src={placeholderSrc}
          alt=""
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${
            imageLoader.loaded ? 'opacity-0' : 'opacity-100'
          } ${imageClassName}`}
          aria-hidden="true"
        />
      )}

      {/* 主图片 */}
      {isInView && (
        <img
          ref={imgRef}
          src={imageLoader.currentSrc}
          srcSet={srcSet}
          alt={alt}
          className={`w-full h-full object-cover transition-opacity duration-300 ${
            imageLoader.loaded ? 'opacity-100' : 'opacity-0'
          } ${imageClassName} ${className || ''}`}
          loading={lazy && !priority ? 'lazy' : 'eager'}
          {...imgProps}
        />
      )}

      {/* 加载状态指示器 */}
      {shouldShowIndicator && (
        <ImageLoadingIndicator
          state={imageLoader}
          onRetry={showRetryButton ? handleRetry : undefined}
          variant={loadingIndicatorVariant}
          showProgress={showProgress}
          showRetryButton={showRetryButton}
        />
      )}
    </div>
  );
};

export default EnhancedImage;