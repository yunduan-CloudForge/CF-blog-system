# 博客系统 (Blog System)

一个现代化的全栈博客系统，基于 React + Node.js + Supabase 构建，支持文章管理、用户认证、评论系统等功能。

## ✨ 特性

- 📝 **文章管理**: 支持 Markdown 编辑器，文章发布、编辑、删除
- 👤 **用户系统**: 完整的用户注册、登录、个人资料管理
- 💬 **评论系统**: 支持文章评论和回复功能
- 🔍 **搜索功能**: 全文搜索文章内容
- 📱 **响应式设计**: 适配桌面端和移动端
- 🚀 **性能优化**: 代码分割、懒加载、缓存策略
- 📊 **监控系统**: 完整的错误监控、性能监控和日志系统
- 🔒 **安全防护**: XSS 防护、CSRF 防护、SQL 注入防护
- 🐳 **容器化部署**: Docker + Docker Compose 支持
- 🔄 **零停机部署**: 蓝绿部署策略

## 🛠️ 技术栈

### 前端
- **框架**: React 18 + TypeScript
- **构建工具**: Vite
- **样式**: Tailwind CSS
- **状态管理**: Zustand
- **路由**: React Router
- **UI 组件**: Lucide React (图标)
- **编辑器**: Monaco Editor (Markdown)
- **HTTP 客户端**: Axios

### 后端
- **运行时**: Node.js
- **框架**: Express.js + TypeScript
- **数据库**: Supabase (PostgreSQL)
- **认证**: Supabase Auth
- **文件存储**: Supabase Storage
- **缓存**: Redis
- **API 文档**: Swagger/OpenAPI

### 基础设施
- **容器化**: Docker + Docker Compose
- **反向代理**: Nginx
- **监控**: Prometheus + Grafana
- **日志**: Loki + Promtail
- **链路追踪**: Jaeger
- **告警**: Alertmanager
- **CI/CD**: GitHub Actions

## 🚀 快速开始

### 环境要求

- Node.js >= 18.0.0
- npm >= 8.0.0 或 pnpm >= 7.0.0
- Docker >= 20.10.0
- Docker Compose >= 2.0.0

### 本地开发

1. **克隆项目**
   ```bash
   git clone <repository-url>
   cd blog-system
   ```

2. **安装依赖**
   ```bash
   npm install
   # 或
   pnpm install
   ```

3. **环境配置**
   ```bash
   # 复制环境变量模板
   cp .env.example .env
   
   # 编辑环境变量
   # 配置 Supabase 项目信息
   # 配置 Redis 连接信息
   ```

4. **启动开发服务器**
   ```bash
   # 启动前端开发服务器
   npm run dev
   
   # 启动后端开发服务器 (新终端)
   npm run dev:api
   ```

5. **访问应用**
   - 前端: http://localhost:5173
   - 后端 API: http://localhost:3001
   - API 文档: http://localhost:3001/api-docs

### Docker 部署

1. **开发环境**
   ```bash
   docker-compose up -d
   ```

2. **生产环境**
   ```bash
   docker-compose -f docker-compose.prod.yml up -d
   ```

3. **零停机部署**
   ```bash
   # Linux/macOS
   ./scripts/zero-downtime-deploy.sh
   
   # Windows
   .\scripts\zero-downtime-deploy.ps1
   ```

## 📁 项目结构

```
blog-system/
├── src/                    # 前端源码
│   ├── components/         # React 组件
│   ├── pages/             # 页面组件
│   ├── hooks/             # 自定义 Hooks
│   ├── utils/             # 工具函数
│   ├── types/             # TypeScript 类型定义
│   └── styles/            # 样式文件
├── api/                   # 后端源码
│   ├── src/               # 后端源码
│   │   ├── routes/        # API 路由
│   │   ├── middleware/    # 中间件
│   │   ├── services/      # 业务逻辑
│   │   ├── utils/         # 工具函数
│   │   └── types/         # 类型定义
│   └── tests/             # 后端测试
├── shared/                # 前后端共享代码
├── supabase/              # Supabase 配置
│   └── migrations/        # 数据库迁移文件
├── docker/                # Docker 配置文件
├── scripts/               # 部署和运维脚本
├── docs/                  # 项目文档
├── monitoring/            # 监控配置
└── nginx/                 # Nginx 配置
```

