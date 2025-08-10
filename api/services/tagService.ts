import { query, queryOne, execute } from '../database/database.js';
import { Tag, CreateTagData, UpdateTagData, TagWithStats } from '../models/Tag.js';

// 生成标签slug
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
    const existingTag = await queryOne<Tag>(
      excludeId 
        ? 'SELECT id FROM tags WHERE slug = ? AND id != ?'
        : 'SELECT id FROM tags WHERE slug = ?',
      excludeId ? [slug, excludeId] : [slug]
    );
    
    if (!existingTag) {
      return slug;
    }
    
    slug = `${baseSlug}-${counter}`;
    counter++;
  }
};

// 创建标签
export const createTag = async (tagData: CreateTagData): Promise<Tag> => {
  const { name } = tagData;
  
  // 生成唯一slug
  const baseSlug = generateSlug(name);
  const slug = await ensureUniqueSlug(baseSlug);
  
  const result = await execute(
    'INSERT INTO tags (name, slug) VALUES (?, ?)',
    [name, slug]
  );
  
  const tagId = await queryOne<{ id: string }>(
    'SELECT id FROM tags WHERE rowid = ?',
    [result.lastID]
  );
  
  if (!tagId) {
    throw new Error('标签创建失败');
  }
  
  const newTag = await getTagById(tagId.id);
  if (!newTag) {
    throw new Error('标签创建失败');
  }
  
  return newTag;
};

// 获取所有标签
export const getTags = async (): Promise<Tag[]> => {
  const tags = await query<Tag>(
    'SELECT * FROM tags ORDER BY name'
  );
  
  // 转换字段格式为前端期望的camelCase
  return tags.map(tag => ({
    ...tag,
    createdAt: tag.created_at,
    updatedAt: tag.updated_at
  }));
};

// 获取标签（带文章统计）
export const getTagsWithStats = async (): Promise<TagWithStats[]> => {
  const tags = await query<TagWithStats>(
    `SELECT 
      t.*,
      COUNT(at.article_id) as article_count
     FROM tags t
     LEFT JOIN article_tags at ON t.id = at.tag_id
     LEFT JOIN articles a ON at.article_id = a.id AND a.status = 'published'
     GROUP BY t.id
     ORDER BY t.name`
  );
  
  // 转换字段格式为前端期望的camelCase
  return tags.map(tag => ({
    ...tag,
    createdAt: tag.created_at,
    updatedAt: tag.updated_at
  }));
};

// 根据ID获取标签
export const getTagById = async (tagId: string): Promise<Tag | null> => {
  const tag = await queryOne<Tag>(
    'SELECT * FROM tags WHERE id = ?',
    [tagId]
  );
  
  if (!tag) return null;
  
  // 转换字段格式为前端期望的camelCase
  return {
    ...tag,
    createdAt: tag.created_at,
    updatedAt: tag.updated_at
  };
};

// 根据slug获取标签
export const getTagBySlug = async (slug: string): Promise<Tag | null> => {
  const tag = await queryOne<Tag>(
    'SELECT * FROM tags WHERE slug = ?',
    [slug]
  );
  
  if (!tag) return null;
  
  // 转换字段格式为前端期望的camelCase
  return {
    ...tag,
    createdAt: tag.created_at,
    updatedAt: tag.updated_at
  };
};

// 更新标签
export const updateTag = async (tagId: string, updateData: UpdateTagData): Promise<Tag> => {
  const { name } = updateData;
  
  // 检查标签是否存在
  const existingTag = await getTagById(tagId);
  if (!existingTag) {
    throw new Error('标签不存在');
  }
  
  if (!name) {
    throw new Error('没有提供更新数据');
  }
  
  // 更新slug
  const baseSlug = generateSlug(name);
  const slug = await ensureUniqueSlug(baseSlug, tagId);
  
  await execute(
    'UPDATE tags SET name = ?, slug = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [name, slug, tagId]
  );
  
  const updatedTag = await getTagById(tagId);
  if (!updatedTag) {
    throw new Error('标签更新失败');
  }
  
  return updatedTag;
};

// 删除标签
export const deleteTag = async (tagId: string): Promise<void> => {
  // 检查标签是否存在
  const existingTag = await getTagById(tagId);
  if (!existingTag) {
    throw new Error('标签不存在');
  }
  
  // 删除标签和文章的关联
  await execute(
    'DELETE FROM article_tags WHERE tag_id = ?',
    [tagId]
  );
  
  // 删除标签
  await execute(
    'DELETE FROM tags WHERE id = ?',
    [tagId]
  );
};

// 获取热门标签（按文章数量排序）
export const getPopularTags = async (limit: number = 10): Promise<TagWithStats[]> => {
  const tags = await query<TagWithStats>(
    `SELECT 
      t.*,
      COUNT(at.article_id) as article_count
     FROM tags t
     LEFT JOIN article_tags at ON t.id = at.tag_id
     LEFT JOIN articles a ON at.article_id = a.id AND a.status = 'published'
     GROUP BY t.id
     HAVING article_count > 0
     ORDER BY article_count DESC, t.name
     LIMIT ?`,
    [limit]
  );
  
  // 转换字段格式为前端期望的camelCase
  return tags.map(tag => ({
    ...tag,
    createdAt: tag.created_at,
    updatedAt: tag.updated_at
  }));
};