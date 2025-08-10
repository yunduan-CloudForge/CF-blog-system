/**
 * 图片工具函数
 * 提供WebP支持检测、图片格式转换、压缩等功能
 */

// 检查浏览器是否支持WebP格式
export const checkWebPSupport = (): Promise<boolean> => {
  return new Promise((resolve) => {
    const webP = new Image();
    webP.onload = webP.onerror = () => {
      resolve(webP.height === 2);
    };
    webP.src = 'data:image/webp;base64,UklGRjoAAABXRUJQVlA4IC4AAACyAgCdASoCAAIALmk0mk0iIiIiIgBoSygABc6WWgAA/veff/0PP8bA//LwYAAA';
  });
};

// 生成不同格式的图片URL
export const generateImageUrls = (basePath: string, filename: string) => {
  const name = filename.split('.')[0];
  const ext = filename.split('.').pop()?.toLowerCase();
  
  return {
    original: `${basePath}/${filename}`,
    webp: `${basePath}/${name}.webp`,
    avif: `${basePath}/${name}.avif`,
    fallback: ext === 'png' ? `${basePath}/${name}.jpg` : `${basePath}/${filename}`
  };
};

// 生成响应式图片的srcset
export const generateSrcSet = (basePath: string, filename: string, sizes: number[] = [400, 800, 1200, 1600]) => {
  const name = filename.split('.')[0];
  const ext = filename.split('.').pop();
  
  return sizes.map(size => `${basePath}/${name}-${size}w.${ext} ${size}w`).join(', ');
};

// 生成WebP格式的srcset
export const generateWebPSrcSet = (basePath: string, filename: string, sizes: number[] = [400, 800, 1200, 1600]) => {
  const name = filename.split('.')[0];
  
  return sizes.map(size => `${basePath}/${name}-${size}w.webp ${size}w`).join(', ');
};

// 图片预加载
export const preloadImage = (src: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = reject;
    img.src = src;
  });
};

// 批量预加载图片
export const preloadImages = async (urls: string[]): Promise<void> => {
  try {
    await Promise.all(urls.map(url => preloadImage(url)));
  } catch (error) {
    console.warn('Some images failed to preload:', error);
  }
};

// 图片压缩（客户端）
export const compressImage = (
  file: File, 
  maxWidth: number = 1920, 
  maxHeight: number = 1080, 
  quality: number = 0.8
): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    if (!ctx) {
      reject(new Error('Canvas context not available'));
      return;
    }
    
    img.onload = () => {
      // 计算新的尺寸
      let { width, height } = img;
      
      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }
      
      if (height > maxHeight) {
        width = (width * maxHeight) / height;
        height = maxHeight;
      }
      
      canvas.width = width;
      canvas.height = height;
      
      // 绘制压缩后的图片
      ctx.drawImage(img, 0, 0, width, height);
      
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to compress image'));
          }
        },
        'image/jpeg',
        quality
      );
    };
    
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
};

// 获取图片尺寸
export const getImageDimensions = (src: string): Promise<{ width: number; height: number }> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = reject;
    img.src = src;
  });
};

// 生成占位符图片（Base64）
export const generatePlaceholder = (width: number, height: number, color: string = '#f3f4f6'): string => {
  const svg = `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="${width}" height="${height}" fill="${color}"/>
      <path d="M${width/2-10} ${height/2-5}L${width/2+10} ${height/2-5}L${width/2} ${height/2+5}Z" fill="#d1d5db"/>
    </svg>
  `;
  
  return `data:image/svg+xml;base64,${btoa(svg)}`;
};

// 图片格式检测
export const getImageFormat = (src: string): string => {
  const ext = src.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    case 'avif':
      return 'image/avif';
    case 'gif':
      return 'image/gif';
    case 'svg':
      return 'image/svg+xml';
    default:
      return 'image/jpeg';
  }
};

// 图片懒加载观察器配置
export const createImageObserver = (
  callback: (entries: IntersectionObserverEntry[]) => void,
  options: IntersectionObserverInit = {}
): IntersectionObserver => {
  const defaultOptions: IntersectionObserverInit = {
    threshold: 0.1,
    rootMargin: '50px',
    ...options
  };
  
  return new IntersectionObserver(callback, defaultOptions);
};