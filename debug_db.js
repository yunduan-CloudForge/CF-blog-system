import { initializeDatabase, query, get, run } from './api/database/connection.js';

// 调试数据库的脚本
async function debugDatabase() {
  console.log('=== 数据库调试信息 ===\n');
  
  try {
    // 初始化数据库连接
    await initializeDatabase();
    console.log('✅ 数据库连接成功\n');
    
    // 1. 检查用户表
    console.log('1. 用户表信息:');
    const users = await query('SELECT id, username, email, role, created_at FROM users');
    console.log('用户数量:', users.length);
    users.forEach(user => {
      console.log(`  - ID: ${user.id}, 用户名: ${user.username}, 邮箱: ${user.email}, 角色: ${user.role}`);
    });
    
    // 2. 检查评论表
    console.log('\n2. 评论表信息:');
    const comments = await query('SELECT * FROM comments ORDER BY created_at DESC');
    console.log('评论总数:', comments.length);
    
    if (comments.length > 0) {
      console.log('\n最近的评论:');
      comments.slice(0, 5).forEach(comment => {
        console.log(`  - ID: ${comment.id}, 内容: "${comment.content}", 用户ID: ${comment.user_id}, 文章ID: ${comment.article_id}, 父评论ID: ${comment.parent_id}, 创建时间: ${comment.created_at}`);
      });
    }
    
    // 3. 统计回复数据
    console.log('\n3. 回复统计:');
    const replyCount = await get('SELECT COUNT(*) as count FROM comments WHERE parent_id IS NOT NULL');
    console.log('回复总数:', replyCount.count);
    
    const repliesByArticle = await query(`
      SELECT article_id, COUNT(*) as reply_count 
      FROM comments 
      WHERE parent_id IS NOT NULL 
      GROUP BY article_id
    `);
    
    if (repliesByArticle.length > 0) {
      console.log('各文章的回复数:');
      repliesByArticle.forEach(stat => {
        console.log(`  - 文章${stat.article_id}: ${stat.reply_count}条回复`);
      });
    } else {
      console.log('没有找到任何回复数据');
    }
    
    // 4. 检查文章1的评论结构
    console.log('\n4. 文章1的评论结构:');
    const article1Comments = await query('SELECT * FROM comments WHERE article_id = 1 ORDER BY created_at');
    console.log('文章1评论数:', article1Comments.length);
    
    if (article1Comments.length > 0) {
      article1Comments.forEach(comment => {
        const type = comment.parent_id ? '回复' : '评论';
        console.log(`  - ${type} ID: ${comment.id}, 内容: "${comment.content}", 父评论: ${comment.parent_id || '无'}, 时间: ${comment.created_at}`);
      });
    }
    
    // 5. 创建测试用户（如果不存在）
    console.log('\n5. 检查/创建测试用户:');
    const testUser = await get('SELECT * FROM users WHERE email = ?', ['test@example.com']);
    
    if (!testUser) {
      console.log('创建测试用户...');
      const bcrypt = await import('bcryptjs');
      const hashedPassword = await bcrypt.hash('test123', 10);
      
      await run(
        'INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)',
        ['testuser', 'test@example.com', hashedPassword, 'user']
      );
      console.log('✅ 测试用户创建成功: test@example.com / test123');
    } else {
      console.log('✅ 测试用户已存在: test@example.com');
    }
    
  } catch (error) {
    console.error('❌ 数据库调试失败:', error);
  }
}

// 运行调试
debugDatabase();