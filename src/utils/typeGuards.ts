import { z } from 'zod';
import {
  UserSchema,
  ArticleSchema,
  CategorySchema,
  TagSchema,
  CommentSchema,
  ApiResponseSchema,
  PaginatedResponseSchema
} from '../types/schemas';
import type {
  User,
  Article,
  Category,
  Tag,
  Comment,
  ApiResponse,
  PaginatedResponse
} from '../types/schemas';

// 基础类型守卫
export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

export function isNumber(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value);
}

export function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

// 业务类型守卫
export function isUser(value: unknown): value is User {
  try {
    UserSchema.parse(value);
    return true;
  } catch {
    return false;
  }
}

export function isArticle(value: unknown): value is Article {
  try {
    ArticleSchema.parse(value);
    return true;
  } catch {
    return false;
  }
}

export function isCategory(value: unknown): value is Category {
  try {
    CategorySchema.parse(value);
    return true;
  } catch {
    return false;
  }
}

export function isTag(value: unknown): value is Tag {
  try {
    TagSchema.parse(value);
    return true;
  } catch {
    return false;
  }
}

export function isComment(value: unknown): value is Comment {
  try {
    CommentSchema.parse(value);
    return true;
  } catch {
    return false;
  }
}

export function isApiResponse<T = any>(value: unknown): value is ApiResponse<T> {
  try {
    ApiResponseSchema.parse(value);
    return true;
  } catch {
    return false;
  }
}

export function isPaginatedResponse<T = any>(value: unknown): value is PaginatedResponse<T> {
  try {
    PaginatedResponseSchema.parse(value);
    return true;
  } catch {
    return false;
  }
}

// 数组类型守卫
export function isUserArray(value: unknown): value is User[] {
  return isArray(value) && value.every(isUser);
}

export function isArticleArray(value: unknown): value is Article[] {
  return isArray(value) && value.every(isArticle);
}

export function isCategoryArray(value: unknown): value is Category[] {
  return isArray(value) && value.every(isCategory);
}

export function isTagArray(value: unknown): value is Tag[] {
  return isArray(value) && value.every(isTag);
}

export function isCommentArray(value: unknown): value is Comment[] {
  return isArray(value) && value.every(isComment);
}

// 验证函数（抛出错误）
export function validateUser(value: unknown): User {
  return UserSchema.parse(value);
}

export function validateArticle(value: unknown): Article {
  return ArticleSchema.parse(value);
}

export function validateCategory(value: unknown): Category {
  return CategorySchema.parse(value);
}

export function validateTag(value: unknown): Tag {
  return TagSchema.parse(value);
}

export function validateComment(value: unknown): Comment {
  return CommentSchema.parse(value);
}

export function validateApiResponse<T = any>(value: unknown): ApiResponse<T> {
  return ApiResponseSchema.parse(value);
}

export function validatePaginatedResponse<T = any>(value: unknown): PaginatedResponse<T> {
  return PaginatedResponseSchema.parse(value);
}

// 安全验证函数（返回结果对象）
export function safeValidateUser(value: unknown): { success: true; data: User } | { success: false; error: string } {
  try {
    const data = UserSchema.parse(value);
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : '验证失败' };
  }
}

export function safeValidateArticle(value: unknown): { success: true; data: Article } | { success: false; error: string } {
  try {
    const data = ArticleSchema.parse(value);
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : '验证失败' };
  }
}

export function safeValidateCategory(value: unknown): { success: true; data: Category } | { success: false; error: string } {
  try {
    const data = CategorySchema.parse(value);
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : '验证失败' };
  }
}

export function safeValidateTag(value: unknown): { success: true; data: Tag } | { success: false; error: string } {
  try {
    const data = TagSchema.parse(value);
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : '验证失败' };
  }
}

export function safeValidateComment(value: unknown): { success: true; data: Comment } | { success: false; error: string } {
  try {
    const data = CommentSchema.parse(value);
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : '验证失败' };
  }
}

// 通用验证函数
export function validateWithSchema<T>(schema: z.ZodSchema<T>, value: unknown): T {
  return schema.parse(value);
}

export function safeValidateWithSchema<T>(
  schema: z.ZodSchema<T>,
  value: unknown
): { success: true; data: T } | { success: false; error: string } {
  try {
    const data = schema.parse(value);
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : '验证失败' };
  }
}