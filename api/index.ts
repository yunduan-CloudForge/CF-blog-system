// API入口文件
// 用于Vercel部署的无服务器函数入口

import { VercelRequest, VercelResponse } from '@vercel/node';
import app from './app';

// 导出默认处理函数供Vercel使用
export default function handler(req: VercelRequest, res: VercelResponse) {
  return app(req, res);
}

// 同时导出app实例供其他用途
export { default as app } from './app';