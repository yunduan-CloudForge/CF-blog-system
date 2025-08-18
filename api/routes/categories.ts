/**
 * 分类管理API路由
 * 处理分类的CRUD操作
 */
import { Router, type Request, type Response } from 'express';
import { query, run, get } from '../database/connection';
import { authMiddleware } from '../middleware/auth';

const router = Router();

/**
 * 获取所有分类
 * GET /api/categories
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const categories = await query(`
      SELECT 
        c.id,
        c.name,
        c.description,
        c.created_at,
        COUNT(a.id) as article_count
      FROM categories c
      LEFT JOIN articles a ON c.id = a.category_id AND a.status = 'published'
      GROUP BY c.id, c.name, c.description, c.created_at
      ORDER BY c.name ASC
    `);

    res.json({
      success: true,
      message: '获取分类列表成功',
      data: categories,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('获取分类列表错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * 获取单个分类详情
 * GET /api/categories/:id
 */
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const category = await get(`
      SELECT 
        c.id,
        c.name,
        c.description,
        c.created_at,
        COUNT(a.id) as article_count
      FROM categories c
      LEFT JOIN articles a ON c.id = a.category_id AND a.status = 'published'
      WHERE c.id = ?
      GROUP BY c.id, c.name, c.description, c.created_at
    `, [id]);

    if (!category) {
      res.status(404).json({
        success: false,
        message: '分类不存在',
        timestamp: new Date().toISOString()
      });
      return;
    }

    res.json({
      success: true,
      message: '获取分类详情成功',
      data: { category },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('获取分类详情错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * 创建分类
 * POST /api/categories
 * 需要管理员权限
 */
router.post('/', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const userRole = req.user?.role;
    const { name, description } = req.body;

    // 检查权限
    if (userRole !== 'admin') {
      res.status(403).json({
        success: false,
        message: '只有管理员可以创建分类',
        timestamp: new Date().toISOString()
      });
      return;
    }

    // 验证必填字段
    if (!name || !name.trim()) {
      res.status(400).json({
        success: false,
        message: '分类名称不能为空',
        timestamp: new Date().toISOString()
      });
      return;
    }

    // 检查分类名称是否已存在
    const existingCategory = await get('SELECT id FROM categories WHERE name = ?', [name.trim()]);
    if (existingCategory) {
      res.status(409).json({
        success: false,
        message: '分类名称已存在',
        timestamp: new Date().toISOString()
      });
      return;
    }

    // 创建分类
    const result = await run(
      'INSERT INTO categories (name, description) VALUES (?, ?)',
      [name.trim(), description || null]
    );

    res.status(201).json({
      success: true,
      message: '分类创建成功',
      data: { categoryId: result.lastID },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('创建分类错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * 更新分类
 * PUT /api/categories/:id
 * 需要管理员权限
 */
router.put('/:id', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userRole = req.user?.role;
    const { name, description } = req.body;

    // 检查权限
    if (userRole !== 'admin') {
      res.status(403).json({
        success: false,
        message: '只有管理员可以更新分类',
        timestamp: new Date().toISOString()
      });
      return;
    }

    // 检查分类是否存在
    const category = await get('SELECT id FROM categories WHERE id = ?', [id]);
    if (!category) {
      res.status(404).json({
        success: false,
        message: '分类不存在',
        timestamp: new Date().toISOString()
      });
      return;
    }

    // 验证必填字段
    if (!name || !name.trim()) {
      res.status(400).json({
        success: false,
        message: '分类名称不能为空',
        timestamp: new Date().toISOString()
      });
      return;
    }

    // 检查分类名称是否已存在（排除当前分类）
    const existingCategory = await get('SELECT id FROM categories WHERE name = ? AND id != ?', [name.trim(), id]);
    if (existingCategory) {
      res.status(409).json({
        success: false,
        message: '分类名称已存在',
        timestamp: new Date().toISOString()
      });
      return;
    }

    // 更新分类
    await run(
      'UPDATE categories SET name = ?, description = ? WHERE id = ?',
      [name.trim(), description || null, id]
    );

    res.json({
      success: true,
      message: '分类更新成功',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('更新分类错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * 删除分类
 * DELETE /api/categories/:id
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
        message: '只有管理员可以删除分类',
        timestamp: new Date().toISOString()
      });
      return;
    }

    // 检查分类是否存在
    const category = await get('SELECT id FROM categories WHERE id = ?', [id]);
    if (!category) {
      res.status(404).json({
        success: false,
        message: '分类不存在',
        timestamp: new Date().toISOString()
      });
      return;
    }

    // 检查是否有文章使用此分类
    const articleCount = await get('SELECT COUNT(*) as count FROM articles WHERE category_id = ?', [id]);
    if (articleCount && articleCount.count > 0) {
      res.status(400).json({
        success: false,
        message: `无法删除分类，还有 ${articleCount.count} 篇文章使用此分类`,
        timestamp: new Date().toISOString()
      });
      return;
    }

    // 删除分类
    await run('DELETE FROM categories WHERE id = ?', [id]);

    res.json({
      success: true,
      message: '分类删除成功',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('删除分类错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误',
      timestamp: new Date().toISOString()
    });
  }
});

export default router;