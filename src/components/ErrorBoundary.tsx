import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  showDetails?: boolean;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string;
}

/**
 * 错误边界组件
 * 捕获子组件中的JavaScript错误，记录错误并显示备用UI
 */
class ErrorBoundary extends Component<Props, State> {
  private retryCount = 0;
  private maxRetries = 3;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: ''
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    // 更新state，下次渲染将显示错误UI
    return {
      hasError: true,
      error,
      errorId: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // 记录错误信息
    this.setState({ errorInfo });
    
    // 调用外部错误处理函数
    this.props.onError?.(error, errorInfo);
    
    // 发送错误到监控服务
    this.reportError(error, errorInfo);
  }

  private reportError = (error: Error, errorInfo: ErrorInfo) => {
    try {
      // 构建错误报告
      const errorReport = {
        id: this.state.errorId,
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        timestamp: new Date().toISOString(),
        url: window.location.href,
        userAgent: navigator.userAgent,
        userId: this.getUserId(),
        retryCount: this.retryCount
      };

      // 发送到错误监控服务（可以是Sentry、LogRocket等）
      if (process.env.NODE_ENV === 'production') {
        // 这里可以集成第三方错误监控服务
        console.error('Error Report:', errorReport);
        
        // 发送到后端错误收集API
        fetch('/api/errors', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(errorReport)
        }).catch(err => {
          console.error('Failed to report error:', err);
        });
      } else {
        // 开发环境下在控制台显示详细错误信息
        console.group('🚨 Error Boundary Caught an Error');
        console.error('Error:', error);
        console.error('Error Info:', errorInfo);
        console.error('Error Report:', errorReport);
        console.groupEnd();
      }
    } catch (reportingError) {
      console.error('Failed to report error:', reportingError);
    }
  };

  private getUserId = (): string | null => {
    try {
      // 从localStorage或其他地方获取用户ID
      const authData = localStorage.getItem('auth');
      if (authData) {
        const parsed = JSON.parse(authData);
        return parsed.user?.id || null;
      }
    } catch {
      // 忽略解析错误
    }
    return null;
  };

  private handleRetry = () => {
    if (this.retryCount < this.maxRetries) {
      this.retryCount++;
      this.setState({
        hasError: false,
        error: null,
        errorInfo: null,
        errorId: ''
      });
    }
  };

  private handleGoHome = () => {
    window.location.href = '/';
  };

  private handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      // 如果提供了自定义fallback，使用它
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // 默认错误UI
      return (
        <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
          <div className="sm:mx-auto sm:w-full sm:max-w-md">
            <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
              <div className="text-center">
                <AlertTriangle className="mx-auto h-12 w-12 text-red-500 mb-4" />
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  哎呀，出错了！
                </h2>
                <p className="text-gray-600 mb-6">
                  页面遇到了一个意外错误，我们已经记录了这个问题。
                </p>
                
                {/* 错误详情（仅在开发环境或showDetails为true时显示） */}
                {(process.env.NODE_ENV === 'development' || this.props.showDetails) && this.state.error && (
                  <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md text-left">
                    <h3 className="text-sm font-medium text-red-800 mb-2">错误详情：</h3>
                    <p className="text-xs text-red-700 font-mono break-all">
                      {this.state.error.message}
                    </p>
                    {this.state.errorInfo && (
                      <details className="mt-2">
                        <summary className="text-xs text-red-600 cursor-pointer">组件堆栈</summary>
                        <pre className="text-xs text-red-600 mt-1 whitespace-pre-wrap">
                          {this.state.errorInfo.componentStack}
                        </pre>
                      </details>
                    )}
                    <p className="text-xs text-red-600 mt-2">
                      错误ID: {this.state.errorId}
                    </p>
                  </div>
                )}
                
                {/* 操作按钮 */}
                <div className="space-y-3">
                  {this.retryCount < this.maxRetries && (
                    <button
                      onClick={this.handleRetry}
                      className="w-full flex justify-center items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
                      重试 ({this.maxRetries - this.retryCount} 次机会)
                    </button>
                  )}
                  
                  <button
                    onClick={this.handleGoHome}
                    className="w-full flex justify-center items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                  >
                    <Home className="w-4 h-4 mr-2" />
                    返回首页
                  </button>
                  
                  <button
                    onClick={this.handleReload}
                    className="w-full flex justify-center items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    刷新页面
                  </button>
                </div>
                
                <p className="text-xs text-gray-500 mt-4">
                  如果问题持续存在，请联系技术支持。
                </p>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

// 高阶组件：为组件添加错误边界
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<Props, 'children'>
) {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  );
  
  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;
  
  return WrappedComponent;
}

// Hook：在函数组件中使用错误边界
export function useErrorHandler() {
  return (error: Error) => {
    // 在函数组件中手动触发错误边界
    throw error;
  };
}

// 错误类型定义
export class ChunkLoadError extends Error {
  constructor(chunkName: string) {
    super(`Failed to load chunk: ${chunkName}`);
    this.name = 'ChunkLoadError';
  }
}

export class NetworkError extends Error {
  constructor(url: string, status?: number) {
    super(`Network error: ${url}${status ? ` (${status})` : ''}`);
    this.name = 'NetworkError';
  }
}

export class AuthenticationError extends Error {
  constructor(message = 'Authentication failed') {
    super(message);
    this.name = 'AuthenticationError';
  }
}