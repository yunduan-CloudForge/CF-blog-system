import express from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import {
  createTag,
  getTags,
  getTagsWithStats,
  getTagById,
  getTagBySlug,
  updateTag,
  deleteTag,
  getPopularTags
} from '../services/tagService.js';
import { CreateTagData, UpdateTagData } from '../models/Tag.js';

const router = express.Router();

// 获取标签列表
router.get('/', async (req, res) => {
  try {
    const withStats = req.query.stats === 'true';
    const popular = req.query.popular === 'true';
    const limit = parseInt(req.query.limit as string) || 10;
    
    let tags;
    if (popular) {
      tags = await getPopularTags(Math.min(limit, 50)); // 限制最大50个
    } else if (withStats) {
      tags = await getTagsWithStats();
    } else {
      tags = await getTags();
    }
    
    res.json({
      success: true,
      message: '获取标签列表成功',
      data: { tags }
    });
  } catch (error) {
    console.error('获取标签列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取标签列表失败',
      error: error instanceof Error ? error.message : '未知错误'
    });
  }
});

// 根据ID或slug获取标签
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // 判断是ID还是slug
    let tag;
    if (id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      // UUID格式，按ID查询
      tag = await getTagById(id);
    } else {
      // 按slug查询
      tag = await getTagBySlug(id);
    }
    
    if (!tag) {
      return res.status(404).json({ error: '标签不存在' });
    }
    
    res.json({ tag });
  } catch (error) {
    console.error('获取标签失败:', error);
    res.status(500).json({ error: '获取标签失败' });
  }
});

// 创建标签（需要管理员权限）
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { name } = req.body;
    
    // 验证必填字段
    if (!name) {
      return res.status(400).json({ error: '标签名称为必填项' });
    }
    
    if (name.length > 30) {
      return res.status(400).json({ error: '标签名称长度不能超过30字符' });
    }
    
    const tagData: CreateTagData = {
      name
    };
    
    const tag = await createTag(tagData);
    
    res.status(201).json({ tag });
  } catch (error) {
    console.error('创建标签失败:', error);
    if (error instanceof Error) {
      res.status(400).json({ error: error.message });
    } else {
      res.status(500).json({ error: '创建标签失败' });
    }
  }
});

// 更新标签（需要管理员权限）
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    
    // 验证数据
    if (!name) {
      return res.status(400).json({ error: '标签名称为必填项' });
    }
    
    if (name.length > 30) {
      return res.status(400).json({ error: '标签名称长度不能超过30字符' });
    }
    
    const updateData: UpdateTagData = {
      name
    };
    
    const tag = await updateTag(id, updateData);
    
    res.json({ tag });
  } catch (error) {
    console.error('更新标签失败:', error);
    if (error instanceof Error) {
      if (error.message.includes('不存在')) {
        res.status(404).json({ error: error.message });
      } else {
        res.status(400).json({ error: error.message });
      }
    } else {
      res.status(500).json({ error: '更新标签失败' });
    }
  }
});

// 删除标签（需要管理员权限）
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    await deleteTag(id);
    
    res.json({ message: '标签删除成功' });
  } catch (error) {
    console.error('删除标签失败:', error);
    if (error instanceof Error) {
      if (error.message.includes('不存在')) {
        res.status(404).json({ error: error.message });
      } else {
        res.status(400).json({ error: error.message });
      }
    } else {
      res.status(500).json({ error: '删除标签失败' });
    }
  }
});

export default router;