/**
 * JWT认证中间件
 * 验证用户身份和权限
 */
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// JWT密钥（生产环境应该使用环境变量）
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// 定义用户信息类型
interface UserInfo {
  id: number;
  userId: number;
  email: string;
  role: string;
  username?: string;
}

// 扩展Request接口以包含用户信息
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: UserInfo;
    }
  }
}

/**
 * JWT认证中间件
 */
export const authMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  try {
    // 从请求头获取令牌
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      res.status(401).json({
        success: false,
        message: '未提供认证令牌',
        timestamp: new Date().toISOString()
      });
      return;
    }

    // 检查令牌格式 (Bearer token)
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
    
    if (!token) {
      res.status(401).json({
        success: false,
        message: '令牌格式不正确',
        timestamp: new Date().toISOString()
      });
      return;
    }

    // 验证令牌
    const decoded = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload & {
      userId: number;
      email: string;
      role: string;
      username?: string;
    };
    
    // 将用户信息添加到请求对象
    req.user = {
      id: decoded.userId,
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role,
      username: decoded.username
    };

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({
        success: false,
        message: '令牌已过期',
        timestamp: new Date().toISOString()
      });
    } else if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({
        success: false,
        message: '无效的令牌',
        timestamp: new Date().toISOString()
      });
    } else {
      console.error('认证中间件错误:', error);
      res.status(500).json({
        success: false,
        message: '服务器内部错误',
        timestamp: new Date().toISOString()
      });
    }
  }
};

/**
 * 角色权限中间件
 * @param roles 允许的角色列表
 */
export const roleMiddleware = (roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: '用户未认证',
          timestamp: new Date().toISOString()
        });
        return;
      }

      if (!roles.includes(req.user.role)) {
        res.status(403).json({
          success: false,
          message: '权限不足',
          timestamp: new Date().toISOString()
        });
        return;
      }

      next();
    } catch (error) {
      console.error('角色权限中间件错误:', error);
      res.status(500).json({
        success: false,
        message: '服务器内部错误',
        timestamp: new Date().toISOString()
      });
    }
  };
};

/**
 * 可选认证中间件（不强制要求登录）
 */
export const optionalAuthMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      // 没有令牌，继续执行但不设置用户信息
      next();
      return;
    }

    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
    
    if (!token) {
      next();
      return;
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload & {
        userId: number;
        email: string;
        role: string;
        username?: string;
      };
      req.user = {
        id: decoded.userId,
        userId: decoded.userId,
        email: decoded.email,
        role: decoded.role,
        username: decoded.username
      };
    } catch (error) {
      // 令牌无效，但不阻止请求继续
      console.warn('可选认证中间件：令牌无效', error);
    }

    next();
  } catch (error) {
    console.error('可选认证中间件错误:', error);
    next(); // 即使出错也继续执行
  }
};