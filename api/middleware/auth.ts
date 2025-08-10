import { Request, Response, NextFunction } from 'express';
import { verifyToken, verifyAccessToken, getUserById } from '../services/userService.js';
import { isTokenBlacklisted } from '../services/tokenBlacklistService.js';
import { UserResponse } from '../models/User.js';

// 扩展Request接口以包含用户信息
declare global {
  namespace Express {
    interface Request {
      user?: UserResponse;
    }
  }
}

// JWT认证中间件
export const authenticateToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
    
    if (!token) {
      res.status(401).json({
        success: false,
        error: '访问令牌缺失'
      });
      return;
    }
    
    // 检查token是否在黑名单中
    const isBlacklisted = await isTokenBlacklisted(token);
    if (isBlacklisted) {
      res.status(401).json({
        success: false,
        error: '访问令牌已失效'
      });
      return;
    }
    
    // 优先使用新的access token验证，向后兼容旧token
    let decoded = verifyAccessToken(token);
    if (!decoded) {
      decoded = verifyToken(token); // 向后兼容
    }
    
    if (!decoded) {
      res.status(403).json({
        success: false,
        error: '无效的访问令牌'
      });
      return;
    }
    
    const user = await getUserById(decoded.userId);
    
    if (!user) {
      res.status(403).json({
        success: false,
        error: '用户不存在'
      });
      return;
    }
    
    req.user = user;
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(500).json({
      success: false,
      error: '认证过程中发生错误'
    });
    return;
  }
};

// 可选的JWT认证中间件（不强制要求登录）
export const optionalAuth = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];
    
    if (token) {
      // 检查token是否在黑名单中
      const isBlacklisted = await isTokenBlacklisted(token);
      if (!isBlacklisted) {
        // 优先使用新的access token验证，向后兼容旧token
        let decoded = verifyAccessToken(token);
        if (!decoded) {
          decoded = verifyToken(token); // 向后兼容
        }
        
        if (decoded) {
          const user = await getUserById(decoded.userId);
          if (user) {
            req.user = user;
          }
        }
      }
    }
    
    next();
  } catch (error) {
    console.error('Optional auth error:', error);
    next(); // 继续执行，不阻止请求
  }
};

// 角色权限检查中间件
export const requireRole = (roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: '需要登录'
      });
      return;
    }
    
    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        error: '权限不足'
      });
      return;
    }
    
    next();
  };
};

// 管理员权限检查
export const requireAdmin = requireRole(['admin']);

// 作者权限检查（管理员和作者都可以）
export const requireAuthor = requireRole(['admin', 'author']);