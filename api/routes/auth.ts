/**
 * 用户认证API路由
 * 处理用户注册、登录、令牌管理等功能
 */
import { Router, type Request, type Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { run, get } from '../database/connection';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// JWT密钥（生产环境应该使用环境变量）
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_EXPIRES_IN = '7d';

/**
 * 用户注册
 * POST /api/auth/register
 */
router.post('/register', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, username } = req.body;

    // 验证必填字段
    if (!email || !password || !username) {
      res.status(400).json({
        success: false,
        message: '邮箱、密码和用户名都是必填项',
        timestamp: new Date().toISOString()
      });
      return;
    }

    // 验证邮箱格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      res.status(400).json({
        success: false,
        message: '邮箱格式不正确',
        timestamp: new Date().toISOString()
      });
      return;
    }

    // 验证密码强度
    if (password.length < 6) {
      res.status(400).json({
        success: false,
        message: '密码长度至少6位',
        timestamp: new Date().toISOString()
      });
      return;
    }

    // 检查邮箱是否已存在
    const existingUser = await get('SELECT id FROM users WHERE email = ?', [email]);
    if (existingUser) {
      res.status(409).json({
        success: false,
        message: '该邮箱已被注册',
        timestamp: new Date().toISOString()
      });
      return;
    }

    // 加密密码
    const hashedPassword = await bcrypt.hash(password, 10);

    // 创建用户
    const result = await run(
      'INSERT INTO users (email, password_hash, username, role) VALUES (?, ?, ?, ?)',
      [email, hashedPassword, username, 'user']
    );

    // 生成JWT令牌
    const token = jwt.sign(
      { userId: result.lastID, email, role: 'user' },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    res.status(201).json({
      success: true,
      message: '注册成功',
      data: {
        token,
        user: {
          id: result.lastID,
          email,
          username,
          role: 'user'
        }
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('注册错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * 用户登录
 * POST /api/auth/login
 */
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    // 验证必填字段
    if (!email || !password) {
      res.status(400).json({
        success: false,
        message: '邮箱和密码都是必填项',
        timestamp: new Date().toISOString()
      });
      return;
    }

    // 查找用户
    const user = await get(
      'SELECT id, email, password_hash, username, role, avatar, bio FROM users WHERE email = ?',
      [email]
    );

    if (!user) {
      res.status(401).json({
        success: false,
        message: '邮箱或密码错误',
        timestamp: new Date().toISOString()
      });
      return;
    }

    // 验证密码
    const isPasswordValid = await bcrypt.compare(password, String(user.password_hash));
    if (!isPasswordValid) {
      res.status(401).json({
        success: false,
        message: '邮箱或密码错误',
        timestamp: new Date().toISOString()
      });
      return;
    }

    // 生成JWT令牌
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    res.json({
      success: true,
      message: '登录成功',
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          role: user.role,
          avatar: user.avatar,
          bio: user.bio
        }
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('登录错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * 获取当前用户信息
 * GET /api/auth/me
 */
router.get('/me', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as { user?: { userId: number } }).user?.userId;
    
    const user = await get(
      'SELECT id, email, username, role, avatar, bio, created_at FROM users WHERE id = ?',
      [userId]
    );

    if (!user) {
      res.status(404).json({
        success: false,
        message: '用户不存在',
        timestamp: new Date().toISOString()
      });
      return;
    }

    res.json({
      success: true,
      message: '获取用户信息成功',
      data: {
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          role: user.role,
          avatar: user.avatar,
          bio: user.bio,
          createdAt: user.created_at
        }
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('获取用户信息错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * 用户登出
 * POST /api/auth/logout
 */
router.post('/logout', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    // 在实际应用中，可以将令牌加入黑名单
    // 这里简单返回成功消息
    res.json({
      success: true,
      message: '登出成功',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('登出错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误',
      timestamp: new Date().toISOString()
    });
  }
});

export default router;