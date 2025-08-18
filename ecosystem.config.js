module.exports = {
  apps: [
    {
      name: 'blog-system-api',
      script: './api/server.ts',
      interpreter: 'node',
      interpreter_args: '--loader tsx',
      instances: 'max', // 使用所有CPU核心
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'development',
        PORT: 3001
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3001
      },
      // 日志配置
      log_file: './logs/combined.log',
      out_file: './logs/out.log',
      error_file: './logs/error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      
      // 进程管理
      max_memory_restart: '1G',
      min_uptime: '10s',
      max_restarts: 10,
      
      // 监控配置
      watch: false,
      ignore_watch: ['node_modules', 'logs', 'uploads', 'backups'],
      
      // 自动重启配置
      autorestart: true,
      cron_restart: '0 2 * * *', // 每天凌晨2点重启
      
      // 健康检查
      health_check_grace_period: 3000,
      
      // 环境变量
      env_file: '.env.production'
    }
  ],
  
  deploy: {
    production: {
      user: 'deploy',
      host: ['your-server-ip'],
      ref: 'origin/main',
      repo: 'https://github.com/yourusername/blog-system.git',
      path: '/var/www/blog-system',
      'pre-deploy-local': '',
      'post-deploy': 'npm install && npm run build && pm2 reload ecosystem.config.js --env production',
      'pre-setup': '',
      'ssh_options': 'StrictHostKeyChecking=no'
    }
  }
};