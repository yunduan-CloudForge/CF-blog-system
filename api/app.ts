/**
 * 博客系统API服务器
 */

import express, { type Request, type Response, type NextFunction }  from 'express';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';
import authRoutes from './routes/auth';
import articlesRoutes from './routes/articles';
import categoriesRoutes from './routes/categories';
import tagsRoutes from './routes/tags';
import uploadRoutes from './routes/upload';
import commentsRoutes from './routes/comments';
import { initializeDatabase } from './database/connection';

// 加载环境变量
dotenv.config();

const app: express.Application = express();

// 初始化数据库
initializeDatabase().catch(console.error);

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 静态文件服务 - 用于访问上传的图片
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

/**
 * API Routes
 */
app.use('/api/auth', authRoutes);
app.use('/api/articles', articlesRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/tags', tagsRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/comments', commentsRoutes);

/**
 * health
 */
app.use('/api/health', (req: Request, res: Response, next: NextFunction): void => {
  res.status(200).json({
    success: true,
    message: 'ok'
  });
});

/**
 * error handler middleware
 */
app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
  res.status(500).json({
    success: false,
    error: 'Server internal error'
  });
});

/**
 * 404 handler
 */
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'API not found'
  });
});

export default app;