// 生产环境配置
module.exports = {
  // 应用配置
  app: {
    name: process.env.APP_NAME || 'Blog System',
    version: process.env.APP_VERSION || '1.0.0',
    env: 'production',
    port: process.env.PORT || 3000,
    host: process.env.HOST || '0.0.0.0',
    url: process.env.APP_URL || 'https://yourdomain.com',
    domain: process.env.APP_DOMAIN || 'yourdomain.com',
    debug: false,
    logLevel: 'info',
    cluster: process.env.CLUSTER_MODE === 'true',
    workers: process.env.WORKER_PROCESSES || require('os').cpus().length
  },

  // 数据库配置
  database: {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 5432,
    name: process.env.DB_NAME,
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    dialect: 'postgres',
    logging: false,
    pool: {
      max: parseInt(process.env.DB_POOL_MAX) || 20,
      min: parseInt(process.env.DB_POOL_MIN) || 5,
      acquire: parseInt(process.env.DB_POOL_ACQUIRE) || 60000,
      idle: parseInt(process.env.DB_POOL_IDLE) || 10000
    },
    ssl: {
      require: process.env.DATABASE_SSL === 'true',
      rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false'
    },
    timezone: '+08:00',
    dialectOptions: {
      ssl: process.env.DATABASE_SSL === 'true' ? {
        require: true,
        rejectUnauthorized: false
      } : false
    }
  },

  // Redis配置
  redis: {
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD,
    db: process.env.REDIS_DB || 0,
    keyPrefix: 'blog:prod:',
    retryDelayOnFailover: 100,
    enableReadyCheck: true,
    maxRetriesPerRequest: 3,
    lazyConnect: true,
    connectTimeout: 10000,
    commandTimeout: 5000,
    family: 4
  },

  // JWT配置
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    issuer: process.env.JWT_ISSUER || 'blog-system',
    audience: process.env.JWT_AUDIENCE || 'blog-users',
    algorithm: 'HS256'
  },

  // 邮件配置
  email: {
    service: process.env.EMAIL_SERVICE || 'gmail',
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    },
    from: process.env.SMTP_FROM,
    templates: {
      welcome: 'welcome',
      resetPassword: 'reset-password',
      emailVerification: 'email-verification'
    },
    tls: {
      rejectUnauthorized: process.env.SMTP_TLS_REJECT_UNAUTHORIZED !== 'false'
    }
  },

  // 文件上传配置
  upload: {
    maxFileSize: parseInt(process.env.UPLOAD_MAX_SIZE) || 20 * 1024 * 1024, // 20MB
    allowedTypes: process.env.UPLOAD_ALLOWED_TYPES?.split(',') || [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp'
    ],
    destination: process.env.UPLOAD_PATH || '/app/uploads',
    publicPath: process.env.UPLOAD_PUBLIC_PATH || '/uploads',
    enableCompression: true,
    compressionQuality: 85,
    // 云存储配置
    cloudStorage: {
      enabled: process.env.CLOUD_STORAGE_ENABLED === 'true',
      provider: process.env.CLOUD_STORAGE_PROVIDER || 'aws',
      aws: {
        bucket: process.env.AWS_BUCKET,
        region: process.env.AWS_REGION,
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
      }
    }
  },

  // 缓存配置
  cache: {
    ttl: parseInt(process.env.CACHE_TTL) || 1800, // 30分钟
    checkPeriod: parseInt(process.env.CACHE_CHECK_PERIOD) || 3600, // 1小时
    maxKeys: parseInt(process.env.CACHE_MAX_KEYS) || 10000,
    useClones: false,
    redis: {
      enabled: process.env.CACHE_REDIS_ENABLED === 'true'
    }
  },

  // 限流配置
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW) * 60 * 1000 || 15 * 60 * 1000, // 15分钟
    max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: process.env.RATE_LIMIT_SKIP_SUCCESSFUL_REQUESTS === 'true',
    skipFailedRequests: process.env.RATE_LIMIT_SKIP_FAILED_REQUESTS === 'true'
  },

  // CORS配置
  cors: {
    origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : false,
    credentials: process.env.CORS_CREDENTIALS === 'true',
    optionsSuccessStatus: 200,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
  },

  // 安全配置
  security: {
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS) || 12,
    sessionSecret: process.env.SESSION_SECRET,
    csrfProtection: process.env.CSRF_PROTECTION === 'true',
    csrfSecret: process.env.CSRF_SECRET,
    helmet: {
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", 'https:'],
          scriptSrc: ["'self'", 'https:'],
          imgSrc: ["'self'", 'data:', 'https:'],
          connectSrc: ["'self'", 'https:'],
          fontSrc: ["'self'", 'https:'],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"]
        }
      },
      crossOriginEmbedderPolicy: false,
      hsts: {
        maxAge: parseInt(process.env.HSTS_MAX_AGE) || 31536000,
        includeSubDomains: true,
        preload: true
      }
    },
    httpsOnly: process.env.HTTPS_ONLY === 'true'
  },

  // 日志配置
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: 'json',
    colorize: false,
    timestamp: true,
    filename: process.env.LOG_FILE_PATH ? `${process.env.LOG_FILE_PATH}/production.log` : './logs/production.log',
    maxsize: process.env.LOG_MAX_SIZE || '50m',
    maxFiles: parseInt(process.env.LOG_MAX_FILES) || 10,
    datePattern: process.env.LOG_DATE_PATTERN || 'YYYY-MM-DD',
    zippedArchive: process.env.LOG_COMPRESS === 'true',
    handleExceptions: true,
    handleRejections: true
  },

  // 监控配置
  monitoring: {
    enabled: process.env.METRICS_ENABLED === 'true',
    metricsPath: process.env.METRICS_PATH || '/metrics',
    metricsPort: process.env.METRICS_PORT || 9090,
    healthCheckPath: process.env.HEALTH_CHECK_PATH || '/health',
    healthCheckTimeout: parseInt(process.env.HEALTH_CHECK_TIMEOUT) || 5000,
    collectDefaultMetrics: true,
    requestDurationBuckets: [0.1, 0.5, 1, 2, 5, 10],
    requestSizeBuckets: [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000],
    // APM配置
    apm: {
      enabled: process.env.APM_ENABLED === 'true',
      serviceName: process.env.APM_SERVICE_NAME || 'blog-system',
      serviceVersion: process.env.APM_SERVICE_VERSION || '1.0.0',
      environment: process.env.APM_ENVIRONMENT || 'production',
      newRelic: {
        licenseKey: process.env.NEW_RELIC_LICENSE_KEY
      },
      sentry: {
        dsn: process.env.SENTRY_DSN
      }
    }
  },

  // 第三方服务配置
  services: {
    // 图片处理服务
    imageProcessing: {
      enabled: true,
      provider: 'sharp',
      quality: 85,
      formats: ['webp', 'jpeg'],
      sizes: {
        thumbnail: { width: 150, height: 150 },
        small: { width: 300, height: 300 },
        medium: { width: 600, height: 600 },
        large: { width: 1200, height: 1200 }
      }
    },

    // 搜索服务
    search: {
      enabled: process.env.ELASTICSEARCH_URL ? true : false,
      provider: 'elasticsearch',
      host: process.env.ELASTICSEARCH_URL,
      index: process.env.ELASTICSEARCH_INDEX || 'blog_prod',
      auth: {
        username: process.env.ELASTICSEARCH_USERNAME,
        password: process.env.ELASTICSEARCH_PASSWORD
      }
    },

    // 消息队列
    queue: {
      enabled: process.env.QUEUE_REDIS_URL ? true : false,
      provider: 'bull',
      redis: process.env.QUEUE_REDIS_URL,
      concurrency: parseInt(process.env.QUEUE_CONCURRENCY) || 5,
      attempts: parseInt(process.env.QUEUE_MAX_ATTEMPTS) || 3,
      backoff: {
        type: 'exponential',
        delay: parseInt(process.env.QUEUE_BACKOFF_DELAY) || 5000
      }
    },

    // CDN配置
    cdn: {
      enabled: process.env.CDN_ENABLED === 'true',
      provider: process.env.CDN_PROVIDER || 'cloudflare',
      url: process.env.CDN_URL,
      cloudflare: {
        zoneId: process.env.CDN_ZONE_ID,
        apiToken: process.env.CDN_API_TOKEN
      }
    }
  },

  // 备份配置
  backup: {
    enabled: process.env.BACKUP_ENABLED === 'true',
    schedule: process.env.BACKUP_SCHEDULE || '0 2 * * *', // 每天凌晨2点
    retentionDays: parseInt(process.env.BACKUP_RETENTION_DAYS) || 30,
    s3: {
      bucket: process.env.BACKUP_S3_BUCKET,
      region: process.env.AWS_REGION
    },
    encryption: {
      enabled: process.env.BACKUP_ENCRYPTION_KEY ? true : false,
      key: process.env.BACKUP_ENCRYPTION_KEY
    }
  },

  // 性能配置
  performance: {
    compression: {
      enabled: process.env.COMPRESSION_ENABLED === 'true',
      level: parseInt(process.env.COMPRESSION_LEVEL) || 6,
      threshold: 1024
    },
    keepAlive: {
      timeout: parseInt(process.env.KEEP_ALIVE_TIMEOUT) || 65000
    },
    request: {
      timeout: parseInt(process.env.REQUEST_TIMEOUT) || 30000,
      bodyLimit: process.env.BODY_LIMIT || '10mb'
    }
  },

  // SSL/TLS配置
  ssl: {
    enabled: process.env.HTTPS_ONLY === 'true',
    cert: process.env.SSL_CERT_PATH,
    key: process.env.SSL_KEY_PATH,
    ca: process.env.SSL_CA_PATH
  },

  // 会话配置
  session: {
    secret: process.env.SESSION_SECRET,
    store: process.env.SESSION_STORE || 'redis',
    ttl: parseInt(process.env.SESSION_TTL) || 86400, // 24小时
    secure: process.env.SESSION_SECURE === 'true',
    httpOnly: process.env.SESSION_HTTP_ONLY !== 'false',
    sameSite: process.env.SESSION_SAME_SITE || 'strict'
  }
};