/**
 * This is a API server
 */

import express, { type Request, type Response, type NextFunction }  from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
// import path from 'path';
import dotenv from 'dotenv';
// import { fileURLToPath } from 'url';
import authRoutes from './routes/auth.js';
import articlesRoutes from './routes/articles.js';
import categoriesRoutes from './routes/categories.js';
import tagsRoutes from './routes/tags.js';
import commentsRoutes from './routes/comments.js';
import usersRoutes from './routes/users.js';
import performanceRoutes from './routes/performance.js';
import sessionsRoutes from './routes/sessions.js';
import passwordRoutes from './routes/password.js';
import monitoringRoutes from './routes/monitoring.js';
import alertsRoutes from './routes/alerts.js';
import healthRoutes from './routes/health.js';
import databaseRoutes from './routes/database.js';
import archiveRoutes from './routes/archive.js';
import backupRoutes from './routes/backup.js';
import { loggerMiddleware, errorLoggerMiddleware } from './utils/logger';
import { initDatabase } from './database/init.js';
// import { errorHandler } from './middleware/errorHandler.js';
import { startCleanupTask } from './services/tokenBlacklistService.js';
import { startSessionCleanupTask } from './services/sessionService.js';
import { logRotationManager } from './utils/logRotation.js';
import { dataArchiveManager } from './utils/dataArchive.js';
import { backupRestoreManager } from './utils/backupRestore.js';

// for esm mode
// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);

// load env
dotenv.config();

// 初始化数据库
initDatabase().catch(console.error);

// 启动token黑名单清理任务
startCleanupTask();

// 启动会话清理任务
startSessionCleanupTask();

// 启动日志轮转服务
logRotationManager.start();

// 启动数据归档服务
dataArchiveManager.start();

// 启动备份恢复服务
backupRestoreManager.start();

const app: express.Application = express();

// 安全中间件
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'", process.env.FRONTEND_URL || 'http://localhost:5173']
    }
  },
  crossOriginEmbedderPolicy: false // 允许跨域嵌入
}));

// CORS中间件
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true // 允许发送cookies
}));

// Cookie解析中间件
app.use(cookieParser());

// 请求体解析中间件
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 日志中间件
app.use(loggerMiddleware);

/**
 * API Routes
 */
app.use('/api/auth', authRoutes);
app.use('/api/articles', articlesRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/tags', tagsRoutes);
app.use('/api/comments', commentsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/performance', performanceRoutes);
app.use('/api/sessions', sessionsRoutes);
app.use('/api/password', passwordRoutes);
app.use('/api/monitoring', monitoringRoutes);
app.use('/api/alerts', alertsRoutes);
app.use('/api/health', healthRoutes);
app.use('/api/database', databaseRoutes);
app.use('/api/archive', archiveRoutes);
app.use('/api/backup', backupRoutes);

/**
 * health
 */
app.use('/api/health', (_req: Request, res: Response, _next: NextFunction): void => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// CSRF保护中间件（仅对状态改变的请求）
app.use((req: Request, res: Response, next: NextFunction): void => {
  // 对于GET、HEAD、OPTIONS请求跳过CSRF检查
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }
  
  // 检查Origin或Referer头
  const origin = req.get('Origin') || req.get('Referer');
  const allowedOrigins = [
    process.env.FRONTEND_URL || 'http://localhost:5173',
    'http://localhost:5173'
  ];
  
  if (!origin || !allowedOrigins.some(allowed => origin.startsWith(allowed))) {
    res.status(403).json({ error: 'CSRF protection: Invalid origin' });
    return;
  }
  
  next();
});

/**
 * error handler middleware
 */
app.use(errorLoggerMiddleware);
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Error:', err);
  
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation Error',
      details: err.message
    });
  }
  
  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid token'
    });
  }
  
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

/**
 * 404 handler
 */
app.use((_req: Request, res: Response): void => {
  res.status(404).json({
    success: false,
    error: 'API not found'
  });
});

export default app;