/**
 * local server entry file, for local development
 */
import app from './app.js';
import RealtimeService from './websocket/realtime.js';

/**
 * start server with port
 */
const PORT = process.env.PORT || 3001;

const server = app.listen(PORT, () => {
  console.log(`Server ready on port ${PORT}`);
});

/**
 * initialize WebSocket service
 */
const realtimeService = new RealtimeService(server);
console.log('实时数据监控服务已启动');

// 导出实时服务实例，供其他模块使用
export { realtimeService };

/**
 * close server
 */
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

export default app;
