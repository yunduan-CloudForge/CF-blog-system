import express from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import {
  createCategory,
  getCategories,
  getCategoriesWithStats,
  getCategoryById,
  getCategoryBySlug,
  updateCategory,
  deleteCategory
} from '../services/categoryService.js';
import { CreateCategoryData, UpdateCategoryData } from '../models/Category.js';

const router = express.Router();

// 获取分类列表
router.get('/', async (req, res) => {
  try {
    const withStats = req.query.stats === 'true';
    
    const categories = withStats 
      ? await getCategoriesWithStats()
      : await getCategories();
    
    res.json({
      success: true,
      message: '获取分类列表成功',
      data: { categories }
    });
  } catch (error) {
    console.error('获取分类列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取分类列表失败',
      error: error instanceof Error ? error.message : '未知错误'
    });
  }
});

// 根据ID或slug获取分类
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // 判断是ID还是slug
    let category;
    if (id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      // UUID格式，按ID查询
      category = await getCategoryById(id);
    } else {
      // 按slug查询
      category = await getCategoryBySlug(id);
    }
    
    if (!category) {
      return res.status(404).json({ error: '分类不存在' });
    }
    
    res.json({ category });
  } catch (error) {
    console.error('获取分类失败:', error);
    res.status(500).json({ error: '获取分类失败' });
  }
});

// 创建分类（需要管理员权限）
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { name, description, color } = req.body;
    
    // 验证必填字段
    if (!name || !color) {
      return res.status(400).json({ error: '分类名称和颜色为必填项' });
    }
    
    if (name.length > 50) {
      return res.status(400).json({ error: '分类名称长度不能超过50字符' });
    }
    
    if (description && description.length > 200) {
      return res.status(400).json({ error: '分类描述长度不能超过200字符' });
    }
    
    // 验证颜色格式（十六进制）
    if (!/^#[0-9A-Fa-f]{6}$/.test(color)) {
      return res.status(400).json({ error: '颜色格式不正确，请使用十六进制格式（如#FF0000）' });
    }
    
    const categoryData: CreateCategoryData = {
      name,
      description,
      color
    };
    
    const category = await createCategory(categoryData);
    
    res.status(201).json({ category });
  } catch (error) {
    console.error('创建分类失败:', error);
    if (error instanceof Error) {
      res.status(400).json({ error: error.message });
    } else {
      res.status(500).json({ error: '创建分类失败' });
    }
  }
});

// 更新分类（需要管理员权限）
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, color } = req.body;
    
    // 验证数据
    if (name && name.length > 50) {
      return res.status(400).json({ error: '分类名称长度不能超过50字符' });
    }
    
    if (description && description.length > 200) {
      return res.status(400).json({ error: '分类描述长度不能超过200字符' });
    }
    
    if (color && !/^#[0-9A-Fa-f]{6}$/.test(color)) {
      return res.status(400).json({ error: '颜色格式不正确，请使用十六进制格式（如#FF0000）' });
    }
    
    const updateData: UpdateCategoryData = {};
    
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (color !== undefined) updateData.color = color;
    
    const category = await updateCategory(id, updateData);
    
    res.json({ category });
  } catch (error) {
    console.error('更新分类失败:', error);
    if (error instanceof Error) {
      if (error.message.includes('不存在')) {
        res.status(404).json({ error: error.message });
      } else {
        res.status(400).json({ error: error.message });
      }
    } else {
      res.status(500).json({ error: '更新分类失败' });
    }
  }
});

// 删除分类（需要管理员权限）
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    await deleteCategory(id);
    
    res.json({ message: '分类删除成功' });
  } catch (error) {
    console.error('删除分类失败:', error);
    if (error instanceof Error) {
      if (error.message.includes('不存在')) {
        res.status(404).json({ error: error.message });
      } else if (error.message.includes('还有文章')) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(400).json({ error: error.message });
      }
    } else {
      res.status(500).json({ error: '删除分类失败' });
    }
  }
});

export default router;