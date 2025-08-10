import React from 'react';
import LazyImage from './LazyImage';
import OptimizedImage from './OptimizedImage';

/**
 * 图片使用指南组件
 * 展示如何正确使用 LazyImage 和 OptimizedImage 组件
 */
export const ImageUsageGuide: React.FC = () => {
  return (
    <div className="space-y-8 p-6">
      <h2 className="text-2xl font-bold mb-4">图片组件使用指南</h2>
      
      {/* LazyImage 基础用法 */}
      <section>
        <h3 className="text-xl font-semibold mb-3">LazyImage - 基础懒加载</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <LazyImage
            src="/images/example.jpg"
            alt="示例图片"
            className="w-full h-48 object-cover rounded-lg"
            placeholder="blur"
          />
          <LazyImage
            src="/images/avatar.png"
            alt="用户头像"
            className="w-32 h-32 rounded-full object-cover"
            loading="lazy"
          />
        </div>
      </section>

      {/* OptimizedImage 高级用法 */}
      <section>
        <h3 className="text-xl font-semibold mb-3">OptimizedImage - 高级优化</h3>
        <div className="space-y-4">
          {/* 响应式图片 */}
          <OptimizedImage
              src="/api/placeholder/400/300"
              alt="响应式图片示例"
              className="w-full h-48 object-cover rounded-lg"
              enableWebP={true}
              enableAvif={false}
              responsiveSizes={[320, 640, 1024]}
            />
          
          {/* WebP/AVIF 支持 */}
          <OptimizedImage
            src="/images/product.jpg"
            alt="产品图片"
            className="w-full h-48 object-cover"
            enableWebP={true}
            enableAvif={true}
            quality={0.85}
          />
          
          {/* 带占位符 */}
          <OptimizedImage
            src="/images/gallery.jpg"
            alt="画廊图片"
            className="w-full h-56 object-cover"
            placeholder="blur"
          />
        </div>
      </section>

      {/* 使用建议 */}
      <section>
        <h3 className="text-xl font-semibold mb-3">使用建议</h3>
        <div className="bg-gray-50 p-4 rounded-lg">
          <ul className="space-y-2 text-sm">
            <li><strong>LazyImage:</strong> 适用于简单的图片懒加载需求</li>
            <li><strong>OptimizedImage:</strong> 适用于需要高级优化的场景</li>
            <li><strong>响应式图片:</strong> 为不同屏幕尺寸提供合适的图片大小</li>
            <li><strong>现代格式:</strong> 优先使用 AVIF 和 WebP 格式以获得更好的压缩率</li>
            <li><strong>占位符:</strong> 使用模糊占位符改善用户体验</li>
            <li><strong>优先级:</strong> 为首屏重要图片设置 priority 属性</li>
          </ul>
        </div>
      </section>

      {/* 性能提示 */}
      <section>
        <h3 className="text-xl font-semibold mb-3">性能优化提示</h3>
        <div className="bg-blue-50 p-4 rounded-lg">
          <ul className="space-y-2 text-sm">
            <li>• 图片会在构建时自动压缩和转换格式</li>
            <li>• 懒加载可减少初始页面加载时间</li>
            <li>• 响应式图片可节省移动端流量</li>
            <li>• WebP/AVIF 格式可减少 30-50% 的文件大小</li>
            <li>• 占位符可避免布局偏移（CLS）</li>
          </ul>
        </div>
      </section>
    </div>
  );
};

export default ImageUsageGuide;