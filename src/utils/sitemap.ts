import { articleApi, categoryApi } from './api';

interface SitemapUrl {
  loc: string;
  lastmod?: string;
  changefreq?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  priority?: number;
}

class SitemapGenerator {
  private baseUrl: string;

  constructor(baseUrl: string = window.location.origin) {
    this.baseUrl = baseUrl.replace(/\/$/, ''); // 移除末尾斜杠
  }

  /**
   * 生成完整的sitemap XML
   */
  async generateSitemap(): Promise<string> {
    const urls = await this.getAllUrls();
    return this.generateXML(urls);
  }

  /**
   * 获取所有需要包含在sitemap中的URL
   */
  private async getAllUrls(): Promise<SitemapUrl[]> {
    const urls: SitemapUrl[] = [];

    // 静态页面
    urls.push(...this.getStaticUrls());

    try {
      // 文章页面
      const articles = await articleApi.getArticles({ page: 1, limit: 1000, status: 'published' });
      urls.push(...this.getArticleUrls(articles.data));

      // 分类页面
      const categories = await categoryApi.getCategories();
      urls.push(...this.getCategoryUrls(categories));
    } catch (error) {
      console.error('获取动态URL失败:', error);
    }

    return urls;
  }

  /**
   * 获取静态页面URL
   */
  private getStaticUrls(): SitemapUrl[] {
    return [
      {
        loc: this.baseUrl,
        changefreq: 'daily',
        priority: 1.0,
        lastmod: new Date().toISOString().split('T')[0]
      },
      {
        loc: `${this.baseUrl}/about`,
        changefreq: 'monthly',
        priority: 0.8
      },
      {
        loc: `${this.baseUrl}/contact`,
        changefreq: 'monthly',
        priority: 0.7
      },
      {
        loc: `${this.baseUrl}/login`,
        changefreq: 'yearly',
        priority: 0.3
      },
      {
        loc: `${this.baseUrl}/register`,
        changefreq: 'yearly',
        priority: 0.3
      }
    ];
  }

  /**
   * 获取文章页面URL
   */
  private getArticleUrls(articles: any[]): SitemapUrl[] {
    return articles.map(article => ({
      loc: `${this.baseUrl}/articles/${article.slug}`,
      lastmod: new Date(article.updatedAt || article.createdAt).toISOString().split('T')[0],
      changefreq: 'weekly' as const,
      priority: 0.9
    }));
  }

  /**
   * 获取分类页面URL
   */
  private getCategoryUrls(categories: any[]): SitemapUrl[] {
    return categories.map(category => ({
      loc: `${this.baseUrl}/categories/${category.slug}`,
      changefreq: 'weekly' as const,
      priority: 0.8
    }));
  }

  /**
   * 生成sitemap XML
   */
  private generateXML(urls: SitemapUrl[]): string {
    const urlElements = urls.map(url => {
      let urlXml = `    <url>\n      <loc>${this.escapeXml(url.loc)}</loc>\n`;
      
      if (url.lastmod) {
        urlXml += `      <lastmod>${url.lastmod}</lastmod>\n`;
      }
      
      if (url.changefreq) {
        urlXml += `      <changefreq>${url.changefreq}</changefreq>\n`;
      }
      
      if (url.priority !== undefined) {
        urlXml += `      <priority>${url.priority.toFixed(1)}</priority>\n`;
      }
      
      urlXml += `    </url>`;
      return urlXml;
    }).join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urlElements}\n</urlset>`;
  }

  /**
   * 转义XML特殊字符
   */
  private escapeXml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * 下载sitemap文件
   */
  async downloadSitemap(): Promise<void> {
    try {
      const sitemapXml = await this.generateSitemap();
      const blob = new Blob([sitemapXml], { type: 'application/xml' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = 'sitemap.xml';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('下载sitemap失败:', error);
      throw error;
    }
  }

  /**
   * 获取sitemap URL列表（用于调试）
   */
  async getUrlList(): Promise<SitemapUrl[]> {
    return this.getAllUrls();
  }
}

// 导出单例实例
export const sitemapGenerator = new SitemapGenerator();

// 导出类型
export type { SitemapUrl };
export { SitemapGenerator };