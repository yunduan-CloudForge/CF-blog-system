/**
 * 图片上传API路由
 * 处理图片文件上传和存储
 */
import { Router, type Request, type Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// 确保上传目录存在
const uploadDir = path.join(process.cwd(), 'uploads', 'images');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// 配置multer存储
const storage = multer.memoryStorage();

// 文件过滤器 - 只允许图片文件
const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('只允许上传图片文件 (JPEG, PNG, GIF, WebP)'));
  }
};

// 配置multer
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB限制
    files: 1 // 一次只能上传一个文件
  }
});

/**
 * 上传图片
 * POST /api/upload/image
 */
router.post('/image', authMiddleware, upload.single('image'), async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({
        success: false,
        message: '请选择要上传的图片文件',
        timestamp: new Date().toISOString()
      });
      return;
    }

    // 用户已通过认证中间件验证
    const file = req.file;
    
    // 生成唯一文件名
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 15);
    const fileExtension = path.extname(file.originalname);
    const fileName = `${timestamp}_${randomString}${fileExtension}`;
    const filePath = path.join(uploadDir, fileName);
    
    // 保存文件到磁盘
    fs.writeFileSync(filePath, file.buffer);
    
    // 生成访问URL
    const imageUrl = `/uploads/images/${fileName}`;
    
    res.json({
      success: true,
      message: '图片上传成功',
      data: {
        url: imageUrl,
        filename: fileName,
        originalName: file.originalname,
        size: file.size,
        mimetype: file.mimetype
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('图片上传错误:', error);
    
    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        res.status(400).json({
          success: false,
          message: '文件大小超过限制 (最大5MB)',
          timestamp: new Date().toISOString()
        });
        return;
      }
    }
    
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : '服务器内部错误',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * 批量上传图片
 * POST /api/upload/images
 */
router.post('/images', authMiddleware, upload.array('images', 5), async (req: Request, res: Response): Promise<void> => {
  try {
    const files = req.files as Express.Multer.File[];
    
    if (!files || files.length === 0) {
      res.status(400).json({
        success: false,
        message: '请选择要上传的图片文件',
        timestamp: new Date().toISOString()
      });
      return;
    }

    // 用户已通过认证中间件验证
    const uploadedFiles = [];
    
    for (const file of files) {
      // 生成唯一文件名
      const timestamp = Date.now();
      const randomString = Math.random().toString(36).substring(2, 15);
      const fileExtension = path.extname(file.originalname);
      const fileName = `${timestamp}_${randomString}${fileExtension}`;
      const filePath = path.join(uploadDir, fileName);
      
      // 保存文件到磁盘
      fs.writeFileSync(filePath, file.buffer);
      
      // 生成访问URL
      const imageUrl = `/uploads/images/${fileName}`;
      
      uploadedFiles.push({
        url: imageUrl,
        filename: fileName,
        originalName: file.originalname,
        size: file.size,
        mimetype: file.mimetype
      });
    }
    
    res.json({
      success: true,
      message: `成功上传 ${uploadedFiles.length} 张图片`,
      data: {
        files: uploadedFiles
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('批量图片上传错误:', error);
    
    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        res.status(400).json({
          success: false,
          message: '文件大小超过限制 (最大5MB)',
          timestamp: new Date().toISOString()
        });
        return;
      }
      if (error.code === 'LIMIT_FILE_COUNT') {
        res.status(400).json({
          success: false,
          message: '文件数量超过限制 (最多5张)',
          timestamp: new Date().toISOString()
        });
        return;
      }
    }
    
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : '服务器内部错误',
      timestamp: new Date().toISOString()
    });
  }
});

export default router;