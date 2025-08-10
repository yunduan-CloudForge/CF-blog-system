import express from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import { getUserById } from '../services/userService.js';
import { query } from '../database/database.js';
import { User } from '../models/User.js';

const router = express.Router();

// 获取作者列表（有发布文章的用户）
router.get('/authors', async (req, res) => {
  try {
    const authors = await query<User>(
      `SELECT DISTINCT u.* 
       FROM users u 
       INNER JOIN articles a ON u.id = a.author_id 
       WHERE a.status = 'published' 
       ORDER BY u.name`
    );
    
    // 转换字段格式为前端期望的camelCase
    const transformedAuthors = authors.map(author => ({
      ...author,
      createdAt: author.created_at,
      updatedAt: author.updated_at
    }));
    
    res.json({
      success: true,
      message: '获取作者列表成功',
      data: { authors: transformedAuthors }
    });
  } catch (error) {
    console.error('获取作者列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取作者列表失败',
      error: error instanceof Error ? error.message : '未知错误'
    });
  }
});

// 获取用户列表（需要管理员权限）
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 10, search, role } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    
    let whereConditions = [];
    let queryValues: any[] = [];
    
    if (search) {
      whereConditions.push('(name LIKE ? OR email LIKE ?)');
      const searchPattern = `%${search}%`;
      queryValues.push(searchPattern, searchPattern);
    }
    
    if (role) {
      whereConditions.push('role = ?');
      queryValues.push(role);
    }
    
    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    
    // 获取总数
    const countResult = await query<{ count: number }>(
      `SELECT COUNT(*) as count FROM users ${whereClause}`,
      queryValues
    );
    const total = countResult[0]?.count || 0;
    
    // 获取用户列表
    const users = await query<User>(
      `SELECT * FROM users ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...queryValues, Number(limit), offset]
    );
    
    // 转换字段格式为前端期望的camelCase
    const transformedUsers = users.map(user => ({
      ...user,
      createdAt: user.created_at,
      updatedAt: user.updated_at
    }));
    
    res.json({
      data: transformedUsers,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error) {
    console.error('获取用户列表失败:', error);
    res.status(500).json({ error: '获取用户列表失败' });
  }
});

// 根据ID获取用户信息
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const user = await getUserById(id);
    
    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }
    
    // 转换字段格式为前端期望的camelCase
    const transformedUser = {
      ...user,
      createdAt: user.created_at,
      updatedAt: user.updated_at
    };
    
    res.json({ user: transformedUser });
  } catch (error) {
    console.error('获取用户信息失败:', error);
    res.status(500).json({ error: '获取用户信息失败' });
  }
});

export default router;