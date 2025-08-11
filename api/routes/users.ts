/**
 * 用户管理API路由
 * 模块: 5.1 管理员权限系统 - 用户管理
 */

import express from 'express';
import sqlite3 from 'sqlite3';
import path from 'path';
import * as bcrypt from 'bcrypt';
import { authMiddleware } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import { logDetailedAction, logSecurityAction } from '../middleware/logger';
import { fileURLToPath } from 'url';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, '../../blog.db');





// 获取用户列表
router.get('/', authMiddleware, requirePermission('users.read'), (req, res) => {
  const { page = 1, limit = 20, search, role, sortBy = 'created_at', sortOrder = 'DESC' } = req.query;
  const offset = (Number(page) - 1) * Number(limit);
  
  const db = new sqlite3.Database(dbPath);
  
  let whereClause = '';
  const params: any[] = [];
  
  if (search) {
    whereClause += ' AND (username LIKE ? OR email LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }
  
  if (role) {
    whereClause += ' AND role = ?';
    params.push(role);
  }
  
  const validSortColumns = ['id', 'username', 'email', 'role', 'created_at'];
  const validSortOrders = ['ASC', 'DESC'];
  const orderBy = validSortColumns.includes(sortBy as string) ? sortBy : 'created_at';
  const order = validSortOrders.includes((sortOrder as string).toUpperCase()) ? (sortOrder as string).toUpperCase() : 'DESC';
  
  const query = `
    SELECT id, email, username, avatar, bio, role, created_at, updated_at
    FROM users
    WHERE 1=1 ${whereClause}
    ORDER BY ${orderBy} ${order}
    LIMIT ? OFFSET ?
  `;
  
  const countQuery = `
    SELECT COUNT(*) as total
    FROM users
    WHERE 1=1 ${whereClause}
  `;
  
  // 获取总数
  db.get(countQuery, params, (err, countRow: any) => {
    if (err) {
      db.close();
      return res.status(500).json({ error: '获取用户总数失败' });
    }
    
    // 获取用户列表
    db.all(query, [...params, Number(limit), offset], (err, rows) => {
      db.close();
      if (err) {
        return res.status(500).json({ error: '获取用户列表失败' });
      }
      
      res.json({
        success: true,
        data: {
          users: rows,
          total: countRow.total,
          page: Number(page),
          limit: Number(limit),
          totalPages: Math.ceil(countRow.total / Number(limit))
        }
      });
    });
  });
});

// 获取单个用户详情
router.get('/:id', authMiddleware, requirePermission('users.read'), (req, res) => {
  const { id } = req.params;
  const db = new sqlite3.Database(dbPath);
  
  const query = `
    SELECT id, email, username, avatar, bio, role, created_at, updated_at
    FROM users
    WHERE id = ?
  `;
  
  db.get(query, [id], (err, row) => {
    db.close();
    if (err) {
      return res.status(500).json({ error: '获取用户详情失败' });
    }
    if (!row) {
      return res.status(404).json({ error: '用户不存在' });
    }
    res.json({ success: true, data: row });
  });
});

// 创建用户
router.post('/', 
  authMiddleware, 
  requirePermission('users.create'),
  logDetailedAction('create_user', 'users'),
  async (req, res) => {
    const { email, password, username, role = 'user', bio } = req.body;
    
    if (!email || !password || !username) {
      return res.status(400).json({ error: '邮箱、密码和用户名为必填项' });
    }
    
    if (!['user', 'author', 'admin'].includes(role)) {
      return res.status(400).json({ error: '无效的用户角色' });
    }
    
    try {
      const passwordHash = await bcrypt.hash(password, 10);
      const db = new sqlite3.Database(dbPath);
      
      const query = `
        INSERT INTO users (email, password_hash, username, role, bio)
        VALUES (?, ?, ?, ?, ?)
      `;
      
      db.run(query, [email, passwordHash, username, role, bio], function(err) {
        db.close();
        if (err) {
          if (err.message.includes('UNIQUE constraint failed')) {
            return res.status(400).json({ error: '邮箱已存在' });
          }
          return res.status(500).json({ error: '创建用户失败' });
        }
        
        res.status(201).json({
          success: true,
          message: '用户创建成功',
          data: {
            id: this.lastID,
            email,
            username,
            role,
            bio
          }
        });
      });
    } catch (error) {
      res.status(500).json({ error: '密码加密失败' });
    }
  }
);

// 更新用户
router.put('/:id', 
  authMiddleware, 
  requirePermission('users.update'),
  logDetailedAction('update_user', 'users'),
  (req, res) => {
    const { id } = req.params;
    const { email, username, role, bio, avatar } = req.body;
    
    if (!email || !username) {
      return res.status(400).json({ error: '邮箱和用户名为必填项' });
    }
    
    if (role && !['user', 'author', 'admin'].includes(role)) {
      return res.status(400).json({ error: '无效的用户角色' });
    }
    
    const db = new sqlite3.Database(dbPath);
    
    const query = `
      UPDATE users 
      SET email = ?, username = ?, role = ?, bio = ?, avatar = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;
    
    db.run(query, [email, username, role, bio, avatar, id], function(err) {
      db.close();
      if (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
          return res.status(400).json({ error: '邮箱已存在' });
        }
        return res.status(500).json({ error: '更新用户失败' });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ error: '用户不存在' });
      }
      
      res.json({ success: true, message: '用户更新成功' });
    });
  }
);

// 重置用户密码
router.put('/:id/password', 
  authMiddleware, 
  requirePermission('users.update'),
  logSecurityAction('reset_password', 'users'),
  async (req, res) => {
    const { id } = req.params;
    const { password } = req.body;
    
    if (!password || password.length < 6) {
      return res.status(400).json({ error: '密码长度至少6位' });
    }
    
    try {
      const passwordHash = await bcrypt.hash(password, 10);
      const db = new sqlite3.Database(dbPath);
      
      const query = `
        UPDATE users 
        SET password_hash = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `;
      
      db.run(query, [passwordHash, id], function(err) {
        db.close();
        if (err) {
          return res.status(500).json({ error: '重置密码失败' });
        }
        
        if (this.changes === 0) {
          return res.status(404).json({ error: '用户不存在' });
        }
        
        res.json({ success: true, message: '密码重置成功' });
      });
    } catch (error) {
      res.status(500).json({ error: '密码加密失败' });
    }
  }
);

// 删除用户
router.delete('/:id', 
  authMiddleware, 
  requirePermission('users.delete'),
  logSecurityAction('delete_user', 'users'),
  (req, res) => {
    const { id } = req.params;
    
    // 防止删除自己
    if (Number(id) === req.user.id) {
      return res.status(400).json({ error: '不能删除自己的账号' });
    }
    
    const db = new sqlite3.Database(dbPath);
    
    const query = 'DELETE FROM users WHERE id = ?';
    
    db.run(query, [id], function(err) {
      db.close();
      if (err) {
        return res.status(500).json({ error: '删除用户失败' });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ error: '用户不存在' });
      }
      
      res.json({ success: true, message: '用户删除成功' });
    });
  }
);

// 获取用户统计信息
router.get('/stats/overview', authMiddleware, requirePermission('users.read'), (req, res) => {
  const db = new sqlite3.Database(dbPath);
  
  const queries = {
    total: 'SELECT COUNT(*) as count FROM users',
    admins: 'SELECT COUNT(*) as count FROM users WHERE role = "admin"',
    authors: 'SELECT COUNT(*) as count FROM users WHERE role = "author"',
    users: 'SELECT COUNT(*) as count FROM users WHERE role = "user"',
    recentUsers: 'SELECT COUNT(*) as count FROM users WHERE created_at >= date("now", "-7 days")',
    activeUsers: 'SELECT COUNT(DISTINCT user_id) as count FROM comments WHERE created_at >= date("now", "-30 days")'
  };
  
  const stats: any = {};
  let completedQueries = 0;
  const totalQueries = Object.keys(queries).length;
  
  Object.entries(queries).forEach(([key, query]) => {
    db.get(query, [], (err, row: any) => {
      if (err) {
        console.error(`Error in ${key} query:`, err);
        stats[key] = 0;
      } else {
        stats[key] = row.count;
      }
      
      completedQueries++;
      if (completedQueries === totalQueries) {
        db.close();
        res.json({ stats });
      }
    });
  });
});

export default router;