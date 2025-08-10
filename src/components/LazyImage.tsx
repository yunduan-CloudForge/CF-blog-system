import React, { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface LazyImageProps {
  src: string;
  alt: string;
  className?: string;
  placeholder?: string;
  fallback?: string;
  webpSrc?: string;
  srcSet?: string;
  sizes?: string;
  loading?: 'lazy' | 'eager';
  onLoad?: () => void;
  onError?: () => void;
  threshold?: number;
  rootMargin?: string;
}

export const LazyImage: React.FC<LazyImageProps> = ({
  src,
  alt,
  className,
  placeholder = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD1cIjEwMFwiIGhlaWdodD1cIjEwMFwiIHZpZXdCb3g9XCIwIDAgMTAwIDEwMFwiIGZpbGw9XCJub25lXCIgeG1sbnM9XCJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Z1wiPjxyZWN0IHdpZHRoPVwiMTAwXCIgaGVpZ2h0PVwiMTAwXCIgZmlsbD1cIiNmM2Y0ZjZcIi8+PC9zdmc+',
  fallback,
  webpSrc,
  srcSet,
  sizes,
  loading = 'lazy',
  onLoad,
  onError,
  threshold = 0.1,
  rootMargin = '50px'
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [currentSrc, setCurrentSrc] = useState(placeholder);
  const imgRef = useRef<HTMLImageElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // 检查WebP支持
  const [supportsWebP, setSupportsWebP] = useState<boolean | null>(null);

  useEffect(() => {
    const checkWebPSupport = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 1;
      canvas.height = 1;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const dataURL = canvas.toDataURL('image/webp');
        setSupportsWebP(dataURL.indexOf('data:image/webp') === 0);
      } else {
        setSupportsWebP(false);
      }
    };

    checkWebPSupport();
  }, []);

  useEffect(() => {
    if (loading === 'eager') {
      setIsInView(true);
      return;
    }

    if (!imgRef.current) return;

    observerRef.current = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observerRef.current?.disconnect();
        }
      },
      {
        threshold,
        rootMargin
      }
    );

    observerRef.current.observe(imgRef.current);

    return () => {
      observerRef.current?.disconnect();
    };
  }, [threshold, rootMargin, loading]);

  useEffect(() => {
    if (isInView && !isLoaded && !hasError) {
      // 确定要加载的图片源
      let imageSrc = src;
      if (webpSrc && supportsWebP) {
        imageSrc = webpSrc;
      }

      const img = new Image();
      
      img.onload = () => {
        setCurrentSrc(imageSrc);
        setIsLoaded(true);
        onLoad?.();
      };

      img.onerror = () => {
        if (fallback) {
          setCurrentSrc(fallback);
          setIsLoaded(true);
        } else {
          setHasError(true);
        }
        onError?.();
      };

      // 设置srcset以支持响应式图片
      if (srcSet) {
        img.srcset = srcSet;
      }
      if (sizes) {
        img.sizes = sizes;
      }
      
      img.src = imageSrc;
    }
  }, [isInView, src, webpSrc, supportsWebP, fallback, srcSet, sizes, isLoaded, hasError, onLoad, onError]);

  if (hasError && !fallback) {
    return (
      <div 
        className={cn(
          'flex items-center justify-center bg-gray-100 text-gray-400',
          className
        )}
        role="img"
        aria-label={alt}
      >
        <svg 
          className="w-8 h-8" 
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
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden">
      <img
        ref={imgRef}
        src={currentSrc}
        alt={alt}
        className={cn(
          'transition-opacity duration-300',
          isLoaded ? 'opacity-100' : 'opacity-0',
          className
        )}
        srcSet={isLoaded && srcSet ? srcSet : undefined}
        sizes={isLoaded && sizes ? sizes : undefined}
        loading={loading}
        onLoad={() => {
          if (currentSrc !== placeholder) {
            setIsLoaded(true);
            onLoad?.();
          }
        }}
        onError={() => {
          if (fallback && currentSrc !== fallback) {
            setCurrentSrc(fallback);
          } else {
            setHasError(true);
          }
          onError?.();
        }}
      />
      
      {/* 加载状态指示器 */}
      {!isLoaded && !hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      )}
    </div>
  );
};

export default LazyImage;