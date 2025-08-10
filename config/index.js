const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

/**
 * 环境配置管理器
 * 根据NODE_ENV环境变量加载相应的配置文件
 */
class ConfigManager {
  constructor() {
    this.env = process.env.NODE_ENV || 'development';
    this.config = null;
    this.loadConfig();
  }

  /**
   * 加载配置文件
   */
  loadConfig() {
    try {
      // 1. 首先加载.env文件（如果存在）
      this.loadEnvFile('.env');
      
      // 2. 加载环境特定的.env文件
      this.loadEnvFile(`.env.${this.env}`);
      
      // 3. 加载环境特定的配置文件
      const configPath = path.join(__dirname, 'environments', `${this.env}.js`);
      
      if (fs.existsSync(configPath)) {
        this.config = require(configPath);
      } else {
        console.warn(`Configuration file not found: ${configPath}`);
        // 回退到默认配置
        this.config = this.getDefaultConfig();
      }
      
      // 4. 验证必需的配置项
      this.validateConfig();
      
      console.log(`Configuration loaded for environment: ${this.env}`);
    } catch (error) {
      console.error('Failed to load configuration:', error.message);
      process.exit(1);
    }
  }

  /**
   * 加载环境变量文件
   * @param {string} filename - 环境变量文件名
   */
  loadEnvFile(filename) {
    const envPath = path.join(process.cwd(), filename);
    
    if (fs.existsSync(envPath)) {
      const result = dotenv.config({ path: envPath });
      
      if (result.error) {
        console.warn(`Failed to load ${filename}:`, result.error.message);
      } else {
        console.log(`Loaded environment variables from ${filename}`);
      }
    }
  }

  /**
   * 获取默认配置
   * @returns {Object} 默认配置对象
   */
  getDefaultConfig() {
    return {
      app: {
        name: 'Blog System',
        version: '1.0.0',
        env: this.env,
        port: 3000,
        host: 'localhost',
        debug: this.env === 'development'
      },
      database: {
        host: 'localhost',
        port: 5432,
        name: `blog_${this.env}`,
        username: 'postgres',
        password: 'postgres',
        dialect: 'postgres',
        logging: this.env === 'development'
      },
      redis: {
        host: 'localhost',
        port: 6379,
        db: this.env === 'test' ? 15 : 0
      },
      jwt: {
        secret: 'default-secret-change-in-production',
        expiresIn: '24h'
      },
      logging: {
        level: this.env === 'production' ? 'info' : 'debug',
        format: this.env === 'production' ? 'json' : 'dev'
      }
    };
  }

  /**
   * 验证配置
   */
  validateConfig() {
    const requiredFields = {
      production: [
        'app.port',
        'database.host',
        'database.name',
        'database.username',
        'database.password',
        'jwt.secret',
        'redis.host'
      ],
      development: [
        'app.port',
        'database.name'
      ],
      test: [
        'app.port',
        'database.name'
      ]
    };

    const required = requiredFields[this.env] || requiredFields.development;
    const missing = [];

    required.forEach(field => {
      if (!this.getNestedValue(this.config, field)) {
        missing.push(field);
      }
    });

    if (missing.length > 0) {
      throw new Error(`Missing required configuration fields: ${missing.join(', ')}`);
    }

    // 生产环境特殊验证
    if (this.env === 'production') {
      this.validateProductionConfig();
    }
  }

  /**
   * 验证生产环境配置
   */
  validateProductionConfig() {
    const warnings = [];
    const errors = [];

    // 检查JWT密钥强度
    if (this.config.jwt.secret === 'default-secret-change-in-production' ||
        this.config.jwt.secret.length < 32) {
      errors.push('JWT secret must be at least 32 characters long in production');
    }

    // 检查数据库SSL
    if (!this.config.database.ssl) {
      warnings.push('Database SSL is not enabled in production');
    }

    // 检查HTTPS
    if (!this.config.security?.httpsOnly) {
      warnings.push('HTTPS is not enforced in production');
    }

    // 检查调试模式
    if (this.config.app.debug) {
      warnings.push('Debug mode is enabled in production');
    }

    // 输出警告
    warnings.forEach(warning => {
      console.warn(`⚠️  Production Warning: ${warning}`);
    });

    // 抛出错误
    if (errors.length > 0) {
      throw new Error(`Production configuration errors: ${errors.join(', ')}`);
    }
  }

