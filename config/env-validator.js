const Joi = require('joi');

/**
 * 环境变量验证器
 * 用于验证和转换环境变量
 */
class EnvValidator {
  constructor() {
    this.schema = this.createSchema();
  }

  /**
   * 创建验证模式
   * @returns {Joi.ObjectSchema} Joi验证模式
   */
  createSchema() {
    return Joi.object({
      // 应用配置
      NODE_ENV: Joi.string()
        .valid('development', 'test', 'production')
        .default('development'),
      
      APP_NAME: Joi.string()
        .default('Blog System'),
      
      APP_VERSION: Joi.string()
        .default('1.0.0'),
      
      APP_PORT: Joi.number()
        .integer()
        .min(1)
        .max(65535)
        .default(3000),
      
      APP_HOST: Joi.string()
        .default('localhost'),
      
      APP_DEBUG: Joi.boolean()
        .default(false),
      
      APP_URL: Joi.string()
        .uri()
        .default('http://localhost:3000'),
      
      // 数据库配置
      DB_HOST: Joi.string()
        .default('localhost'),
      
      DB_PORT: Joi.number()
        .integer()
        .min(1)
        .max(65535)
        .default(5432),
      
      DB_NAME: Joi.string()
        .required(),
      
      DB_USERNAME: Joi.string()
        .required(),
      
      DB_PASSWORD: Joi.string()
        .required(),
      
      DB_DIALECT: Joi.string()
        .valid('postgres', 'mysql', 'sqlite', 'mariadb')
        .default('postgres'),
      
      DB_SSL: Joi.boolean()
        .default(false),
      
      DB_LOGGING: Joi.boolean()
        .default(false),
      
      DB_POOL_MIN: Joi.number()
        .integer()
        .min(0)
        .default(0),
      
      DB_POOL_MAX: Joi.number()
        .integer()
        .min(1)
        .default(10),
      
      DB_POOL_ACQUIRE: Joi.number()
        .integer()
        .min(1000)
        .default(30000),
      
      DB_POOL_IDLE: Joi.number()
        .integer()
        .min(1000)
        .default(10000),
      
      // Redis配置
      REDIS_HOST: Joi.string()
        .default('localhost'),
      
      REDIS_PORT: Joi.number()
        .integer()
        .min(1)
        .max(65535)
        .default(6379),
      
      REDIS_PASSWORD: Joi.string()
        .allow(''),
      
      REDIS_DB: Joi.number()
        .integer()
        .min(0)
        .max(15)
        .default(0),
      
      REDIS_TTL: Joi.number()
        .integer()
        .min(1)
        .default(3600),
      
      // JWT配置
      JWT_SECRET: Joi.string()
        .min(32)
        .required(),
      
      JWT_EXPIRES_IN: Joi.string()
        .default('24h'),
      
      JWT_REFRESH_SECRET: Joi.string()
        .min(32)
        .required(),
      
      JWT_REFRESH_EXPIRES_IN: Joi.string()
        .default('7d'),
      
      JWT_ISSUER: Joi.string()
        .default('blog-system'),
      
      JWT_AUDIENCE: Joi.string()
        .default('blog-users'),
      
      // 邮件配置
      EMAIL_HOST: Joi.string(),
      
      EMAIL_PORT: Joi.number()
        .integer()
        .min(1)
        .max(65535)
        .default(587),
      
      EMAIL_SECURE: Joi.boolean()
        .default(false),
      
      EMAIL_USER: Joi.string(),
      
      EMAIL_PASS: Joi.string(),
      
      EMAIL_FROM: Joi.string()
        .email(),
      
      EMAIL_FROM_NAME: Joi.string()
        .default('Blog System'),
      
      // 文件上传配置
      UPLOAD_MAX_SIZE: Joi.number()
        .integer()
        .min(1)
        .default(10485760), // 10MB
      
      UPLOAD_ALLOWED_TYPES: Joi.string()
        .default('image/jpeg,image/png,image/gif,image/webp'),
      
      UPLOAD_DEST: Joi.string()
        .default('./uploads'),
      
      // 安全配置
      SECURITY_BCRYPT_ROUNDS: Joi.number()
        .integer()
        .min(10)
        .max(15)
        .default(12),
      
      SECURITY_SESSION_SECRET: Joi.string()
        .min(32),
      
      SECURITY_CSRF_SECRET: Joi.string()
        .min(32),
      
      SECURITY_RATE_LIMIT_WINDOW: Joi.number()
        .integer()
        .min(1000)
        .default(900000), // 15分钟
      
      SECURITY_RATE_LIMIT_MAX: Joi.number()
        .integer()
        .min(1)
        .default(100),
      
      SECURITY_CORS_ORIGIN: Joi.string()
        .default('*'),
      
      SECURITY_HTTPS_ONLY: Joi.boolean()
        .default(false),
      
      // 日志配置
      LOG_LEVEL: Joi.string()
        .valid('error', 'warn', 'info', 'debug')
        .default('info'),
      
      LOG_FORMAT: Joi.string()
        .valid('json', 'simple', 'dev')
        .default('json'),
      
      LOG_FILE: Joi.string(),
      
      LOG_MAX_SIZE: Joi.string()
        .default('20m'),
      
      LOG_MAX_FILES: Joi.number()
        .integer()
        .min(1)
        .default(14),
      
      // 缓存配置
      CACHE_TTL: Joi.number()
        .integer()
        .min(1)
        .default(3600),
      
      CACHE_MAX_KEYS: Joi.number()
        .integer()
        .min(1)
        .default(1000),
      
      // 监控配置
      MONITORING_ENABLED: Joi.boolean()
        .default(false),
      
      MONITORING_ENDPOINT: Joi.string()
        .default('/metrics'),
      
      HEALTH_CHECK_ENDPOINT: Joi.string()
        .default('/health'),
      
      // APM配置
      APM_ENABLED: Joi.boolean()
        .default(false),
      
      APM_SERVICE_NAME: Joi.string()
        .default('blog-system'),
      
      APM_SERVER_URL: Joi.string()
        .uri(),
      
      APM_SECRET_TOKEN: Joi.string(),
      
      // 第三方服务
      CLOUDINARY_CLOUD_NAME: Joi.string(),
      
      CLOUDINARY_API_KEY: Joi.string(),
      
      CLOUDINARY_API_SECRET: Joi.string(),
      
      ELASTICSEARCH_URL: Joi.string()
        .uri(),
      
      ELASTICSEARCH_INDEX: Joi.string()
        .default('blog-posts'),
      
      // 社交登录
      GOOGLE_CLIENT_ID: Joi.string(),
      
      GOOGLE_CLIENT_SECRET: Joi.string(),
      
      GITHUB_CLIENT_ID: Joi.string(),
      
      GITHUB_CLIENT_SECRET: Joi.string(),
      
      // 支付配置
      STRIPE_PUBLIC_KEY: Joi.string(),
      
      STRIPE_SECRET_KEY: Joi.string(),
      
      STRIPE_WEBHOOK_SECRET: Joi.string(),
      
      // 通知配置
      NOTIFICATION_ENABLED: Joi.boolean()
        .default(false),
      
      SLACK_WEBHOOK_URL: Joi.string()
        .uri(),
      
      DISCORD_WEBHOOK_URL: Joi.string()
        .uri(),
      
      // 容器配置
      CONTAINER_NAME: Joi.string(),
      
      CONTAINER_VERSION: Joi.string(),
      
      KUBERNETES_NAMESPACE: Joi.string(),
      
      // 负载均衡
      LOAD_BALANCER_ENABLED: Joi.boolean()
        .default(false),
      
      LOAD_BALANCER_ALGORITHM: Joi.string()
        .valid('round-robin', 'least-connections', 'ip-hash')
        .default('round-robin'),
      
      // CDN配置
      CDN_ENABLED: Joi.boolean()
        .default(false),
      
      CDN_URL: Joi.string()
        .uri(),
      
      CDN_API_KEY: Joi.string(),
      
      // 自动扩缩容
      AUTO_SCALING_ENABLED: Joi.boolean()
        .default(false),
      
      AUTO_SCALING_MIN_INSTANCES: Joi.number()
        .integer()
        .min(1)
        .default(1),
      
      AUTO_SCALING_MAX_INSTANCES: Joi.number()
        .integer()
        .min(1)
        .default(10),
      
      AUTO_SCALING_TARGET_CPU: Joi.number()
        .min(1)
        .max(100)
        .default(70),
      
      // 备份配置
      BACKUP_ENABLED: Joi.boolean()
        .default(false),
      
      BACKUP_SCHEDULE: Joi.string()
        .default('0 2 * * *'), // 每天凌晨2点
      
      BACKUP_RETENTION_DAYS: Joi.number()
        .integer()
        .min(1)
        .default(30),
      
      BACKUP_S3_BUCKET: Joi.string(),
      
      BACKUP_S3_REGION: Joi.string(),
      
      BACKUP_S3_ACCESS_KEY: Joi.string(),
      
      BACKUP_S3_SECRET_KEY: Joi.string()
    }).unknown(true); // 允许未知字段
  }

