import { lazy, Suspense } from 'react';
import { ComponentLoadingSpinner } from './LoadingSpinner';

// 懒加载的图表组件
const LazyChart = lazy(() => {
  // 模拟加载时间
  return new Promise<{ default: React.ComponentType<{
    data: Array<{ name: string; value: number; color?: string }>;
    type: 'bar' | 'line' | 'pie';
    title?: string;
  }> }>(resolve => {
    setTimeout(() => {
      resolve({
        default: ({ data, type, title }: {
          data: Array<{ name: string; value: number; color?: string }>;
          type: 'bar' | 'line' | 'pie';
          title?: string;
        }) => {
          const maxValue = Math.max(...data.map(item => item.value));
          
          if (type === 'bar') {
            return (
              <div className="bg-white p-6 rounded-lg shadow">
                {title && <h3 className="text-lg font-semibold mb-4">{title}</h3>}
                <div className="space-y-3">
                  {data.map((item, index) => {
                    const percentage = (item.value / maxValue) * 100;
                    return (
                      <div key={index} className="flex items-center">
                        <div className="w-20 text-sm text-gray-600 truncate">{item.name}</div>
                        <div className="flex-1 mx-3">
                          <div className="bg-gray-200 rounded-full h-4 relative">
                            <div 
                              className="h-4 rounded-full transition-all duration-500"
                              style={{ 
                                width: `${percentage}%`,
                                backgroundColor: item.color || '#3B82F6'
                              }}
                            />
                          </div>
                        </div>
                        <div className="w-12 text-sm text-gray-900 text-right">{item.value}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          }
          
          if (type === 'pie') {
            const total = data.reduce((sum, item) => sum + item.value, 0);
            return (
              <div className="bg-white p-6 rounded-lg shadow">
                {title && <h3 className="text-lg font-semibold mb-4">{title}</h3>}
                <div className="flex items-center justify-center">
                  <div className="relative w-48 h-48">
                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                      {data.map((item, index) => {
                        const percentage = (item.value / total) * 100;
                        const strokeDasharray = `${percentage} ${100 - percentage}`;
                        const strokeDashoffset = data.slice(0, index).reduce((sum, prev) => sum + (prev.value / total) * 100, 0);
                        return (
                          <circle
                            key={index}
                            cx="50"
                            cy="50"
                            r="15.915"
                            fill="transparent"
                            stroke={item.color || `hsl(${index * 60}, 70%, 50%)`}
                            strokeWidth="8"
                            strokeDasharray={strokeDasharray}
                            strokeDashoffset={-strokeDashoffset}
                            className="transition-all duration-500"
                          />
                        );
                      })}
                    </svg>
                  </div>
                  <div className="ml-6 space-y-2">
                    {data.map((item, index) => (
                      <div key={index} className="flex items-center">
                        <div 
                          className="w-3 h-3 rounded-full mr-2"
                          style={{ backgroundColor: item.color || `hsl(${index * 60}, 70%, 50%)` }}
                        />
                        <span className="text-sm text-gray-600">{item.name}: {item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          }
          
          // Line chart (simplified)
          return (
            <div className="bg-white p-6 rounded-lg shadow">
              {title && <h3 className="text-lg font-semibold mb-4">{title}</h3>}
              <div className="h-64 flex items-end justify-between border-b border-l border-gray-300 p-4">
                {data.map((item, index) => {
                  const height = (item.value / maxValue) * 200;
                  return (
                    <div key={index} className="flex flex-col items-center">
                      <div 
                        className="w-2 bg-blue-500 transition-all duration-500 rounded-t"
                        style={{ height: `${height}px` }}
                      />
                      <span className="text-xs text-gray-600 mt-2 transform rotate-45 origin-left">
                        {item.name}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        }
      });
    }, 800); // 模拟800ms加载时间
  });
});

interface ChartComponentProps {
  data: Array<{ name: string; value: number; color?: string }>;
  type: 'bar' | 'line' | 'pie';
  title?: string;
  className?: string;
}

export default function ChartComponent({ data, type, title, className = '' }: ChartComponentProps) {
  return (
    <div className={`chart-component ${className}`}>
      <Suspense fallback={
        <div className="bg-white p-6 rounded-lg shadow animate-pulse">
          {title && <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>}
          <div className="space-y-3">
            <ComponentLoadingSpinner size="lg" />
            <p className="text-center text-gray-500">正在加载图表组件...</p>
          </div>
        </div>
      }>
        <LazyChart data={data} type={type} title={title} />
      </Suspense>
    </div>
  );
}

// 导出懒加载版本
export const LazyChartComponent = lazy(() => import('./ChartComponent'));