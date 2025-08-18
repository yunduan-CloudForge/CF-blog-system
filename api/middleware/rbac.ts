/**
 * 基于角色的访问控制 (RBAC) 中间件
 * 模块: 5.1 管理员权限系统
 */

import { Request, Response, NextFunction } from 'express';
import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, '../../blog.db');

// 定义用户信息类型
interface UserInfo {
  id: number;
  userId: number;
  email: string;
  role: string;
  username?: string;
}

// 扩展Request接口
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: UserInfo;
    }
  }
}

/**
 * 权限检查中间件
 * @param permission 需要的权限名称 (格式: resource.action)
 * @returns Express中间件函数
 */
export const requirePermission = (permission: string) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // 检查用户是否已认证
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: '用户未认证',
          timestamp: new Date().toISOString()
        });
        return;
      }

      const userRole = req.user.role;
      
      // 超级管理员拥有所有权限
      if (userRole === 'admin') {
        next();
        return;
      }

      // 检查用户角色是否有指定权限
      const hasPermission = await checkUserPermission(userRole, permission);
      
      if (!hasPermission) {
        res.status(403).json({
          success: false,
          error: `权限不足，需要权限: ${permission}`,
          timestamp: new Date().toISOString()
        });
        return;
      }

      next();
    } catch (error) {
      console.error('权限检查中间件错误:', error);
      res.status(500).json({
        success: false,
        error: '权限检查失败',
        timestamp: new Date().toISOString()
      });
    }
  };
};

/**
 * 检查用户权限
 * @param role 用户角色
 * @param permission 权限名称
 * @returns Promise<boolean>
 */
function checkUserPermission(role: string, permission: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath);
    
    const query = `
      SELECT p.* FROM permissions p
      JOIN role_permissions rp ON p.id = rp.permission_id
      WHERE rp.role = ? AND p.name = ?
    `;

    db.get(query, [role, permission], (err, row) => {
      db.close();
      if (err) {
        reject(err);
        return;
      }
      resolve(!!row);
    });
  });
}

/**
 * 多权限检查中间件（需要满足所有权限）
 * @param permissions 权限列表
 * @returns Express中间件函数
 */
export const requireAllPermissions = (permissions: string[]) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: '用户未认证',
          timestamp: new Date().toISOString()
        });
        return;
      }

      const userRole = req.user.role;
      
      // 超级管理员拥有所有权限
      if (userRole === 'admin') {
        next();
        return;
      }

      // 检查所有权限
      const permissionChecks = await Promise.all(
        permissions.map(permission => checkUserPermission(userRole, permission))
      );
      
      const hasAllPermissions = permissionChecks.every(hasPermission => hasPermission);
      
      if (!hasAllPermissions) {
        const missingPermissions = permissions.filter((_, index) => !permissionChecks[index]);
        res.status(403).json({
          success: false,
          error: `权限不足，缺少权限: ${missingPermissions.join(', ')}`,
          timestamp: new Date().toISOString()
        });
        return;
      }

      next();
    } catch (error) {
      console.error('多权限检查中间件错误:', error);
      res.status(500).json({
        success: false,
        error: '权限检查失败',
        timestamp: new Date().toISOString()
      });
    }
  };
};

/**
 * 任一权限检查中间件（满足任一权限即可）
 * @param permissions 权限列表
 * @returns Express中间件函数
 */
export const requireAnyPermission = (permissions: string[]) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: '用户未认证',
          timestamp: new Date().toISOString()
        });
        return;
      }

      const userRole = req.user.role;
      
      // 超级管理员拥有所有权限
      if (userRole === 'admin') {
        next();
        return;
      }

      // 检查任一权限
      const permissionChecks = await Promise.all(
        permissions.map(permission => checkUserPermission(userRole, permission))
      );
      
      const hasAnyPermission = permissionChecks.some(hasPermission => hasPermission);
      
      if (!hasAnyPermission) {
        res.status(403).json({
          success: false,
          error: `权限不足，需要以下任一权限: ${permissions.join(', ')}`,
          timestamp: new Date().toISOString()
        });
        return;
      }

      next();
    } catch (error) {
      console.error('任一权限检查中间件错误:', error);
      res.status(500).json({
        success: false,
        error: '权限检查失败',
        timestamp: new Date().toISOString()
      });
    }
  };
};

