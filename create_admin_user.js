import { initializeDatabase, query, get, run } from './api/database/connection.js';
import bcrypt from 'bcryptjs';

// 创建管理员用户的脚本
async function createAdminUser() {
  console.log('=== 创建管理员用户 ===\n');
  
  try {
    // 初始化数据库连接
    await initializeDatabase();
    console.log('✅ 数据库连接成功\n');
    
    const email = 'admin@example.com';
    const password = 'admin123';
    const username = 'admin';
    const role = 'admin';
    
    // 检查用户是否存在
    const existingUser = await get('SELECT * FROM users WHERE email = ?', [email]);
    
    if (existingUser) {
      console.log('管理员用户已存在，更新密码...');
      
      // 加密新密码
      const hashedPassword = await bcrypt.hash(password, 10);
      
      // 更新用户信息
      await run(
        'UPDATE users SET password_hash = ?, username = ?, role = ? WHERE email = ?',
        [hashedPassword, username, role, email]
      );
      
      console.log(`✅ 管理员用户更新成功: ${email} / ${password}`);
    } else {
      console.log('创建新的管理员用户...');
      
      // 加密密码
      const hashedPassword = await bcrypt.hash(password, 10);
      
      // 创建用户
      await run(
        'INSERT INTO users (email, password_hash, username, role, bio) VALUES (?, ?, ?, ?, ?)',
        [email, hashedPassword, username, role, '系统管理员']
      );
      
      console.log(`✅ 管理员用户创建成功: ${email} / ${password}`);
    }
    
    // 验证密码
    console.log('\n验证密码...');
    const updatedUser = await get('SELECT * FROM users WHERE email = ?', [email]);
    const isValid = await bcrypt.compare(password, updatedUser.password_hash);
    
    if (isValid) {
      console.log('✅ 密码验证成功');
    } else {
      console.log('❌ 密码验证失败');
    }
    
    console.log('\n管理员用户信息:');
    console.log(`ID: ${updatedUser.id}`);
    console.log(`用户名: ${updatedUser.username}`);
    console.log(`邮箱: ${updatedUser.email}`);
    console.log(`角色: ${updatedUser.role}`);
    
  } catch (error) {
    console.error('❌ 创建管理员用户失败:', error);
  }
}

// 运行创建
createAdminUser();