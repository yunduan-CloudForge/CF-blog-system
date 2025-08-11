import { initializeDatabase, query, get, run } from './api/database/connection.js';

// 检查用户表结构的脚本
async function checkUserTable() {
  console.log('=== 检查用户表结构 ===\n');
  
  try {
    // 初始化数据库连接
    await initializeDatabase();
    console.log('✅ 数据库连接成功\n');
    
    // 获取用户表结构
    console.log('用户表结构:');
    const tableInfo = await query('PRAGMA table_info(users)');
    console.table(tableInfo);
    
    // 获取所有用户数据
    console.log('\n所有用户数据:');
    const users = await query('SELECT * FROM users');
    console.table(users);
    
  } catch (error) {
    console.error('❌ 检查用户表失败:', error);
  }
}

// 运行检查
checkUserTable();