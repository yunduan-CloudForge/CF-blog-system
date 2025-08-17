/**
 * 管理员权限系统API路由
 * 模块: 5.1 管理员权限系统
 */

import express from 'express';
import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';
// import * as bcrypt from 'bcrypt'; // 暂时注释未使用的导入
import nodemailer from 'nodemailer';
import { authMiddleware } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import { logDetailedAction, logSecurityAction, queryLogs, LogStatus, LogLevel } from '../middleware/logger';
import { fileURLToPath } from 'url';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, '../../blog.db');





// 获取所有权限
router.get('/permissions', authMiddleware, requirePermission('admin.permissions.read'), (req, res) => {
  const db = new sqlite3.Database(dbPath);
  
  const query = `
    SELECT p.*, 
           GROUP_CONCAT(rp.role) as roles
    FROM permissions p
    LEFT JOIN role_permissions rp ON p.id = rp.permission_id
    GROUP BY p.id
    ORDER BY p.resource, p.action
  `;

  db.all(query, [], (err, rows) => {
    db.close();
    if (err) {
      return res.status(500).json({ error: '获取权限列表失败' });
    }
    
    const permissions = rows.map((row: Record<string, unknown>) => ({
      ...row,
      roles: row.roles ? (row.roles as string).split(',') : []
    }));
    
    res.json({ data: permissions });
  });
});

// 获取角色权限
router.get('/roles/:role/permissions', authMiddleware, requirePermission('admin.permissions.read'), (req, res) => {
  const { role } = req.params;
  const db = new sqlite3.Database(dbPath);
  
  const query = `
    SELECT p.* FROM permissions p
    JOIN role_permissions rp ON p.id = rp.permission_id
    WHERE rp.role = ?
    ORDER BY p.resource, p.action
  `;

  db.all(query, [role], (err, rows) => {
    db.close();
    if (err) {
      return res.status(500).json({ error: '获取角色权限失败' });
    }
    res.json({ role, permissions: rows });
  });
});

// 更新角色权限
router.put('/roles/:role/permissions', 
  authMiddleware, 
  requirePermission('admin.permissions.update'),
  logSecurityAction('update_role_permissions', 'permissions'),
  (req, res) => {
    const { role } = req.params;
    const { permissionIds } = req.body;
    
    if (!Array.isArray(permissionIds)) {
      return res.status(400).json({ error: '权限ID列表格式错误' });
    }
    
    const db = new sqlite3.Database(dbPath);
    
    // 开始事务
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');
      
      // 删除现有权限
      db.run('DELETE FROM role_permissions WHERE role = ?', [role], (err) => {
        if (err) {
          db.run('ROLLBACK');
          db.close();
          return res.status(500).json({ error: '删除现有权限失败' });
        }
        
        // 插入新权限
        const insertStmt = db.prepare('INSERT INTO role_permissions (role, permission_id) VALUES (?, ?)');
        let insertCount = 0;
        let hasError = false;
        
        if (permissionIds.length === 0) {
          db.run('COMMIT');
          db.close();
          return res.json({ message: '角色权限更新成功', role, permissionCount: 0 });
        }
        
        permissionIds.forEach((permissionId: number) => {
          insertStmt.run([role, permissionId], (err) => {
            if (err && !hasError) {
              hasError = true;
              db.run('ROLLBACK');
              db.close();
              return res.status(500).json({ error: '插入新权限失败' });
            }
            
            insertCount++;
            if (insertCount === permissionIds.length && !hasError) {
              insertStmt.finalize();
              db.run('COMMIT');
              db.close();
              res.json({ message: '角色权限更新成功', role, permissionCount: insertCount });
            }
          });
        });
      });
    });
  }
);

// 获取操作日志
router.get('/logs', authMiddleware, requirePermission('admin.logs.read'), async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      action, 
      resource, 
      userId, 
      status, 
      level,
      startDate,
      endDate 
    } = req.query;
    
    const filters = {
      userId: userId ? Number(userId) : undefined,
      action: action as string,
      resource: resource as string,
      status: status as LogStatus,
      level: level as LogLevel,
      startDate: startDate as string,
      endDate: endDate as string
    };
    
    const pagination = {
      page: Number(page),
      limit: Number(limit)
    };
    
    const result = await queryLogs(filters, pagination);
    
    res.json({
      logs: result.logs,
      total: result.total,
      page: pagination.page,
      limit: pagination.limit,
      totalPages: Math.ceil(result.total / pagination.limit)
    });
  } catch (error) {
    console.error('获取操作日志失败:', error);
    res.status(500).json({ error: '获取操作日志失败' });
  }
});

