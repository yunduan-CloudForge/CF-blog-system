import { initializeDatabase, query, get, run } from './api/database/connection.js';
import bcrypt from 'bcryptjs';

// 重置测试用户密码的脚本
async function resetTestUser() {
  console.log('=== 重置测试用户密码 ===\n');
  
  try {
    // 初始化数据库连接
    await initializeDatabase();
    console.log('✅ 数据库连接成功\n');
    
    const email = 'test@example.com';
    const newPassword = 'test123';
    
    // 检查用户是否存在
    const user = await get('SELECT * FROM users WHERE email = ?', [email]);
    
    if (!user) {
      console.log('用户不存在，创建新用户...');
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      
      await run(
        'INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)',
        ['testuser', email, hashedPassword, 'user']
      );
      console.log(`✅ 用户创建成功: ${email} / ${newPassword}`);
    } else {
      console.log('用户已存在，更新密码...');
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      
      await run(
        'UPDATE users SET password_hash = ? WHERE email = ?',
        [hashedPassword, email]
      );
      console.log(`✅ 密码更新成功: ${email} / ${newPassword}`);
    }
    
    // 验证密码
    console.log('\n验证新密码...');
    const updatedUser = await get('SELECT * FROM users WHERE email = ?', [email]);
    const isValid = await bcrypt.compare(newPassword, updatedUser.password_hash);
    
    if (isValid) {
      console.log('✅ 密码验证成功');
    } else {
      console.log('❌ 密码验证失败');
    }
    
    console.log('\n用户信息:');
    console.log(`ID: ${updatedUser.id}`);
    console.log(`用户名: ${updatedUser.username}`);
    console.log(`邮箱: ${updatedUser.email}`);
    console.log(`角色: ${updatedUser.role}`);
    
  } catch (error) {
    console.error('❌ 重置用户失败:', error);
  }
}

// 运行重置
resetTestUser();