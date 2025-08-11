import { initializeDatabase, query, get, run } from './api/database/connection.js';

// 检查回复数据持久化的脚本
async function checkReplyPersistence() {
  console.log('=== 检查回复数据持久化 ===\n');
  
  try {
    // 初始化数据库连接
    await initializeDatabase();
    console.log('✅ 数据库连接成功\n');
    
    // 1. 检查所有评论记录
    console.log('1. 检查所有评论记录:');
    const allComments = await query(`
      SELECT 
        c.id, c.content, c.user_id, c.article_id, c.parent_id, c.likes,
        c.created_at, c.updated_at,
        u.username
      FROM comments c
      JOIN users u ON c.user_id = u.id
      ORDER BY c.created_at DESC
    `);
    
    console.log(`总评论数: ${allComments.length}`);
    allComments.forEach((comment: any) => {
      const type = comment.parent_id ? '回复' : '主评论';
      console.log(`- [${type}] ID:${comment.id}, 内容:"${comment.content.substring(0, 30)}...", 用户:${comment.username}, 父ID:${comment.parent_id || 'null'}`);
    });
    
    // 2. 专门检查回复记录
    console.log('\n2. 检查回复记录 (parent_id IS NOT NULL):');
    const replies = await query(`
      SELECT 
        c.id, c.content, c.user_id, c.article_id, c.parent_id, c.likes,
        c.created_at, c.updated_at,
        u.username,
        parent.content as parent_content
      FROM comments c
      JOIN users u ON c.user_id = u.id
      LEFT JOIN comments parent ON c.parent_id = parent.id
      WHERE c.parent_id IS NOT NULL
      ORDER BY c.created_at DESC
    `);
    
    console.log(`回复数量: ${replies.length}`);
    if (replies.length === 0) {
      console.log('❌ 没有找到任何回复记录！');
    } else {
      replies.forEach((reply: any) => {
        console.log(`- 回复ID:${reply.id}, 内容:"${reply.content}", 用户:${reply.username}`);
        console.log(`  回复给ID:${reply.parent_id}, 父评论:"${reply.parent_content?.substring(0, 30)}..."`);
        console.log(`  创建时间:${reply.created_at}\n`);
      });
    }
    
    // 3. 检查特定文章的评论结构
    console.log('3. 检查文章1的评论结构:');
    const article1Comments = await query(`
      SELECT 
        c.id, c.content, c.user_id, c.article_id, c.parent_id, c.likes,
        c.created_at, u.username
      FROM comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.article_id = 1
      ORDER BY c.created_at ASC
    `);
    
    console.log(`文章1的评论数: ${article1Comments.length}`);
    article1Comments.forEach((comment: any) => {
      const indent = comment.parent_id ? '  └─ ' : '├─ ';
      const type = comment.parent_id ? '回复' : '主评论';
      console.log(`${indent}[${type}] ID:${comment.id}, "${comment.content}", 用户:${comment.username}`);
    });
    
    // 4. 检查数据库表结构
    console.log('\n4. 检查评论表结构:');
    const tableInfo = await query(`PRAGMA table_info(comments)`);
    console.log('评论表字段:');
    tableInfo.forEach((field: any) => {
      console.log(`- ${field.name}: ${field.type} ${field.notnull ? 'NOT NULL' : ''} ${field.dflt_value ? `DEFAULT ${field.dflt_value}` : ''}`);
    });
    
    // 5. 检查索引
    console.log('\n5. 检查评论表索引:');
    const indexes = await query(`PRAGMA index_list(comments)`);
    console.log('评论表索引:');
    indexes.forEach((index: any) => {
      console.log(`- ${index.name}: ${index.unique ? 'UNIQUE' : 'NON-UNIQUE'}`);
    });
    
  } catch (error) {
    console.error('❌ 检查过程中出错:', error);
  }
}

// 运行检查
checkReplyPersistence().catch(console.error);