  /**
   * 验证环境变量
   * @param {Object} env - 环境变量对象
   * @returns {Object} 验证后的环境变量
   */
  validate(env = process.env) {
    const { error, value } = this.schema.validate(env, {
      allowUnknown: true,
      stripUnknown: false,
      convert: true,
      abortEarly: false
    });

    if (error) {
      const errorMessages = error.details.map(detail => {
        return `${detail.path.join('.')}: ${detail.message}`;
      });
      
      throw new Error(`Environment validation failed:\n${errorMessages.join('\n')}`);
    }

    return value;
  }

  /**
   * 验证生产环境特定要求
   * @param {Object} env - 环境变量对象
   */
  validateProduction(env) {
    const productionRequirements = [
      'JWT_SECRET',
      'JWT_REFRESH_SECRET',
      'DB_PASSWORD',
      'SECURITY_SESSION_SECRET'
    ];

    const missing = productionRequirements.filter(key => !env[key]);
    
    if (missing.length > 0) {
      throw new Error(`Missing required production environment variables: ${missing.join(', ')}`);
    }

    // 检查密钥强度
    const secrets = {
      JWT_SECRET: env.JWT_SECRET,
      JWT_REFRESH_SECRET: env.JWT_REFRESH_SECRET,
      SECURITY_SESSION_SECRET: env.SECURITY_SESSION_SECRET
    };

    Object.entries(secrets).forEach(([key, value]) => {
      if (value && value.length < 32) {
        throw new Error(`${key} must be at least 32 characters long in production`);
      }
    });

    // 检查HTTPS
    if (!env.SECURITY_HTTPS_ONLY) {
      console.warn('⚠️  HTTPS is not enforced in production environment');
    }

    // 检查调试模式
    if (env.APP_DEBUG) {
      console.warn('⚠️  Debug mode is enabled in production environment');
    }
  }