// 获取系统统计信息
router.get('/stats', authMiddleware, requirePermission('admin.stats.read'), (req, res) => {
  const db = new sqlite3.Database(dbPath);
  
  const queries = {
    users: 'SELECT COUNT(*) as count FROM users',
    articles: 'SELECT COUNT(*) as count FROM articles',
    comments: 'SELECT COUNT(*) as count FROM comments',
    categories: 'SELECT COUNT(*) as count FROM categories',
    tags: 'SELECT COUNT(*) as count FROM tags',
    adminLogs: 'SELECT COUNT(*) as count FROM admin_logs WHERE created_at >= date("now", "-7 days")',
    recentUsers: 'SELECT COUNT(*) as count FROM users WHERE created_at >= date("now", "-7 days")',
    publishedArticles: 'SELECT COUNT(*) as count FROM articles WHERE status = "published"'
  };
  
  const stats: Record<string, number> = {};
  let completedQueries = 0;
  const totalQueries = Object.keys(queries).length;
  
  Object.entries(queries).forEach(([key, query]) => {
    db.get(query, [], (err, row: { count: number }) => {
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

// 获取仪表板详细统计数据
router.get('/dashboard/stats', authMiddleware, requirePermission('admin.stats.read'), (req, res) => {
  const db = new sqlite3.Database(dbPath);
  
  const dashboardStats: any = {
    overview: {},
    trends: {},
    charts: {},
    systemStatus: {}
  };
  
  let completedQueries = 0;
  const totalQueries = 8; // 总查询数量
  
  // 1. 基础概览数据
  const overviewQuery = `
    SELECT 
      (SELECT COUNT(*) FROM users) as totalUsers,
      (SELECT COUNT(*) FROM users WHERE created_at >= date('now', '-7 days')) as newUsers,
      (SELECT COUNT(*) FROM articles) as totalArticles,
      (SELECT COUNT(*) FROM articles WHERE status = 'published') as publishedArticles,
      (SELECT COUNT(*) FROM articles WHERE created_at >= date('now', '-7 days')) as newArticles,
      (SELECT COUNT(*) FROM comments) as totalComments,
      (SELECT COUNT(*) FROM comments WHERE created_at >= date('now', '-7 days')) as newComments,
      (SELECT SUM(views) FROM articles) as totalViews,
      (SELECT SUM(likes) FROM articles) as totalLikes
  `;
  
  db.get(overviewQuery, [], (err, row: any) => {
    if (err) {
      console.error('Overview query error:', err);
      dashboardStats.overview = {};
    } else {
      dashboardStats.overview = row;
    }
    
    completedQueries++;
    if (completedQueries === totalQueries) {
      db.close();
      res.json({
        success: true,
        data: dashboardStats,
        timestamp: new Date().toISOString()
      });
    }
  });
  
  // 2. 用户注册趋势（最近30天）
  const userTrendQuery = `
    SELECT 
      date(created_at) as date,
      COUNT(*) as count
    FROM users 
    WHERE created_at >= date('now', '-30 days')
    GROUP BY date(created_at)
    ORDER BY date
  `;
  
  db.all(userTrendQuery, [], (err, rows) => {
    if (err) {
      console.error('User trend query error:', err);
      dashboardStats.trends.users = [];
    } else {
      dashboardStats.trends.users = rows;
    }
    
    completedQueries++;
    if (completedQueries === totalQueries) {
      db.close();
      res.json({
        success: true,
        data: dashboardStats,
        timestamp: new Date().toISOString()
      });
    }
  });
  
  // 3. 文章发布趋势（最近30天）
  const articleTrendQuery = `
    SELECT 
      date(created_at) as date,
      COUNT(*) as count
    FROM articles 
    WHERE created_at >= date('now', '-30 days')
    GROUP BY date(created_at)
    ORDER BY date
  `;
  
  db.all(articleTrendQuery, [], (err, rows) => {
    if (err) {
      console.error('Article trend query error:', err);
      dashboardStats.trends.articles = [];
    } else {
      dashboardStats.trends.articles = rows;
    }
    
    completedQueries++;
    if (completedQueries === totalQueries) {
      db.close();
      res.json({
        success: true,
        data: dashboardStats,
        timestamp: new Date().toISOString()
      });
    }
  });
  
  // 4. 评论趋势（最近30天）
  const commentTrendQuery = `
    SELECT 
      date(created_at) as date,
      COUNT(*) as count
    FROM comments 
    WHERE created_at >= date('now', '-30 days')
    GROUP BY date(created_at)
    ORDER BY date
  `;
  
  db.all(commentTrendQuery, [], (err, rows) => {
    if (err) {
      console.error('Comment trend query error:', err);
      dashboardStats.trends.comments = [];
    } else {
      dashboardStats.trends.comments = rows;
    }
    
    completedQueries++;
    if (completedQueries === totalQueries) {
      db.close();
      res.json({
        success: true,
        data: dashboardStats,
        timestamp: new Date().toISOString()
      });
    }
  });
  
  // 5. 分类文章分布
  const categoryDistributionQuery = `
    SELECT 
      c.name,
      COUNT(a.id) as count
    FROM categories c
    LEFT JOIN articles a ON c.id = a.category_id AND a.status = 'published'
    GROUP BY c.id, c.name
    ORDER BY count DESC
  `;
  
  db.all(categoryDistributionQuery, [], (err, rows) => {
    if (err) {
      console.error('Category distribution query error:', err);
      dashboardStats.charts.categoryDistribution = [];
    } else {
      dashboardStats.charts.categoryDistribution = rows;
    }
    
    completedQueries++;
    if (completedQueries === totalQueries) {
      db.close();
      res.json({
        success: true,
        data: dashboardStats,
        timestamp: new Date().toISOString()
      });
    }
  });
  
  // 6. 热门文章（按阅读量）
  const popularArticlesQuery = `
    SELECT 
      a.id,
      a.title,
      a.views,
      a.likes,
      (SELECT COUNT(*) FROM comments c WHERE c.article_id = a.id) as comments_count,
      u.username as author
    FROM articles a
    JOIN users u ON a.author_id = u.id
    WHERE a.status = 'published'
    ORDER BY a.views DESC
    LIMIT 10
  `;
  
  db.all(popularArticlesQuery, [], (err, rows) => {
    if (err) {
      console.error('Popular articles query error:', err);
      dashboardStats.charts.popularArticles = [];
    } else {
      dashboardStats.charts.popularArticles = rows;
    }
    
    completedQueries++;
    if (completedQueries === totalQueries) {
      db.close();
      res.json({
        success: true,
        data: dashboardStats,
        timestamp: new Date().toISOString()
      });
    }
  });
  
  // 7. 活跃用户（按文章数量）
  const activeUsersQuery = `
    SELECT 
      u.id,
      u.username,
      u.email,
      COUNT(a.id) as articleCount,
      u.created_at
    FROM users u
    LEFT JOIN articles a ON u.id = a.author_id
    GROUP BY u.id
    ORDER BY articleCount DESC
    LIMIT 10
  `;
  
  db.all(activeUsersQuery, [], (err, rows) => {
    if (err) {
      console.error('Active users query error:', err);
      dashboardStats.charts.activeUsers = [];
    } else {
      dashboardStats.charts.activeUsers = rows;
    }
    
    completedQueries++;
    if (completedQueries === totalQueries) {
      db.close();
      res.json({
        success: true,
        data: dashboardStats,
        timestamp: new Date().toISOString()
      });
    }
  });
  
  // 8. 系统状态监控
  const systemStatusQuery = `
    SELECT 
      (SELECT COUNT(*) FROM admin_logs WHERE created_at >= datetime('now', '-1 hour')) as recentLogs,
      (SELECT COUNT(*) FROM admin_logs WHERE action LIKE '%error%' AND created_at >= datetime('now', '-24 hours')) as errorCount,
      (SELECT COUNT(*) FROM users WHERE created_at >= datetime('now', '-1 hour')) as recentUsers,
      (SELECT AVG(CAST(views AS REAL)) FROM articles WHERE status = 'published') as avgViews
  `;
  
  db.get(systemStatusQuery, [], (err, row: any) => {
    if (err) {
      console.error('System status query error:', err);
      dashboardStats.systemStatus = {};
    } else {
      dashboardStats.systemStatus = {
        ...row,
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        timestamp: new Date().toISOString()
      };
    }
    
    completedQueries++;
    if (completedQueries === totalQueries) {
      db.close();
      res.json({
        success: true,
        data: dashboardStats,
        timestamp: new Date().toISOString()
      });
    }
  });
});

// 获取系统设置
router.get('/settings', authMiddleware, requirePermission('admin.settings.read'), (req, res) => {
  const db = new sqlite3.Database(dbPath);
  
  const query = 'SELECT * FROM system_settings';
  
  db.all(query, [], (err, rows) => {
    db.close();
    if (err) {
      console.error('获取系统设置失败:', err);
      return res.status(500).json({ error: '获取系统设置失败' });
    }
    
    // 将设置转换为键值对格式
    const settings: any = {};
    rows.forEach((row: any) => {
      settings[row.key] = row.value;
    });
    
    res.json({ 
      success: true,
      data: settings,
      timestamp: new Date().toISOString()
    });
  });
});

// 更新系统设置
router.put('/settings', 
  authMiddleware, 
  requirePermission('admin.settings.update'),
  logDetailedAction('update_system_settings', 'settings'),
  (req, res) => {
    const settings = req.body;
    const db = new sqlite3.Database(dbPath);
    
    // 开始事务
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');
      
      const updateStmt = db.prepare('INSERT OR REPLACE INTO system_settings (key, value, updated_at) VALUES (?, ?, datetime("now"))');
      let updateCount = 0;
      let hasError = false;
      const settingsKeys = Object.keys(settings);
      
      if (settingsKeys.length === 0) {
        db.run('COMMIT');
        db.close();
        return res.json({ 
          success: true,
          message: '没有设置需要更新',
          data: {},
          timestamp: new Date().toISOString()
        });
      }
      
      settingsKeys.forEach((key) => {
        updateStmt.run([key, settings[key]], (err) => {
          if (err && !hasError) {
            hasError = true;
            console.error('更新设置失败:', err);
            db.run('ROLLBACK');
            db.close();
            return res.status(500).json({ error: '更新设置失败' });
          }
          
          updateCount++;
          if (updateCount === settingsKeys.length && !hasError) {
            updateStmt.finalize();
            db.run('COMMIT');
            db.close();
            res.json({ 
              success: true,
              message: '设置更新成功', 
              data: { updatedCount: updateCount },
              timestamp: new Date().toISOString()
            });
          }
        });
      });
    });
  }
);

// 获取所有角色权限映射
router.get('/role-permissions', authMiddleware, requirePermission('admin.permissions.read'), (req, res) => {
  const db = new sqlite3.Database(dbPath);
  
  const query = `
    SELECT 
      rp.role,
      rp.permission_id,
      p.name as permission_name,
      p.description as permission_description,
      p.resource,
      p.action
    FROM role_permissions rp
    JOIN permissions p ON rp.permission_id = p.id
    ORDER BY rp.role, p.resource, p.action
  `;

  db.all(query, [], (err, rows) => {
    db.close();
    if (err) {
      console.error('获取角色权限映射失败:', err);
      return res.status(500).json({ error: '获取角色权限映射失败' });
    }
    
    res.json({ data: rows });
  });
});

// 创建权限
router.post('/permissions', 
  authMiddleware, 
  requirePermission('admin.permissions.create'),
  logDetailedAction('create_permission', 'permissions'),
  (req, res) => {
    const { name, description, resource, action } = req.body;
    
    if (!name || !resource || !action) {
      return res.status(400).json({ error: '权限名称、资源和操作不能为空' });
    }
    
    const db = new sqlite3.Database(dbPath);
    
    const query = `
      INSERT INTO permissions (name, description, resource, action, created_at)
      VALUES (?, ?, ?, ?, datetime('now'))
    `;
    
    db.run(query, [name, description || '', resource, action], function(err) {
      db.close();
      if (err) {
        console.error('创建权限失败:', err);
        return res.status(500).json({ error: '创建权限失败' });
      }
      
      res.status(201).json({ 
        message: '权限创建成功', 
        id: this.lastID,
        permission: { id: this.lastID, name, description, resource, action }
      });
    });
  }
);

// 更新权限
router.put('/permissions/:id', 
  authMiddleware, 
  requirePermission('admin.permissions.update'),
  logDetailedAction('update_permission', 'permissions'),
  (req, res) => {
    const { id } = req.params;
    const { name, description, resource, action } = req.body;
    
    if (!name || !resource || !action) {
      return res.status(400).json({ error: '权限名称、资源和操作不能为空' });
    }
    
    const db = new sqlite3.Database(dbPath);
    
    const query = `
      UPDATE permissions 
      SET name = ?, description = ?, resource = ?, action = ?, updated_at = datetime('now')
      WHERE id = ?
    `;
    
    db.run(query, [name, description || '', resource, action, id], function(err) {
      db.close();
      if (err) {
        console.error('更新权限失败:', err);
        return res.status(500).json({ error: '更新权限失败' });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ error: '权限不存在' });
      }
      
      res.json({ 
        message: '权限更新成功',
        permission: { id: parseInt(id), name, description, resource, action }
      });
    });
  }
);

// 删除权限
router.delete('/permissions/:id', 
  authMiddleware, 
  requirePermission('admin.permissions.delete'),
  logSecurityAction('delete_permission', 'permissions'),
  (req, res) => {
    const { id } = req.params;
    const db = new sqlite3.Database(dbPath);
    
    // 开始事务
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');
      
      // 先删除角色权限关联
      db.run('DELETE FROM role_permissions WHERE permission_id = ?', [id], (err) => {
        if (err) {
          db.run('ROLLBACK');
          db.close();
          console.error('删除权限关联失败:', err);
          return res.status(500).json({ error: '删除权限关联失败' });
        }
        
        // 再删除权限本身
        db.run('DELETE FROM permissions WHERE id = ?', [id], function(err) {
          if (err) {
            db.run('ROLLBACK');
            db.close();
            console.error('删除权限失败:', err);
            return res.status(500).json({ error: '删除权限失败' });
          }
          
          if (this.changes === 0) {
            db.run('ROLLBACK');
            db.close();
            return res.status(404).json({ error: '权限不存在' });
          }
          
          db.run('COMMIT');
          db.close();
          res.json({ message: '权限删除成功' });
        });
      });
    });
  }
);

