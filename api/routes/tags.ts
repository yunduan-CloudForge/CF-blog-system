/**
 * 标签管理API路由
 * 处理标签的CRUD操作
 */
import { Router, type Request, type Response } from 'express';
import { query, run, get } from '../database/connection';
import { authMiddleware } from '../middleware/auth';

const router = Router();

/**
 * 获取所有标签
 * GET /api/tags
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const tags = await query(`
      SELECT 
        t.id,
        t.name,
        t.color,
        t.created_at,
        COUNT(at.article_id) as article_count
      FROM tags t
      LEFT JOIN article_tags at ON t.id = at.tag_id
      LEFT JOIN articles a ON at.article_id = a.id AND a.status = 'published'
      GROUP BY t.id, t.name, t.color, t.created_at
      ORDER BY t.name ASC
    `);

    res.json({
      success: true,
      message: '获取标签列表成功',
      data: tags,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('获取标签列表错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * 获取单个标签详情
 * GET /api/tags/:id
 */
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const tag = await get(`
      SELECT 
        t.id,
        t.name,
        t.color,
        t.created_at,
        COUNT(at.article_id) as article_count
      FROM tags t
      LEFT JOIN article_tags at ON t.id = at.tag_id
      LEFT JOIN articles a ON at.article_id = a.id AND a.status = 'published'
      WHERE t.id = ?
      GROUP BY t.id, t.name, t.color, t.created_at
    `, [id]);

    if (!tag) {
      res.status(404).json({
        success: false,
        message: '标签不存在',
        timestamp: new Date().toISOString()
      });
      return;
    }

    res.json({
      success: true,
      message: '获取标签详情成功',
      data: { tag },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('获取标签详情错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * 创建标签
 * POST /api/tags
 * 需要管理员权限
 */
router.post('/', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const userRole = req.user?.role;
    const { name, color } = req.body;

    // 检查权限
    if (userRole !== 'admin') {
      res.status(403).json({
        success: false,
        message: '只有管理员可以创建标签',
        timestamp: new Date().toISOString()
      });
      return;
    }

    // 验证必填字段
    if (!name || !name.trim()) {
      res.status(400).json({
        success: false,
        message: '标签名称不能为空',
        timestamp: new Date().toISOString()
      });
      return;
    }

    // 检查标签名称是否已存在
    const existingTag = await get('SELECT id FROM tags WHERE name = ?', [name.trim()]);
    if (existingTag) {
      res.status(409).json({
        success: false,
        message: '标签名称已存在',
        timestamp: new Date().toISOString()
      });
      return;
    }

    // 验证颜色格式（可选）
    const tagColor = color || '#3B82F6'; // 默认蓝色
    if (color && !/^#[0-9A-Fa-f]{6}$/.test(color)) {
      res.status(400).json({
        success: false,
        message: '颜色格式不正确，请使用十六进制格式（如 #3B82F6）',
        timestamp: new Date().toISOString()
      });
      return;
    }

    // 创建标签
    const result = await run(
      'INSERT INTO tags (name, color) VALUES (?, ?)',
      [name.trim(), tagColor]
    );

    res.status(201).json({
      success: true,
      message: '标签创建成功',
      data: { tagId: result.lastID },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('创建标签错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * 更新标签
 * PUT /api/tags/:id
 * 需要管理员权限
 */
router.put('/:id', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userRole = req.user?.role;
    const { name, color } = req.body;

    // 检查权限
    if (userRole !== 'admin') {
      res.status(403).json({
        success: false,
        message: '只有管理员可以更新标签',
        timestamp: new Date().toISOString()
      });
      return;
    }

    // 检查标签是否存在
    const tag = await get('SELECT id FROM tags WHERE id = ?', [id]);
    if (!tag) {
      res.status(404).json({
        success: false,
        message: '标签不存在',
        timestamp: new Date().toISOString()
      });
      return;
    }

    // 验证必填字段
    if (!name || !name.trim()) {
      res.status(400).json({
        success: false,
        message: '标签名称不能为空',
        timestamp: new Date().toISOString()
      });
      return;
    }

    // 检查标签名称是否已存在（排除当前标签）
    const existingTag = await get('SELECT id FROM tags WHERE name = ? AND id != ?', [name.trim(), id]);
    if (existingTag) {
      res.status(409).json({
        success: false,
        message: '标签名称已存在',
        timestamp: new Date().toISOString()
      });
      return;
    }

    // 验证颜色格式（可选）
    const tagColor = color || '#3B82F6'; // 默认蓝色
    if (color && !/^#[0-9A-Fa-f]{6}$/.test(color)) {
      res.status(400).json({
        success: false,
        message: '颜色格式不正确，请使用十六进制格式（如 #3B82F6）',
        timestamp: new Date().toISOString()
      });
      return;
    }

    // 更新标签
    await run(
      'UPDATE tags SET name = ?, color = ? WHERE id = ?',
      [name.trim(), tagColor, id]
    );

    res.json({
      success: true,
      message: '标签更新成功',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('更新标签错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * 删除标签
 * DELETE /api/tags/:id
 * 需要管理员权限
 */
router.delete('/:id', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userRole = req.user?.role;

    // 检查权限
    if (userRole !== 'admin') {
      res.status(403).json({
        success: false,
        message: '只有管理员可以删除标签',
        timestamp: new Date().toISOString()
      });
      return;
    }

    // 检查标签是否存在
    const tag = await get('SELECT id FROM tags WHERE id = ?', [id]);
    if (!tag) {
      res.status(404).json({
        success: false,
        message: '标签不存在',
        timestamp: new Date().toISOString()
      });
      return;
    }

    // 检查是否有文章使用此标签
    const articleCount = await get(`
      SELECT COUNT(*) as count 
      FROM article_tags at 
      JOIN articles a ON at.article_id = a.id 
      WHERE at.tag_id = ?
    `, [id]);
    
    if (articleCount && articleCount.count > 0) {
      res.status(400).json({
        success: false,
        message: `无法删除标签，还有 ${articleCount.count} 篇文章使用此标签`,
        timestamp: new Date().toISOString()
      });
      return;
    }

    // 删除标签（先删除关联关系，再删除标签）
    await run('DELETE FROM article_tags WHERE tag_id = ?', [id]);
    await run('DELETE FROM tags WHERE id = ?', [id]);

    res.json({
      success: true,
      message: '标签删除成功',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('删除标签错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * 批量创建标签
 * POST /api/tags/batch
 * 需要管理员权限
 */
router.post('/batch', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const userRole = req.user?.role;
    const { tags } = req.body;

    // 检查权限
    if (userRole !== 'admin') {
      res.status(403).json({
        success: false,
        message: '只有管理员可以批量创建标签',
        timestamp: new Date().toISOString()
      });
      return;
    }

    // 验证输入
    if (!Array.isArray(tags) || tags.length === 0) {
      res.status(400).json({
        success: false,
        message: '标签列表不能为空',
        timestamp: new Date().toISOString()
      });
      return;
    }

    const createdTags = [];
    const errors = [];

    for (const tagData of tags) {
      try {
        const { name, color } = tagData;

        if (!name || !name.trim()) {
          errors.push(`标签名称不能为空`);
          continue;
        }

        // 检查标签名称是否已存在
        const existingTag = await get('SELECT id FROM tags WHERE name = ?', [name.trim()]);
        if (existingTag) {
          errors.push(`标签 "${name}" 已存在`);
          continue;
        }

        // 验证颜色格式
        const tagColor = color || '#3B82F6';
        if (color && !/^#[0-9A-Fa-f]{6}$/.test(color)) {
          errors.push(`标签 "${name}" 的颜色格式不正确`);
          continue;
        }

        // 创建标签
        const result = await run(
          'INSERT INTO tags (name, color) VALUES (?, ?)',
          [name.trim(), tagColor]
        );

        createdTags.push({
          id: result.lastID,
          name: name.trim(),
          color: tagColor
        });
      } catch (error) {
        errors.push(`创建标签 "${tagData.name}" 失败: ${error}`);
      }
    }

    res.status(201).json({
      success: true,
      message: `成功创建 ${createdTags.length} 个标签`,
      data: { 
        createdTags,
        errors: errors.length > 0 ? errors : undefined
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('批量创建标签错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误',
      timestamp: new Date().toISOString()
    });
  }
});

export default router;