/**
 * 角色检查中间件
 * @param roles 允许的角色列表
 * @returns Express中间件函数
 */
export const requireRole = (roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: '用户未认证',
          timestamp: new Date().toISOString()
        });
        return;
      }

      if (!roles.includes(req.user.role)) {
        res.status(403).json({
          success: false,
          error: `权限不足，需要角色: ${roles.join(' 或 ')}`,
          timestamp: new Date().toISOString()
        });
        return;
      }

      next();
    } catch (error) {
      console.error('角色检查中间件错误:', error);
      res.status(500).json({
        success: false,
        error: '角色检查失败',
        timestamp: new Date().toISOString()
      });
    }
  };
};

/**
 * 资源所有者检查中间件
 * @param resourceIdParam 资源ID参数名（如 'id', 'articleId'）
 * @param resourceTable 资源表名
 * @param ownerField 所有者字段名（如 'user_id', 'author_id'）
 * @returns Express中间件函数
 */
export const requireResourceOwner = (resourceIdParam: string, resourceTable: string, ownerField: string) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: '用户未认证',
          timestamp: new Date().toISOString()
        });
        return;
      }

      const resourceId = req.params[resourceIdParam];
      const userId = req.user.id || req.user.userId;
      
      if (!resourceId) {
        res.status(400).json({
          success: false,
          error: '资源ID缺失',
          timestamp: new Date().toISOString()
        });
        return;
      }

      // 超级管理员可以访问所有资源
      if (req.user.role === 'admin') {
        next();
        return;
      }

      // 检查资源所有权
      const isOwner = await checkResourceOwnership(resourceId, userId, resourceTable, ownerField);
      
      if (!isOwner) {
        res.status(403).json({
          success: false,
          error: '只能操作自己的资源',
          timestamp: new Date().toISOString()
        });
        return;
      }

      next();
    } catch (error) {
      console.error('资源所有者检查中间件错误:', error);
      res.status(500).json({
        success: false,
        error: '资源所有权检查失败',
        timestamp: new Date().toISOString()
      });
    }
  };
};

/**
 * 检查资源所有权
 * @param resourceId 资源ID
 * @param userId 用户ID
 * @param resourceTable 资源表名
 * @param ownerField 所有者字段名
 * @returns Promise<boolean>
 */
function checkResourceOwnership(resourceId: string, userId: number, resourceTable: string, ownerField: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath);
    
    const query = `SELECT ${ownerField} FROM ${resourceTable} WHERE id = ?`;

    db.get(query, [resourceId], (err, row: Record<string, unknown>) => {
      db.close();
      if (err) {
        reject(err);
        return;
      }
      if (!row) {
        resolve(false);
        return;
      }
      resolve(row[ownerField] === userId);
    });
  });
}

/**
 * 获取用户权限列表
 * @param userId 用户ID
 * @returns Promise<string[]>
 */
export async function getUserPermissions(userId: number): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath);
    
    const query = `
      SELECT DISTINCT p.name
      FROM permissions p
      JOIN role_permissions rp ON p.id = rp.permission_id
      JOIN users u ON u.role = rp.role
      WHERE u.id = ?
    `;

    db.all(query, [userId], (err, rows: { name: string }[]) => {
      db.close();
      if (err) {
        reject(err);
        return;
      }
      resolve(rows.map(row => row.name));
    });
  });
}

// 导出兼容性别名
export const authenticateToken = requireRole(['user', 'author', 'admin']);
export const requireAdmin = requireRole(['admin']);
export const requireAuthor = requireRole(['author', 'admin']);