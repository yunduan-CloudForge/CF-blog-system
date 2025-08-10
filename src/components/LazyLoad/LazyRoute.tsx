import React, { Suspense, Component, ReactNode } from 'react';

interface LazyRouteProps {
  component: React.ComponentType<any>;
  fallback?: React.ReactNode;
  errorFallback?: React.ComponentType<{ error: Error; resetErrorBoundary: () => void }>;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class CustomErrorBoundary extends Component<
  { children: ReactNode; fallback: React.ComponentType<{ error: Error; resetErrorBoundary: () => void }> },
  ErrorBoundaryState
> {
  constructor(props: { children: ReactNode; fallback: React.ComponentType<{ error: Error; resetErrorBoundary: () => void }> }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('LazyRoute Error:', error, errorInfo);
  }

  resetErrorBoundary = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      const FallbackComponent = this.props.fallback;
      return <FallbackComponent error={this.state.error} resetErrorBoundary={this.resetErrorBoundary} />;
    }

    return this.props.children;
  }
}

const DefaultFallback = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
      <p className="text-gray-600">加载中...</p>
    </div>
  </div>
);

const DefaultErrorFallback = ({ error, resetErrorBoundary }: { error: Error; resetErrorBoundary: () => void }) => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="text-center">
      <h2 className="text-2xl font-bold text-red-600 mb-4">页面加载失败</h2>
      <p className="text-gray-600 mb-4">{error.message}</p>
      <button
        onClick={resetErrorBoundary}
        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
      >
        重试
      </button>
    </div>
  </div>
);

const LazyRoute: React.FC<LazyRouteProps> = ({ 
  component: Component, 
  fallback = <DefaultFallback />, 
  errorFallback = DefaultErrorFallback 
}) => {
  return (
    <CustomErrorBoundary fallback={errorFallback}>
      <Suspense fallback={fallback}>
        <Component />
      </Suspense>
    </CustomErrorBoundary>
  );
};

// 高阶组件用于包装懒加载组件
export const withLazyLoading = <P extends object>(
  importFunc: () => Promise<{ default: ComponentType<P> }>,
  fallback?: React.ReactNode,
  errorFallback?: ComponentType<{ error: Error; resetErrorBoundary: () => void }>
) => {
  const LazyComponent = React.lazy(importFunc);
  
  return (props: P) => (
    <LazyRoute 
      component={() => <LazyComponent {...props} />}
      fallback={fallback}
      errorFallback={errorFallback}
    />
  );
};