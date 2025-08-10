/**
 * 图片优化配置
 * 统一管理项目中的图片处理参数
 */

export const IMAGE_CONFIG = {
  // 默认图片质量
  quality: {
    webp: 80,
    avif: 80,
    jpeg: 85,
    png: 90,
  },

  // 响应式图片尺寸
  responsiveSizes: {
    mobile: [320, 480],
    tablet: [640, 768],
    desktop: [1024, 1280, 1920],
    all: [320, 480, 640, 768, 1024, 1280, 1920],
  },

  // 图片格式优先级
  formatPriority: ['avif', 'webp', 'jpg', 'png'] as const,

  // 懒加载配置
  lazyLoading: {
    rootMargin: '50px',
    threshold: 0.1,
    // 预加载距离（像素）
    preloadDistance: 100,
  },

  // 占位符配置
  placeholder: {
    // 默认模糊占位符
    blur: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAIAAoDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkqGx0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyJckliyjqTzSlT54b6bk+h0R//2Q==',
    // 彩色占位符
    color: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjNmNGY2Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzlmYTJhNyIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkxvYWRpbmcuLi48L3RleHQ+PC9zdmc+',
  },

  // 图片路径配置
  paths: {
    // 静态资源路径
    static: '/images',
    // 用户上传路径
    uploads: '/uploads',
    // CDN 路径（如果使用）
    cdn: process.env.VITE_CDN_URL || '',
  },

  // 缓存配置
  cache: {
    // 浏览器缓存时间（秒）
    maxAge: 31536000, // 1年
    // Service Worker 缓存策略
    strategy: 'cache-first' as const,
  },

  // 错误处理
  fallback: {
    // 默认错误图片
    error: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjNmNGY2IiBzdHJva2U9IiNkMWQ1ZGIiIHN0cm9rZS13aWR0aD0iMiIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiM2YjcyODAiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5JbWFnZSBub3QgZm91bmQ8L3RleHQ+PC9zdmc+',
    // 重试次数
    retryCount: 3,
    // 重试延迟（毫秒）
    retryDelay: 1000,
  },

  // 性能监控
  performance: {
    // 是否启用性能监控
    enabled: process.env.NODE_ENV === 'development',
    // 监控指标
    metrics: {
      loadTime: true,
      fileSize: true,
      formatUsage: true,
    },
  },
} as const;

// 图片类型定义
export type ImageFormat = typeof IMAGE_CONFIG.formatPriority[number];
export type ResponsiveSizeKey = keyof typeof IMAGE_CONFIG.responsiveSizes;
export type CacheStrategy = typeof IMAGE_CONFIG.cache.strategy;

// 工具函数
export const getImagePath = (path: string, type: 'static' | 'uploads' | 'cdn' = 'static'): string => {
  const basePath = IMAGE_CONFIG.paths[type];
  if (type === 'cdn' && basePath) {
    return `${basePath}${path}`;
  }
  return `${basePath}${path.startsWith('/') ? '' : '/'}${path}`;
};

export const getResponsiveSizes = (key: ResponsiveSizeKey): readonly number[] => {
  return IMAGE_CONFIG.responsiveSizes[key];
};

export const getImageQuality = (format: ImageFormat): number => {
  return IMAGE_CONFIG.quality[format as keyof typeof IMAGE_CONFIG.quality] || 80;
};

// 性能监控函数
export const logImagePerformance = (src: string, loadTime: number, fileSize?: number) => {
  if (!IMAGE_CONFIG.performance.enabled) return;
  
  console.group(`🖼️ Image Performance: ${src}`);
  console.log(`⏱️ Load Time: ${loadTime}ms`);
  if (fileSize) {
    console.log(`📦 File Size: ${(fileSize / 1024).toFixed(2)}KB`);
  }
  console.groupEnd();
};

export default IMAGE_CONFIG;