import { useEffect, useState } from 'react';

interface LoadingSpinnerProps {
  delay?: number;
  minDuration?: number;
  message?: string;
}

export default function LoadingSpinner({ 
  delay = 200, 
  minDuration = 500,
  message = '加载中...'
}: LoadingSpinnerProps) {
  const [show, setShow] = useState(false);
  const [startTime, setStartTime] = useState<number | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShow(true);
      setStartTime(Date.now());
    }, delay);

    return () => clearTimeout(timer);
  }, [delay]);

  useEffect(() => {
    if (startTime && show) {
      const elapsed = Date.now() - startTime;
      if (elapsed < minDuration) {
        const remainingTime = minDuration - elapsed;
        setTimeout(() => setShow(false), remainingTime);
      }
    }
  }, [startTime, minDuration, show]);

  if (!show) return null;

  return (
    <div className="flex items-center justify-center min-h-[200px]">
      <div className="flex flex-col items-center space-y-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="text-gray-600 text-sm">{message}</span>
      </div>
    </div>
  );
}

// 页面级别的加载组件
export function PageLoadingSpinner() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="flex flex-col items-center space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <span className="text-gray-600">页面加载中...</span>
      </div>
    </div>
  );
}

// 组件级别的加载组件
export function ComponentLoadingSpinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6', 
    lg: 'h-8 w-8'
  };

  return (
    <div className="flex items-center justify-center p-4">
      <div className={`animate-spin rounded-full border-b-2 border-blue-600 ${sizeClasses[size]}`}></div>
    </div>
  );
}