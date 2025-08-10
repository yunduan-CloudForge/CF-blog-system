import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { supabase } from '../database/supabase';

// 用户角色枚举
export enum UserRole {
  ADMIN = 'admin',
  EDITOR = 'editor',
  AUTHOR = 'author',
  USER = 'user'
}

// 角色权限映射
const rolePermissions = {
  [UserRole.ADMIN]: ['*'], // 管理员拥有所有权限
  [UserRole.EDITOR]: [
    'articles:read',
    'articles:write',
    'articles:update',
    'articles:delete',
    'categories:read',
    'categories:write',
    'tags:read',
    'tags:write',
    'comments:read',
    'comments:moderate'
  ],
  [UserRole.AUTHOR]: [
    'articles:read',
    'articles:write',
    'articles:update:own',
    'categories:read',
    'tags:read',
    'comments:read'
  ],
  [UserRole.USER]: [
    'articles:read',
    'categories:read',
    'tags:read',
    'comments:read',
    'comments:write'
  ]
};

// 扩展Request接口以包含用户信息
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: UserRole;
        permissions: string[];
      };
    }
  }
}

// 获取用户角色
export async function getUserRole(userId: string): Promise<UserRole> {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('role')
      .eq('id', userId)
      .single();
    
    if (error || !user) {
      logger.warn(`获取用户角色失败: ${userId}`, error);
      return UserRole.USER; // 默认角色
    }
    
    return user.role as UserRole || UserRole.USER;
  } catch (error) {
    logger.error('获取用户角色异常:', error);
    return UserRole.USER;
  }
}

// 检查用户权限
export function hasPermission(userRole: UserRole, permission: string): boolean {
  const permissions = rolePermissions[userRole] || [];
  
  // 管理员拥有所有权限
  if (permissions.includes('*')) {
    return true;
  }
  
  // 检查具体权限
  return permissions.includes(permission);
}

// 权限检查中间件
export function requirePermission(permission: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: '未授权访问'
        });
      }
      
      const userRole = req.user.role;
      
      if (!hasPermission(userRole, permission)) {
        logger.warn(`用户 ${req.user.id} 尝试访问无权限的资源: ${permission}`);
        return res.status(403).json({
          success: false,
          message: '权限不足'
        });
      }
      
      next();
    } catch (error) {
      logger.error('权限检查失败:', error);
      res.status(500).json({
        success: false,
        message: '权限检查失败'
      });
    }
  };
}

// 角色检查中间件
export function requireRole(roles: UserRole | UserRole[]) {
  const allowedRoles = Array.isArray(roles) ? roles : [roles];
  
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: '未授权访问'
        });
      }
      
      const userRole = req.user.role;
      
      if (!allowedRoles.includes(userRole)) {
        logger.warn(`用户 ${req.user.id} 角色 ${userRole} 尝试访问需要角色 ${allowedRoles.join(', ')} 的资源`);
        return res.status(403).json({
          success: false,
          message: '角色权限不足'
        });
      }
      
      next();
    } catch (error) {
      logger.error('角色检查失败:', error);
      res.status(500).json({
        success: false,
        message: '角色检查失败'
      });
    }
  };
}

// 资源所有者检查中间件
export function requireOwnership(resourceType: string, resourceIdParam: string = 'id') {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: '未授权访问'
        });
      }
      
      // 管理员和编辑可以访问所有资源
      if (req.user.role === UserRole.ADMIN || req.user.role === UserRole.EDITOR) {
        return next();
      }
      
      const resourceId = req.params[resourceIdParam];
      if (!resourceId) {
        return res.status(400).json({
          success: false,
          message: '资源ID缺失'
        });
      }
      
      // 检查资源所有权
      const { data: resource, error } = await supabase
        .from(resourceType)
        .select('author_id, user_id')
        .eq('id', resourceId)
        .single();
      
      if (error || !resource) {
        return res.status(404).json({
          success: false,
          message: '资源不存在'
        });
      }
      
      const ownerId = resource.author_id || resource.user_id;
      if (ownerId !== req.user.id) {
        logger.warn(`用户 ${req.user.id} 尝试访问不属于自己的资源: ${resourceType}/${resourceId}`);
        return res.status(403).json({
          success: false,
          message: '只能操作自己的资源'
        });
      }
      
      next();
    } catch (error) {
      logger.error('所有权检查失败:', error);
      res.status(500).json({
        success: false,
        message: '所有权检查失败'
      });
    }
  };
}

// 用户认证中间件（从JWT token中提取用户信息）
export async function authenticateUser(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: '缺少认证令牌'
      });
    }
    
    const token = authHeader.substring(7);
    
    // 验证JWT token
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      return res.status(401).json({
        success: false,
        message: '无效的认证令牌'
      });
    }
    
    // 获取用户角色
    const userRole = await getUserRole(user.id);
    
    // 设置用户信息到请求对象
    req.user = {
      id: user.id,
      email: user.email || '',
      role: userRole,
      permissions: rolePermissions[userRole] || []
    };
    
    next();
  } catch (error) {
    logger.error('用户认证失败:', error);
    res.status(500).json({
      success: false,
      message: '认证失败'
    });
  }
}

// 可选认证中间件（不强制要求认证）
export async function optionalAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(); // 没有token，继续执行
    }
    
    const token = authHeader.substring(7);
    
    // 验证JWT token
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (!error && user) {
      // 获取用户角色
      const userRole = await getUserRole(user.id);
      
      // 设置用户信息到请求对象
      req.user = {
        id: user.id,
        email: user.email || '',
        role: userRole,
        permissions: rolePermissions[userRole] || []
      };
    }
    
    next();
  } catch (error) {
    logger.error('可选认证失败:', error);
    next(); // 认证失败也继续执行
  }
}