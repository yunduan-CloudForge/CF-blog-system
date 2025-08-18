-- 系统设置表迁移脚本
-- 创建时间: 2024年

-- 启用外键约束
PRAGMA foreign_keys = ON;

-- 创建系统设置表
CREATE TABLE IF NOT EXISTS system_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key VARCHAR(100) UNIQUE NOT NULL,
  value TEXT DEFAULT NULL,
  type VARCHAR(20) DEFAULT 'string' CHECK (type IN ('string', 'number', 'boolean', 'json')),
  description TEXT DEFAULT NULL,
  category VARCHAR(50) DEFAULT 'general',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 创建系统设置表索引
CREATE INDEX IF NOT EXISTS idx_system_settings_key ON system_settings(key);
CREATE INDEX IF NOT EXISTS idx_system_settings_category ON system_settings(category);

-- 插入默认系统设置
INSERT OR IGNORE INTO system_settings (key, value, type, description, category) VALUES
-- 基础设置
('site_name', '我的博客', 'string', '网站名称', 'general'),
('site_description', '一个基于现代技术栈的个人博客系统', 'string', '网站描述', 'general'),
('site_keywords', '博客,技术,分享,学习', 'string', '网站关键词', 'general'),
('site_logo', '', 'string', '网站Logo URL', 'general'),
('site_favicon', '', 'string', '网站图标 URL', 'general'),
('admin_email', 'admin@blog.com', 'string', '管理员邮箱', 'general'),
('timezone', 'Asia/Shanghai', 'string', '时区设置', 'general'),
('language', 'zh-CN', 'string', '默认语言', 'general'),

-- 邮件设置
('smtp_host', '', 'string', 'SMTP服务器地址', 'mail'),
('smtp_port', '587', 'number', 'SMTP端口', 'mail'),
('smtp_secure', 'false', 'boolean', '是否使用SSL/TLS', 'mail'),
('smtp_user', '', 'string', 'SMTP用户名', 'mail'),
('smtp_password', '', 'string', 'SMTP密码', 'mail'),
('mail_from_name', '我的博客', 'string', '发件人名称', 'mail'),
('mail_from_email', '', 'string', '发件人邮箱', 'mail'),

-- 安全设置
('enable_registration', 'true', 'boolean', '允许用户注册', 'security'),
('require_email_verification', 'false', 'boolean', '需要邮箱验证', 'security'),
('max_login_attempts', '5', 'number', '最大登录尝试次数', 'security'),
('session_timeout', '7200', 'number', '会话超时时间(秒)', 'security'),
('enable_two_factor', 'false', 'boolean', '启用双因子认证', 'security'),

-- 内容设置
('posts_per_page', '10', 'number', '每页文章数量', 'content'),
('allow_comments', 'true', 'boolean', '允许评论', 'content'),
('moderate_comments', 'false', 'boolean', '评论需要审核', 'content'),
('enable_likes', 'true', 'boolean', '启用点赞功能', 'content'),
('max_upload_size', '10485760', 'number', '最大上传文件大小(字节)', 'content'),
('allowed_file_types', 'jpg,jpeg,png,gif,pdf,doc,docx', 'string', '允许的文件类型', 'content'),

-- 系统设置
('maintenance_mode', 'false', 'boolean', '维护模式', 'system'),
('debug_mode', 'false', 'boolean', '调试模式', 'system'),
('cache_enabled', 'true', 'boolean', '启用缓存', 'system'),
('backup_enabled', 'true', 'boolean', '启用自动备份', 'system'),
('backup_frequency', 'daily', 'string', '备份频率', 'system'),
('log_level', 'info', 'string', '日志级别', 'system');

-- 创建更新时间触发器
CREATE TRIGGER IF NOT EXISTS update_system_settings_updated_at
  AFTER UPDATE ON system_settings
  FOR EACH ROW
  BEGIN
    UPDATE system_settings SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
  END;