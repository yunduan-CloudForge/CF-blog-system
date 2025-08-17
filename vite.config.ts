import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tsconfigPaths from "vite-tsconfig-paths";
import { traeBadgePlugin } from 'vite-plugin-trae-solo-badge';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: [
          'react-dev-locator',
        ],
      },
    }),
    traeBadgePlugin({
      variant: 'dark',
      position: 'bottom-right',
      prodOnly: true,
      clickable: true,
      clickUrl: 'https://www.trae.ai/solo?showJoin=1',
      autoTheme: true,
      autoThemeTarget: '#root'
    }), 
    tsconfigPaths(),
  ],
  // 构建优化配置
  build: {
    // 代码分割配置
    rollupOptions: {
      output: {
        // 按路由分割代码
        manualChunks: {
          // 第三方库分割
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-ui': ['lucide-react', 'recharts', 'react-hot-toast', 'sonner'],
          'vendor-utils': ['zustand', 'clsx', 'tailwind-merge'],
          'vendor-markdown': ['react-markdown', 'remark-gfm'],
          // 管理员相关页面
          'admin': [
            './src/pages/AdminDashboard.tsx',
            './src/pages/AdminUsers.tsx',
            './src/pages/AdminArticles.tsx',
            './src/pages/AdminCategories.tsx',
            './src/pages/AdminTags.tsx',
            './src/pages/AdminSettings.tsx',
            './src/pages/AdminLogs.tsx',
            './src/pages/AdminPermissions.tsx'
          ]
        },
        // 文件命名策略
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          if (/\.(png|jpe?g|gif|svg|webp|ico)$/i.test(assetInfo.name || '')) {
            return 'assets/images/[name]-[hash].[ext]';
          }
          if (/\.(css)$/i.test(assetInfo.name || '')) {
            return 'assets/css/[name]-[hash].[ext]';
          }
          return 'assets/[ext]/[name]-[hash].[ext]';
        }
      }
    },
    // 压缩配置
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true, // 生产环境移除console
        drop_debugger: true
      }
    },
    // 启用源码映射（开发时）
    sourcemap: process.env.NODE_ENV === 'development',
    // 设置chunk大小警告阈值
    chunkSizeWarningLimit: 1000,
    // 启用CSS代码分割
    cssCodeSplit: true
  },
  // 静态资源优化
  assetsInclude: ['**/*.svg', '**/*.png', '**/*.jpg', '**/*.jpeg', '**/*.gif', '**/*.webp'],
  // 开发服务器优化
  server: {
    // 启用HTTP/2
    // https: false, // 注释掉，使用默认值
    // 预热常用文件
    warmup: {
      clientFiles: [
        './src/App.tsx',
        './src/pages/Home.tsx',
        './src/pages/ArticleList.tsx',
        './src/pages/ArticleDetail.tsx'
      ]
    },
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
        configure: (proxy) => {
          proxy.on('error', (err) => {
            console.log('proxy error', err);
          });
          proxy.on('proxyReq', (proxyReq, req) => {
            console.log('Sending Request to the Target:', req.method, req.url);
          });
          proxy.on('proxyRes', (proxyRes, req) => {
            console.log('Received Response from the Target:', proxyRes.statusCode, req.url);
          });
        },
      }
    }
  },
  // 依赖优化
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      'zustand',
      'lucide-react',
      'react-markdown',
      'remark-gfm'
    ],
    exclude: ['@vite/client', '@vite/env']
  },
  // 缓存策略
  cacheDir: 'node_modules/.vite',
  // 预览服务器配置
  preview: {
    port: 4173,
    strictPort: true,
    headers: {
      'Cache-Control': 'public, max-age=31536000'
    }
  }
})
