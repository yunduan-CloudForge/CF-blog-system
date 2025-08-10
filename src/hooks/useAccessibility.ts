import { useEffect, useRef, useCallback } from 'react';

interface AccessibilityOptions {
  announceOnMount?: string;
  announceOnUpdate?: string;
  role?: string;
  ariaLabel?: string;
  ariaDescribedBy?: string;
}

// Hook for screen reader announcements
export const useScreenReader = () => {
  const announceRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Create a live region for announcements
    const liveRegion = document.createElement('div');
    liveRegion.setAttribute('aria-live', 'polite');
    liveRegion.setAttribute('aria-atomic', 'true');
    liveRegion.style.position = 'absolute';
    liveRegion.style.left = '-10000px';
    liveRegion.style.width = '1px';
    liveRegion.style.height = '1px';
    liveRegion.style.overflow = 'hidden';
    document.body.appendChild(liveRegion);
    announceRef.current = liveRegion;

    return () => {
      if (announceRef.current && document.body.contains(announceRef.current)) {
        document.body.removeChild(announceRef.current);
      }
    };
  }, []);

  const announce = useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    if (announceRef.current) {
      announceRef.current.setAttribute('aria-live', priority);
      announceRef.current.textContent = message;
      
      // Clear the message after a short delay to allow for re-announcements
      setTimeout(() => {
        if (announceRef.current) {
          announceRef.current.textContent = '';
        }
      }, 1000);
    }
  }, []);

  return { announce };
};

// Hook for managing ARIA attributes
export const useAriaAttributes = (options: AccessibilityOptions) => {
  const { announceOnMount, announceOnUpdate, role, ariaLabel, ariaDescribedBy } = options;
  const { announce } = useScreenReader();
  const elementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (announceOnMount) {
      announce(announceOnMount);
    }
  }, [announceOnMount, announce]);

  useEffect(() => {
    if (announceOnUpdate) {
      announce(announceOnUpdate);
    }
  }, [announceOnUpdate, announce]);

  const setAriaAttributes = useCallback((element: HTMLElement) => {
    if (role) element.setAttribute('role', role);
    if (ariaLabel) element.setAttribute('aria-label', ariaLabel);
    if (ariaDescribedBy) element.setAttribute('aria-describedby', ariaDescribedBy);
    elementRef.current = element;
  }, [role, ariaLabel, ariaDescribedBy]);

  return { setAriaAttributes, elementRef };
};

// Hook for skip links
export const useSkipLinks = () => {
  useEffect(() => {
    // Create skip link if it doesn't exist
    if (!document.querySelector('#skip-to-main')) {
      const skipLink = document.createElement('a');
      skipLink.id = 'skip-to-main';
      skipLink.href = '#main-content';
      skipLink.textContent = '跳转到主要内容';
      skipLink.className = 'sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:bg-blue-600 focus:text-white focus:px-4 focus:py-2 focus:rounded';
      
      // Insert at the beginning of body
      document.body.insertBefore(skipLink, document.body.firstChild);
    }
  }, []);
};

// Hook for reduced motion preferences
export const useReducedMotion = () => {
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  
  useEffect(() => {
    if (prefersReducedMotion) {
      document.documentElement.style.setProperty('--animation-duration', '0.01ms');
      document.documentElement.style.setProperty('--transition-duration', '0.01ms');
    }
  }, [prefersReducedMotion]);

  return { prefersReducedMotion };
};

// Hook for high contrast mode detection
export const useHighContrast = () => {
  const prefersHighContrast = window.matchMedia('(prefers-contrast: high)').matches;
  
  useEffect(() => {
    if (prefersHighContrast) {
      document.documentElement.classList.add('high-contrast');
    } else {
      document.documentElement.classList.remove('high-contrast');
    }
  }, [prefersHighContrast]);

  return { prefersHighContrast };
};

// Hook for color scheme preference
export const useColorScheme = () => {
  const prefersDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
  
  return { prefersDarkMode };
};

// Utility function to generate unique IDs for ARIA relationships
export const generateAriaId = (prefix: string = 'aria') => {
  return `${prefix}-${Math.random().toString(36).substr(2, 9)}`;
};