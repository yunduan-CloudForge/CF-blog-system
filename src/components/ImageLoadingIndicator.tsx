import React from 'react';
import { Loader2, AlertCircle, RotateCcw } from 'lucide-react';
import { ImageLoadState } from '../hooks/useImageLoader';

export interface ImageLoadingIndicatorProps {
  state: ImageLoadState;
  onRetry?: () => void;
  className?: string;
  showProgress?: boolean;
  showRetryButton?: boolean;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'overlay' | 'inline' | 'minimal';
}

const sizeClasses = {
  sm: 'w-4 h-4',
  md: 'w-6 h-6',
  lg: 'w-8 h-8',
};

const containerClasses = {
  overlay: 'absolute inset-0 flex items-center justify-center bg-gray-100 bg-opacity-75',
  inline: 'flex items-center justify-center p-4',
  minimal: 'flex items-center justify-center',
};

export const ImageLoadingIndicator: React.FC<ImageLoadingIndicatorProps> = ({
  state,
  onRetry,
  className = '',
  showProgress = true,
  showRetryButton = true,
  size = 'md',
  variant = 'overlay',
}) => {
  const iconSize = sizeClasses[size];
  const containerClass = containerClasses[variant];

  // 加载中状态
  if (state.loading) {
    return (
      <div className={`${containerClass} ${className}`}>
        <div className="flex flex-col items-center space-y-2">
          <Loader2 className={`${iconSize} animate-spin text-blue-500`} />
          {showProgress && (
            <div className="w-24 bg-gray-200 rounded-full h-1.5">
              <div 
                className="bg-blue-500 h-1.5 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${Math.min(state.progress, 100)}%` }}
              />
            </div>
          )}
          {variant !== 'minimal' && (
            <span className="text-xs text-gray-500">
              {state.retryCount > 0 ? `重试中... (${state.retryCount})` : '加载中...'}
            </span>
          )}
        </div>
      </div>
    );
  }

  // 错误状态
  if (state.error) {
    return (
      <div className={`${containerClass} ${className}`}>
        <div className="flex flex-col items-center space-y-2 text-center">
          <AlertCircle className={`${iconSize} text-red-500`} />
          {variant !== 'minimal' && (
            <>
              <span className="text-xs text-gray-500">
                图片加载失败
              </span>
              {showRetryButton && onRetry && (
                <button
                  onClick={onRetry}
                  className="flex items-center space-x-1 px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded transition-colors"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>重试</span>
                </button>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  // 已加载或其他状态不显示指示器
  return null;
};

// 简化的加载指示器
export const SimpleLoadingSpinner: React.FC<{ 
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}> = ({ size = 'md', className = '' }) => {
  const iconSize = sizeClasses[size];
  return (
    <Loader2 className={`${iconSize} animate-spin text-blue-500 ${className}`} />
  );
};

// 进度条组件
export const ImageProgressBar: React.FC<{
  progress: number;
  className?: string;
  showPercentage?: boolean;
}> = ({ progress, className = '', showPercentage = false }) => {
  return (
    <div className={`w-full ${className}`}>
      <div className="flex justify-between items-center mb-1">
        {showPercentage && (
          <span className="text-xs text-gray-500">
            {Math.round(progress)}%
          </span>
        )}
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div 
          className="bg-blue-500 h-2 rounded-full transition-all duration-300 ease-out"
          style={{ width: `${Math.min(progress, 100)}%` }}
        />
      </div>
    </div>
  );
};

// 错误重试按钮
export const ImageRetryButton: React.FC<{
  onRetry: () => void;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}> = ({ onRetry, className = '', size = 'md' }) => {
  const buttonSizes = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-2 text-sm',
    lg: 'px-4 py-2 text-base',
  };

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  return (
    <button
      onClick={onRetry}
      className={`
        flex items-center space-x-2 
        ${buttonSizes[size]}
        bg-red-50 hover:bg-red-100 
        text-red-600 hover:text-red-700
        border border-red-200 hover:border-red-300
        rounded-md transition-all duration-200
        focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-50
        ${className}
      `}
    >
      <RotateCcw className={iconSizes[size]} />
      <span>重试</span>
    </button>
  );
};

export default ImageLoadingIndicator;