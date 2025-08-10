import { z } from 'zod';

// 用户相关模式
export const UserSchema = z.object({
  id: z.number(),
  username: z.string().min(1, '用户名不能为空'),
  email: z.string().email('邮箱格式不正确'),
  role: z.enum(['admin', 'editor', 'reader']),
  avatar: z.string().nullable(),
  bio: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string()
});

export const CreateUserSchema = z.object({
  username: z.string().min(1, '用户名不能为空').max(50, '用户名不能超过50个字符'),
  email: z.string().email('邮箱格式不正确'),
  password: z.string().min(6, '密码至少6个字符'),
  role: z.enum(['admin', 'editor', 'reader']).optional().default('reader')
});

export const LoginSchema = z.object({
  email: z.string().email('邮箱格式不正确'),
  password: z.string().min(1, '密码不能为空')
});

// 文章相关模式
export const ArticleSchema = z.object({
  id: z.number(),
  title: z.string().min(1, '标题不能为空'),
  content: z.string().min(1, '内容不能为空'),
  excerpt: z.string().nullable(),
  featured_image: z.string().nullable(),
  status: z.enum(['draft', 'published', 'archived']),
  author_id: z.number(),
  category_id: z.number(),
  created_at: z.string(),
  updated_at: z.string(),
  author: UserSchema.optional(),
  category: z.object({
    id: z.number(),
    name: z.string(),
    slug: z.string()
  }).optional(),
  tags: z.array(z.object({
    id: z.number(),
    name: z.string(),
    slug: z.string()
  })).optional()
});

export const CreateArticleSchema = z.object({
  title: z.string().min(1, '标题不能为空').max(200, '标题不能超过200个字符'),
  content: z.string().min(1, '内容不能为空'),
  excerpt: z.string().max(500, '摘要不能超过500个字符').optional(),
  featured_image: z.string().url('图片链接格式不正确').optional(),
  status: z.enum(['draft', 'published', 'archived']).default('draft'),
  category_id: z.number().positive('请选择分类'),
  tag_ids: z.array(z.number()).optional()
});

export const UpdateArticleSchema = CreateArticleSchema.partial();

// 分类相关模式
export const CategorySchema = z.object({
  id: z.number(),
  name: z.string().min(1, '分类名称不能为空'),
  slug: z.string().min(1, 'URL别名不能为空'),
  description: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string()
});

export const CreateCategorySchema = z.object({
  name: z.string().min(1, '分类名称不能为空').max(50, '分类名称不能超过50个字符'),
  slug: z.string().min(1, 'URL别名不能为空').max(50, 'URL别名不能超过50个字符'),
  description: z.string().max(200, '描述不能超过200个字符').optional()
});

// 标签相关模式
export const TagSchema = z.object({
  id: z.number(),
  name: z.string().min(1, '标签名称不能为空'),
  slug: z.string().min(1, 'URL别名不能为空'),
  created_at: z.string(),
  updated_at: z.string()
});

export const CreateTagSchema = z.object({
  name: z.string().min(1, '标签名称不能为空').max(30, '标签名称不能超过30个字符'),
  slug: z.string().min(1, 'URL别名不能为空').max(30, 'URL别名不能超过30个字符')
});

// 评论相关模式
export const CommentSchema = z.object({
  id: z.number(),
  content: z.string().min(1, '评论内容不能为空'),
  author_name: z.string().min(1, '作者姓名不能为空'),
  author_email: z.string().email('邮箱格式不正确'),
  article_id: z.number(),
  parent_id: z.number().nullable(),
  status: z.enum(['pending', 'approved', 'rejected']),
  created_at: z.string(),
  updated_at: z.string()
});

export const CreateCommentSchema = z.object({
  content: z.string().min(1, '评论内容不能为空').max(1000, '评论内容不能超过1000个字符'),
  author_name: z.string().min(1, '作者姓名不能为空').max(50, '作者姓名不能超过50个字符'),
  author_email: z.string().email('邮箱格式不正确'),
  article_id: z.number().positive('文章ID无效'),
  parent_id: z.number().positive().optional()
});

// API响应模式
export const ApiResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.any().nullable().optional(),
  error: z.string().optional()
});

export const PaginationSchema = z.object({
  page: z.number().positive(),
  limit: z.number().positive().max(100),
  total: z.number().nonnegative(),
  totalPages: z.number().nonnegative()
});

export const PaginatedResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.array(z.any()).optional(),
  pagination: PaginationSchema.optional()
});

// 类型导出
export type User = z.infer<typeof UserSchema>;
export type CreateUser = z.infer<typeof CreateUserSchema>;
export type LoginData = z.infer<typeof LoginSchema>;
export type Article = z.infer<typeof ArticleSchema>;
export type CreateArticle = z.infer<typeof CreateArticleSchema>;
export type UpdateArticle = z.infer<typeof UpdateArticleSchema>;
export type Category = z.infer<typeof CategorySchema>;
export type CreateCategory = z.infer<typeof CreateCategorySchema>;
export type Tag = z.infer<typeof TagSchema>;
export type CreateTag = z.infer<typeof CreateTagSchema>;
export type Comment = z.infer<typeof CommentSchema>;
export type CreateComment = z.infer<typeof CreateCommentSchema>;
export type ApiResponse<T = any> = {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
};
export type Pagination = z.infer<typeof PaginationSchema>;
export type PaginatedResponse<T = any> = {
  success: boolean;
  message: string;
  data?: T[];
  pagination?: Pagination;
};