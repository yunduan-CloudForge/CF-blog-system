import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface PageTransitionProps {
  children: React.ReactNode;
  className?: string;
  duration?: number;
  type?: 'fade' | 'slide' | 'scale';
}

export function PageTransition({ 
  children, 
  className, 
  duration = 300,
  type = 'fade'
}: PageTransitionProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isEntering, setIsEntering] = useState(true);
  const location = useLocation();

  useEffect(() => {
    // 页面切换时重置动画状态
    setIsVisible(false);
    setIsEntering(true);
    
    const timer = setTimeout(() => {
      setIsVisible(true);
      setIsEntering(false);
    }, 50);

    return () => clearTimeout(timer);
  }, [location.pathname]);

  const getTransitionClasses = () => {
    const baseClasses = 'transition-all ease-out';
    const durationClass = `duration-${duration}`;
    
    switch (type) {
      case 'slide':
        return cn(
          baseClasses,
          durationClass,
          isVisible 
            ? 'transform translate-x-0 opacity-100' 
            : 'transform translate-x-4 opacity-0'
        );
      case 'scale':
        return cn(
          baseClasses,
          durationClass,
          isVisible 
            ? 'transform scale-100 opacity-100' 
            : 'transform scale-95 opacity-0'
        );
      case 'fade':
      default:
        return cn(
          baseClasses,
          durationClass,
          isVisible ? 'opacity-100' : 'opacity-0'
        );
    }
  };

  return (
    <div 
      className={cn(
        getTransitionClasses(),
        className
      )}
      style={{
        transitionDuration: `${duration}ms`
      }}
    >
      {children}
    </div>
  );
}

// 路由级别的页面过渡组件
export function RouteTransition({ children }: { children: React.ReactNode }) {
  return (
    <PageTransition type="fade" duration={200} className="min-h-screen">
      {children}
    </PageTransition>
  );
}

// 内容区域过渡组件
export function ContentTransition({ 
  children, 
  show = true,
  type = 'fade'
}: { 
  children: React.ReactNode;
  show?: boolean;
  type?: 'fade' | 'slide' | 'scale';
}) {
  const [shouldRender, setShouldRender] = useState(show);
  const [isVisible, setIsVisible] = useState(show);

  useEffect(() => {
    if (show) {
      setShouldRender(true);
      const timer = setTimeout(() => setIsVisible(true), 50);
      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
      const timer = setTimeout(() => setShouldRender(false), 200);
      return () => clearTimeout(timer);
    }
  }, [show]);

  if (!shouldRender) return null;

  const getTransitionClasses = () => {
    const baseClasses = 'transition-all duration-200 ease-out';
    
    switch (type) {
      case 'slide':
        return cn(
          baseClasses,
          isVisible 
            ? 'transform translate-y-0 opacity-100' 
            : 'transform -translate-y-2 opacity-0'
        );
      case 'scale':
        return cn(
          baseClasses,
          isVisible 
            ? 'transform scale-100 opacity-100' 
            : 'transform scale-95 opacity-0'
        );
      case 'fade':
      default:
        return cn(
          baseClasses,
          isVisible ? 'opacity-100' : 'opacity-0'
        );
    }
  };

  return (
    <div className={getTransitionClasses()}>
      {children}
    </div>
  );
}

// 列表项动画组件
export function ListItemTransition({ 
  children, 
  index = 0,
  delay = 50
}: { 
  children: React.ReactNode;
  index?: number;
  delay?: number;
}) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, index * delay);

    return () => clearTimeout(timer);
  }, [index, delay]);

  return (
    <div 
      className={cn(
        'transition-all duration-300 ease-out',
        isVisible 
          ? 'transform translate-y-0 opacity-100' 
          : 'transform translate-y-4 opacity-0'
      )}
      style={{
        transitionDelay: `${index * delay}ms`
      }}
    >
      {children}
    </div>
  );
}

// 模态框动画组件
export function ModalTransition({ 
  children, 
  show = false,
  onClose
}: { 
  children: React.ReactNode;
  show?: boolean;
  onClose?: () => void;
}) {
  const [shouldRender, setShouldRender] = useState(show);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (show) {
      setShouldRender(true);
      const timer = setTimeout(() => setIsVisible(true), 50);
      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
      const timer = setTimeout(() => setShouldRender(false), 200);
      return () => clearTimeout(timer);
    }
  }, [show]);

  if (!shouldRender) return null;

  return (
    <div 
      className={cn(
        'fixed inset-0 z-50 flex items-center justify-center',
        'transition-all duration-200 ease-out',
        isVisible ? 'opacity-100' : 'opacity-0'
      )}
      onClick={onClose}
    >
      {/* 背景遮罩 */}
      <div 
        className={cn(
          'absolute inset-0 bg-black transition-opacity duration-200',
          isVisible ? 'opacity-50' : 'opacity-0'
        )}
      />
      
      {/* 模态框内容 */}
      <div 
        className={cn(
          'relative bg-white rounded-lg shadow-xl',
          'transition-all duration-200 ease-out',
          isVisible 
            ? 'transform scale-100 opacity-100' 
            : 'transform scale-95 opacity-0'
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}