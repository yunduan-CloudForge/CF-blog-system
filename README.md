# 博客系统 (Blog System)

一个基于 React + TypeScript + Vite + Express + SQLite 构建的现代化全栈博客系统。

## 🚀 技术栈

### 前端
- **React 18** - 现代化的用户界面库
- **TypeScript** - 类型安全的 JavaScript 超集
- **Vite** - 快速的前端构建工具
- **Tailwind CSS** - 实用优先的 CSS 框架
- **React Router** - 客户端路由管理
- **Zustand** - 轻量级状态管理
- **React Hot Toast** - 优雅的通知组件
- **Lucide React** - 美观的图标库
- **Recharts** - 数据可视化图表库

### 后端
- **Node.js** - JavaScript 运行时环境
- **Express** - Web 应用框架
- **SQLite** - 轻量级数据库
- **JWT** - 身份验证和授权
- **bcryptjs** - 密码加密
- **Nodemailer** - 邮件发送服务
- **WebSocket** - 实时通信
- **Multer** - 文件上传处理

## ✨ 功能特性

### 用户功能
- 🔐 用户注册、登录、个人资料管理
- 📝 文章浏览、搜索、分类筛选
- 💬 评论系统（支持回复、点赞）
- 🏷️ 标签系统
- 📱 响应式设计，支持移动端
- 🌙 深色模式支持

### 作者功能
- ✍️ 文章创建、编辑、发布
- 📊 文章数据统计
- 💾 草稿保存
- 🖼️ 图片上传
- 📋 Markdown 编辑器

### 管理员功能
- 👥 用户管理
- 📰 文章管理
- 🏷️ 分类和标签管理
- 💬 评论管理
- 🔧 系统设置
- 📧 邮件配置
- 📈 数据统计和监控
- 🔒 权限管理（RBAC）
- 📋 操作日志
- 💾 数据备份

### 系统特性
- 🚀 性能优化（缓存、查询优化）
- 📊 实时监控和错误追踪
- 🔄 实时通信（WebSocket）
- 📱 PWA 支持
- 🌐 SEO 友好
- 🔒 安全防护（XSS、CSRF、SQL注入防护）

## 📦 安装和运行

### 环境要求
- Node.js >= 18.0.0
- npm >= 8.0.0

### 克隆项目
```bash
git clone <repository-url>
cd blog-system
```

### 安装依赖
```bash
npm install
```

### 环境配置
创建 `.env` 文件并配置以下环境变量：
```env
# JWT 密钥
JWT_SECRET=your-secret-key

# 邮件配置
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your-email@example.com
SMTP_PASS=your-password

# 数据库配置
DB_PATH=./blog.db

# 服务器配置
PORT=3001
```

### 数据库初始化
```bash
# 数据库会在首次运行时自动创建和初始化
npm run dev
```

### 启动开发服务器
```bash
# 同时启动前端和后端开发服务器
npm run dev

# 或者分别启动
npm run client:dev  # 前端开发服务器 (http://localhost:5173)
npm run server:dev  # 后端开发服务器 (http://localhost:3001)
```

### 构建生产版本
```bash
npm run build
```

### 预览生产版本
```bash
npm run preview
```

## 📁 项目结构

```
blog-system/
├── api/                    # 后端代码
│   ├── database/          # 数据库相关
│   ├── middleware/        # 中间件
│   ├── routes/           # API 路由
│   ├── utils/            # 工具函数
│   └── websocket/        # WebSocket 服务
├── src/                   # 前端代码
│   ├── components/       # React 组件
│   ├── pages/           # 页面组件
│   ├── hooks/           # 自定义 Hooks
│   ├── store/           # 状态管理
│   ├── utils/           # 工具函数
│   ├── services/        # API 服务
│   └── types/           # TypeScript 类型定义
├── public/               # 静态资源
├── uploads/              # 上传文件存储
└── backups/              # 数据库备份
```

## 🛠️ 开发说明

### 代码规范
- 使用 ESLint 进行代码检查
- 使用 TypeScript 确保类型安全
- 遵循 React Hooks 最佳实践
- 使用 Tailwind CSS 进行样式开发

### 提交规范
```bash
# 功能开发
git commit -m "feat: 添加用户注册功能"

# 问题修复
git commit -m "fix: 修复登录状态丢失问题"

# 文档更新
git commit -m "docs: 更新 README 文档"

# 样式调整
git commit -m "style: 优化首页布局样式"
```

### 代码检查
```bash
# TypeScript 类型检查
npm run check

# ESLint 代码检查
npm run lint
```

## 🚀 部署说明

### Vercel 部署
1. 将项目推送到 GitHub
2. 在 Vercel 中导入项目
3. 配置环境变量
4. 部署完成

### 传统服务器部署
1. 构建生产版本：`npm run build`
2. 将构建文件上传到服务器
3. 配置 Nginx 反向代理
4. 使用 PM2 管理 Node.js 进程

## 🤝 贡献指南

1. Fork 本项目
2. 创建功能分支：`git checkout -b feature/new-feature`
3. 提交更改：`git commit -m 'feat: 添加新功能'`
4. 推送到分支：`git push origin feature/new-feature`
5. 提交 Pull Request

## 📄 许可证

MIT License

## 🙏 致谢

感谢所有为这个项目做出贡献的开发者！

## 📞 联系方式

如有问题或建议，请通过以下方式联系：

- 提交 Issue
- 发送邮件
- 加入讨论群

---

**English Version**: [README-En.md](./README-En.md)
