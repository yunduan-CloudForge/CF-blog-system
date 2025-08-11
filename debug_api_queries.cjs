const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// 数据库连接
const dbPath = path.join(__dirname, 'blog.db');
const db = new sqlite3.Database(dbPath);

// 模拟API查询逻辑
async function debugAPIQueries() {
  console.log('=== 调试API查询逻辑 ===\n');
  
  const articleId = 1;
  const limitNum = 20;
  const offset = 0;
  const sortField = 'created_at';
  const orderDir = 'DESC';
  
  try {
    // 1. 获取评论总数
    console.log('1. 获取评论总数:');
    const totalResult = await new Promise((resolve, reject) => {
      db.get('SELECT COUNT(*) as total FROM comments WHERE article_id = ?', [articleId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
    console.log('总评论数:', totalResult.total);
    
    // 2. 获取顶级评论（分页）
    console.log('\n2. 获取顶级评论（分页）:');
    const topLevelQuery = `
      SELECT 
        c.id, c.content, c.user_id, c.article_id, c.parent_id, c.likes,
        c.created_at, c.updated_at,
        u.username, u.avatar
      FROM comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.article_id = ? AND c.parent_id IS NULL
      ORDER BY c.${sortField} ${orderDir}
      LIMIT ? OFFSET ?
    `;
    
    console.log('查询SQL:', topLevelQuery);
    console.log('参数:', [articleId, limitNum, offset]);
    
    const topLevelComments = await new Promise((resolve, reject) => {
      db.all(topLevelQuery, [articleId, limitNum, offset], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    
    console.log('顶级评论数量:', topLevelComments.length);
    topLevelComments.forEach((comment, index) => {
      console.log(`  ${index + 1}. ID: ${comment.id}, 内容: "${comment.content.substring(0, 30)}...", parent_id: ${comment.parent_id}`);
    });
    
    // 3. 获取所有回复（不分页）
    console.log('\n3. 获取所有回复（不分页）:');
    const repliesQuery = `
      SELECT 
        c.id, c.content, c.user_id, c.article_id, c.parent_id, c.likes,
        c.created_at, c.updated_at,
        u.username, u.avatar
      FROM comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.article_id = ? AND c.parent_id IS NOT NULL
      ORDER BY c.created_at ASC
    `;
    
    console.log('查询SQL:', repliesQuery);
    console.log('参数:', [articleId]);
    
    const allReplies = await new Promise((resolve, reject) => {
      db.all(repliesQuery, [articleId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    
    console.log('回复评论数量:', allReplies.length);
    allReplies.forEach((reply, index) => {
      console.log(`  ${index + 1}. ID: ${reply.id}, 内容: "${reply.content.substring(0, 30)}...", parent_id: ${reply.parent_id}`);
    });
    
    // 4. 合并所有评论
    console.log('\n4. 合并结果:');
    const allComments = [...topLevelComments, ...allReplies];
    console.log('合并后总数:', allComments.length);
    
    // 5. 检查用户表是否有问题
    console.log('\n5. 检查用户表:');
    const users = await new Promise((resolve, reject) => {
      db.all('SELECT id, username FROM users', [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    console.log('用户数量:', users.length);
    users.forEach(user => {
      console.log(`  用户ID: ${user.id}, 用户名: ${user.username}`);
    });
    
    // 6. 检查是否有孤立的评论（用户不存在）
    console.log('\n6. 检查孤立评论:');
    const orphanComments = await new Promise((resolve, reject) => {
      db.all(`
        SELECT c.id, c.content, c.user_id 
        FROM comments c 
        LEFT JOIN users u ON c.user_id = u.id 
        WHERE c.article_id = ? AND u.id IS NULL
      `, [articleId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    
    console.log('孤立评论数量:', orphanComments.length);
    if (orphanComments.length > 0) {
      console.log('⚠️ 发现孤立评论（用户不存在）:');
      orphanComments.forEach(comment => {
        console.log(`  评论ID: ${comment.id}, 用户ID: ${comment.user_id}, 内容: "${comment.content.substring(0, 30)}..."`);
      });
    }
    
  } catch (error) {
    console.error('❌ 查询失败:', error);
  } finally {
    db.close();
  }
}

// 运行调试
debugAPIQueries();