  /**
   * 获取嵌套对象的值
   * @param {Object} obj - 对象
   * @param {string} path - 路径（如 'app.port'）
   * @returns {*} 值
   */
  getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : null;
    }, obj);
  }

  /**
   * 获取配置
   * @param {string} path - 配置路径（可选）
   * @returns {*} 配置值
   */
  get(path) {
    if (!path) {
      return this.config;
    }
    return this.getNestedValue(this.config, path);
  }

  /**
   * 检查是否为开发环境
   * @returns {boolean}
   */
  isDevelopment() {
    return this.env === 'development';
  }

  /**
   * 检查是否为测试环境
   * @returns {boolean}
   */
  isTest() {
    return this.env === 'test';
  }

  /**
   * 检查是否为生产环境
   * @returns {boolean}
   */
  isProduction() {
    return this.env === 'production';
  }

  /**
   * 获取环境名称
   * @returns {string}
   */
  getEnvironment() {
    return this.env;
  }

  /**
   * 重新加载配置
   */
  reload() {
    this.loadConfig();
  }

  /**
   * 获取数据库连接字符串
   * @returns {string}
   */
  getDatabaseUrl() {
    const db = this.config.database;
    const protocol = db.dialect || 'postgres';
    const auth = db.username && db.password ? `${db.username}:${db.password}@` : '';
    const ssl = db.ssl ? '?ssl=true' : '';
    
    return `${protocol}://${auth}${db.host}:${db.port}/${db.name}${ssl}`;
  }

  /**
   * 获取Redis连接字符串
   * @returns {string}
   */
  getRedisUrl() {
    const redis = this.config.redis;
    const auth = redis.password ? `:${redis.password}@` : '';
    const db = redis.db ? `/${redis.db}` : '';
    
    return `redis://${auth}${redis.host}:${redis.port}${db}`;
  }

  /**
   * 导出配置用于日志记录（隐藏敏感信息）
   * @returns {Object}
   */
  toLogSafeObject() {
    const config = JSON.parse(JSON.stringify(this.config));
    
    // 隐藏敏感信息
    const sensitiveFields = [
      'database.password',
      'redis.password',
      'jwt.secret',
      'jwt.refreshSecret',
      'email.auth.pass',
      'security.sessionSecret',
      'security.csrfSecret'
    ];

    sensitiveFields.forEach(field => {
      const keys = field.split('.');
      let current = config;
      
      for (let i = 0; i < keys.length - 1; i++) {
        if (current[keys[i]]) {
          current = current[keys[i]];
        } else {
          break;
        }
      }
      
      if (current && current[keys[keys.length - 1]]) {
        current[keys[keys.length - 1]] = '***HIDDEN***';
      }
    });

    return config;
  }
}

// 创建单例实例
const configManager = new ConfigManager();

// 导出配置管理器实例和配置对象
module.exports = configManager;
module.exports.config = configManager.get();
module.exports.ConfigManager = ConfigManager;

// 便捷方法
module.exports.get = (path) => configManager.get(path);
module.exports.isDevelopment = () => configManager.isDevelopment();
module.exports.isTest = () => configManager.isTest();
module.exports.isProduction = () => configManager.isProduction();
module.exports.getEnvironment = () => configManager.getEnvironment();
module.exports.getDatabaseUrl = () => configManager.getDatabaseUrl();
module.exports.getRedisUrl = () => configManager.getRedisUrl();