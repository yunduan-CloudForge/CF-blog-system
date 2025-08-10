import React, { Suspense, lazy } from 'react';
import { ComponentLoadingSpinner } from './LoadingSpinner';

// 懒加载的富文本编辑器组件
const LazyRichEditor = lazy(() => {
  // 模拟加载时间
  return new Promise<{ default: React.ComponentType<{
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
  }> }>(resolve => {
    setTimeout(() => {
      resolve({
        default: ({ value, onChange, placeholder }: {
          value: string;
          onChange: (value: string) => void;
          placeholder?: string;
        }) => {
          return (
            <div className="border border-gray-300 rounded-lg">
              {/* 工具栏 */}
              <div className="border-b border-gray-200 p-2 bg-gray-50 rounded-t-lg">
                <div className="flex space-x-2">
                  <button type="button" className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-100">
                    <strong>B</strong>
                  </button>
                  <button type="button" className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-100">
                    <em>I</em>
                  </button>
                  <button type="button" className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-100">
                    <u>U</u>
                  </button>
                  <div className="border-l border-gray-300 mx-2"></div>
                  <button type="button" className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-100">
                    H1
                  </button>
                  <button type="button" className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-100">
                    H2
                  </button>
                  <button type="button" className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-100">
                    链接
                  </button>
                  <button type="button" className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-100">
                    图片
                  </button>
                </div>
              </div>
              
              {/* 编辑区域 */}
              <textarea
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder || '开始编写您的内容...'}
                className="w-full p-4 border-0 focus:outline-none focus:ring-0 resize-none rounded-b-lg"
                rows={15}
                style={{ minHeight: '400px' }}
              />
            </div>
          );
        }
      });
    }, 1000); // 模拟1秒加载时间
  });
});

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export default function RichTextEditor({ value, onChange, placeholder, className = '' }: RichTextEditorProps) {
  return (
    <div className={`rich-text-editor ${className}`}>
      <Suspense fallback={
        <div className="border border-gray-300 rounded-lg p-8">
          <ComponentLoadingSpinner size="lg" />
          <p className="text-center text-gray-500 mt-4">正在加载富文本编辑器...</p>
        </div>
      }>
        <LazyRichEditor 
          value={value} 
          onChange={onChange} 
          placeholder={placeholder}
        />
      </Suspense>
    </div>
  );
}

// 导出懒加载版本
export const LazyRichTextEditor = lazy(() => import('./RichTextEditor'));