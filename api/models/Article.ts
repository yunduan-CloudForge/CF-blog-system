export interface Article {
  id: string;
  author_id: string;
  category_id: string;
  title: string;
  content: string;
  excerpt?: string;
  slug: string;
  status: 'draft' | 'published' | 'archived';
  view_count: number;
  published_at?: string;
  created_at: string;
  updated_at: string;
}

export interface ArticleWithAuthor extends Article {
  author_name: string;
  author_email: string;
  category_name: string;
  category_slug: string;
  category_color: string;
}

export interface CreateArticleData {
  title: string;
  content: string;
  excerpt?: string;
  category_id: string;
  tags?: string[];
  status?: 'draft' | 'published';
}

export interface UpdateArticleData {
  title?: string;
  content?: string;
  excerpt?: string;
  category_id?: string;
  tags?: string[];
  status?: 'draft' | 'published' | 'archived';
}

export interface ArticleListQuery {
  page?: number;
  limit?: number;
  category?: string;
  search?: string;
  status?: string;
  author_id?: string;
  tags?: string;
  startDate?: string;
  endDate?: string;
}

export interface ArticleListResponse {
  articles: ArticleWithAuthor[];
  total: number;
  page: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  color: string;
  created_at: string;
}

export interface Tag {
  id: string;
  name: string;
  slug: string;
  created_at: string;
}