/**
 * This is a user authentication API route demo.
 * Handle user registration, login, token management, etc.
 */
import { Router, type Request, type Response } from 'express';
import { createUser, loginUser, getUserById, refreshAccessToken } from '../services/userService.js';
import { authenticateToken } from '../middleware/auth.js';
import { addToBlacklist } from '../services/tokenBlacklistService.js';
import { terminateSession } from '../services/sessionService.js';
import { CreateUserData, LoginData } from '../models/User.js';
import rateLimit from 'express-rate-limit';
import { logger } from '../utils/logger.js';


const router = Router();

// 登录速率限制 - 开发环境放宽限制
const loginLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5分钟
  max: 20, // 最多20次尝试
  message: {
    success: false,
    message: '登录尝试次数过多，请5分钟后再试'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true // 成功的请求不计入限制
});

// 注册速率限制
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1小时
  max: 3, // 最多3次注册
  message: {
    success: false,
    message: '注册尝试次数过多，请1小时后再试'
  },
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * User Register
 * POST /api/auth/register
 */
router.post('/register', registerLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, username, role }: CreateUserData = req.body;
    
    // 验证必填字段
    if (!email || !password || !username) {
      res.status(400).json({
        success: false,
        error: '邮箱、密码和用户名为必填项'
      });
      return;
    }
    
    // 验证邮箱格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      res.status(400).json({
        success: false,
        error: '邮箱格式不正确'
      });
      return;
    }
    
    // 验证密码长度
    if (password.length < 6) {
      res.status(400).json({
        success: false,
        error: '密码长度至少为6位'
      });
      return;
    }
    
    const user = await createUser({ email, password, username, role });
    
    // 记录用户注册操作日志
    logger.logOperation({
      userId: user.id,
      action: 'USER_REGISTER',
      resource: 'user',
      resourceId: user.id,
      details: {
        username: user.username,
        email: user.email,
        role: user.role
      },
      ip: req.ip || req.connection.remoteAddress || 'Unknown',
      userAgent: req.get('User-Agent') || 'Unknown'
    });
    
    res.status(201).json({
      success: true,
      message: '注册成功',
      user
    });
  } catch (error: any) {
    console.error('Register error:', error);
    res.status(400).json({
      success: false,
      error: error.message || '注册失败'
    });
  }
});

/**
 * User Login
 * POST /api/auth/login
 */
router.post('/login', loginLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password }: LoginData = req.body;
    
    // 验证必填字段
    if (!email || !password) {
      res.status(400).json({
        success: false,
        error: '邮箱和密码为必填项'
      });
      return;
    }
    
    // 获取设备信息
    const deviceInfo = {
      userAgent: req.get('User-Agent') || 'Unknown',
      ip: req.ip || req.connection.remoteAddress || 'Unknown'
    };
    
    const result = await loginUser({ email, password }, deviceInfo);
    
    // 设置HttpOnly cookies
    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7天
    });
    
    // 设置HttpOnly cookie for session token
    res.cookie('sessionToken', result.sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7天
    });
    
    // 记录用户登录操作日志
    logger.logOperation({
      userId: result.user.id,
      action: 'USER_LOGIN',
      resource: 'user',
      resourceId: result.user.id,
      details: {
        username: result.user.username,
        email: result.user.email,
        loginMethod: 'email_password'
      },
      ip: req.ip || req.connection.remoteAddress || 'Unknown',
      userAgent: req.get('User-Agent') || 'Unknown'
    });
    
    res.status(200).json({
      success: true,
      message: '登录成功',
      data: {
        user: result.user,
        accessToken: result.accessToken
        // refreshToken和sessionToken不返回给客户端，存储在HttpOnly cookie中
      }
    });
  } catch (error: any) {
    console.error('Login error:', error);
    res.status(401).json({
      success: false,
      error: error.message || '登录失败'
    });
  }
});

/**
 * Get Current User
 * GET /api/auth/me
 */
router.get('/me', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    res.status(200).json({
      success: true,
      user: req.user
    });
  } catch (error: any) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      error: '获取用户信息失败'
    });
  }
});

/**
 * Refresh Access Token
 * POST /api/auth/refresh
 */
router.post('/refresh', async (req: Request, res: Response): Promise<void> => {
  try {
    const refreshToken = req.cookies.refreshToken;
    
    if (!refreshToken) {
      res.status(401).json({
        success: false,
        error: '刷新令牌缺失'
      });
      return;
    }
    
    const result = await refreshAccessToken(refreshToken);
    
    if (!result) {
      res.status(403).json({
        success: false,
        error: '无效的刷新令牌'
      });
      return;
    }
    
    // 更新HttpOnly cookie中的refresh token
    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7天
    });
    
    res.json({
      success: true,
      data: {
        accessToken: result.accessToken
      }
    });
  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(500).json({
      success: false,
      error: '令牌刷新失败'
    });
  }
});

/**
 * User Logout
 * POST /api/auth/logout
 */
router.post('/logout', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    // 获取access token
    const authHeader = req.headers.authorization;
    const accessToken = authHeader && authHeader.split(' ')[1];
    
    // 获取refresh token和session token
    const refreshToken = req.cookies.refreshToken;
    const sessionToken = req.cookies.sessionToken;
    
    // 终止会话
    if (sessionToken) {
      try {
        await terminateSession(sessionToken);
      } catch (error) {
        console.error('终止会话失败:', error);
      }
    }
    
    // 将access token添加到黑名单
    if (accessToken) {
      try {
        // 计算token过期时间（假设access token有效期为1小时）
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
        await addToBlacklist(accessToken, expiresAt, 'logout');
      } catch (error) {
        console.error('添加access token到黑名单失败:', error);
      }
    }
    
    // 将refresh token添加到黑名单
    if (refreshToken) {
      try {
        // 计算token过期时间（假设refresh token有效期为7天）
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        await addToBlacklist(refreshToken, expiresAt, 'logout');
      } catch (error) {
        console.error('添加refresh token到黑名单失败:', error);
      }
    }
    
    // 清除HttpOnly cookies
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict'
    });
    
    res.clearCookie('sessionToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict'
    });
    
    // 记录用户登出操作日志
    logger.logOperation({
      userId: req.user?.id,
      action: 'USER_LOGOUT',
      resource: 'user',
      resourceId: req.user?.id,
      details: {
        username: req.user?.username,
        logoutMethod: 'manual'
      },
      ip: req.ip || req.connection.remoteAddress || 'Unknown',
      userAgent: req.get('User-Agent') || 'Unknown'
    });
    
    res.json({
      success: true,
      message: '登出成功'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      error: '登出失败'
    });
  }
});

export default router;