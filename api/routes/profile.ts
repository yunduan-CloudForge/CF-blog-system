/**
 * 用户个人信息管理API路由
 * 模块: 6.1 用户信息管理
 */

import express from 'express';
import sqlite3 from 'sqlite3';
import path from 'path';
import * as bcrypt from 'bcrypt';
import { authMiddleware } from '../middleware/auth';
import { logDetailedAction, logSecurityAction } from '../middleware/logger';
import { fileURLToPath } from 'url';

// 用户数据库记录接口
interface UserRecord {
  id: number;
  email: string;
  username: string;
  avatar?: string;
  bio?: string;
  role: string;
  password_hash: string;
  created_at: string;
  updated_at: string;
}

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, '../../blog.db');

/**
 * 获取当前用户个人信息
 * GET /api/profile
 */
router.get('/', authMiddleware, (req, res) => {
  const userId = req.user?.userId;
  const db = new sqlite3.Database(dbPath);
  
  const query = `
    SELECT id, email, username, avatar, bio, role, created_at, updated_at
    FROM users
    WHERE id = ?
  `;
  
  db.get(query, [userId], (err, row: UserRecord) => {
    db.close();
    if (err) {
      return res.status(500).json({ 
        success: false,
        error: '获取用户信息失败' 
      });
    }
    
    if (!row) {
      return res.status(404).json({ 
        success: false,
        error: '用户不存在' 
      });
    }
    
    res.json({
      success: true,
      data: {
        user: {
          id: row.id,
          email: row.email,
          username: row.username,
          avatar: row.avatar,
          bio: row.bio,
          role: row.role,
          createdAt: row.created_at,
          updatedAt: row.updated_at
        }
      }
    });
  });
});

/**
 * 更新当前用户个人信息
 * PUT /api/profile
 */
router.put('/', 
  authMiddleware,
  logDetailedAction('update_profile', 'users'),
  (req, res) => {
    const userId = req.user?.userId;
    const { username, bio, avatar } = req.body;
    
    if (!username) {
      return res.status(400).json({ 
        success: false,
        error: '用户名为必填项' 
      });
    }
    
    const db = new sqlite3.Database(dbPath);
    
    // 检查用户名是否已被其他用户使用
    const checkQuery = 'SELECT id FROM users WHERE username = ? AND id != ?';
    db.get(checkQuery, [username, userId], (err, existingUser) => {
      if (err) {
        db.close();
        return res.status(500).json({ 
          success: false,
          error: '检查用户名失败' 
        });
      }
      
      if (existingUser) {
        db.close();
        return res.status(400).json({ 
          success: false,
          error: '用户名已被使用' 
        });
      }
      
      const updateQuery = `
        UPDATE users 
        SET username = ?, bio = ?, avatar = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `;
      
      db.run(updateQuery, [username, bio, avatar, userId], function(err) {
        db.close();
        if (err) {
          return res.status(500).json({ 
            success: false,
            error: '更新用户信息失败' 
          });
        }
        
        if (this.changes === 0) {
          return res.status(404).json({ 
            success: false,
            error: '用户不存在' 
          });
        }
        
        res.json({ 
          success: true, 
          message: '个人信息更新成功' 
        });
      });
    });
  }
);

/**
 * 修改密码
 * PUT /api/profile/password
 */
router.put('/password', 
  authMiddleware,
  logSecurityAction('change_password', 'users'),
  async (req, res) => {
    const userId = req.user?.userId;
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ 
        success: false,
        error: '当前密码和新密码都是必填项' 
      });
    }
    
    if (newPassword.length < 6) {
      return res.status(400).json({ 
        success: false,
        error: '新密码长度至少6位' 
      });
    }
    
    const db = new sqlite3.Database(dbPath);
    
    // 获取当前用户的密码哈希
    const getUserQuery = 'SELECT password_hash FROM users WHERE id = ?';
    db.get(getUserQuery, [userId], async (err, user: UserRecord) => {
      if (err) {
        db.close();
        return res.status(500).json({ 
          success: false,
          error: '获取用户信息失败' 
        });
      }
      
      if (!user) {
        db.close();
        return res.status(404).json({ 
          success: false,
          error: '用户不存在' 
        });
      }
      
      try {
        // 验证当前密码
        const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password_hash);
        if (!isCurrentPasswordValid) {
          db.close();
          return res.status(400).json({ 
            success: false,
            error: '当前密码不正确' 
          });
        }
        
        // 加密新密码
        const hashedNewPassword = await bcrypt.hash(newPassword, 10);
        
        // 更新密码
        const updateQuery = `
          UPDATE users 
          SET password_hash = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `;
        
        db.run(updateQuery, [hashedNewPassword, userId], function(err) {
          db.close();
          if (err) {
            return res.status(500).json({ 
              success: false,
              error: '密码更新失败' 
            });
          }
          
          res.json({ 
            success: true, 
            message: '密码修改成功' 
          });
        });
      } catch {
        db.close();
        res.status(500).json({ 
          success: false,
          error: '密码处理失败' 
        });
      }
    });
  }
);

/**
 * 更新头像
 * PUT /api/profile/avatar
 */
router.put('/avatar', 
  authMiddleware,
  logDetailedAction('update_avatar', 'users'),
  (req, res) => {
    const userId = req.user?.userId;
    const { avatar } = req.body;
    
    if (!avatar) {
      return res.status(400).json({ 
        success: false,
        error: '头像URL为必填项' 
      });
    }
    
    const db = new sqlite3.Database(dbPath);
    
    const updateQuery = `
      UPDATE users 
      SET avatar = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;
    
    db.run(updateQuery, [avatar, userId], function(err) {
      db.close();
      if (err) {
        return res.status(500).json({ 
          success: false,
          error: '头像更新失败' 
        });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ 
          success: false,
          error: '用户不存在' 
        });
      }
      
      res.json({ 
        success: true, 
        message: '头像更新成功' 
      });
    });
  }
);

export default router;