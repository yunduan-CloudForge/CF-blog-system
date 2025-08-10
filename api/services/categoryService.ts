import { query, queryOne, execute } from '../database/database.js';
import { Category, CreateCategoryData, UpdateCategoryData, CategoryWithStats } from '../models/Category.js';

// 生成分类slug
const generateSlug = (name: string): string => {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 100);
};

// 确保slug唯一性
const ensureUniqueSlug = async (baseSlug: string, excludeId?: string): Promise<string> => {
  let slug = baseSlug;
  let counter = 1;
  
  while (true) {
    const existingCategory = await queryOne<Category>(
      excludeId 
        ? 'SELECT id FROM categories WHERE slug = ? AND id != ?'
        : 'SELECT id FROM categories WHERE slug = ?',
      excludeId ? [slug, excludeId] : [slug]
    );
    
    if (!existingCategory) {
      return slug;
    }
    
    slug = `${baseSlug}-${counter}`;
    counter++;
  }
};

// 创建分类
export const createCategory = async (categoryData: CreateCategoryData): Promise<Category> => {
  const { name, description, color } = categoryData;
  
  // 生成唯一slug
  const baseSlug = generateSlug(name);
  const slug = await ensureUniqueSlug(baseSlug);
  
  const result = await execute(
    'INSERT INTO categories (name, slug, description, color) VALUES (?, ?, ?, ?)',
    [name, slug, description || null, color]
  );
  
  const categoryId = await queryOne<{ id: string }>(
    'SELECT id FROM categories WHERE rowid = ?',
    [result.lastID]
  );
  
  if (!categoryId) {
    throw new Error('分类创建失败');
  }
  
  const newCategory = await getCategoryById(categoryId.id);
  if (!newCategory) {
    throw new Error('分类创建失败');
  }
  
  return newCategory;
};

// 获取所有分类
export const getCategories = async (): Promise<Category[]> => {
  const categories = await query<Category>(
    'SELECT * FROM categories ORDER BY name'
  );
  
  // 转换字段格式为前端期望的camelCase
  return categories.map(category => ({
    ...category,
    createdAt: category.created_at,
    updatedAt: category.updated_at
  }));
};

// 获取分类（带文章统计）
export const getCategoriesWithStats = async (): Promise<CategoryWithStats[]> => {
  const categories = await query<CategoryWithStats>(
    `SELECT 
      c.*,
      COUNT(a.id) as article_count
     FROM categories c
     LEFT JOIN articles a ON c.id = a.category_id AND a.status = 'published'
     GROUP BY c.id
     ORDER BY c.name`
  );
  
  // 转换字段格式为前端期望的camelCase
  return categories.map(category => ({
    ...category,
    createdAt: category.created_at,
    updatedAt: category.updated_at
  }));
};

// 根据ID获取分类
export const getCategoryById = async (categoryId: string): Promise<Category | null> => {
  const category = await queryOne<Category>(
    'SELECT * FROM categories WHERE id = ?',
    [categoryId]
  );
  
  if (!category) return null;
  
  // 转换字段格式为前端期望的camelCase
  return {
    ...category,
    createdAt: category.created_at,
    updatedAt: category.updated_at
  };
};

// 根据slug获取分类
export const getCategoryBySlug = async (slug: string): Promise<Category | null> => {
  const category = await queryOne<Category>(
    'SELECT * FROM categories WHERE slug = ?',
    [slug]
  );
  
  if (!category) return null;
  
  // 转换字段格式为前端期望的camelCase
  return {
    ...category,
    createdAt: category.created_at,
    updatedAt: category.updated_at
  };
};

// 更新分类
export const updateCategory = async (categoryId: string, updateData: UpdateCategoryData): Promise<Category> => {
  const { name, description, color } = updateData;
  
  // 检查分类是否存在
  const existingCategory = await getCategoryById(categoryId);
  if (!existingCategory) {
    throw new Error('分类不存在');
  }
  
  const updates: string[] = [];
  const values: any[] = [];
  
  if (name !== undefined) {
    updates.push('name = ?');
    values.push(name);
    
    // 更新slug
    const baseSlug = generateSlug(name);
    const slug = await ensureUniqueSlug(baseSlug, categoryId);
    updates.push('slug = ?');
    values.push(slug);
  }
  
  if (description !== undefined) {
    updates.push('description = ?');
    values.push(description);
  }
  
  if (color !== undefined) {
    updates.push('color = ?');
    values.push(color);
  }
  
  if (updates.length === 0) {
    throw new Error('没有提供更新数据');
  }
  
  updates.push('updated_at = CURRENT_TIMESTAMP');
  values.push(categoryId);
  
  await execute(
    `UPDATE categories SET ${updates.join(', ')} WHERE id = ?`,
    values
  );
  
  const updatedCategory = await getCategoryById(categoryId);
  if (!updatedCategory) {
    throw new Error('分类更新失败');
  }
  
  return updatedCategory;
};

// 删除分类
export const deleteCategory = async (categoryId: string): Promise<void> => {
  // 检查分类是否存在
  const existingCategory = await getCategoryById(categoryId);
  if (!existingCategory) {
    throw new Error('分类不存在');
  }
  
  // 检查是否有文章使用此分类
  const articleCount = await queryOne<{ count: number }>(
    'SELECT COUNT(*) as count FROM articles WHERE category_id = ?',
    [categoryId]
  );
  
  if (articleCount && articleCount.count > 0) {
    throw new Error('该分类下还有文章，无法删除');
  }
  
  await execute(
    'DELETE FROM categories WHERE id = ?',
    [categoryId]
  );
};