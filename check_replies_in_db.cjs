const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// 连接到数据库
const dbPath = path.join(__dirname, 'blog.db');
const db = new sqlite3.Database(dbPath);

console.log('🔍 检查数据库中的回复记录...');

// 首先检查表结构
db.all("PRAGMA table_info(comments)", [], (err, columns) => {
  if (err) {
    console.error('❌ 获取表结构失败:', err.message);
    return;
  }
  
  console.log('📋 comments表结构:');
  columns.forEach(col => {
    console.log(`  - ${col.name}: ${col.type}`);
  });
  
  // 查询所有评论记录
  db.all(`
    SELECT 
      id,
      content,
      parent_id,
      article_id,
      user_id,
      created_at
    FROM comments 
    ORDER BY created_at ASC
  `, [], (err, rows) => {
  if (err) {
    console.error('❌ 查询失败:', err.message);
    return;
  }

  console.log(`\n📊 数据库中总共有 ${rows.length} 条评论记录`);
  
  // 分类统计
  const rootComments = rows.filter(row => !row.parent_id);
  const replies = rows.filter(row => row.parent_id);
  
  console.log(`📝 根评论: ${rootComments.length} 条`);
  console.log(`💬 回复评论: ${replies.length} 条`);
  
  if (replies.length > 0) {
    console.log('\n🔍 回复详情:');
    replies.forEach((reply, index) => {
      console.log(`${index + 1}. ID: ${reply.id}, 内容: "${reply.content}", 回复给: ${reply.parent_id}, 用户ID: ${reply.user_id}, 时间: ${reply.created_at}`);
    });
  }
  
  if (rootComments.length > 0) {
    console.log('\n📋 根评论详情:');
    rootComments.forEach((comment, index) => {
      console.log(`${index + 1}. ID: ${comment.id}, 内容: "${comment.content}", 用户ID: ${comment.user_id}, 时间: ${comment.created_at}`);
    });
  }
  
  // 检查数据完整性
  console.log('\n🔧 数据完整性检查:');
  replies.forEach(reply => {
    const parentExists = rows.find(row => row.id === reply.parent_id);
    if (!parentExists) {
      console.log(`⚠️  回复 ${reply.id} 的父评论 ${reply.parent_id} 不存在`);
    }
  });
  
  db.close();
  });
});