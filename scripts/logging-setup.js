#!/usr/bin/env node

/**
 * 日志收集配置脚本
 * 用于设置应用日志收集、分析和存储
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 配置
const config = {
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.LOG_FORMAT || 'json',
    maxFiles: process.env.LOG_MAX_FILES || 10,
    maxSize: process.env.LOG_MAX_SIZE || '100m',
    retention: process.env.LOG_RETENTION || '30d'
  },
  elasticsearch: {
    host: process.env.ELASTICSEARCH_HOST || 'localhost',
    port: process.env.ELASTICSEARCH_PORT || 9200,
    username: process.env.ELASTICSEARCH_USERNAME,
    password: process.env.ELASTICSEARCH_PASSWORD,
    indexPrefix: process.env.ELASTICSEARCH_INDEX_PREFIX || 'blog-system'
  },
  kibana: {
    port: process.env.KIBANA_PORT || 5601
  },
  filebeat: {
    port: process.env.FILEBEAT_PORT || 5044
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

// 生成Winston日志配置
function generateWinstonConfig() {
  const winstonConfig = `
// Winston日志配置
const winston = require('winston');
const path = require('path');

// 自定义日志格式
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.prettyPrint()
);

// 开发环境格式
const devFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    return \`\${timestamp} [\${level}]: \${message} \${Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''}\`;
  })
);

// 创建日志器
const logger = winston.createLogger({
  level: '${config.logging.level}',
  format: process.env.NODE_ENV === 'production' ? logFormat : devFormat,
  defaultMeta: {
    service: '${config.application.name}',
    environment: '${config.application.environment}',
    version: '${config.application.version}'
  },
  transports: [
    // 控制台输出
    new winston.transports.Console({
      level: process.env.NODE_ENV === 'production' ? 'warn' : 'debug'
    }),
    
    // 错误日志文件
    new winston.transports.File({
      filename: path.join(process.cwd(), 'logs', 'error.log'),
      level: 'error',
      maxsize: ${parseInt(config.logging.maxSize.replace('m', '')) * 1024 * 1024},
      maxFiles: ${config.logging.maxFiles},
      tailable: true
    }),
    
    // 组合日志文件
    new winston.transports.File({
      filename: path.join(process.cwd(), 'logs', 'combined.log'),
      maxsize: ${parseInt(config.logging.maxSize.replace('m', '')) * 1024 * 1024},
      maxFiles: ${config.logging.maxFiles},
      tailable: true
    }),
    
    // 访问日志文件
    new winston.transports.File({
      filename: path.join(process.cwd(), 'logs', 'access.log'),
      level: 'info',
      maxsize: ${parseInt(config.logging.maxSize.replace('m', '')) * 1024 * 1024},
      maxFiles: ${config.logging.maxFiles},
      tailable: true
    })
  ],
  
  // 异常处理
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(process.cwd(), 'logs', 'exceptions.log')
    })
  ],
  
  // 拒绝处理
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(process.cwd(), 'logs', 'rejections.log')
    })
  ]
});

// 生产环境添加Elasticsearch传输
if (process.env.NODE_ENV === 'production' && process.env.ELASTICSEARCH_HOST) {
  const { ElasticsearchTransport } = require('winston-elasticsearch');
  
  const esTransportOpts = {
    level: 'info',
    clientOpts: {
      node: \`http://\${process.env.ELASTICSEARCH_HOST}:\${process.env.ELASTICSEARCH_PORT || 9200}\`,
      auth: process.env.ELASTICSEARCH_USERNAME ? {
        username: process.env.ELASTICSEARCH_USERNAME,
        password: process.env.ELASTICSEARCH_PASSWORD
      } : undefined
    },
    index: \`\${process.env.ELASTICSEARCH_INDEX_PREFIX || '${config.elasticsearch.indexPrefix}'}-\${new Date().toISOString().slice(0, 7)}\`,
    transformer: (logData) => {
      return {
        '@timestamp': new Date().toISOString(),
        severity: logData.level,
        message: logData.message,
        fields: logData.meta,
        service: '${config.application.name}',
        environment: '${config.application.environment}'
      };
    }
  };
  
  logger.add(new ElasticsearchTransport(esTransportOpts));
}

// 请求日志中间件
function requestLogger(req, res, next) {
  const start = Date.now();
  
  // 记录请求开始
  logger.info('Request started', {
    method: req.method,
    url: req.url,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    requestId: req.id
  });
  
  // 监听响应结束
  res.on('finish', () => {
    const duration = Date.now() - start;
    
    logger.info('Request completed', {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: \`\${duration}ms\`,
      contentLength: res.get('Content-Length'),
      requestId: req.id
    });
  });
  
  next();
}

// 错误日志中间件
function errorLogger(err, req, res, next) {
  logger.error('Request error', {
    error: {
      message: err.message,
      stack: err.stack,
      name: err.name
    },
    request: {
      method: req.method,
      url: req.url,
      headers: req.headers,
      body: req.body,
      params: req.params,
      query: req.query,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      requestId: req.id
    }
  });
  
  next(err);
}

// 数据库查询日志
function dbQueryLogger(query, duration, error = null) {
  if (error) {
    logger.error('Database query error', {
      query,
      duration: \`\${duration}ms\`,
      error: {
        message: error.message,
        stack: error.stack
      }
    });
  } else {
    logger.debug('Database query executed', {
      query,
      duration: \`\${duration}ms\`
    });
  }
}

// 性能监控日志
function performanceLogger(operation, duration, metadata = {}) {
  const level = duration > 1000 ? 'warn' : 'info';
  
  logger.log(level, 'Performance metric', {
    operation,
    duration: \`\${duration}ms\`,
    ...metadata
  });
}

// 安全事件日志
function securityLogger(event, details = {}) {
  logger.warn('Security event', {
    event,
    timestamp: new Date().toISOString(),
    ...details
  });
}

// 业务事件日志
function businessLogger(event, details = {}) {
  logger.info('Business event', {
    event,
    timestamp: new Date().toISOString(),
    ...details
  });
}

module.exports = {
  logger,
  requestLogger,
  errorLogger,
  dbQueryLogger,
  performanceLogger,
  securityLogger,
  businessLogger
};
`;

  return winstonConfig.trim();
}

// 生成Filebeat配置
function generateFilebeatConfig() {
  const filebeatConfig = `
# Filebeat配置文件
filebeat.inputs:
  # 应用日志
  - type: log
    enabled: true
    paths:
      - /var/log/app/*.log
    fields:
      service: ${config.application.name}
      environment: ${config.application.environment}
      log_type: application
    fields_under_root: true
    multiline.pattern: '^\\d{4}-\\d{2}-\\d{2}'
    multiline.negate: true
    multiline.match: after
    
  # Nginx访问日志
  - type: log
    enabled: true
    paths:
      - /var/log/nginx/access.log
    fields:
      service: nginx
      environment: ${config.application.environment}
      log_type: access
    fields_under_root: true
    
  # Nginx错误日志
  - type: log
    enabled: true
    paths:
      - /var/log/nginx/error.log
    fields:
      service: nginx
      environment: ${config.application.environment}
      log_type: error
    fields_under_root: true
    
  # PostgreSQL日志
  - type: log
    enabled: true
    paths:
      - /var/log/postgresql/*.log
    fields:
      service: postgresql
      environment: ${config.application.environment}
      log_type: database
    fields_under_root: true
    
  # Redis日志
  - type: log
    enabled: true
    paths:
      - /var/log/redis/*.log
    fields:
      service: redis
      environment: ${config.application.environment}
      log_type: cache
    fields_under_root: true
    
  # 系统日志
  - type: log
    enabled: true
    paths:
      - /var/log/syslog
      - /var/log/messages
    fields:
      service: system
      environment: ${config.application.environment}
      log_type: system
    fields_under_root: true

# 处理器
processors:
  - add_host_metadata:
      when.not.contains.tags: forwarded
  - add_docker_metadata: ~
  - add_kubernetes_metadata: ~
  - timestamp:
      field: '@timestamp'
      layouts:
        - '2006-01-02T15:04:05.000Z'
        - '2006-01-02 15:04:05'
      test:
        - '2023-05-15T14:30:45.123Z'
        - '2023-05-15 14:30:45'

# 输出配置
output.elasticsearch:
  hosts: ["${config.elasticsearch.host}:${config.elasticsearch.port}"]
  index: "${config.elasticsearch.indexPrefix}-%{+yyyy.MM.dd}"
  template.name: "${config.elasticsearch.indexPrefix}"
  template.pattern: "${config.elasticsearch.indexPrefix}-*"
  template.settings:
    index.number_of_shards: 1
    index.number_of_replicas: 0
    index.refresh_interval: 5s
  ${config.elasticsearch.username ? `username: "${config.elasticsearch.username}"` : ''}
  ${config.elasticsearch.password ? `password: "${config.elasticsearch.password}"` : ''}

# 日志配置
logging.level: info
logging.to_files: true
logging.files:
  path: /var/log/filebeat
  name: filebeat
  keepfiles: 7
  permissions: 0644

# 监控
monitoring.enabled: true
monitoring.elasticsearch:
  hosts: ["${config.elasticsearch.host}:${config.elasticsearch.port}"]
  ${config.elasticsearch.username ? `username: "${config.elasticsearch.username}"` : ''}
  ${config.elasticsearch.password ? `password: "${config.elasticsearch.password}"` : ''}

# 设置
setup.template.enabled: true
setup.template.settings:
  index.number_of_shards: 1
  index.number_of_replicas: 0
  index.refresh_interval: 5s

setup.ilm.enabled: true
setup.ilm.rollover_alias: "${config.elasticsearch.indexPrefix}"
setup.ilm.pattern: "{now/d}-000001"
setup.ilm.policy: "${config.elasticsearch.indexPrefix}-policy"
`;

  return filebeatConfig.trim();
}

// 生成Elasticsearch索引模板
function generateElasticsearchTemplate() {
  const template = {
    index_patterns: [`${config.elasticsearch.indexPrefix}-*`],
    settings: {
      number_of_shards: 1,
      number_of_replicas: 0,
      refresh_interval: '5s',
      'index.lifecycle.name': `${config.elasticsearch.indexPrefix}-policy`,
      'index.lifecycle.rollover_alias': config.elasticsearch.indexPrefix
    },
    mappings: {
      properties: {
        '@timestamp': {
          type: 'date'
        },
        level: {
          type: 'keyword'
        },
        message: {
          type: 'text',
          analyzer: 'standard'
        },
        service: {
          type: 'keyword'
        },
        environment: {
          type: 'keyword'
        },
        log_type: {
          type: 'keyword'
        },
        host: {
          properties: {
            name: {
              type: 'keyword'
            },
            ip: {
              type: 'ip'
            }
          }
        },
        request: {
          properties: {
            method: {
              type: 'keyword'
            },
            url: {
              type: 'keyword'
            },
            status_code: {
              type: 'integer'
            },
            duration: {
              type: 'float'
            },
            user_agent: {
              type: 'text'
            },
            ip: {
              type: 'ip'
            }
          }
        },
        error: {
          properties: {
            message: {
              type: 'text'
            },
            stack: {
              type: 'text'
            },
            name: {
              type: 'keyword'
            }
          }
        },
        database: {
          properties: {
            query: {
              type: 'text'
            },
            duration: {
              type: 'float'
            },
            rows_affected: {
              type: 'integer'
            }
          }
        }
      }
    }
  };

  return JSON.stringify(template, null, 2);
}

// 生成Elasticsearch ILM策略
function generateILMPolicy() {
  const policy = {
    policy: {
      phases: {
        hot: {
          actions: {
            rollover: {
              max_size: '50gb',
              max_age: '1d'
            },
            set_priority: {
              priority: 100
            }
          }
        },
        warm: {
          min_age: '1d',
          actions: {
            set_priority: {
              priority: 50
            },
            allocate: {
              number_of_replicas: 0
            }
          }
        },
        cold: {
          min_age: '7d',
          actions: {
            set_priority: {
              priority: 0
            },
            allocate: {
              number_of_replicas: 0
            }
          }
        },
        delete: {
          min_age: config.logging.retention
        }
      }
    }
  };

  return JSON.stringify(policy, null, 2);
}

// 生成Kibana仪表板配置
function generateKibanaDashboard() {
  const dashboard = {
    version: '8.0.0',
    objects: [
      {
        id: 'application-logs-dashboard',
        type: 'dashboard',
        attributes: {
          title: `${config.application.name} - 应用日志仪表板`,
          hits: 0,
          description: '应用日志监控和分析仪表板',
          panelsJSON: JSON.stringify([
            {
              gridData: {
                x: 0,
                y: 0,
                w: 24,
                h: 15
              },
              panelIndex: '1',
              embeddableConfig: {},
              panelRefName: 'panel_1'
            },
            {
              gridData: {
                x: 24,
                y: 0,
                w: 24,
                h: 15
              },
              panelIndex: '2',
              embeddableConfig: {},
              panelRefName: 'panel_2'
            }
          ]),
          timeRestore: false,
          timeTo: 'now',
          timeFrom: 'now-24h',
          refreshInterval: {
            pause: false,
            value: 30000
          },
          kibanaSavedObjectMeta: {
            searchSourceJSON: JSON.stringify({
              query: {
                match_all: {}
              },
              filter: []
            })
          }
        }
      }
    ]
  };

  return JSON.stringify(dashboard, null, 2);
}

// 生成Docker Compose日志配置
function generateLoggingCompose() {
  const composeConfig = `
# Docker Compose日志服务配置
version: '3.8'

services:
  # Elasticsearch
  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:8.8.0
    container_name: elasticsearch
    environment:
      - discovery.type=single-node
      - "ES_JAVA_OPTS=-Xms512m -Xmx512m"
      - xpack.security.enabled=false
      - xpack.security.enrollment.enabled=false
    ports:
      - "${config.elasticsearch.port}:9200"
    volumes:
      - elasticsearch_data:/usr/share/elasticsearch/data
      - ./logging/elasticsearch/elasticsearch.yml:/usr/share/elasticsearch/config/elasticsearch.yml
    networks:
      - logging
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "curl -f http://localhost:9200/_cluster/health || exit 1"]
      interval: 30s
      timeout: 10s
      retries: 5

  # Kibana
  kibana:
    image: docker.elastic.co/kibana/kibana:8.8.0
    container_name: kibana
    environment:
      - ELASTICSEARCH_HOSTS=http://elasticsearch:9200
      - xpack.security.enabled=false
      - xpack.encryptedSavedObjects.encryptionKey=a7a6311933d3503b89bc2dbc36572c33a6c10925682e591bffcab6911c06786d
    ports:
      - "${config.kibana.port}:5601"
    volumes:
      - ./logging/kibana/kibana.yml:/usr/share/kibana/config/kibana.yml
    networks:
      - logging
    depends_on:
      elasticsearch:
        condition: service_healthy
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "curl -f http://localhost:5601/api/status || exit 1"]
      interval: 30s
      timeout: 10s
      retries: 5

  # Filebeat
  filebeat:
    image: docker.elastic.co/beats/filebeat:8.8.0
    container_name: filebeat
    user: root
    volumes:
      - ./logging/filebeat/filebeat.yml:/usr/share/filebeat/filebeat.yml:ro
      - /var/lib/docker/containers:/var/lib/docker/containers:ro
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - ./logs:/var/log/app:ro
      - /var/log:/var/log/host:ro
    environment:
      - ELASTICSEARCH_HOST=${config.elasticsearch.host}
      - ELASTICSEARCH_PORT=${config.elasticsearch.port}
      - KIBANA_HOST=kibana
      - KIBANA_PORT=${config.kibana.port}
    networks:
      - logging
      - app-network
    depends_on:
      elasticsearch:
        condition: service_healthy
    restart: unless-stopped

  # Logstash (可选)
  logstash:
    image: docker.elastic.co/logstash/logstash:8.8.0
    container_name: logstash
    ports:
      - "${config.filebeat.port}:5044"
      - "9600:9600"
    volumes:
      - ./logging/logstash/logstash.yml:/usr/share/logstash/config/logstash.yml
      - ./logging/logstash/pipeline:/usr/share/logstash/pipeline
    environment:
      - "LS_JAVA_OPTS=-Xmx256m -Xms256m"
    networks:
      - logging
    depends_on:
      elasticsearch:
        condition: service_healthy
    restart: unless-stopped

volumes:
  elasticsearch_data:

networks:
  logging:
    driver: bridge
  app-network:
    external: true
`;

  return composeConfig.trim();
}

// 生成日志轮转配置
function generateLogrotateConfig() {
  const logrotateConfig = `
# 日志轮转配置
/var/log/app/*.log {
    daily
    missingok
    rotate ${config.logging.maxFiles}
    compress
    delaycompress
    notifempty
    create 0644 app app
    postrotate
        /bin/kill -USR1 \`cat /var/run/app.pid 2> /dev/null\` 2> /dev/null || true
    endscript
}

/var/log/nginx/*.log {
    daily
    missingok
    rotate 52
    compress
    delaycompress
    notifempty
    create 0644 nginx nginx
    postrotate
        /bin/kill -USR1 \`cat /var/run/nginx.pid 2> /dev/null\` 2> /dev/null || true
    endscript
}

/var/log/postgresql/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 0644 postgres postgres
    postrotate
        /usr/bin/pg_ctl reload -D /var/lib/postgresql/data
    endscript
}
`;

  return logrotateConfig.trim();
}

// 创建日志配置文件
function createLoggingConfigs() {
  logInfo('创建日志配置文件...');
  
  // 创建目录结构
  const loggingDir = path.join(process.cwd(), 'logging');
  const logsDir = path.join(process.cwd(), 'logs');
  
  ensureDirectory(loggingDir);
  ensureDirectory(logsDir);
  
  const dirs = [
    'elasticsearch',
    'kibana',
    'filebeat',
    'logstash/pipeline'
  ];
  
  dirs.forEach(dir => {
    ensureDirectory(path.join(loggingDir, dir));
  });
  
  // 生成配置文件
  const configs = [
    {
      path: path.join(process.cwd(), 'config', 'winston.js'),
      content: generateWinstonConfig()
    },
    {
      path: path.join(loggingDir, 'filebeat', 'filebeat.yml'),
      content: generateFilebeatConfig()
    },
    {
      path: path.join(loggingDir, 'elasticsearch', 'index-template.json'),
      content: generateElasticsearchTemplate()
    },
    {
      path: path.join(loggingDir, 'elasticsearch', 'ilm-policy.json'),
      content: generateILMPolicy()
    },
    {
      path: path.join(loggingDir, 'kibana', 'dashboard.json'),
      content: generateKibanaDashboard()
    },
    {
      path: path.join(process.cwd(), 'docker-compose.logging.yml'),
      content: generateLoggingCompose()
    },
    {
      path: path.join(loggingDir, 'logrotate.conf'),
      content: generateLogrotateConfig()
    }
  ];
  
  configs.forEach(({ path: filePath, content }) => {
    ensureDirectory(path.dirname(filePath));
    fs.writeFileSync(filePath, content);
    logSuccess(`创建配置文件: ${filePath}`);
  });
}

// 创建日志管理脚本
function createLoggingScripts() {
  logInfo('创建日志管理脚本...');
  
  const scriptsDir = path.join(process.cwd(), 'scripts');
  
  // 启动日志服务脚本
  const startLoggingScript = `
#!/bin/bash

# 启动日志服务脚本

echo "启动日志收集服务..."

# 检查Docker是否运行
if ! docker info > /dev/null 2>&1; then
    echo "错误: Docker未运行"
    exit 1
fi

# 创建网络（如果不存在）
docker network create app-network 2>/dev/null || true

# 启动日志服务
docker-compose -f docker-compose.logging.yml up -d

echo "等待服务启动..."
sleep 60

# 检查服务状态
echo "检查服务状态:"
docker-compose -f docker-compose.logging.yml ps

# 设置Elasticsearch索引模板和ILM策略
echo "设置Elasticsearch配置..."
sleep 30

# 创建索引模板
curl -X PUT "localhost:${config.elasticsearch.port}/_index_template/${config.elasticsearch.indexPrefix}-template" \
  -H "Content-Type: application/json" \
  -d @logging/elasticsearch/index-template.json

# 创建ILM策略
curl -X PUT "localhost:${config.elasticsearch.port}/_ilm/policy/${config.elasticsearch.indexPrefix}-policy" \
  -H "Content-Type: application/json" \
  -d @logging/elasticsearch/ilm-policy.json

echo ""
echo "日志服务访问地址:"
echo "Kibana: http://localhost:${config.kibana.port}"
echo "Elasticsearch: http://localhost:${config.elasticsearch.port}"
echo ""
echo "日志服务启动完成!"
`;
  
  // 停止日志服务脚本
  const stopLoggingScript = `
#!/bin/bash

# 停止日志服务脚本

echo "停止日志收集服务..."

docker-compose -f docker-compose.logging.yml down

echo "日志服务已停止"
`;
  
  // 日志清理脚本
  const cleanLogsScript = `
#!/bin/bash

# 日志清理脚本

echo "清理旧日志文件..."

# 清理应用日志（保留最近7天）
find ./logs -name "*.log" -type f -mtime +7 -delete

# 清理压缩日志（保留最近30天）
find ./logs -name "*.log.gz" -type f -mtime +30 -delete

# 清理Elasticsearch旧索引
if command -v curl &> /dev/null; then
    echo "清理Elasticsearch旧索引..."
    
    # 获取30天前的日期
    OLD_DATE=$(date -d "30 days ago" +%Y.%m.%d)
    
    # 删除旧索引
    curl -X DELETE "localhost:${config.elasticsearch.port}/${config.elasticsearch.indexPrefix}-*" \
      --data-urlencode "q=@timestamp:<$OLD_DATE" 2>/dev/null || true
fi

echo "日志清理完成"
`;
  
  // Windows版本的脚本
  const startLoggingPs1 = `
# 启动日志服务脚本 (PowerShell)

Write-Host "启动日志收集服务..." -ForegroundColor Green

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

# 启动日志服务
docker-compose -f docker-compose.logging.yml up -d

Write-Host "等待服务启动..." -ForegroundColor Yellow
Start-Sleep -Seconds 60

# 检查服务状态
Write-Host "检查服务状态:" -ForegroundColor Green
docker-compose -f docker-compose.logging.yml ps

# 设置Elasticsearch配置
Write-Host "设置Elasticsearch配置..." -ForegroundColor Yellow
Start-Sleep -Seconds 30

# 创建索引模板
try {
    $template = Get-Content "logging/elasticsearch/index-template.json" -Raw
    Invoke-RestMethod -Uri "http://localhost:${config.elasticsearch.port}/_index_template/${config.elasticsearch.indexPrefix}-template" -Method Put -Body $template -ContentType "application/json"
}
catch {
    Write-Warning "无法创建索引模板: $($_.Exception.Message)"
}

# 创建ILM策略
try {
    $policy = Get-Content "logging/elasticsearch/ilm-policy.json" -Raw
    Invoke-RestMethod -Uri "http://localhost:${config.elasticsearch.port}/_ilm/policy/${config.elasticsearch.indexPrefix}-policy" -Method Put -Body $policy -ContentType "application/json"
}
catch {
    Write-Warning "无法创建ILM策略: $($_.Exception.Message)"
}

Write-Host ""
Write-Host "日志服务访问地址:" -ForegroundColor Green
Write-Host "Kibana: http://localhost:${config.kibana.port}" -ForegroundColor Cyan
Write-Host "Elasticsearch: http://localhost:${config.elasticsearch.port}" -ForegroundColor Cyan
Write-Host ""
Write-Host "日志服务启动完成!" -ForegroundColor Green
`;
  
  // 保存脚本
  fs.writeFileSync(path.join(scriptsDir, 'start-logging.sh'), startLoggingScript.trim());
  fs.writeFileSync(path.join(scriptsDir, 'stop-logging.sh'), stopLoggingScript.trim());
  fs.writeFileSync(path.join(scriptsDir, 'clean-logs.sh'), cleanLogsScript.trim());
  fs.writeFileSync(path.join(scriptsDir, 'start-logging.ps1'), startLoggingPs1.trim());
  
  logSuccess('日志管理脚本创建完成');
}

// 主函数
function main() {
  logInfo('开始设置日志收集配置...');
  
  try {
    // 创建日志配置文件
    createLoggingConfigs();
    
    // 创建日志管理脚本
    createLoggingScripts();
    
    logSuccess('日志收集配置设置完成!');
    
    console.log('\n=== 日志收集配置信息 ===');
    console.log(`Elasticsearch端口: ${config.elasticsearch.port}`);
    console.log(`Kibana端口: ${config.kibana.port}`);
    console.log(`Filebeat端口: ${config.filebeat.port}`);
    console.log(`日志级别: ${config.logging.level}`);
    console.log(`日志保留: ${config.logging.retention}`);
    console.log('\n启动日志服务:');
    console.log('  Linux/Mac: ./scripts/start-logging.sh');
    console.log('  Windows: .\\scripts\\start-logging.ps1');
    console.log('\n或者直接使用:');
    console.log('  docker-compose -f docker-compose.logging.yml up -d');
    console.log('\n日志清理:');
    console.log('  ./scripts/clean-logs.sh');
    
  } catch (error) {
    logError('日志收集配置设置失败', { error: error.message });
    process.exit(1);
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  main();
}

module.exports = {
  createLoggingConfigs,
  createLoggingScripts,
  generateWinstonConfig
};