import React, { useState, useEffect, useRef } from 'react';
import { LazyImage } from '@/components/LazyLoad/LazyImage';
import { usePerformanceContext } from '@/components/Performance/PerformanceProvider';
import { useVirtualScroll } from '@/hooks/usePerformance';
import { useDebounce } from '@/hooks/useDebounce';
import MetaTags from '@/components/SEO/MetaTags';

interface TestImage {
  id: number;
  url: string;
  title: string;
  description: string;
}

const ImageOptimizationTest: React.FC = () => {
  const { monitor, networkInfo, memoryInfo, isOnline } = usePerformanceContext();
  const [images, setImages] = useState<TestImage[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollElementRef = useRef<HTMLDivElement>(null);
  const [loadingStats, setLoadingStats] = useState({
    totalImages: 0,
    loadedImages: 0,
    failedImages: 0,
    averageLoadTime: 0
  });
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  const filteredImages = images.filter(img =>
    img.title.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
    img.description.toLowerCase().includes(debouncedSearchTerm.toLowerCase())
  );
  
  // 虚拟滚动配置
  const {
    visibleItems
  } = useVirtualScroll({
    items: filteredImages,
    itemHeight: 300,
    containerHeight: 600
  });

  // 生成测试图片数据
  useEffect(() => {
    const generateTestImages = (): TestImage[] => {
      const categories = ['nature', 'city', 'technology', 'food', 'people', 'abstract'];
      const sizes = ['400x300', '600x400', '800x600', '1200x800'];
      
      return Array.from({ length: 100 }, (_, index) => {
        const category = categories[index % categories.length];
        const size = sizes[index % sizes.length];
        
        return {
          id: index + 1,
          url: `https://picsum.photos/${size}?random=${index + 1}&category=${category}`,
          title: `测试图片 ${index + 1} - ${category}`,
          description: `这是一张${size}尺寸的${category}类别测试图片，用于验证懒加载和性能优化效果。`
        };
      });
    };

    setImages(generateTestImages());
  }, []);

  // 监控图片加载性能
  const handleImageLoad = (loadTime?: number) => {
    setLoadingStats(prev => {
      const newLoadedCount = prev.loadedImages + 1;
      const newAverageLoadTime = loadTime 
        ? ((prev.averageLoadTime * prev.loadedImages) + loadTime) / newLoadedCount
        : prev.averageLoadTime;
      
      return {
        ...prev,
        loadedImages: newLoadedCount,
        averageLoadTime: newAverageLoadTime
      };
    });
  };

  const handleImageError = () => {
    setLoadingStats(prev => ({
      ...prev,
      failedImages: prev.failedImages + 1
    }));
  };

  // 更新总图片数
  useEffect(() => {
    setLoadingStats(prev => ({
      ...prev,
      totalImages: images.length
    }));
  }, [images.length]);

  // 性能测试函数
  const runPerformanceTest = async () => {
    const testFunction = async () => {
      // 模拟图片批量加载
      const promises = images.slice(0, 10).map(img => 
        new Promise((resolve) => {
          const testImg = new Image();
          testImg.onload = () => resolve(img.id);
          testImg.onerror = () => resolve(img.id);
          testImg.src = img.url;
        })
      );
      
      await Promise.all(promises);
    };

    const result = await monitor.measureAsyncFunction(async () => await testFunction(), 'batch-image-load');
    console.log('批量图片加载性能测试结果:', result);
  };



  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <MetaTags
        title="图片优化测试 - 性能监控"
        description="测试图片懒加载、虚拟滚动和性能优化效果的演示页面"
        keywords="图片优化,懒加载,虚拟滚动,性能测试"
        url="/test/image-optimization"
      />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* 页面标题 */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            图片优化测试页面
          </h1>
          <p className="text-lg text-gray-600">
            测试懒加载、虚拟滚动和性能监控功能
          </p>
        </div>

        {/* 性能统计面板 */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">性能统计</h2>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{loadingStats.totalImages}</div>
              <div className="text-sm text-gray-600">总图片数</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{loadingStats.loadedImages}</div>
              <div className="text-sm text-gray-600">已加载</div>
            </div>
            <div className="text-center p-4 bg-red-50 rounded-lg">
              <div className="text-2xl font-bold text-red-600">{loadingStats.failedImages}</div>
              <div className="text-sm text-gray-600">加载失败</div>
            </div>
            <div className="text-center p-4 bg-yellow-50 rounded-lg">
              <div className="text-2xl font-bold text-yellow-600">
                {loadingStats.averageLoadTime.toFixed(0)}ms
              </div>
              <div className="text-sm text-gray-600">平均加载时间</div>
            </div>
          </div>

          {/* 网络状态 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${
                isOnline ? 'bg-green-500' : 'bg-red-500'
              }`}></div>
              <span className="text-sm text-gray-600">
                网络状态: {isOnline ? '在线' : '离线'}
              </span>
            </div>
            
            {networkInfo.effectiveType && (
              <div className="text-sm text-gray-600">
                连接类型: {networkInfo.effectiveType}
              </div>
            )}
            
            {networkInfo.saveData && (
              <div className="text-sm text-orange-600">
                数据节省模式: 已启用
              </div>
            )}
          </div>

          {/* 内存使用情况 */}
          {memoryInfo.usedJSHeapSize && (
            <div className="text-sm text-gray-600">
              内存使用: {(memoryInfo.usedJSHeapSize / 1024 / 1024).toFixed(2)} MB / 
              {(memoryInfo.jsHeapSizeLimit / 1024 / 1024).toFixed(2)} MB
            </div>
          )}

          <button
            onClick={runPerformanceTest}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            运行性能测试
          </button>
        </div>

        {/* 搜索框 */}
        <div className="mb-6">
          <input
            type="text"
            placeholder="搜索图片..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* 虚拟滚动图片网格 */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            图片网格 (虚拟滚动) - 显示 {filteredImages.length} 张图片
          </h2>
          
          <div 
            ref={containerRef}
            className="h-96 overflow-auto border border-gray-200 rounded-lg"
          >
            <div ref={scrollElementRef}>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
                {visibleItems.map((item) => {
                  const image = item as TestImage;
                  return (
                    <div key={image.id} className="bg-gray-50 rounded-lg overflow-hidden">
                      <LazyImage
                        src={image.url}
                        alt={image.title}
                        className="w-full h-48 object-cover"
                        onLoad={() => handleImageLoad()}
                        onError={() => handleImageError()}
                      />
                      <div className="p-4">
                        <h3 className="font-semibold text-gray-900 mb-2">{image.title}</h3>
                        <p className="text-sm text-gray-600">{image.description}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* 性能提示 */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-2">性能优化说明</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• 使用懒加载技术，只有当图片进入视口时才开始加载</li>
            <li>• 虚拟滚动技术确保只渲染可见区域的图片，提高大列表性能</li>
            <li>• 防抖搜索减少不必要的过滤操作</li>
            <li>• 根据网络状况自动调整图片质量和加载策略</li>
            <li>• 实时监控内存使用和加载性能</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default ImageOptimizationTest;