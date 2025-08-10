import React, { useState, useCallback } from 'react';
import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { cn } from '../../utils/cn';

type LoadingStateType = 'loading' | 'success' | 'error' | 'idle';

interface LoadingStateProps {
  state: LoadingStateType;
  loadingText?: string;
  successText?: string;
  errorText?: string;
  onRetry?: () => void;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'minimal' | 'card';
}

const sizeClasses = {
  sm: {
    icon: 'h-4 w-4',
    text: 'text-sm',
    padding: 'p-2'
  },
  md: {
    icon: 'h-6 w-6',
    text: 'text-base',
    padding: 'p-4'
  },
  lg: {
    icon: 'h-8 w-8',
    text: 'text-lg',
    padding: 'p-6'
  }
};

export const LoadingState: React.FC<LoadingStateProps> = ({
  state,
  loadingText = '加载中...',
  successText = '加载完成',
  errorText = '加载失败',
  onRetry,
  className = '',
  size = 'md',
  variant = 'default'
}) => {
  const sizeConfig = sizeClasses[size];

  if (state === 'idle') {
    return null;
  }

  const baseClasses = cn(
    'flex items-center justify-center',
    sizeConfig.padding,
    {
      'bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm': variant === 'card',
      'min-h-[200px]': variant === 'default' && size === 'lg',
      'min-h-[120px]': variant === 'default' && size === 'md',
      'min-h-[80px]': variant === 'default' && size === 'sm'
    },
    className
  );

  const renderContent = () => {
    switch (state) {
      case 'loading':
        return (
          <div className="flex flex-col items-center space-y-3">
            <Loader2 className={cn(sizeConfig.icon, 'animate-spin text-blue-600')} />
            {variant !== 'minimal' && (
              <p className={cn(sizeConfig.text, 'text-gray-600 dark:text-gray-400')}>
                {loadingText}
              </p>
            )}
          </div>
        );

      case 'success':
        return (
          <div className="flex flex-col items-center space-y-3">
            <CheckCircle2 className={cn(sizeConfig.icon, 'text-green-600')} />
            {variant !== 'minimal' && (
              <p className={cn(sizeConfig.text, 'text-green-600 dark:text-green-400')}>
                {successText}
              </p>
            )}
          </div>
        );

      case 'error':
        return (
          <div className="flex flex-col items-center space-y-3">
            <AlertCircle className={cn(sizeConfig.icon, 'text-red-600')} />
            {variant !== 'minimal' && (
              <div className="text-center space-y-2">
                <p className={cn(sizeConfig.text, 'text-red-600 dark:text-red-400')}>
                  {errorText}
                </p>
                {onRetry && (
                  <button
                    onClick={onRetry}
                    className="px-3 py-1 text-sm bg-red-600 hover:bg-red-700 text-white rounded-md transition-colors"
                  >
                    重试
                  </button>
                )}
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return <div className={baseClasses}>{renderContent()}</div>;
};

// 内联加载状态组件
export const InlineLoading: React.FC<{
  isLoading: boolean;
  text?: string;
  className?: string;
}> = ({ isLoading, text = '加载中...', className = '' }) => {
  if (!isLoading) return null;

  return (
    <div className={cn('flex items-center space-x-2', className)}>
      <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
      <span className="text-sm text-gray-600 dark:text-gray-400">{text}</span>
    </div>
  );
};

// 按钮加载状态组件
export const ButtonLoading: React.FC<{
  isLoading: boolean;
  children: React.ReactNode;
  loadingText?: string;
  className?: string;
  disabled?: boolean;
  onClick?: () => void;
}> = ({ 
  isLoading, 
  children, 
  loadingText, 
  className = '', 
  disabled = false,
  onClick 
}) => {
  return (
    <button
      onClick={onClick}
      disabled={isLoading || disabled}
      className={cn(
        'inline-flex items-center justify-center px-4 py-2 font-medium rounded-lg transition-colors',
        'bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white',
        'disabled:cursor-not-allowed',
        className
      )}
    >
      {isLoading && (
        <Loader2 className="h-4 w-4 animate-spin mr-2" />
      )}
      {isLoading ? (loadingText || '处理中...') : children}
    </button>
  );
};

// 页面级加载状态组件
export const PageLoading: React.FC<{
  text?: string;
  className?: string;
}> = ({ text = '页面加载中...', className = '' }) => {
  return (
    <div className={cn('min-h-screen flex items-center justify-center', className)}>
      <div className="text-center space-y-4">
        <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto" />
        <p className="text-lg text-gray-600 dark:text-gray-400">{text}</p>
      </div>
    </div>
  );
};

// 自定义Hook：管理异步状态
export const useAsyncState = <T,>(initialState?: T) => {
  const [state, setState] = useState<LoadingStateType>('idle');
  const [data, setData] = useState<T | undefined>(initialState);
  const [error, setError] = useState<Error | null>(null);

  const execute = useCallback(async (asyncFunction: () => Promise<T>) => {
    setState('loading');
    setError(null);
    
    try {
      const result = await asyncFunction();
      setData(result);
      setState('success');
      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      setError(error);
      setState('error');
      throw error;
    }
  }, []);

  const reset = useCallback(() => {
    setState('idle');
    setError(null);
    setData(initialState);
  }, [initialState]);

  return {
    state,
    data,
    error,
    execute,
    reset,
    isLoading: state === 'loading',
    isSuccess: state === 'success',
    isError: state === 'error',
    isIdle: state === 'idle'
  };
};