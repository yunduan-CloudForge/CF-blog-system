// 测试环境配置
module.exports = {
  // 应用配置
  app: {
    name: 'Blog System Test',
    version: process.env.npm_package_version || '1.0.0',
    env: 'test',
    port: process.env.PORT || 3002,
    host: process.env.HOST || 'localhost',
    url: process.env.APP_URL || 'http://localhost:3002',
    debug: false,
    logLevel: 'error'
  },

  // 数据库配置
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    name: process.env.DB_NAME || 'blog_test',
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    dialect: 'postgres',
    logging: false,
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    },
    ssl: false,
    timezone: '+08:00',
    // 测试环境特殊配置
    sync: { force: true }, // 每次测试前重建表
    transactionType: 'IMMEDIATE'
  },

  // Redis配置
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD || '',
    db: process.env.REDIS_DB || 15, // 使用独立的测试数据库
    keyPrefix: 'blog:test:',
    retryDelayOnFailover: 100,
    enableReadyCheck: false,
    maxRetriesPerRequest: null,
    lazyConnect: true
  },

  // JWT配置
  jwt: {
    secret: process.env.JWT_SECRET || 'test-secret-key',
    expiresIn: process.env.JWT_EXPIRES_IN || '1h',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '24h',
    issuer: process.env.JWT_ISSUER || 'blog-system-test',
    audience: process.env.JWT_AUDIENCE || 'blog-users-test'
  },

  // 邮件配置（测试环境使用模拟邮件服务）
  email: {
    service: 'test',
    host: 'localhost',
    port: 1025,
    secure: false,
    auth: {
      user: 'test@example.com',
      pass: 'test'
    },
    from: 'Blog System Test <test@blog.com>',
    templates: {
      welcome: 'welcome',
      resetPassword: 'reset-password',
      emailVerification: 'email-verification'
    },
    // 测试环境特殊配置
    preview: false,
    send: false // 不实际发送邮件
  },

  // 文件上传配置
  upload: {
    maxFileSize: 5 * 1024 * 1024, // 5MB
    allowedTypes: ['image/jpeg', 'image/png', 'image/gif'],
    destination: './test-uploads',
    publicPath: '/test-uploads',
    enableCompression: false,
    compressionQuality: 80
  },

  // 缓存配置
  cache: {
    ttl: 60, // 1分钟
    checkPeriod: 120, // 2分钟
    maxKeys: 100,
    useClones: false
  },

  // 限流配置（测试环境更宽松）
  rateLimit: {
    windowMs: 1 * 60 * 1000, // 1分钟
    max: 10000, // 每个IP最多10000次请求
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => true // 测试环境跳过限流
  },

  // CORS配置
  cors: {
    origin: true, // 测试环境允许所有来源
    credentials: true,
    optionsSuccessStatus: 200
  },

  // 安全配置
  security: {
    bcryptRounds: 1, // 测试环境使用最低加密轮数以提高速度
    sessionSecret: 'test-session-secret',
    csrfProtection: false,
    helmet: {
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false
    }
  },

  // 日志配置
  logging: {
    level: 'error',
    format: 'simple',
    colorize: false,
    timestamp: false,
    filename: './logs/test.log',
    maxsize: 1048576, // 1MB
    maxFiles: 2,
    silent: process.env.NODE_ENV === 'test' // 测试时静默日志
  },

  // 监控配置
  monitoring: {
    enabled: false,
    metricsPath: '/metrics',
    healthCheckPath: '/health',
    collectDefaultMetrics: false
  },

  // 第三方服务配置
  services: {
    // 图片处理服务
    imageProcessing: {
      enabled: false, // 测试环境禁用图片处理
      provider: 'mock',
      quality: 80,
      formats: ['jpeg'],
      sizes: {
        thumbnail: { width: 150, height: 150 }
      }
    },

    // 搜索服务
    search: {
      enabled: false,
      provider: 'mock',
      host: 'localhost:9200',
      index: 'blog_test'
    },

    // 消息队列
    queue: {
      enabled: false,
      provider: 'mock',
      redis: {
        host: 'localhost',
        port: 6379,
        db: 15
      }
    }
  },

  // 测试工具配置
  testTools: {
    fixtures: {
      enabled: true,
      path: './test/fixtures',
      autoLoad: true
    },
    mocks: {
      enabled: true,
      path: './test/mocks',
      autoLoad: true
    },
    coverage: {
      enabled: true,
      threshold: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80
        }
      },
      exclude: [
        'test/**',
        'coverage/**',
        'node_modules/**'
      ]
    },
    timeout: {
      unit: 5000,
      integration: 10000,
      e2e: 30000
    }
  },

  // 数据库种子配置
  seeds: {
    enabled: true,
    path: './test/seeds',
    users: [
      {
        email: 'test@example.com',
        password: 'test123',
        role: 'user',
        verified: true
      },
      {
        email: 'admin@example.com',
        password: 'admin123',
        role: 'admin',
        verified: true
      }
    ],
    posts: [
      {
        title: 'Test Post 1',
        content: 'This is a test post content.',
        status: 'published',
        authorId: 1
      },
      {
        title: 'Test Post 2',
        content: 'This is another test post content.',
        status: 'draft',
        authorId: 2
      }
    ]
  }
};