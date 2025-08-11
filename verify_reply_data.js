import { initializeDatabase, query, get, run } from './api/database/connection.js';

// 验证回复数据的脚本
async function verifyReplyData() {
  console.log('=== 验证回复数据 ===\n');
  
  try {
    // 初始化数据库连接
    await initializeDatabase();
    
    // 1. 查看所有评论
    console.log('1. 所有评论数据:');
    const allComments = await query(`
      SELECT 
        c.id, c.content, c.user_id, c.article_id, c.parent_id, c.likes,
        c.created_at, c.updated_at,
        u.username
      FROM comments c
      JOIN users u ON c.user_id = u.id
      ORDER BY c.created_at DESC
    `);
    
    console.log(`共找到 ${allComments.length} 条评论:`);
    allComments.forEach(comment => {
      console.log(`- ID: ${comment.id}, 内容: "${comment.content}", 用户: ${comment.username}, 父评论: ${comment.parent_id || 'null'}, 文章: ${comment.article_id}`);
    });
    
    // 2. 查看文章1的评论结构
    console.log('\n2. 文章1的评论结构:');
    const article1Comments = allComments.filter(c => c.article_id === 1);
    console.log(`文章1共有 ${article1Comments.length} 条评论`);
    
    // 分别显示根评论和回复
    const rootComments = article1Comments.filter(c => c.parent_id === null);
    const replies = article1Comments.filter(c => c.parent_id !== null);
    
    console.log(`\n根评论 (${rootComments.length} 条):`);
    rootComments.forEach(comment => {
      console.log(`- ID: ${comment.id}, 内容: "${comment.content}", 用户: ${comment.username}`);
    });
    
    console.log(`\n回复 (${replies.length} 条):`);
    replies.forEach(reply => {
      console.log(`- ID: ${reply.id}, 内容: "${reply.content}", 用户: ${reply.username}, 回复给: ${reply.parent_id}`);
    });
    
    // 3. 构建树形结构验证
    console.log('\n3. 构建树形结构:');
    const commentMap = new Map();
    const rootCommentsTree = [];
    
    // 初始化所有评论
    article1Comments.forEach(comment => {
      commentMap.set(comment.id, { ...comment, replies: [] });
    });
    
    // 构建树结构
    article1Comments.forEach(comment => {
      const commentWithReplies = commentMap.get(comment.id);
      
      if (comment.parent_id === null) {
        rootCommentsTree.push(commentWithReplies);
      } else {
        const parent = commentMap.get(comment.parent_id);
        if (parent) {
          parent.replies.push(commentWithReplies);
        }
      }
    });
    
    console.log('树形结构:');
    console.log(JSON.stringify(rootCommentsTree, null, 2));
    
    // 4. 检查最新的回复
    console.log('\n4. 最新的5条回复:');
    const latestReplies = replies.slice(0, 5);
    latestReplies.forEach(reply => {
      console.log(`- ID: ${reply.id}, 时间: ${reply.created_at}, 内容: "${reply.content}"`);
    });
    
    // 5. 验证特定回复是否存在
    console.log('\n5. 查找包含"测试回复"的评论:');
    const testReplies = allComments.filter(c => c.content.includes('测试回复'));
    console.log(`找到 ${testReplies.length} 条测试回复:`);
    testReplies.forEach(reply => {
      console.log(`- ID: ${reply.id}, 内容: "${reply.content}", 父评论: ${reply.parent_id}, 时间: ${reply.created_at}`);
    });
    
  } catch (error) {
    console.error('验证失败:', error.message);
  }
}

// 运行验证
verifyReplyData().catch(console.error);