## 📖 文档

- [部署指南](./docs/deployment-guide.md) - 详细的部署流程和配置说明
- [运维手册](./docs/operations-manual.md) - 日常运维操作和故障处理
- [API 文档](http://localhost:3001/api-docs) - 后端 API 接口文档
- [技术架构](./docs/architecture.md) - 系统架构设计文档

## 🔧 开发指南

### 代码规范

- 使用 ESLint + Prettier 进行代码格式化
- 遵循 TypeScript 严格模式
- 组件文件使用 PascalCase 命名
- 工具函数使用 camelCase 命名

### 提交规范

使用 Conventional Commits 规范：

```
feat: 新功能
fix: 修复 bug
docs: 文档更新
style: 代码格式调整
refactor: 代码重构
test: 测试相关
chore: 构建过程或辅助工具的变动
```

### 分支策略

- `main`: 主分支，用于生产环境
- `develop`: 开发分支，用于集成测试
- `feature/*`: 功能分支
- `hotfix/*`: 热修复分支

## 🧪 测试

```bash
# 运行前端测试
npm run test

# 运行后端测试
npm run test:api

# 运行端到端测试
npm run test:e2e

# 生成测试覆盖率报告
npm run test:coverage
```

## 📊 监控和日志

### 监控系统

- **Grafana**: http://localhost:3000 (admin/admin)
- **Prometheus**: http://localhost:9090
- **Jaeger**: http://localhost:16686
- **Alertmanager**: http://localhost:9093

### 日志查询

```bash
# 查看应用日志
docker-compose logs -f app

# 查看 Nginx 日志
docker-compose logs -f nginx

# 查看数据库日志
docker-compose logs -f postgres
```

## 🚨 故障排除

### 常见问题

1. **端口冲突**
   - 检查端口占用：`netstat -tulpn | grep :5173`
   - 修改端口配置或停止冲突服务

2. **数据库连接失败**
   - 检查 Supabase 配置
   - 验证网络连接
   - 查看数据库日志

3. **Docker 构建失败**
   - 清理 Docker 缓存：`docker system prune -a`
   - 检查 Dockerfile 语法
   - 验证基础镜像可用性

更多故障排除信息请参考 [运维手册](./docs/operations-manual.md)。

## 🤝 贡献指南

我们欢迎所有形式的贡献！请遵循以下步骤：

1. **Fork 项目**
2. **创建功能分支** (`git checkout -b feature/AmazingFeature`)
3. **提交更改** (`git commit -m 'Add some AmazingFeature'`)
4. **推送到分支** (`git push origin feature/AmazingFeature`)
5. **创建 Pull Request**

### 贡献类型

- 🐛 Bug 修复
- ✨ 新功能开发
- 📝 文档改进
- 🎨 UI/UX 优化
- ⚡ 性能优化
- 🧪 测试覆盖
- 🔧 工具和配置

### 开发环境设置

1. 确保本地环境满足要求
2. 安装开发依赖
3. 配置代码编辑器（推荐 VS Code）
4. 安装推荐的扩展插件

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 🙏 致谢

感谢所有为这个项目做出贡献的开发者！

- [React](https://reactjs.org/) - 用户界面库
- [Supabase](https://supabase.com/) - 开源 Firebase 替代方案
- [Tailwind CSS](https://tailwindcss.com/) - CSS 框架
- [Vite](https://vitejs.dev/) - 前端构建工具

## 📞 联系我们

如果您有任何问题或建议，请通过以下方式联系我们：

- 提交 [Issue](../../issues)
- 发送邮件到：[your-email@example.com]
- 加入我们的讨论群：[链接]

---

⭐ 如果这个项目对您有帮助，请给我们一个 Star！