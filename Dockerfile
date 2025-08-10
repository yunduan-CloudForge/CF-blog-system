# 多阶段构建 Dockerfile
# 阶段1: 构建前端
FROM node:18-alpine AS frontend-builder

WORKDIR /app

# 复制前端依赖文件
COPY package*.json ./
COPY tsconfig.json ./
COPY vite.config.ts ./
COPY tailwind.config.js ./
COPY postcss.config.js ./
COPY index.html ./

# 安装前端依赖
RUN npm ci --only=production

# 复制前端源码
COPY src/ ./src/
COPY public/ ./public/

# 构建前端
RUN npm run build

# 阶段2: 构建后端
FROM node:18-alpine AS backend-builder

WORKDIR /app

# 复制后端依赖文件
COPY package*.json ./
COPY tsconfig.json ./

# 安装后端依赖
RUN npm ci --only=production

# 复制后端源码
COPY api/ ./api/
COPY shared/ ./shared/

# 编译TypeScript
RUN npx tsc --project tsconfig.json

# 阶段3: 生产环境
FROM node:18-alpine AS production

# 安装必要的系统依赖
RUN apk add --no-cache \
    dumb-init \
    curl \
    sqlite \
    && rm -rf /var/cache/apk/*

# 创建非root用户
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

WORKDIR /app

# 复制package.json和依赖
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# 复制构建产物
COPY --from=frontend-builder /app/dist ./dist
COPY --from=backend-builder /app/api ./api
COPY --from=backend-builder /app/shared ./shared

# 复制其他必要文件
COPY data/ ./data/
COPY scripts/ ./scripts/
COPY supabase/ ./supabase/

# 创建日志目录
RUN mkdir -p /app/logs && chown -R nextjs:nodejs /app/logs

# 设置权限
RUN chown -R nextjs:nodejs /app
USER nextjs

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/api/health || exit 1

# 暴露端口
EXPOSE 3000

# 使用dumb-init作为PID 1
ENTRYPOINT ["dumb-init", "--"]

# 启动应用
CMD ["node", "api/server.js"]

# 元数据标签
LABEL maintainer="Blog System Team"
LABEL version="1.0.0"
LABEL description="Blog System Production Container"
LABEL org.opencontainers.image.source="https://github.com/your-org/blog-system"