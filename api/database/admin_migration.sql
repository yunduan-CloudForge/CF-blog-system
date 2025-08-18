-- 管理员权限系统数据库迁移脚本
-- 创建时间: 2024年
-- 模块: 5.1 管理员权限系统

-- 启用外键约束
PRAGMA foreign_keys = ON;

-- 创建权限表
CREATE TABLE permissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name VARCHAR(100) UNIQUE NOT NULL,
  description TEXT DEFAULT NULL,
  resource VARCHAR(100) NOT NULL, -- 资源名称，如 'articles', 'users', 'comments'
  action VARCHAR(50) NOT NULL,    -- 操作类型，如 'create', 'read', 'update', 'delete'
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 创建权限表索引
CREATE INDEX idx_permissions_resource ON permissions(resource);
CREATE INDEX idx_permissions_action ON permissions(action);
CREATE UNIQUE INDEX idx_permissions_resource_action ON permissions(resource, action);

-- 创建角色权限关联表
CREATE TABLE role_permissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  role VARCHAR(20) NOT NULL,
  permission_id INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE,
  UNIQUE(role, permission_id)
);

-- 创建角色权限关联表索引
CREATE INDEX idx_role_permissions_role ON role_permissions(role);
CREATE INDEX idx_role_permissions_permission_id ON role_permissions(permission_id);

-- 创建操作日志表
CREATE TABLE admin_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  action VARCHAR(100) NOT NULL,     -- 操作类型，如 'create_article', 'delete_user'
  resource VARCHAR(100) NOT NULL,   -- 操作的资源类型
  resource_id INTEGER DEFAULT NULL, -- 操作的资源ID
  details TEXT DEFAULT NULL,        -- 操作详情（JSON格式）
  ip_address VARCHAR(45) DEFAULT NULL,
  user_agent TEXT DEFAULT NULL,
  status VARCHAR(20) DEFAULT 'success' CHECK (status IN ('success', 'failed', 'pending')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 创建操作日志表索引
CREATE INDEX idx_admin_logs_user_id ON admin_logs(user_id);
CREATE INDEX idx_admin_logs_action ON admin_logs(action);
CREATE INDEX idx_admin_logs_resource ON admin_logs(resource);
CREATE INDEX idx_admin_logs_created_at ON admin_logs(created_at DESC);
CREATE INDEX idx_admin_logs_status ON admin_logs(status);

-- 初始化基础权限数据
INSERT INTO permissions (name, description, resource, action) VALUES
-- 文章管理权限
('articles.create', '创建文章', 'articles', 'create'),
('articles.read', '查看文章', 'articles', 'read'),
('articles.update', '更新文章', 'articles', 'update'),
('articles.delete', '删除文章', 'articles', 'delete'),
('articles.publish', '发布文章', 'articles', 'publish'),
('articles.manage_all', '管理所有文章', 'articles', 'manage_all'),

-- 用户管理权限
('users.create', '创建用户', 'users', 'create'),
('users.read', '查看用户', 'users', 'read'),
('users.update', '更新用户', 'users', 'update'),
('users.delete', '删除用户', 'users', 'delete'),
('users.manage_roles', '管理用户角色', 'users', 'manage_roles'),
('users.ban', '封禁用户', 'users', 'ban'),

-- 评论管理权限
('comments.create', '创建评论', 'comments', 'create'),
('comments.read', '查看评论', 'comments', 'read'),
('comments.update', '更新评论', 'comments', 'update'),
('comments.delete', '删除评论', 'comments', 'delete'),
('comments.moderate', '审核评论', 'comments', 'moderate'),

-- 分类管理权限
('categories.create', '创建分类', 'categories', 'create'),
('categories.read', '查看分类', 'categories', 'read'),
('categories.update', '更新分类', 'categories', 'update'),
('categories.delete', '删除分类', 'categories', 'delete'),

-- 标签管理权限
('tags.create', '创建标签', 'tags', 'create'),
('tags.read', '查看标签', 'tags', 'read'),
('tags.update', '更新标签', 'tags', 'update'),
('tags.delete', '删除标签', 'tags', 'delete'),

-- 系统管理权限
('system.dashboard', '访问仪表板', 'system', 'dashboard'),
('system.settings', '系统设置', 'system', 'settings'),
('system.logs', '查看系统日志', 'system', 'logs'),
('system.backup', '数据备份', 'system', 'backup'),
('system.restore', '数据恢复', 'system', 'restore'),

-- 权限管理权限
('permissions.read', '查看权限', 'permissions', 'read'),
('permissions.manage', '管理权限', 'permissions', 'manage');

-- 为admin角色分配所有权限
INSERT INTO role_permissions (role, permission_id)
SELECT 'admin', id FROM permissions;

-- 为author角色分配基础权限
INSERT INTO role_permissions (role, permission_id)
SELECT 'author', id FROM permissions 
WHERE name IN (
  'articles.create', 'articles.read', 'articles.update', 'articles.delete', 'articles.publish',
  'comments.create', 'comments.read', 'comments.update', 'comments.delete',
  'categories.read', 'tags.read', 'tags.create'
);

-- 为user角色分配基础权限
INSERT INTO role_permissions (role, permission_id)
SELECT 'user', id FROM permissions 
WHERE name IN (
  'articles.read', 'comments.create', 'comments.read', 'comments.update',
  'categories.read', 'tags.read'
);

-- 创建权限表更新时间触发器
CREATE TRIGGER update_permissions_updated_at
  AFTER UPDATE ON permissions
  FOR EACH ROW
  BEGIN
    UPDATE permissions SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
  END;

-- 创建示例操作日志（可选）
INSERT INTO admin_logs (user_id, action, resource, resource_id, details, ip_address, status) VALUES
(1, 'system.init', 'system', NULL, '{"message": "管理员权限系统初始化完成"}', '127.0.0.1', 'success');