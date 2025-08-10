import React from 'react';
import { Helmet } from 'react-helmet-async';

interface PersonSchema {
  '@type': 'Person';
  name: string;
  url?: string;
  image?: string;
  sameAs?: string[];
}

interface OrganizationSchema {
  '@type': 'Organization';
  name: string;
  url?: string;
  logo?: string;
  sameAs?: string[];
}

interface ArticleSchema {
  '@type': 'Article' | 'BlogPosting';
  headline: string;
  description?: string;
  image?: string | string[];
  author: PersonSchema | OrganizationSchema;
  publisher: OrganizationSchema;
  datePublished: string;
  dateModified?: string;
  mainEntityOfPage: {
    '@type': 'WebPage';
    '@id': string;
  };
  articleSection?: string;
  keywords?: string[];
  wordCount?: number;
  url: string;
}

interface WebSiteSchema {
  '@type': 'WebSite';
  name: string;
  url: string;
  description?: string;
  publisher: OrganizationSchema;
  potentialAction?: {
    '@type': 'SearchAction';
    target: {
      '@type': 'EntryPoint';
      urlTemplate: string;
    };
    'query-input': string;
  };
}

interface BreadcrumbSchema {
  '@type': 'BreadcrumbList';
  itemListElement: Array<{
    '@type': 'ListItem';
    position: number;
    name: string;
    item: string;
  }>;
}

interface StructuredDataProps {
  type: 'website' | 'article' | 'breadcrumb';
  data: WebSiteSchema | ArticleSchema | BreadcrumbSchema;
}

const StructuredData: React.FC<StructuredDataProps> = ({ type, data }) => {
  const structuredData = {
    '@context': 'https://schema.org',
    ...data
  };

  return (
    <Helmet>
      <script type="application/ld+json">
        {JSON.stringify(structuredData, null, 2)}
      </script>
    </Helmet>
  );
};

// 预定义的组织信息
export const defaultPublisher: OrganizationSchema = {
  '@type': 'Organization',
  name: '个人博客系统',
  url: import.meta.env.VITE_SITE_URL || 'https://yourdomain.com',
  logo: `${import.meta.env.VITE_SITE_URL || 'https://yourdomain.com'}/images/logo.png`
};

// 网站结构化数据
export const createWebSiteSchema = (siteUrl: string): WebSiteSchema => ({
  '@type': 'WebSite',
  name: '个人博客系统',
  url: siteUrl,
  description: '分享技术见解、生活感悟和创意思考的个人博客平台',
  publisher: defaultPublisher,
  potentialAction: {
    '@type': 'SearchAction',
    target: {
      '@type': 'EntryPoint',
      urlTemplate: `${siteUrl}/search?q={search_term_string}`
    },
    'query-input': 'required name=search_term_string'
  }
});

// 文章结构化数据
export const createArticleSchema = ({
  title,
  description,
  image,
  author,
  publishedDate,
  modifiedDate,
  url,
  category,
  tags,
  wordCount
}: {
  title: string;
  description?: string;
  image?: string;
  author: { name: string; url?: string };
  publishedDate: string;
  modifiedDate?: string;
  url: string;
  category?: string;
  tags?: string[];
  wordCount?: number;
}): ArticleSchema => ({
  '@type': 'BlogPosting',
  headline: title,
  description,
  image: image ? [image] : undefined,
  author: {
    '@type': 'Person',
    name: author.name,
    url: author.url
  },
  publisher: defaultPublisher,
  datePublished: publishedDate,
  dateModified: modifiedDate || publishedDate,
  mainEntityOfPage: {
    '@type': 'WebPage',
    '@id': url
  },
  articleSection: category,
  keywords: tags,
  wordCount,
  url
});

// 面包屑结构化数据
export const createBreadcrumbSchema = (breadcrumbs: Array<{ name: string; url: string }>): BreadcrumbSchema => ({
  '@type': 'BreadcrumbList',
  itemListElement: breadcrumbs.map((item, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    name: item.name,
    item: item.url
  }))
});

export default StructuredData;
export { StructuredData };
export type { ArticleSchema, WebSiteSchema, BreadcrumbSchema, PersonSchema, OrganizationSchema };