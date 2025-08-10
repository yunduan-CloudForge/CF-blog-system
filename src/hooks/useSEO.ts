import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

interface SEOData {
  title?: string;
  description?: string;
  keywords?: string;
  image?: string;
  author?: string;
  publishedTime?: string;
  modifiedTime?: string;
  section?: string;
  tags?: string[];
  type?: 'website' | 'article' | 'profile';
}

interface BreadcrumbItem {
  name: string;
  url: string;
}

interface UseSEOOptions {
  seo?: SEOData;
  breadcrumbs?: BreadcrumbItem[];
  structuredData?: any;
}

const useSEO = ({ seo, breadcrumbs, structuredData }: UseSEOOptions = {}) => {
  const location = useLocation();
  const currentUrl = `${window.location.origin}${location.pathname}`;

  useEffect(() => {
    // 更新页面标题
    if (seo?.title) {
      document.title = `${seo.title} | 个人博客系统`;
    }

    // 更新meta描述
    if (seo?.description) {
      const metaDescription = document.querySelector('meta[name="description"]');
      if (metaDescription) {
        metaDescription.setAttribute('content', seo.description);
      } else {
        const meta = document.createElement('meta');
        meta.name = 'description';
        meta.content = seo.description;
        document.head.appendChild(meta);
      }
    }

    // 更新关键词
    if (seo?.keywords) {
      const metaKeywords = document.querySelector('meta[name="keywords"]');
      if (metaKeywords) {
        metaKeywords.setAttribute('content', seo.keywords);
      } else {
        const meta = document.createElement('meta');
        meta.name = 'keywords';
        meta.content = seo.keywords;
        document.head.appendChild(meta);
      }
    }

    // 更新Open Graph标签
    if (seo?.title) {
      updateMetaProperty('og:title', `${seo.title} | 个人博客系统`);
    }
    if (seo?.description) {
      updateMetaProperty('og:description', seo.description);
    }
    if (seo?.image) {
      updateMetaProperty('og:image', seo.image);
    }
    updateMetaProperty('og:url', currentUrl);
    updateMetaProperty('og:type', seo?.type || 'website');

    // 更新Twitter Card标签
    if (seo?.title) {
      updateMetaName('twitter:title', `${seo.title} | 个人博客系统`);
    }
    if (seo?.description) {
      updateMetaName('twitter:description', seo.description);
    }
    if (seo?.image) {
      updateMetaName('twitter:image', seo.image);
    }

    // 更新canonical链接
    updateCanonicalUrl(currentUrl);

    // 文章特定的meta标签
    if (seo?.type === 'article') {
      if (seo.author) {
        updateMetaProperty('article:author', seo.author);
      }
      if (seo.publishedTime) {
        updateMetaProperty('article:published_time', seo.publishedTime);
      }
      if (seo.modifiedTime) {
        updateMetaProperty('article:modified_time', seo.modifiedTime);
      }
      if (seo.section) {
        updateMetaProperty('article:section', seo.section);
      }
      if (seo.tags) {
        // 移除现有的article:tag标签
        const existingTags = document.querySelectorAll('meta[property="article:tag"]');
        existingTags.forEach(tag => tag.remove());
        
        // 添加新的标签
        seo.tags.forEach(tag => {
          const meta = document.createElement('meta');
          meta.setAttribute('property', 'article:tag');
          meta.content = tag;
          document.head.appendChild(meta);
        });
      }
    }

    // 添加结构化数据
    if (structuredData) {
      addStructuredData(structuredData);
    }

  }, [seo, currentUrl, structuredData]);

  // 辅助函数：更新meta property
  const updateMetaProperty = (property: string, content: string) => {
    let meta = document.querySelector(`meta[property="${property}"]`);
    if (meta) {
      meta.setAttribute('content', content);
    } else {
      meta = document.createElement('meta');
      meta.setAttribute('property', property);
      meta.content = content;
      document.head.appendChild(meta);
    }
  };

  // 辅助函数：更新meta name
  const updateMetaName = (name: string, content: string) => {
    let meta = document.querySelector(`meta[name="${name}"]`);
    if (meta) {
      meta.setAttribute('content', content);
    } else {
      meta = document.createElement('meta');
      meta.name = name;
      meta.content = content;
      document.head.appendChild(meta);
    }
  };

  // 辅助函数：更新canonical URL
  const updateCanonicalUrl = (url: string) => {
    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;
    if (canonical) {
      canonical.href = url;
    } else {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      canonical.href = url;
      document.head.appendChild(canonical);
    }
  };

  // 辅助函数：添加结构化数据
  const addStructuredData = (data: any) => {
    // 移除现有的结构化数据
    const existingScript = document.querySelector('script[type="application/ld+json"]');
    if (existingScript) {
      existingScript.remove();
    }

    // 添加新的结构化数据
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify(data, null, 2);
    document.head.appendChild(script);
  };

  return {
    currentUrl,
    updateSEO: (newSEO: SEOData) => {
      // 可以用于动态更新SEO信息
    }
  };
};

export default useSEO;
export type { SEOData, BreadcrumbItem, UseSEOOptions };