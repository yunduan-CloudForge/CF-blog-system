import { useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { errorMonitor } from '../utils/errorMonitor';

interface ClickEvent {
  element: string;
  text?: string;
  href?: string;
  position: { x: number; y: number };
  timestamp: number;
}

interface ScrollEvent {
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
  scrollPercentage: number;
  timestamp: number;
}

interface PageViewEvent {
  url: string;
  title: string;
  referrer: string;
  timestamp: number;
  sessionId: string;
}

interface FormInteractionEvent {
  formId?: string;
  fieldName: string;
  action: 'focus' | 'blur' | 'change' | 'submit';
  value?: string;
  timestamp: number;
}

interface UseBehaviorAnalyticsOptions {
  trackClicks?: boolean;
  trackScrolling?: boolean;
  trackPageViews?: boolean;
  trackFormInteractions?: boolean;
  trackHover?: boolean;
  trackKeyboard?: boolean;
  scrollThreshold?: number; // 滚动百分比阈值
  debounceMs?: number; // 防抖时间
}

export const useBehaviorAnalytics = (options: UseBehaviorAnalyticsOptions = {}) => {
  const {
    trackClicks = true,
    trackScrolling = true,
    trackPageViews = true,
    trackFormInteractions = true,
    trackHover = false,
    trackKeyboard = false,
    scrollThreshold = 25, // 每25%记录一次
    debounceMs = 300
  } = options;

  const location = useLocation();
  const sessionId = useRef<string>(generateSessionId());
  const scrollThresholds = useRef<Set<number>>(new Set());
  const lastScrollTime = useRef<number>(0);
  const pageStartTime = useRef<number>(Date.now());
  const isPageVisible = useRef<boolean>(true);

  // 生成会话ID
  function generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // 获取元素选择器
  const getElementSelector = useCallback((element: Element): string => {
    if (element.id) return `#${element.id}`;
    if (element.className && typeof element.className === 'string') {
      const classes = element.className.split(' ').filter(c => c.trim()).slice(0, 2);
      if (classes.length > 0) return `.${classes.join('.')}`;
    }
    return element.tagName.toLowerCase();
  }, []);

  // 获取元素文本内容
  const getElementText = useCallback((element: Element): string => {
    const text = element.textContent?.trim() || '';
    return text.length > 50 ? text.substring(0, 50) + '...' : text;
  }, []);

  // 跟踪点击事件
  const trackClick = useCallback((event: MouseEvent) => {
    if (!trackClicks) return;

    const target = event.target as Element;
    if (!target) return;

    const clickEvent: ClickEvent = {
      element: getElementSelector(target),
      text: getElementText(target),
      href: target.getAttribute('href') || undefined,
      position: { x: event.clientX, y: event.clientY },
      timestamp: Date.now()
    };

    errorMonitor.captureUserAction({
      action: 'click',
      element: clickEvent.element,
      url: window.location.href,
      timestamp: clickEvent.timestamp,
      sessionId: sessionId.current,
      context: {
        text: clickEvent.text,
        href: clickEvent.href,
        position: clickEvent.position
      }
    });
  }, [trackClicks, getElementSelector, getElementText]);

  // 跟踪滚动事件
  const trackScroll = useCallback(() => {
    if (!trackScrolling) return;

    const now = Date.now();
    if (now - lastScrollTime.current < debounceMs) return;
    lastScrollTime.current = now;

    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
    const scrollPercentage = scrollHeight > 0 ? Math.round((scrollTop / scrollHeight) * 100) : 0;

    // 记录滚动阈值
    const threshold = Math.floor(scrollPercentage / scrollThreshold) * scrollThreshold;
    if (threshold > 0 && !scrollThresholds.current.has(threshold)) {
      scrollThresholds.current.add(threshold);
      
      const scrollEvent: ScrollEvent = {
        scrollTop,
        scrollHeight: scrollHeight + window.innerHeight,
        clientHeight: window.innerHeight,
        scrollPercentage: threshold,
        timestamp: now
      };

      errorMonitor.captureUserAction({
        action: 'scroll',
        element: 'window',
        url: window.location.href,
        timestamp: scrollEvent.timestamp,
        sessionId: sessionId.current,
        context: {
          scrollTop: scrollEvent.scrollTop,
          scrollHeight: scrollEvent.scrollHeight,
          clientHeight: scrollEvent.clientHeight,
          scrollPercentage: scrollEvent.scrollPercentage
        }
      });
    }
  }, [trackScrolling, debounceMs, scrollThreshold]);

  // 跟踪页面访问
  const trackPageView = useCallback(() => {
    if (!trackPageViews) return;

    const pageViewEvent: PageViewEvent = {
      url: window.location.href,
      title: document.title,
      referrer: document.referrer,
      timestamp: Date.now(),
      sessionId: sessionId.current
    };

    errorMonitor.captureUserAction({
      action: 'page_view',
      element: 'page',
      url: pageViewEvent.url,
      timestamp: pageViewEvent.timestamp,
      sessionId: pageViewEvent.sessionId,
      context: {
        title: pageViewEvent.title,
        referrer: pageViewEvent.referrer
      }
    });

    // 重置页面相关状态
    pageStartTime.current = Date.now();
    scrollThresholds.current.clear();
  }, [trackPageViews]);

  // 跟踪页面离开
  const trackPageLeave = useCallback(() => {
    const timeOnPage = Date.now() - pageStartTime.current;
    const maxScroll = Math.max(...Array.from(scrollThresholds.current), 0);

    errorMonitor.captureUserAction({
      action: 'page_leave',
      element: 'page',
      url: window.location.href,
      timestamp: Date.now(),
      sessionId: sessionId.current,
      context: {
        timeOnPage,
        maxScrollPercentage: maxScroll
      }
    });
  }, []);

  // 跟踪表单交互
  const trackFormInteraction = useCallback((event: Event) => {
    if (!trackFormInteractions) return;

    const target = event.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
    if (!target || !['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;

    const form = target.closest('form');
    const formInteractionEvent: FormInteractionEvent = {
      formId: form?.id || undefined,
      fieldName: target.name || target.id || getElementSelector(target),
      action: event.type as 'focus' | 'blur' | 'change' | 'submit',
      value: event.type === 'change' ? target.value?.substring(0, 100) : undefined,
      timestamp: Date.now()
    };

    errorMonitor.captureUserAction({
      action: 'form_interaction',
      element: formInteractionEvent.fieldName,
      url: window.location.href,
      timestamp: formInteractionEvent.timestamp,
      sessionId: sessionId.current,
      context: {
        formId: formInteractionEvent.formId,
        action: formInteractionEvent.action,
        value: formInteractionEvent.value
      }
    });
  }, [trackFormInteractions, getElementSelector]);

  // 跟踪悬停事件
  const trackHoverEvent = useCallback((event: MouseEvent) => {
    if (!trackHover) return;

    const target = event.target as Element;
    if (!target) return;

    // 只跟踪重要元素的悬停
    const importantElements = ['A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA'];
    if (!importantElements.includes(target.tagName)) return;

    errorMonitor.captureUserAction({
      action: 'hover',
      element: getElementSelector(target),
      url: window.location.href,
      timestamp: Date.now(),
      sessionId: sessionId.current,
      context: {
        text: getElementText(target)
      }
    });
  }, [trackHover, getElementSelector, getElementText]);

  // 跟踪键盘事件
  const trackKeyboardEvent = useCallback((event: KeyboardEvent) => {
    if (!trackKeyboard) return;

    // 只跟踪特殊键和快捷键
    const specialKeys = ['Enter', 'Escape', 'Tab', 'Space'];
    const isShortcut = event.ctrlKey || event.metaKey || event.altKey;
    
    if (!specialKeys.includes(event.key) && !isShortcut) return;

    errorMonitor.captureUserAction({
      action: 'keyboard',
      element: 'keyboard',
      url: window.location.href,
      timestamp: Date.now(),
      sessionId: sessionId.current,
      context: {
        key: event.key,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        altKey: event.altKey,
        shiftKey: event.shiftKey
      }
    });
  }, [trackKeyboard]);

  // 跟踪页面可见性变化
  const trackVisibilityChange = useCallback(() => {
    const isVisible = !document.hidden;
    const previousVisibility = isPageVisible.current;
    isPageVisible.current = isVisible;

    if (previousVisibility !== isVisible) {
      errorMonitor.captureUserAction({
        action: 'visibility_change',
        element: 'page',
        url: window.location.href,
        timestamp: Date.now(),
        sessionId: sessionId.current,
        context: {
          visible: isVisible
        }
      });
    }
  }, []);

  // 手动跟踪自定义事件
  const trackCustomEvent = useCallback((eventType: string, data: Record<string, any>) => {
    errorMonitor.captureUserAction({
      action: 'custom',
      element: eventType,
      url: window.location.href,
      timestamp: Date.now(),
      sessionId: sessionId.current,
      context: data
    });
  }, []);

  // 跟踪搜索行为
  const trackSearch = useCallback((query: string, results?: number, filters?: Record<string, any>) => {
    errorMonitor.captureUserAction({
      action: 'search',
      element: 'search',
      url: window.location.href,
      timestamp: Date.now(),
      sessionId: sessionId.current,
      context: {
        query: query.substring(0, 100),
        results,
        filters
      }
    });
  }, []);

  // 跟踪文章阅读行为
  const trackArticleRead = useCallback((articleId: string, readingTime: number, scrollPercentage: number) => {
    errorMonitor.captureUserAction({
      action: 'article_read',
      element: 'article',
      url: window.location.href,
      timestamp: Date.now(),
      sessionId: sessionId.current,
      context: {
        articleId,
        readingTime,
        scrollPercentage
      }
    });
  }, []);

  // 设置事件监听器
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const events: Array<[string, EventListener, boolean?]> = [];

    if (trackClicks) {
      events.push(['click', trackClick as EventListener]);
    }

    if (trackScrolling) {
      events.push(['scroll', trackScroll as EventListener, true]);
    }

    if (trackFormInteractions) {
      events.push(['focus', trackFormInteraction as EventListener, true]);
      events.push(['blur', trackFormInteraction as EventListener, true]);
      events.push(['change', trackFormInteraction as EventListener, true]);
      events.push(['submit', trackFormInteraction as EventListener, true]);
    }

    if (trackHover) {
      events.push(['mouseenter', trackHoverEvent as EventListener, true]);
    }

    if (trackKeyboard) {
      events.push(['keydown', trackKeyboardEvent as EventListener]);
    }

    events.push(['visibilitychange', trackVisibilityChange]);
    events.push(['beforeunload', trackPageLeave]);

    // 添加事件监听器
    events.forEach(([event, handler, useCapture = false]) => {
      document.addEventListener(event, handler, useCapture);
    });

    // 清理函数
    return () => {
      events.forEach(([event, handler, useCapture = false]) => {
        document.removeEventListener(event, handler, useCapture);
      });
    };
  }, [trackClick, trackScroll, trackFormInteraction, trackHoverEvent, trackKeyboardEvent, trackVisibilityChange, trackPageLeave]);

  // 跟踪路由变化
  useEffect(() => {
    trackPageView();
  }, [location.pathname, trackPageView]);

  return {
    trackCustomEvent,
    trackSearch,
    trackArticleRead,
    sessionId: sessionId.current
  };
};

// 高阶组件：为组件添加行为分析
export const withBehaviorAnalytics = <P extends object>(
  Component: React.ComponentType<P>,
  options?: UseBehaviorAnalyticsOptions
) => {
  const WrappedComponent = (props: P) => {
    useBehaviorAnalytics(options);
    return React.createElement(Component, props);
  };

  WrappedComponent.displayName = `withBehaviorAnalytics(${Component.displayName || Component.name})`;
  return WrappedComponent;
};