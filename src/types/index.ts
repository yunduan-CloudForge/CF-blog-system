// 用户相关类型
export interface User {
  id: number;
  name: string;
  username: string;
  email: string;
  role: 'admin' | 'editor' | 'reader';
  avatar?: string;
  bio?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LoginResponse {
  token: string;
  user: User;
}

export interface RegisterData {
  username: string;
  email: string;
  password: string;
}

// 分类相关类型
export interface Category {
  id: number;
  name: string;
  slug: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CategoryWithStats extends Category {
  articleCount: number;
}

export interface CreateCategory {
  name: string;
  description?: string;
  color: string;
}

export interface UpdateCategory {
  name?: string;
  description?: string;
  color?: string;
}

// 标签相关类型
export interface Tag {
  id: number;
  name: string;
  slug: string;
  createdAt: string;
  updatedAt: string;
}

export interface TagWithStats extends Tag {
  articleCount: number;
}

// 文章相关类型
export interface Article {
  id: number;
  title: string;
  slug: string;
  content: string;
  excerpt?: string;
  status: 'draft' | 'published' | 'archived';
  authorId: number;
  categoryId?: number;
  viewCount: number;
  commentCount: number;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
  author?: User;
  category?: Category;
  tags?: Tag[];
}

export interface ArticleListQuery {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
  tag?: string;
  tags?: string;
  status?: 'draft' | 'published' | 'archived';
  author?: string;
  author_id?: string;
  startDate?: string;
  endDate?: string;
}

export interface ArticleListResponse {
  articles: Article[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface CreateArticleData {
  title: string;
  content: string;
  excerpt?: string;
  status: 'draft' | 'published';
  categoryId?: number;
  tags?: string[];
}

export interface UpdateArticleData {
  title?: string;
  content?: string;
  excerpt?: string;
  status?: 'draft' | 'published' | 'archived';
  categoryId?: number;
  tagIds?: number[];
}

// 评论相关类型
export interface Comment {
  id: number;
  content: string;
  status: 'pending' | 'approved' | 'rejected';
  articleId: number;
  userId: number;
  parentId?: number;
  createdAt: string;
  updatedAt: string;
  user?: User;
  replies?: Comment[];
}

export interface CommentWithUser extends Comment {
  user: User;
}

export interface CreateCommentData {
  content: string;
  articleId: number;
  parentId?: number;
}

export interface CommentListQuery {
  page?: number;
  limit?: number;
  articleId?: number;
  userId?: number;
  status?: 'pending' | 'approved' | 'rejected';
  parentId?: number;
}

export interface CommentListResponse {
  comments: CommentWithUser[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// API 响应类型
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface PaginationResponse {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// 表单相关类型
export interface FormErrors {
  [key: string]: string;
}

export interface LoadingState {
  [key: string]: boolean;
}