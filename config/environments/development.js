// 开发环境配置
module.exports = {
  // 应用配置
  app: {
    name: 'Blog System',
    version: process.env.npm_package_version || '1.0.0',
    env: 'development',
    port: process.env.PORT || 3000,
    host: process.env.HOST || 'localhost',
    url: process.env.APP_URL || 'http://localhost:3000',
    debug: true,
    logLevel: 'debug'
  },

  // 数据库配置
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    name: process.env.DB_NAME || 'blog_dev',
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    dialect: 'postgres',
    logging: true,
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    },
    ssl: false,
    timezone: '+08:00'
  },

  // Redis配置
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD || '',
    db: process.env.REDIS_DB || 0,
    keyPrefix: 'blog:dev:',
    retryDelayOnFailover: 100,
    enableReadyCheck: false,
    maxRetriesPerRequest: null,
    lazyConnect: true
  },

  // JWT配置
  jwt: {
    secret: process.env.JWT_SECRET || 'dev-secret-key-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
    issuer: process.env.JWT_ISSUER || 'blog-system',
    audience: process.env.JWT_AUDIENCE || 'blog-users'
  },

  // 邮件配置
  email: {
    service: process.env.EMAIL_SERVICE || 'gmail',
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: process.env.EMAIL_PORT || 587,
    secure: process.env.EMAIL_SECURE === 'true',
    auth: {
      user: process.env.EMAIL_USER || 'test@example.com',
      pass: process.env.EMAIL_PASS || 'password'
    },
    from: process.env.EMAIL_FROM || 'Blog System <noreply@blog.com>',
    templates: {
      welcome: 'welcome',
      resetPassword: 'reset-password',
      emailVerification: 'email-verification'
    }
  },

  // 文件上传配置
  upload: {
    maxFileSize: process.env.MAX_FILE_SIZE || 10 * 1024 * 1024, // 10MB
    allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    destination: process.env.UPLOAD_DEST || './uploads',
    publicPath: process.env.UPLOAD_PUBLIC_PATH || '/uploads',
    enableCompression: true,
    compressionQuality: 80
  },

  // 缓存配置
  cache: {
    ttl: process.env.CACHE_TTL || 300, // 5分钟
    checkPeriod: process.env.CACHE_CHECK_PERIOD || 600, // 10分钟
    maxKeys: process.env.CACHE_MAX_KEYS || 1000,
    useClones: false
  },

  // 限流配置
  rateLimit: {
    windowMs: process.env.RATE_LIMIT_WINDOW || 15 * 60 * 1000, // 15分钟
    max: process.env.RATE_LIMIT_MAX || 1000, // 每个IP最多1000次请求
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false
  },

  // CORS配置
  cors: {
    origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : [
      'http://localhost:3000',
      'http://localhost:5173',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:5173'
    ],
    credentials: true,
    optionsSuccessStatus: 200
  },

  // 安全配置
  security: {
    bcryptRounds: process.env.BCRYPT_ROUNDS || 10,
    sessionSecret: process.env.SESSION_SECRET || 'dev-session-secret',
    csrfProtection: false, // 开发环境关闭CSRF保护
    helmet: {
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false
    }
  },

  // 日志配置
  logging: {
    level: process.env.LOG_LEVEL || 'debug',
    format: 'dev',
    colorize: true,
    timestamp: true,
    filename: process.env.LOG_FILE || './logs/development.log',
    maxsize: process.env.LOG_MAX_SIZE || 5242880, // 5MB
    maxFiles: process.env.LOG_MAX_FILES || 5,
    datePattern: 'YYYY-MM-DD-HH',
    zippedArchive: true
  },

  // 监控配置
  monitoring: {
    enabled: process.env.MONITORING_ENABLED === 'true',
    metricsPath: '/metrics',
    healthCheckPath: '/health',
    collectDefaultMetrics: true,
    requestDurationBuckets: [0.1, 0.5, 1, 2, 5],
    requestSizeBuckets: [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000]
  },

  // 第三方服务配置
  services: {
    // 图片处理服务
    imageProcessing: {
      enabled: true,
      provider: 'sharp',
      quality: 80,
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
      enabled: false,
      provider: 'elasticsearch',
      host: process.env.ELASTICSEARCH_HOST || 'localhost:9200',
      index: process.env.ELASTICSEARCH_INDEX || 'blog_dev'
    },

    // 消息队列
    queue: {
      enabled: false,
      provider: 'bull',
      redis: {
        host: process.env.QUEUE_REDIS_HOST || 'localhost',
        port: process.env.QUEUE_REDIS_PORT || 6379,
        db: process.env.QUEUE_REDIS_DB || 1
      }
    }
  },

  // 开发工具配置
  devTools: {
    hotReload: true,
    sourceMap: true,
    mockData: true,
    apiDocumentation: true,
    debugger: true,
    profiler: false
  }
};