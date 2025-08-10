#!/usr/bin/env node

/**
 * 监控配置脚本
 * 用于设置应用监控、日志收集和告警
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 配置
const config = {
  monitoring: {
    prometheus: {
      port: 9090,
      retention: '15d',
      scrapeInterval: '15s'
    },
    grafana: {
      port: 3001,
      adminUser: 'admin',
      adminPassword: process.env.GRAFANA_PASSWORD || 'admin123'
    },
    alertmanager: {
      port: 9093,
      slackWebhook: process.env.SLACK_WEBHOOK_URL,
      emailSmtp: {
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT || 587,
        username: process.env.SMTP_USERNAME,
        password: process.env.SMTP_PASSWORD,
        from: process.env.ALERT_EMAIL_FROM
      }
    },
    loki: {
      port: 3100,
      retention: '168h' // 7 days
    },
    promtail: {
      port: 9080
    }
  },
  application: {
    name: 'blog-system',
    environment: process.env.NODE_ENV || 'development',
    version: process.env.APP_VERSION || '1.0.0'
  }
};

// 日志函数
function log(level, message, data = null) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level,
    message,
    ...(data && { data })
  };
  
  console.log(JSON.stringify(logEntry));
}

function logInfo(message, data) {
  log('INFO', message, data);
}

function logError(message, data) {
  log('ERROR', message, data);
}

function logSuccess(message, data) {
  log('SUCCESS', message, data);
}

function logWarning(message, data) {
  log('WARNING', message, data);
}

// 创建目录
function ensureDirectory(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    logInfo(`创建目录: ${dirPath}`);
  }
}

// 生成Prometheus配置
function generatePrometheusConfig() {
  const prometheusConfig = `
# Prometheus配置文件
global:
  scrape_interval: ${config.monitoring.prometheus.scrapeInterval}
  evaluation_interval: 15s

rule_files:
  - "alert_rules.yml"

alerting:
  alertmanagers:
    - static_configs:
        - targets:
          - alertmanager:${config.monitoring.alertmanager.port}

scrape_configs:
  # Prometheus自身监控
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:${config.monitoring.prometheus.port}']

  # 应用监控
  - job_name: '${config.application.name}'
    static_configs:
      - targets: ['app:3000']
    metrics_path: '/metrics'
    scrape_interval: 10s
    scrape_timeout: 5s

  # Node Exporter (系统监控)
  - job_name: 'node-exporter'
    static_configs:
      - targets: ['node-exporter:9100']

  # PostgreSQL监控
  - job_name: 'postgres-exporter'
    static_configs:
      - targets: ['postgres-exporter:9187']

  # Redis监控
  - job_name: 'redis-exporter'
    static_configs:
      - targets: ['redis-exporter:9121']

  # Docker监控
  - job_name: 'cadvisor'
    static_configs:
      - targets: ['cadvisor:8080']

  # Nginx监控
  - job_name: 'nginx-exporter'
    static_configs:
      - targets: ['nginx-exporter:9113']
`;

  return prometheusConfig.trim();
}

// 生成告警规则
function generateAlertRules() {
  const alertRules = `
# Prometheus告警规则
groups:
  - name: application.rules
    rules:
      # 应用可用性告警
      - alert: ApplicationDown
        expr: up{job="${config.application.name}"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "应用服务不可用"
          description: "{{ $labels.instance }} 应用服务已停止运行超过1分钟"

      # 高响应时间告警
      - alert: HighResponseTime
        expr: http_request_duration_seconds{quantile="0.95"} > 2
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "应用响应时间过高"
          description: "{{ $labels.instance }} 95%响应时间超过2秒，当前值: {{ $value }}s"

      # 高错误率告警
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m]) > 0.05
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "应用错误率过高"
          description: "{{ $labels.instance }} 5xx错误率超过5%，当前值: {{ $value | humanizePercentage }}"

  - name: system.rules
    rules:
      # CPU使用率告警
      - alert: HighCPUUsage
        expr: 100 - (avg by(instance) (irate(node_cpu_seconds_total{mode="idle"}[5m])) * 100) > 80
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "CPU使用率过高"
          description: "{{ $labels.instance }} CPU使用率超过80%，当前值: {{ $value | humanizePercentage }}"

      # 内存使用率告警
      - alert: HighMemoryUsage
        expr: (1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) * 100 > 85
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "内存使用率过高"
          description: "{{ $labels.instance }} 内存使用率超过85%，当前值: {{ $value | humanizePercentage }}"

      # 磁盘空间告警
      - alert: HighDiskUsage
        expr: (1 - (node_filesystem_avail_bytes{fstype!="tmpfs"} / node_filesystem_size_bytes{fstype!="tmpfs"})) * 100 > 90
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "磁盘空间不足"
          description: "{{ $labels.instance }} 磁盘使用率超过90%，当前值: {{ $value | humanizePercentage }}"

  - name: database.rules
    rules:
      # 数据库连接数告警
      - alert: HighDatabaseConnections
        expr: pg_stat_database_numbackends / pg_settings_max_connections * 100 > 80
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "数据库连接数过高"
          description: "PostgreSQL连接数超过80%，当前值: {{ $value | humanizePercentage }}"

      # 数据库查询时间告警
      - alert: SlowDatabaseQueries
        expr: pg_stat_activity_max_tx_duration > 300
        for: 2m
        labels:
          severity: warning
        annotations:
          summary: "数据库查询时间过长"
          description: "PostgreSQL存在运行超过5分钟的查询"

  - name: redis.rules
    rules:
      # Redis内存使用告警
      - alert: HighRedisMemoryUsage
        expr: redis_memory_used_bytes / redis_memory_max_bytes * 100 > 90
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Redis内存使用率过高"
          description: "Redis内存使用率超过90%，当前值: {{ $value | humanizePercentage }}"

      # Redis连接数告警
      - alert: HighRedisConnections
        expr: redis_connected_clients > 100
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Redis连接数过高"
          description: "Redis连接数超过100，当前值: {{ $value }}"
`;

  return alertRules.trim();
}

// 生成Alertmanager配置
function generateAlertmanagerConfig() {
  const alertmanagerConfig = `
# Alertmanager配置文件
global:
  smtp_smarthost: '${config.monitoring.alertmanager.emailSmtp.host}:${config.monitoring.alertmanager.emailSmtp.port}'
  smtp_from: '${config.monitoring.alertmanager.emailSmtp.from}'
  smtp_auth_username: '${config.monitoring.alertmanager.emailSmtp.username}'
  smtp_auth_password: '${config.monitoring.alertmanager.emailSmtp.password}'

route:
  group_by: ['alertname', 'cluster', 'service']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 1h
  receiver: 'default'
  routes:
    - match:
        severity: critical
      receiver: 'critical-alerts'
    - match:
        severity: warning
      receiver: 'warning-alerts'

receivers:
  - name: 'default'
    slack_configs:
      - api_url: '${config.monitoring.alertmanager.slackWebhook}'
        channel: '#alerts'
        title: '{{ range .Alerts }}{{ .Annotations.summary }}{{ end }}'
        text: '{{ range .Alerts }}{{ .Annotations.description }}{{ end }}'

  - name: 'critical-alerts'
    email_configs:
      - to: '${config.monitoring.alertmanager.emailSmtp.from}'
        subject: '[CRITICAL] {{ .GroupLabels.alertname }}'
        body: |
          {{ range .Alerts }}
          告警: {{ .Annotations.summary }}
          描述: {{ .Annotations.description }}
          标签: {{ range .Labels.SortedPairs }}{{ .Name }}={{ .Value }} {{ end }}
          时间: {{ .StartsAt }}
          {{ end }}
    slack_configs:
      - api_url: '${config.monitoring.alertmanager.slackWebhook}'
        channel: '#critical-alerts'
        title: '🚨 CRITICAL: {{ range .Alerts }}{{ .Annotations.summary }}{{ end }}'
        text: '{{ range .Alerts }}{{ .Annotations.description }}{{ end }}'
        color: 'danger'

  - name: 'warning-alerts'
    slack_configs:
      - api_url: '${config.monitoring.alertmanager.slackWebhook}'
        channel: '#alerts'
        title: '⚠️ WARNING: {{ range .Alerts }}{{ .Annotations.summary }}{{ end }}'
        text: '{{ range .Alerts }}{{ .Annotations.description }}{{ end }}'
        color: 'warning'

inhibit_rules:
  - source_match:
      severity: 'critical'
    target_match:
      severity: 'warning'
    equal: ['alertname', 'cluster', 'service']
`;

  return alertmanagerConfig.trim();
}

// 生成Grafana数据源配置
function generateGrafanaDatasources() {
  const datasources = {
    apiVersion: 1,
    datasources: [
      {
        name: 'Prometheus',
        type: 'prometheus',
        access: 'proxy',
        url: `http://prometheus:${config.monitoring.prometheus.port}`,
        isDefault: true,
        editable: true
      },
      {
        name: 'Loki',
        type: 'loki',
        access: 'proxy',
        url: `http://loki:${config.monitoring.loki.port}`,
        editable: true
      }
    ]
  };

  return JSON.stringify(datasources, null, 2);
}

// 生成Loki配置
function generateLokiConfig() {
  const lokiConfig = `
# Loki配置文件
auth_enabled: false

server:
  http_listen_port: ${config.monitoring.loki.port}
  grpc_listen_port: 9096

ingester:
  wal:
    enabled: true
    dir: /loki/wal
  lifecycler:
    address: 127.0.0.1
    ring:
      kvstore:
        store: inmemory
      replication_factor: 1
    final_sleep: 0s
  chunk_idle_period: 1h
  max_chunk_age: 1h
  chunk_target_size: 1048576
  chunk_retain_period: 30s
  max_transfer_retries: 0

schema_config:
  configs:
    - from: 2020-10-24
      store: boltdb-shipper
      object_store: filesystem
      schema: v11
      index:
        prefix: index_
        period: 24h

storage_config:
  boltdb_shipper:
    active_index_directory: /loki/boltdb-shipper-active
    cache_location: /loki/boltdb-shipper-cache
    cache_ttl: 24h
    shared_store: filesystem
  filesystem:
    directory: /loki/chunks

compactor:
  working_directory: /loki/boltdb-shipper-compactor
  shared_store: filesystem

limits_config:
  reject_old_samples: true
  reject_old_samples_max_age: ${config.monitoring.loki.retention}

chunk_store_config:
  max_look_back_period: 0s

table_manager:
  retention_deletes_enabled: false
  retention_period: 0s

ruler:
  storage:
    type: local
    local:
      directory: /loki/rules
  rule_path: /loki/rules-temp
  alertmanager_url: http://alertmanager:${config.monitoring.alertmanager.port}
  ring:
    kvstore:
      store: inmemory
  enable_api: true
`;

  return lokiConfig.trim();
}

// 生成Promtail配置
function generatePromtailConfig() {
  const promtailConfig = `
# Promtail配置文件
server:
  http_listen_port: ${config.monitoring.promtail.port}
  grpc_listen_port: 0

positions:
  filename: /tmp/positions.yaml

clients:
  - url: http://loki:${config.monitoring.loki.port}/loki/api/v1/push

scrape_configs:
  # 应用日志
  - job_name: application
    static_configs:
      - targets:
          - localhost
        labels:
          job: ${config.application.name}
          environment: ${config.application.environment}
          __path__: /var/log/app/*.log

  # Nginx访问日志
  - job_name: nginx-access
    static_configs:
      - targets:
          - localhost
        labels:
          job: nginx-access
          environment: ${config.application.environment}
          __path__: /var/log/nginx/access.log
    pipeline_stages:
      - regex:
          expression: '^(?P<remote_addr>[\\w\\.]+) - (?P<remote_user>\\S+) \\[(?P<time_local>[\\w:/]+\\s[+\\-]\\d{4})\\] "(?P<method>\\S+) (?P<request>\\S+) (?P<protocol>\\S+)" (?P<status>\\d{3}) (?P<body_bytes_sent>\\d+) "(?P<http_referer>[^"]*)" "(?P<http_user_agent>[^"]*)"'
      - labels:
          method:
          status:
          remote_addr:

  # Nginx错误日志
  - job_name: nginx-error
    static_configs:
      - targets:
          - localhost
        labels:
          job: nginx-error
          environment: ${config.application.environment}
          __path__: /var/log/nginx/error.log

  # PostgreSQL日志
  - job_name: postgresql
    static_configs:
      - targets:
          - localhost
        labels:
          job: postgresql
          environment: ${config.application.environment}
          __path__: /var/log/postgresql/*.log

  # Redis日志
  - job_name: redis
    static_configs:
      - targets:
          - localhost
        labels:
          job: redis
          environment: ${config.application.environment}
          __path__: /var/log/redis/*.log

  # 系统日志
  - job_name: syslog
    static_configs:
      - targets:
          - localhost
        labels:
          job: syslog
          environment: ${config.application.environment}
          __path__: /var/log/syslog
`;

  return promtailConfig.trim();
}

// 生成Docker Compose监控配置
function generateMonitoringCompose() {
  const composeConfig = `
# Docker Compose监控服务配置
version: '3.8'

services:
  # Prometheus
  prometheus:
    image: prom/prometheus:latest
    container_name: prometheus
    ports:
      - "${config.monitoring.prometheus.port}:9090"
    volumes:
      - ./monitoring/prometheus/prometheus.yml:/etc/prometheus/prometheus.yml
      - ./monitoring/prometheus/alert_rules.yml:/etc/prometheus/alert_rules.yml
      - prometheus_data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--web.console.libraries=/etc/prometheus/console_libraries'
      - '--web.console.templates=/etc/prometheus/consoles'
      - '--storage.tsdb.retention.time=${config.monitoring.prometheus.retention}'
      - '--web.enable-lifecycle'
    networks:
      - monitoring
    restart: unless-stopped

  # Grafana
  grafana:
    image: grafana/grafana:latest
    container_name: grafana
    ports:
      - "${config.monitoring.grafana.port}:3000"
    volumes:
      - grafana_data:/var/lib/grafana
      - ./monitoring/grafana/datasources:/etc/grafana/provisioning/datasources
      - ./monitoring/grafana/dashboards:/etc/grafana/provisioning/dashboards
    environment:
      - GF_SECURITY_ADMIN_USER=${config.monitoring.grafana.adminUser}
      - GF_SECURITY_ADMIN_PASSWORD=${config.monitoring.grafana.adminPassword}
      - GF_USERS_ALLOW_SIGN_UP=false
    networks:
      - monitoring
    restart: unless-stopped

  # Alertmanager
  alertmanager:
    image: prom/alertmanager:latest
    container_name: alertmanager
    ports:
      - "${config.monitoring.alertmanager.port}:9093"
    volumes:
      - ./monitoring/alertmanager/alertmanager.yml:/etc/alertmanager/alertmanager.yml
      - alertmanager_data:/alertmanager
    command:
      - '--config.file=/etc/alertmanager/alertmanager.yml'
      - '--storage.path=/alertmanager'
    networks:
      - monitoring
    restart: unless-stopped

  # Loki
  loki:
    image: grafana/loki:latest
    container_name: loki
    ports:
      - "${config.monitoring.loki.port}:3100"
    volumes:
      - ./monitoring/loki/loki.yml:/etc/loki/local-config.yaml
      - loki_data:/loki
    command: -config.file=/etc/loki/local-config.yaml
    networks:
      - monitoring
    restart: unless-stopped

  # Promtail
  promtail:
    image: grafana/promtail:latest
    container_name: promtail
    ports:
      - "${config.monitoring.promtail.port}:9080"
    volumes:
      - ./monitoring/promtail/promtail.yml:/etc/promtail/config.yml
      - /var/log:/var/log:ro
      - ./logs:/var/log/app:ro
    command: -config.file=/etc/promtail/config.yml
    networks:
      - monitoring
    restart: unless-stopped

  # Node Exporter
  node-exporter:
    image: prom/node-exporter:latest
    container_name: node-exporter
    ports:
      - "9100:9100"
    volumes:
      - /proc:/host/proc:ro
      - /sys:/host/sys:ro
      - /:/rootfs:ro
    command:
      - '--path.procfs=/host/proc'
      - '--path.rootfs=/rootfs'
      - '--path.sysfs=/host/sys'
      - '--collector.filesystem.mount-points-exclude=^/(sys|proc|dev|host|etc)($$|/)'
    networks:
      - monitoring
    restart: unless-stopped

  # cAdvisor
  cadvisor:
    image: gcr.io/cadvisor/cadvisor:latest
    container_name: cadvisor
    ports:
      - "8080:8080"
    volumes:
      - /:/rootfs:ro
      - /var/run:/var/run:ro
      - /sys:/sys:ro
      - /var/lib/docker/:/var/lib/docker:ro
      - /dev/disk/:/dev/disk:ro
    privileged: true
    devices:
      - /dev/kmsg
    networks:
      - monitoring
    restart: unless-stopped

  # PostgreSQL Exporter
  postgres-exporter:
    image: prometheuscommunity/postgres-exporter:latest
    container_name: postgres-exporter
    ports:
      - "9187:9187"
    environment:
      - DATA_SOURCE_NAME=postgresql://${process.env.DB_USERNAME || 'postgres'}:${process.env.DB_PASSWORD || 'password'}@postgres:5432/${process.env.DB_NAME || 'blog_system'}?sslmode=disable
    networks:
      - monitoring
      - app-network
    restart: unless-stopped

  # Redis Exporter
  redis-exporter:
    image: oliver006/redis_exporter:latest
    container_name: redis-exporter
    ports:
      - "9121:9121"
    environment:
      - REDIS_ADDR=redis://redis:6379
    networks:
      - monitoring
      - app-network
    restart: unless-stopped

volumes:
  prometheus_data:
  grafana_data:
  alertmanager_data:
  loki_data:

networks:
  monitoring:
    driver: bridge
  app-network:
    external: true
`;

  return composeConfig.trim();
}

// 创建监控配置文件
function createMonitoringConfigs() {
  logInfo('创建监控配置文件...');
  
  // 创建目录结构
  const monitoringDir = path.join(process.cwd(), 'monitoring');
  ensureDirectory(monitoringDir);
  
  const dirs = [
    'prometheus',
    'grafana/datasources',
    'grafana/dashboards',
    'alertmanager',
    'loki',
    'promtail'
  ];
  
  dirs.forEach(dir => {
    ensureDirectory(path.join(monitoringDir, dir));
  });
  
  // 生成配置文件
  const configs = [
    {
      path: path.join(monitoringDir, 'prometheus', 'prometheus.yml'),
      content: generatePrometheusConfig()
    },
    {
      path: path.join(monitoringDir, 'prometheus', 'alert_rules.yml'),
      content: generateAlertRules()
    },
    {
      path: path.join(monitoringDir, 'alertmanager', 'alertmanager.yml'),
      content: generateAlertmanagerConfig()
    },
    {
      path: path.join(monitoringDir, 'grafana', 'datasources', 'datasources.yml'),
      content: generateGrafanaDatasources()
    },
    {
      path: path.join(monitoringDir, 'loki', 'loki.yml'),
      content: generateLokiConfig()
    },
    {
      path: path.join(monitoringDir, 'promtail', 'promtail.yml'),
      content: generatePromtailConfig()
    },
    {
      path: path.join(process.cwd(), 'docker-compose.monitoring.yml'),
      content: generateMonitoringCompose()
    }
  ];
  
  configs.forEach(({ path: filePath, content }) => {
    fs.writeFileSync(filePath, content);
    logSuccess(`创建配置文件: ${filePath}`);
  });
}

// 创建Grafana仪表板
function createGrafanaDashboards() {
  logInfo('创建Grafana仪表板...');
  
  const dashboardsDir = path.join(process.cwd(), 'monitoring', 'grafana', 'dashboards');
  
  // 应用监控仪表板
  const appDashboard = {
    dashboard: {
      id: null,
      title: `${config.application.name} - 应用监控`,
      tags: ['application', 'monitoring'],
      timezone: 'browser',
      panels: [
        {
          id: 1,
          title: '请求率',
          type: 'graph',
          targets: [
            {
              expr: `rate(http_requests_total{job="${config.application.name}"}[5m])`,
              legendFormat: '{{method}} {{status}}'
            }
          ]
        },
        {
          id: 2,
          title: '响应时间',
          type: 'graph',
          targets: [
            {
              expr: `histogram_quantile(0.95, rate(http_request_duration_seconds_bucket{job="${config.application.name}"}[5m]))`,
              legendFormat: '95th percentile'
            }
          ]
        },
        {
          id: 3,
          title: '错误率',
          type: 'graph',
          targets: [
            {
              expr: `rate(http_requests_total{job="${config.application.name}",status=~"5.."}[5m]) / rate(http_requests_total{job="${config.application.name}"}[5m])`,
              legendFormat: 'Error Rate'
            }
          ]
        }
      ],
      time: {
        from: 'now-1h',
        to: 'now'
      },
      refresh: '5s'
    }
  };
  
  // 系统监控仪表板
  const systemDashboard = {
    dashboard: {
      id: null,
      title: '系统监控',
      tags: ['system', 'monitoring'],
      timezone: 'browser',
      panels: [
        {
          id: 1,
          title: 'CPU使用率',
          type: 'graph',
          targets: [
            {
              expr: '100 - (avg by(instance) (irate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)',
              legendFormat: '{{instance}}'
            }
          ]
        },
        {
          id: 2,
          title: '内存使用率',
          type: 'graph',
          targets: [
            {
              expr: '(1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) * 100',
              legendFormat: '{{instance}}'
            }
          ]
        },
        {
          id: 3,
          title: '磁盘使用率',
          type: 'graph',
          targets: [
            {
              expr: '(1 - (node_filesystem_avail_bytes{fstype!="tmpfs"} / node_filesystem_size_bytes{fstype!="tmpfs"})) * 100',
              legendFormat: '{{instance}} {{mountpoint}}'
            }
          ]
        }
      ],
      time: {
        from: 'now-1h',
        to: 'now'
      },
      refresh: '5s'
    }
  };
  
  // 保存仪表板
  fs.writeFileSync(
    path.join(dashboardsDir, 'application-dashboard.json'),
    JSON.stringify(appDashboard, null, 2)
  );
  
  fs.writeFileSync(
    path.join(dashboardsDir, 'system-dashboard.json'),
    JSON.stringify(systemDashboard, null, 2)
  );
  
  logSuccess('Grafana仪表板创建完成');
}

// 创建监控启动脚本
function createMonitoringScripts() {
  logInfo('创建监控启动脚本...');
  
  const scriptsDir = path.join(process.cwd(), 'scripts');
  
  // 启动监控服务脚本
  const startMonitoringScript = `
#!/bin/bash

# 启动监控服务脚本

echo "启动监控服务..."

# 检查Docker是否运行
if ! docker info > /dev/null 2>&1; then
    echo "错误: Docker未运行"
    exit 1
fi

# 创建网络（如果不存在）
docker network create app-network 2>/dev/null || true

# 启动监控服务
docker-compose -f docker-compose.monitoring.yml up -d

echo "等待服务启动..."
sleep 30

# 检查服务状态
echo "检查服务状态:"
docker-compose -f docker-compose.monitoring.yml ps

echo ""
echo "监控服务访问地址:"
echo "Grafana: http://localhost:${config.monitoring.grafana.port}"
echo "Prometheus: http://localhost:${config.monitoring.prometheus.port}"
echo "Alertmanager: http://localhost:${config.monitoring.alertmanager.port}"
echo ""
echo "Grafana默认登录信息:"
echo "用户名: ${config.monitoring.grafana.adminUser}"
echo "密码: ${config.monitoring.grafana.adminPassword}"
`;
  
  // 停止监控服务脚本
  const stopMonitoringScript = `
#!/bin/bash

# 停止监控服务脚本

echo "停止监控服务..."

docker-compose -f docker-compose.monitoring.yml down

echo "监控服务已停止"
`;
  
  // Windows版本的启动脚本
  const startMonitoringPs1 = `
# 启动监控服务脚本 (PowerShell)

Write-Host "启动监控服务..." -ForegroundColor Green

# 检查Docker是否运行
try {
    docker info | Out-Null
}
catch {
    Write-Error "Docker未运行"
    exit 1
}

# 创建网络（如果不存在）
docker network create app-network 2>$null

# 启动监控服务
docker-compose -f docker-compose.monitoring.yml up -d

Write-Host "等待服务启动..." -ForegroundColor Yellow
Start-Sleep -Seconds 30

# 检查服务状态
Write-Host "检查服务状态:" -ForegroundColor Green
docker-compose -f docker-compose.monitoring.yml ps

Write-Host ""
Write-Host "监控服务访问地址:" -ForegroundColor Green
Write-Host "Grafana: http://localhost:${config.monitoring.grafana.port}" -ForegroundColor Cyan
Write-Host "Prometheus: http://localhost:${config.monitoring.prometheus.port}" -ForegroundColor Cyan
Write-Host "Alertmanager: http://localhost:${config.monitoring.alertmanager.port}" -ForegroundColor Cyan
Write-Host ""
Write-Host "Grafana默认登录信息:" -ForegroundColor Yellow
Write-Host "用户名: ${config.monitoring.grafana.adminUser}" -ForegroundColor White
Write-Host "密码: ${config.monitoring.grafana.adminPassword}" -ForegroundColor White
`;
  
  // 保存脚本
  fs.writeFileSync(path.join(scriptsDir, 'start-monitoring.sh'), startMonitoringScript.trim());
  fs.writeFileSync(path.join(scriptsDir, 'stop-monitoring.sh'), stopMonitoringScript.trim());
  fs.writeFileSync(path.join(scriptsDir, 'start-monitoring.ps1'), startMonitoringPs1.trim());
  
  logSuccess('监控脚本创建完成');
}

// 主函数
function main() {
  logInfo('开始设置监控配置...');
  
  try {
    // 创建监控配置文件
    createMonitoringConfigs();
    
    // 创建Grafana仪表板
    createGrafanaDashboards();
    
    // 创建监控脚本
    createMonitoringScripts();
    
    logSuccess('监控配置设置完成!');
    
    console.log('\n=== 监控配置信息 ===');
    console.log(`Prometheus端口: ${config.monitoring.prometheus.port}`);
    console.log(`Grafana端口: ${config.monitoring.grafana.port}`);
    console.log(`Alertmanager端口: ${config.monitoring.alertmanager.port}`);
    console.log(`Loki端口: ${config.monitoring.loki.port}`);
    console.log('\n启动监控服务:');
    console.log('  Linux/Mac: ./scripts/start-monitoring.sh');
    console.log('  Windows: .\\scripts\\start-monitoring.ps1');
    console.log('\n或者直接使用:');
    console.log('  docker-compose -f docker-compose.monitoring.yml up -d');
    
  } catch (error) {
    logError('监控配置设置失败', { error: error.message });
    process.exit(1);
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  main();
}

module.exports = {
  createMonitoringConfigs,
  createGrafanaDashboards,
  createMonitoringScripts
};