// 测试邮件配置
router.post('/settings/test-email', 
  authMiddleware, 
  requirePermission('admin.settings.update'),
  logDetailedAction('test_email_settings', 'settings'),
  async (req, res) => {
    const { 
      smtp_host, 
      smtp_port, 
      smtp_username, 
      smtp_password, 
      smtp_encryption, 
      mail_from_address, 
      mail_from_name,
      test_email 
    } = req.body;
    
    // 验证必需的邮件配置
    if (!smtp_host || !smtp_port || !smtp_username || !smtp_password || !mail_from_address) {
      return res.status(400).json({ 
        success: false,
        error: '邮件配置信息不完整' 
      });
    }
    
    try {
      // 创建邮件传输器
      const transporter = nodemailer.createTransport({
        host: smtp_host,
        port: parseInt(smtp_port),
        secure: smtp_encryption === 'ssl', // true for 465, false for other ports
        auth: {
          user: smtp_username,
          pass: smtp_password
        },
        tls: {
          rejectUnauthorized: false // 允许自签名证书
        }
      });
      
      // 验证SMTP连接
      await transporter.verify();
      console.log('SMTP连接验证成功');
      
      // 发送测试邮件
      const testEmailAddress = test_email || '18677523963@163.com';
      const mailOptions = {
        from: `${mail_from_name || 'Blog System'} <${mail_from_address}>`,
        to: testEmailAddress,
        subject: '博客系统邮件配置测试',
        text: '这是一封测试邮件，用于验证博客系统的邮件配置是否正常工作。',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">博客系统邮件配置测试</h2>
            <p>您好！</p>
            <p>这是一封测试邮件，用于验证博客系统的邮件配置是否正常工作。</p>
            <p><strong>测试时间：</strong> ${new Date().toLocaleString('zh-CN')}</p>
            <p><strong>SMTP服务器：</strong> ${smtp_host}:${smtp_port}</p>
            <p><strong>发件人：</strong> ${mail_from_address}</p>
            <hr style="border: 1px solid #eee; margin: 20px 0;">
            <p style="color: #666; font-size: 12px;">此邮件由博客系统自动发送，请勿回复。</p>
          </div>
        `
      };
      
      const info = await transporter.sendMail(mailOptions);
      console.log('邮件发送成功:', info.messageId);
      
      res.json({
        success: true,
        message: '测试邮件发送成功',
        data: {
          success: true,
          message: '邮件配置测试成功',
          details: {
            host: smtp_host,
            port: smtp_port,
            secure: smtp_encryption === 'ssl',
            from: `${mail_from_name || 'Blog System'} <${mail_from_address}>`,
            to: testEmailAddress,
            messageId: info.messageId,
            response: info.response
          }
        }
      });
      
    } catch (error) {
      console.error('邮件测试失败:', error);
      res.status(500).json({ 
        success: false,
        error: '邮件测试失败',
        details: error instanceof Error ? error.message : '未知错误'
      });
    }
  }
);

// 创建系统备份
router.post('/backup', 
  authMiddleware, 
  requirePermission('admin.backup.create'),
  logSecurityAction('create_backup', 'system'),
  (req, res) => {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupFileName = `backup_${timestamp}.db`;
      const backupPath = path.join(__dirname, '../../backups', backupFileName);
      
      // 确保备份目录存在
      const backupDir = path.dirname(backupPath);
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }
      
      // 创建数据库备份
      const sourceDb = new sqlite3.Database(dbPath);
      
      sourceDb.serialize(() => {
        // 获取所有表的结构和数据（排除系统表）
        sourceDb.all("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'", [], (err, tables) => {
          if (err) {
            console.error('获取表列表失败:', err);
            return res.status(500).json({ error: '备份失败：无法获取表列表' });
          }
          
          // 创建备份数据库
          const backupDb = new sqlite3.Database(backupPath);
          let completedTables = 0;
          
          if (tables.length === 0) {
            backupDb.close();
            sourceDb.close();
            return res.json({
              success: true,
              message: '备份创建成功',
              filename: backupFileName,
              path: backupPath,
              timestamp: new Date().toISOString()
            });
          }
          
          tables.forEach((table: any) => {
            const tableName = table.name;
            
            // 获取表结构
            sourceDb.get(`SELECT sql FROM sqlite_master WHERE type='table' AND name=?`, [tableName], (err, schema: any) => {
              if (err) {
                console.error(`获取表 ${tableName} 结构失败:`, err);
                return;
              }
              
              // 创建表
              backupDb.run(schema.sql, (err) => {
                if (err) {
                  console.error(`创建表 ${tableName} 失败:`, err);
                  return;
                }
                
                // 复制数据
                sourceDb.all(`SELECT * FROM ${tableName}`, [], (err, rows) => {
                  if (err) {
                    console.error(`读取表 ${tableName} 数据失败:`, err);
                    return;
                  }
                  
                  if (rows.length > 0) {
                    const columns = Object.keys(rows[0]);
                    const placeholders = columns.map(() => '?').join(',');
                    const insertSql = `INSERT INTO ${tableName} (${columns.join(',')}) VALUES (${placeholders})`;
                    
                    const stmt = backupDb.prepare(insertSql);
                    rows.forEach((row: any) => {
                      const values = columns.map(col => row[col]);
                      stmt.run(values);
                    });
                    stmt.finalize();
                  }
                  
                  completedTables++;
                  if (completedTables === tables.length) {
                    backupDb.close();
                    sourceDb.close();
                    
                    res.json({
                      success: true,
                      message: '备份创建成功',
                      filename: backupFileName,
                      path: backupPath,
                      timestamp: new Date().toISOString(),
                      tables: tables.length
                    });
                  }
                });
              });
            });
          });
        });
      });
      
    } catch (error) {
      console.error('创建备份失败:', error);
      res.status(500).json({ 
        success: false,
        error: '创建备份失败',
        details: error instanceof Error ? error.message : '未知错误'
      });
    }
  }
);

export default router;