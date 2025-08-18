-- 监控系统数据库表结构
-- 用于存储错误报告和性能指标

-- 错误报告表
CREATE TABLE IF NOT EXISTS error_reports (
  id VARCHAR(255) PRIMARY KEY,
  type VARCHAR(50) NOT NULL CHECK (type IN ('javascript', 'promise', 'resource', 'network', 'custom')),
  message TEXT NOT NULL,
  stack TEXT,
  filename VARCHAR(500),
  lineno INTEGER,
  colno INTEGER,
  timestamp DATETIME NOT NULL,
  url VARCHAR(1000) NOT NULL,
  user_agent TEXT,
  user_id INTEGER,
  session_id VARCHAR(255) NOT NULL,
  breadcrumbs TEXT, -- JSON格式存储
  context TEXT, -- JSON格式存储
  client_ip VARCHAR(45),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- 性能指标表
CREATE TABLE IF NOT EXISTS performance_metrics (
  id VARCHAR(255) PRIMARY KEY,
  type VARCHAR(50) NOT NULL CHECK (type IN ('navigation', 'resource', 'paint', 'layout', 'custom')),
  name VARCHAR(100) NOT NULL,
  value REAL NOT NULL,
  unit VARCHAR(20) NOT NULL,
  timestamp DATETIME NOT NULL,
  url VARCHAR(1000) NOT NULL,
  user_id INTEGER,
  session_id VARCHAR(255) NOT NULL,
  context TEXT, -- JSON格式存储
  client_ip VARCHAR(45),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- 创建索引以优化查询性能
CREATE INDEX IF NOT EXISTS idx_error_reports_created_at ON error_reports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_reports_type ON error_reports(type);
CREATE INDEX IF NOT EXISTS idx_error_reports_session_id ON error_reports(session_id);
CREATE INDEX IF NOT EXISTS idx_error_reports_user_id ON error_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_error_reports_url ON error_reports(url);
CREATE INDEX IF NOT EXISTS idx_error_reports_message ON error_reports(message);

CREATE INDEX IF NOT EXISTS idx_performance_metrics_created_at ON performance_metrics(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_type ON performance_metrics(type);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_name ON performance_metrics(name);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_session_id ON performance_metrics(session_id);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_user_id ON performance_metrics(user_id);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_url ON performance_metrics(url);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_value ON performance_metrics(value);

-- 复合索引
CREATE INDEX IF NOT EXISTS idx_error_reports_type_created_at ON error_reports(type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_type_name ON performance_metrics(type, name);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_name_created_at ON performance_metrics(name, created_at DESC);

-- 系统监控统计视图
CREATE VIEW IF NOT EXISTS v_monitoring_summary AS
SELECT 
  'errors' as metric_type,
  COUNT(*) as total_count,
  COUNT(DISTINCT session_id) as unique_sessions,
  COUNT(DISTINCT user_id) as unique_users,
  DATE(created_at) as date
FROM error_reports 
WHERE created_at >= date('now', '-30 days')
GROUP BY DATE(created_at)
UNION ALL
SELECT 
  'performance' as metric_type,
  COUNT(*) as total_count,
  COUNT(DISTINCT session_id) as unique_sessions,
  COUNT(DISTINCT user_id) as unique_users,
  DATE(created_at) as date
FROM performance_metrics 
WHERE created_at >= date('now', '-30 days')
GROUP BY DATE(created_at);

-- 错误趋势视图
CREATE VIEW IF NOT EXISTS v_error_trends AS
SELECT 
  type,
  COUNT(*) as error_count,
  COUNT(DISTINCT session_id) as affected_sessions,
  COUNT(DISTINCT user_id) as affected_users,
  DATE(created_at) as date,
  strftime('%H', created_at) as hour
FROM error_reports 
WHERE created_at >= datetime('now', '-7 days')
GROUP BY type, DATE(created_at), strftime('%H', created_at)
ORDER BY date DESC, hour DESC;

-- 性能趋势视图
CREATE VIEW IF NOT EXISTS v_performance_trends AS
SELECT 
  type,
  name,
  AVG(value) as avg_value,
  MIN(value) as min_value,
  MAX(value) as max_value,
  COUNT(*) as sample_count,
  unit,
  DATE(created_at) as date,
  strftime('%H', created_at) as hour
FROM performance_metrics 
WHERE created_at >= datetime('now', '-7 days')
GROUP BY type, name, unit, DATE(created_at), strftime('%H', created_at)
ORDER BY date DESC, hour DESC;

-- 清理过期数据的触发器（可选）
-- 保留30天的错误报告
-- CREATE TRIGGER IF NOT EXISTS cleanup_old_error_reports
-- AFTER INSERT ON error_reports
-- BEGIN
--   DELETE FROM error_reports 
--   WHERE created_at < datetime('now', '-30 days');
-- END;

-- 保留30天的性能指标
-- CREATE TRIGGER IF NOT EXISTS cleanup_old_performance_metrics
-- AFTER INSERT ON performance_metrics
-- BEGIN
--   DELETE FROM performance_metrics 
--   WHERE created_at < datetime('now', '-30 days');
-- END;