  /**
   * 转换环境变量为配置对象
   * @param {Object} env - 验证后的环境变量
   * @returns {Object} 配置对象
   */
  transform(env) {
    return {
      app: {
        name: env.APP_NAME,
        version: env.APP_VERSION,
        env: env.NODE_ENV,
        port: env.APP_PORT,
        host: env.APP_HOST,
        debug: env.APP_DEBUG,
        url: env.APP_URL
      },
      
      database: {
        host: env.DB_HOST,
        port: env.DB_PORT,
        name: env.DB_NAME,
        username: env.DB_USERNAME,
        password: env.DB_PASSWORD,
        dialect: env.DB_DIALECT,
        ssl: env.DB_SSL,
        logging: env.DB_LOGGING,
        pool: {
          min: env.DB_POOL_MIN,
          max: env.DB_POOL_MAX,
          acquire: env.DB_POOL_ACQUIRE,
          idle: env.DB_POOL_IDLE
        }
      },
      
      redis: {
        host: env.REDIS_HOST,
        port: env.REDIS_PORT,
        password: env.REDIS_PASSWORD,
        db: env.REDIS_DB,
        ttl: env.REDIS_TTL
      },
      
      jwt: {
        secret: env.JWT_SECRET,
        expiresIn: env.JWT_EXPIRES_IN,
        refreshSecret: env.JWT_REFRESH_SECRET,
        refreshExpiresIn: env.JWT_REFRESH_EXPIRES_IN,
        issuer: env.JWT_ISSUER,
        audience: env.JWT_AUDIENCE
      },
      
      email: {
        host: env.EMAIL_HOST,
        port: env.EMAIL_PORT,
        secure: env.EMAIL_SECURE,
        auth: {
          user: env.EMAIL_USER,
          pass: env.EMAIL_PASS
        },
        from: env.EMAIL_FROM,
        fromName: env.EMAIL_FROM_NAME
      },
      
      upload: {
        maxSize: env.UPLOAD_MAX_SIZE,
        allowedTypes: env.UPLOAD_ALLOWED_TYPES.split(','),
        destination: env.UPLOAD_DEST
      },
      
      security: {
        bcryptRounds: env.SECURITY_BCRYPT_ROUNDS,
        sessionSecret: env.SECURITY_SESSION_SECRET,
        csrfSecret: env.SECURITY_CSRF_SECRET,
        rateLimit: {
          windowMs: env.SECURITY_RATE_LIMIT_WINDOW,
          max: env.SECURITY_RATE_LIMIT_MAX
        },
        cors: {
          origin: env.SECURITY_CORS_ORIGIN === '*' ? true : env.SECURITY_CORS_ORIGIN.split(',')
        },
        httpsOnly: env.SECURITY_HTTPS_ONLY
      },
      
      logging: {
        level: env.LOG_LEVEL,
        format: env.LOG_FORMAT,
        file: env.LOG_FILE,
        maxSize: env.LOG_MAX_SIZE,
        maxFiles: env.LOG_MAX_FILES
      },
      
      cache: {
        ttl: env.CACHE_TTL,
        maxKeys: env.CACHE_MAX_KEYS
      },
      
      monitoring: {
        enabled: env.MONITORING_ENABLED,
        endpoint: env.MONITORING_ENDPOINT,
        healthCheck: env.HEALTH_CHECK_ENDPOINT
      },
      
      apm: {
        enabled: env.APM_ENABLED,
        serviceName: env.APM_SERVICE_NAME,
        serverUrl: env.APM_SERVER_URL,
        secretToken: env.APM_SECRET_TOKEN
      },
      
      thirdParty: {
        cloudinary: {
          cloudName: env.CLOUDINARY_CLOUD_NAME,
          apiKey: env.CLOUDINARY_API_KEY,
          apiSecret: env.CLOUDINARY_API_SECRET
        },
        elasticsearch: {
          url: env.ELASTICSEARCH_URL,
          index: env.ELASTICSEARCH_INDEX
        },
        google: {
          clientId: env.GOOGLE_CLIENT_ID,
          clientSecret: env.GOOGLE_CLIENT_SECRET
        },
        github: {
          clientId: env.GITHUB_CLIENT_ID,
          clientSecret: env.GITHUB_CLIENT_SECRET
        },
        stripe: {
          publicKey: env.STRIPE_PUBLIC_KEY,
          secretKey: env.STRIPE_SECRET_KEY,
          webhookSecret: env.STRIPE_WEBHOOK_SECRET
        }
      },
      
      notification: {
        enabled: env.NOTIFICATION_ENABLED,
        slack: {
          webhookUrl: env.SLACK_WEBHOOK_URL
        },
        discord: {
          webhookUrl: env.DISCORD_WEBHOOK_URL
        }
      },
      
      container: {
        name: env.CONTAINER_NAME,
        version: env.CONTAINER_VERSION,
        namespace: env.KUBERNETES_NAMESPACE
      },
      
      loadBalancer: {
        enabled: env.LOAD_BALANCER_ENABLED,
        algorithm: env.LOAD_BALANCER_ALGORITHM
      },
      
      cdn: {
        enabled: env.CDN_ENABLED,
        url: env.CDN_URL,
        apiKey: env.CDN_API_KEY
      },
      
      autoScaling: {
        enabled: env.AUTO_SCALING_ENABLED,
        minInstances: env.AUTO_SCALING_MIN_INSTANCES,
        maxInstances: env.AUTO_SCALING_MAX_INSTANCES,
        targetCpu: env.AUTO_SCALING_TARGET_CPU
      },
      
      backup: {
        enabled: env.BACKUP_ENABLED,
        schedule: env.BACKUP_SCHEDULE,
        retentionDays: env.BACKUP_RETENTION_DAYS,
        s3: {
          bucket: env.BACKUP_S3_BUCKET,
          region: env.BACKUP_S3_REGION,
          accessKey: env.BACKUP_S3_ACCESS_KEY,
          secretKey: env.BACKUP_S3_SECRET_KEY
        }
      }
    };
  }

  /**
   * 验证并转换环境变量
   * @param {Object} env - 环境变量对象
   * @returns {Object} 配置对象
   */
  validateAndTransform(env = process.env) {
    const validatedEnv = this.validate(env);
    
    // 生产环境额外验证
    if (validatedEnv.NODE_ENV === 'production') {
      this.validateProduction(validatedEnv);
    }
    
    return this.transform(validatedEnv);
  }
}

module.exports = EnvValidator;
module.exports.default = EnvValidator;