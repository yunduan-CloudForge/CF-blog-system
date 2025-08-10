import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

/**
 * URL重定向组件
 * 用于处理旧URL到新SEO友好URL的重定向
 */
export function URLRedirect() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const currentPath = location.pathname;
    const searchParams = location.search;
    
    // 定义重定向规则
    const redirectRules: Record<string, string> = {
      // 文章相关重定向
      '/article/': '/articles/',
      '/post/': '/articles/',
      '/blog/': '/articles/',
      
      // 分类相关重定向
      '/category/': '/categories/',
      '/cat/': '/categories/',
      
      // 标签相关重定向
      '/tag/': '/tags/',
      '/label/': '/tags/',
      
      // 管理相关重定向
      '/manage': '/admin/dashboard',
      '/control': '/admin/dashboard',
      
      // 用户相关重定向
      '/user': '/profile',
      '/account': '/profile',
      '/settings': '/profile',
      
      // 创建文章重定向
      '/new': '/articles/create',
      '/add': '/articles/create',
      '/write': '/articles/create',
    };

    // 检查是否需要重定向
    for (const [oldPattern, newPattern] of Object.entries(redirectRules)) {
      if (currentPath.startsWith(oldPattern)) {
        // 构建新的URL
        const newPath = currentPath.replace(oldPattern, newPattern);
        
        // 如果新路径与当前路径不同，执行重定向
        if (newPath !== currentPath) {
          navigate(newPath + searchParams, { replace: true });
          return;
        }
      }
    }

    // 处理特殊的重定向规则
    handleSpecialRedirects(currentPath, searchParams, navigate);
  }, [location.pathname, location.search, navigate]);

  return null; // 这个组件不渲染任何内容
}

/**
 * 处理特殊的重定向规则
 */
function handleSpecialRedirects(
  currentPath: string,
  searchParams: string,
  navigate: (path: string, options?: any) => void
) {
  // 处理带有查询参数的分类筛选
  if (currentPath === '/' && searchParams.includes('category=')) {
    const urlParams = new URLSearchParams(searchParams);
    const category = urlParams.get('category');
    if (category) {
      // 移除category参数，其他参数保留
      urlParams.delete('category');
      const remainingParams = urlParams.toString();
      const newPath = `/categories/${encodeURIComponent(category)}${
        remainingParams ? '?' + remainingParams : ''
      }`;
      navigate(newPath, { replace: true });
      return;
    }
  }

  // 处理带有查询参数的标签筛选
  if (currentPath === '/' && searchParams.includes('tag=')) {
    const urlParams = new URLSearchParams(searchParams);
    const tag = urlParams.get('tag');
    if (tag) {
      // 移除tag参数，其他参数保留
      urlParams.delete('tag');
      const remainingParams = urlParams.toString();
      const newPath = `/tags/${encodeURIComponent(tag)}${
        remainingParams ? '?' + remainingParams : ''
      }`;
      navigate(newPath, { replace: true });
      return;
    }
  }

  // 处理旧的文章ID格式到slug格式的重定向
  const articleIdMatch = currentPath.match(/^\/article\/(\d+)$/);
  if (articleIdMatch) {
    const articleId = articleIdMatch[1];
    // 这里可以调用API获取文章的slug，然后重定向
    // 暂时保持原样，因为需要API支持
    console.log(`需要将文章ID ${articleId} 重定向到对应的slug URL`);
  }

  // 处理编辑文章的URL重定向
  const editIdMatch = currentPath.match(/^\/edit\/(\d+)$/);
  if (editIdMatch) {
    const articleId = editIdMatch[1];
    navigate(`/articles/${articleId}/edit`, { replace: true });
    return;
  }

  // 处理其他常见的错误URL格式
  const commonMistakes: Record<string, string> = {
    '/home': '/',
    '/index': '/',
    '/main': '/',
    '/articles/new': '/articles/create',
    '/articles/add': '/articles/create',
    '/admin/seo-management': '/admin/seo',
    '/admin/seo-settings': '/admin/seo',
  };

  if (commonMistakes[currentPath]) {
    navigate(commonMistakes[currentPath] + searchParams, { replace: true });
  }
}

/**
 * 生成SEO友好的URL
 */
export function generateSEOFriendlyURL(type: string, identifier: string, title?: string): string {
  const baseUrls: Record<string, string> = {
    article: '/articles',
    category: '/categories',
    tag: '/tags',
    user: '/users',
  };

  const baseUrl = baseUrls[type] || '/articles';
  
  if (title) {
    // 将标题转换为SEO友好的slug
    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-') // 保留中文字符
      .replace(/^-+|-+$/g, '') // 移除开头和结尾的连字符
      .substring(0, 100); // 限制长度
    
    return `${baseUrl}/${slug}-${identifier}`;
  }
  
  return `${baseUrl}/${identifier}`;
}

/**
 * 从SEO友好的URL中提取标识符
 */
export function extractIdentifierFromSEOURL(url: string): string | null {
  // 匹配格式: /articles/title-slug-123 或 /articles/123
  const match = url.match(/\/(\d+)(?:-[^/]*)?$/) || url.match(/\/([^/]+)$/);
  return match ? match[1] : null;
}

/**
 * 验证URL是否为SEO友好格式
 */
export function isSEOFriendlyURL(url: string): boolean {
  const seoPatterns = [
    /^\/articles\/[a-z0-9\u4e00-\u9fa5-]+$/,
    /^\/categories\/[a-z0-9\u4e00-\u9fa5-]+$/,
    /^\/tags\/[a-z0-9\u4e00-\u9fa5-]+$/,
    /^\/users\/[a-z0-9\u4e00-\u9fa5-]+$/,
  ];
  
  return seoPatterns.some(pattern => pattern.test(url));
}