import React, { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { 
  checkWebPSupport, 
  generateImageUrls, 
  generateSrcSet, 
  generateWebPSrcSet,
  generatePlaceholder,
  createImageObserver
} from '@/utils/imageUtils';

interface OptimizedImageProps {
  src: string;
  alt: string;
  className?: string;
  width?: number;
  height?: number;
  placeholder?: string;
  fallback?: string;
  basePath?: string;
  sizes?: string;
  responsiveSizes?: number[];
  loading?: 'lazy' | 'eager';
  priority?: boolean;
  onLoad?: () => void;
  onError?: () => void;
  threshold?: number;
  rootMargin?: string;
  enableWebP?: boolean;
  enableAvif?: boolean;
  quality?: number;
}

export const OptimizedImage: React.FC<OptimizedImageProps> = ({
  src,
  alt,
  className,
  width,
  height,
  placeholder,
  fallback,
  basePath = '/images',
  sizes = '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw',
  responsiveSizes = [400, 800, 1200, 1600],
  loading = 'lazy',
  priority = false,
  onLoad,
  onError,
  threshold = 0.1,
  rootMargin = '50px',
  enableWebP = true,
  enableAvif = false,
  quality = 0.8
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(priority || loading === 'eager');
  const [hasError, setHasError] = useState(false);
  const [supportsWebP, setSupportsWebP] = useState<boolean | null>(null);
  const [supportsAvif, setSupportsAvif] = useState<boolean | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // 检查浏览器格式支持
  useEffect(() => {
    const checkFormats = async () => {
      if (enableWebP) {
        const webpSupport = await checkWebPSupport();
        setSupportsWebP(webpSupport);
      }
      
      if (enableAvif) {
        // 简单的AVIF支持检测
        const avifSupport = await new Promise<boolean>((resolve) => {
          const avif = new Image();
          avif.onload = () => resolve(true);
          avif.onerror = () => resolve(false);
          avif.src = 'data:image/avif;base64,AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUIAAADybWV0YQAAAAAAAAAoaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAGxpYmF2aWYAAAAADnBpdG0AAAAAAAEAAAAeaWxvYwAAAABEAAABAAEAAAABAAABGgAAAB0AAAAoaWluZgAAAAAAAQAAABppbmZlAgAAAAABAABhdjAxQ29sb3IAAAAAamlwcnAAAABLaXBjbwAAABRpc3BlAAAAAAAAAAIAAAACAAAAEHBpeGkAAAAAAwgICAAAAAxhdjFDgQ0MAAAAABNjb2xybmNseAACAAIAAYAAAAAXaXBtYQAAAAAAAAABAAEEAQKDBAAAACVtZGF0EgAKCBgABogQEAwgMg8f8D///8WfhwB8+ErK42A=';
        });
        setSupportsAvif(avifSupport);
      }
    };

    checkFormats();
  }, [enableWebP, enableAvif]);

  // 设置Intersection Observer
  useEffect(() => {
    if (priority || loading === 'eager' || isInView) return;

    if (!imgRef.current) return;

    observerRef.current = createImageObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observerRef.current?.disconnect();
        }
      },
      { threshold, rootMargin }
    );

    observerRef.current.observe(imgRef.current);

    return () => {
      observerRef.current?.disconnect();
    };
  }, [threshold, rootMargin, loading, priority, isInView]);

  // 生成图片源
  const getImageSources = () => {
    if (!isInView) return { src: placeholder || generatePlaceholder(width || 400, height || 300) };

    const filename = src.split('/').pop() || src;
    const imageUrls = generateImageUrls(basePath, filename);
    
    // 确定最佳格式
    let bestSrc = imageUrls.original;
    let bestSrcSet = generateSrcSet(basePath, filename, responsiveSizes);
    
    if (enableAvif && supportsAvif) {
      bestSrc = imageUrls.avif;
      bestSrcSet = generateSrcSet(basePath, filename.replace(/\.[^.]+$/, '.avif'), responsiveSizes);
    } else if (enableWebP && supportsWebP) {
      bestSrc = imageUrls.webp;
      bestSrcSet = generateWebPSrcSet(basePath, filename, responsiveSizes);
    }

    return {
      src: bestSrc,
      srcSet: bestSrcSet,
      fallbackSrc: fallback || imageUrls.fallback
    };
  };

  const { src: imageSrc, srcSet, fallbackSrc } = getImageSources();

  const handleLoad = () => {
    setIsLoaded(true);
    onLoad?.();
  };

  const handleError = () => {
    if (fallbackSrc && imageSrc !== fallbackSrc) {
      // 尝试加载fallback图片
      const img = imgRef.current;
      if (img) {
        img.src = fallbackSrc;
        return;
      }
    }
    setHasError(true);
    onError?.();
  };

  if (hasError) {
    return (
      <div 
        className={cn(
          'flex items-center justify-center bg-gray-100 text-gray-400 border border-gray-200 rounded',
          className
        )}
        style={{ width, height }}
        role="img"
        aria-label={alt}
      >
        <div className="text-center">
          <svg 
            className="w-8 h-8 mx-auto mb-2" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" 
            />
          </svg>
          <p className="text-xs">图片加载失败</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden">
      {/* 使用picture元素支持多种格式 */}
      <picture>
        {/* AVIF格式 */}
        {enableAvif && supportsAvif && isInView && (
          <source 
            srcSet={generateSrcSet(basePath, src.split('/').pop()?.replace(/\.[^.]+$/, '.avif') || '', responsiveSizes)}
            sizes={sizes}
            type="image/avif"
          />
        )}
        
        {/* WebP格式 */}
        {enableWebP && supportsWebP && isInView && (
          <source 
            srcSet={generateWebPSrcSet(basePath, src.split('/').pop() || '', responsiveSizes)}
            sizes={sizes}
            type="image/webp"
          />
        )}
        
        {/* 原始格式 */}
        <img
          ref={imgRef}
          src={imageSrc}
          alt={alt}
          className={cn(
            'transition-all duration-300 ease-in-out',
            isLoaded ? 'opacity-100 scale-100' : 'opacity-0 scale-105',
            className
          )}
          srcSet={isInView ? srcSet : undefined}
          sizes={isInView ? sizes : undefined}
          width={width}
          height={height}
          loading={loading}
          onLoad={handleLoad}
          onError={handleError}
          decoding="async"
        />
      </picture>
      
      {/* 加载状态指示器 */}
      {!isLoaded && !hasError && isInView && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
          <div className="flex flex-col items-center space-y-2">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-600 border-t-transparent"></div>
            <p className="text-xs text-gray-500">加载中...</p>
          </div>
        </div>
      )}
      
      {/* 模糊占位符效果 */}
      {!isLoaded && !hasError && (
        <div 
          className="absolute inset-0 bg-gray-200 animate-pulse"
          style={{
            backgroundImage: placeholder ? `url(${placeholder})` : undefined,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: 'blur(5px)'
          }}
        />
      )}
    </div>
  );
};

export default OptimizedImage;