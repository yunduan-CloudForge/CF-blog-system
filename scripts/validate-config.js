#!/usr/bin/env node

/**
 * 配置验证脚本
 * 用于验证不同环境的配置文件是否正确
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function colorLog(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

class ConfigValidator {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.environments = ['development', 'test', 'production'];
    this.configDir = path.join(process.cwd(), 'config');
  }

  /**
   * 验证所有环境配置
   */
  async validateAll() {
    colorLog('cyan', '🔍 开始验证配置文件...');
    console.log();

    // 验证配置目录结构
    this.validateDirectoryStructure();

    // 验证环境变量文件
    this.validateEnvFiles();

    // 验证配置文件
    for (const env of this.environments) {
      await this.validateEnvironment(env);
    }

    // 验证配置管理器
    this.validateConfigManager();

    // 输出结果
    this.printResults();

    // 如果有错误，退出进程
    if (this.errors.length > 0) {
      process.exit(1);
    }
  }

  /**
   * 验证目录结构
   */
  validateDirectoryStructure() {
    colorLog('blue', '📁 验证目录结构...');

    const requiredDirs = [
      'config',
      'config/environments'
    ];

    const requiredFiles = [
      'config/index.js'
    ];

    // 检查目录
    requiredDirs.forEach(dir => {
      const dirPath = path.join(process.cwd(), dir);
      if (!fs.existsSync(dirPath)) {
        this.errors.push(`缺少必需目录: ${dir}`);
      } else {
        colorLog('green', `  ✓ 目录存在: ${dir}`);
      }
    });

    // 检查文件
    requiredFiles.forEach(file => {
      const filePath = path.join(process.cwd(), file);
      if (!fs.existsSync(filePath)) {
        this.errors.push(`缺少必需文件: ${file}`);
      } else {
        colorLog('green', `  ✓ 文件存在: ${file}`);
      }
    });

    console.log();
  }

  /**
   * 验证环境变量文件
   */
  validateEnvFiles() {
    colorLog('blue', '🔧 验证环境变量文件...');

    const envFiles = [
      '.env.example',
      'config/environments/development.env',
      'config/environments/test.env',
      'config/environments/production.env'
    ];

    envFiles.forEach(file => {
      const filePath = path.join(process.cwd(), file);
      if (fs.existsSync(filePath)) {
        try {
          const content = fs.readFileSync(filePath, 'utf8');
          this.validateEnvContent(file, content);
          colorLog('green', `  ✓ 环境变量文件有效: ${file}`);
        } catch (error) {
          this.errors.push(`环境变量文件格式错误 ${file}: ${error.message}`);
        }
      } else {
        this.warnings.push(`环境变量文件不存在: ${file}`);
      }
    });

    console.log();
  }

  /**
   * 验证环境变量内容
   */
  validateEnvContent(filename, content) {
    const lines = content.split('\n');
    const envVars = new Set();

    lines.forEach((line, index) => {
      const trimmedLine = line.trim();
      
      // 跳过空行和注释
      if (!trimmedLine || trimmedLine.startsWith('#')) {
        return;
      }

      // 验证格式
      if (!trimmedLine.includes('=')) {
        this.warnings.push(`${filename}:${index + 1} - 无效的环境变量格式: ${trimmedLine}`);
        return;
      }

      const [key] = trimmedLine.split('=');
      
      // 检查重复
      if (envVars.has(key)) {
        this.warnings.push(`${filename}:${index + 1} - 重复的环境变量: ${key}`);
      }
      
      envVars.add(key);
    });
  }

  /**
   * 验证特定环境配置
   */
  async validateEnvironment(env) {
    colorLog('blue', `⚙️  验证 ${env} 环境配置...`);

    const configPath = path.join(this.configDir, 'environments', `${env}.js`);
    
    if (!fs.existsSync(configPath)) {
      this.errors.push(`配置文件不存在: ${configPath}`);
      return;
    }

    try {
      // 临时设置环境变量
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = env;

      // 加载配置
      delete require.cache[require.resolve(configPath)];
      const config = require(configPath);

      // 验证配置结构
      this.validateConfigStructure(env, config);

      // 验证必需字段
      this.validateRequiredFields(env, config);

      // 验证数据类型
      this.validateDataTypes(env, config);

      // 环境特定验证
      if (env === 'production') {
        this.validateProductionConfig(config);
      }

      colorLog('green', `  ✓ ${env} 环境配置有效`);

      // 恢复环境变量
      process.env.NODE_ENV = originalEnv;

    } catch (error) {
      this.errors.push(`${env} 环境配置加载失败: ${error.message}`);
    }

    console.log();
  }

  /**
   * 验证配置结构
   */
  validateConfigStructure(env, config) {
    const requiredSections = [
      'app',
      'database',
      'redis',
      'jwt',
      'logging'
    ];

    requiredSections.forEach(section => {
      if (!config[section]) {
        this.errors.push(`${env}: 缺少配置节: ${section}`);
      }
    });
  }

  /**
   * 验证必需字段
   */
  validateRequiredFields(env, config) {
    const requiredFields = {
      app: ['name', 'port', 'env'],
      database: ['host', 'port', 'name'],
      redis: ['host', 'port'],
      jwt: ['secret'],
      logging: ['level']
    };

    Object.entries(requiredFields).forEach(([section, fields]) => {
      if (config[section]) {
        fields.forEach(field => {
          if (config[section][field] === undefined || config[section][field] === null) {
            this.errors.push(`${env}: 缺少必需字段: ${section}.${field}`);
          }
        });
      }
    });
  }

  /**
   * 验证数据类型
   */
  validateDataTypes(env, config) {
    const typeValidations = {
      'app.port': 'number',
      'database.port': 'number',
      'redis.port': 'number',
      'app.debug': 'boolean'
    };

    Object.entries(typeValidations).forEach(([path, expectedType]) => {
      const value = this.getNestedValue(config, path);
      if (value !== undefined && typeof value !== expectedType) {
        this.warnings.push(`${env}: ${path} 应该是 ${expectedType} 类型，当前是 ${typeof value}`);
      }
    });
  }

  /**
   * 验证生产环境配置
   */
  validateProductionConfig(config) {
    // JWT密钥强度检查
    if (config.jwt && config.jwt.secret) {
      if (config.jwt.secret.length < 32) {
        this.errors.push('生产环境: JWT密钥长度应至少32个字符');
      }
      if (config.jwt.secret === 'default-secret-change-in-production') {
        this.errors.push('生产环境: 必须更改默认JWT密钥');
      }
    }

    // 调试模式检查
    if (config.app && config.app.debug === true) {
      this.warnings.push('生产环境: 建议关闭调试模式');
    }

    // 数据库SSL检查
    if (config.database && !config.database.ssl) {
      this.warnings.push('生产环境: 建议启用数据库SSL连接');
    }

    // HTTPS检查
    if (config.security && !config.security.ssl?.enabled) {
      this.warnings.push('生产环境: 建议启用HTTPS');
    }

    // 日志级别检查
    if (config.logging && config.logging.level === 'debug') {
      this.warnings.push('生产环境: 建议使用info或更高级别的日志');
    }
  }

  /**
   * 验证配置管理器
   */
  validateConfigManager() {
    colorLog('blue', '🔧 验证配置管理器...');

    try {
      const configManagerPath = path.join(this.configDir, 'index.js');
      delete require.cache[require.resolve(configManagerPath)];
      
      const configManager = require(configManagerPath);

      // 检查必需方法
      const requiredMethods = [
        'get',
        'isDevelopment',
        'isTest',
        'isProduction',
        'getEnvironment',
        'getDatabaseUrl',
        'getRedisUrl'
      ];

      requiredMethods.forEach(method => {
        if (typeof configManager[method] !== 'function') {
          this.errors.push(`配置管理器缺少方法: ${method}`);
        }
      });

      // 测试基本功能
      try {
        const config = configManager.get();
        if (!config || typeof config !== 'object') {
          this.errors.push('配置管理器无法返回有效配置');
        }
      } catch (error) {
        this.errors.push(`配置管理器测试失败: ${error.message}`);
      }

      colorLog('green', '  ✓ 配置管理器有效');

    } catch (error) {
      this.errors.push(`配置管理器加载失败: ${error.message}`);
    }

    console.log();
  }

  /**
   * 获取嵌套对象的值
   */
  getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);
  }

  /**
   * 打印验证结果
   */
  printResults() {
    console.log('='.repeat(60));
    colorLog('cyan', '📊 验证结果');
    console.log('='.repeat(60));

    if (this.errors.length === 0 && this.warnings.length === 0) {
      colorLog('green', '🎉 所有配置验证通过！');
    } else {
      if (this.errors.length > 0) {
        colorLog('red', `❌ 发现 ${this.errors.length} 个错误:`);
        this.errors.forEach(error => {
          colorLog('red', `   • ${error}`);
        });
        console.log();
      }

      if (this.warnings.length > 0) {
        colorLog('yellow', `⚠️  发现 ${this.warnings.length} 个警告:`);
        this.warnings.forEach(warning => {
          colorLog('yellow', `   • ${warning}`);
        });
        console.log();
      }
    }

    console.log('='.repeat(60));
  }
}

// 主函数
async function main() {
  try {
    const validator = new ConfigValidator();
    await validator.validateAll();
  } catch (error) {
    colorLog('red', `验证过程中发生错误: ${error.message}`);
    process.exit(1);
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  main();
}

module.exports = ConfigValidator;