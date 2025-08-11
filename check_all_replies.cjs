const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// 数据库路径
const dbPath = path.join(process.cwd(), 'blog.db');

class ReplyChecker {
  constructor() {
    this.db = new sqlite3.Database(dbPath);
  }

  // 检查所有评论和回复
  async checkAllComments() {
    return new Promise((resolve, reject) => {
      console.log('=== 检查数据库中的所有评论和回复 ===\n');
      
      const query = `
        SELECT 
          c.id,
          c.content,
          c.parent_id,
          c.article_id,
          c.created_at,
          u.username
        FROM comments c
        LEFT JOIN users u ON c.user_id = u.id
        ORDER BY c.article_id, c.parent_id IS NULL DESC, c.created_at ASC
      `;
      
      this.db.all(query, [], (err, rows) => {
        if (err) {
          reject(err);
          return;
        }
        
        console.log(`总共找到 ${rows.length} 条评论记录:\n`);
        
        // 按文章分组
        const articleGroups = {};
        rows.forEach(row => {
          if (!articleGroups[row.article_id]) {
            articleGroups[row.article_id] = {
              topLevel: [],
              replies: []
            };
          }
          
          if (row.parent_id === null) {
            articleGroups[row.article_id].topLevel.push(row);
          } else {
            articleGroups[row.article_id].replies.push(row);
          }
        });
        
        // 显示每篇文章的评论统计
        Object.keys(articleGroups).forEach(articleId => {
          const group = articleGroups[articleId];
          console.log(`文章 ${articleId}:`);
          console.log(`  顶级评论: ${group.topLevel.length} 条`);
          console.log(`  回复评论: ${group.replies.length} 条`);
          console.log(`  总计: ${group.topLevel.length + group.replies.length} 条\n`);
          
          // 显示详细信息
          group.topLevel.forEach(comment => {
            console.log(`  📝 顶级评论 ${comment.id}: "${comment.content.substring(0, 30)}..." (${comment.username})`);
            
            // 显示这条评论的回复
            const replies = group.replies.filter(reply => reply.parent_id === comment.id);
            replies.forEach(reply => {
              console.log(`    💬 回复 ${reply.id}: "${reply.content.substring(0, 30)}..." (${reply.username})`);
            });
          });
          
          // 显示孤立的回复（parent_id指向不存在的评论）
          const orphanReplies = group.replies.filter(reply => {
            return !group.topLevel.some(comment => comment.id === reply.parent_id) &&
                   !group.replies.some(comment => comment.id === reply.parent_id);
          });
          
          if (orphanReplies.length > 0) {
            console.log(`  ⚠️  孤立回复 (parent_id指向不存在的评论): ${orphanReplies.length} 条`);
            orphanReplies.forEach(reply => {
              console.log(`    🔗 回复 ${reply.id} -> parent_id: ${reply.parent_id} (不存在)`);
            });
          }
          
          console.log('');
        });
        
        resolve(rows);
      });
    });
  }

  // 检查特定文章的评论
  async checkArticleComments(articleId) {
    return new Promise((resolve, reject) => {
      console.log(`=== 检查文章 ${articleId} 的评论详情 ===\n`);
      
      const query = `
        SELECT 
          c.id,
          c.content,
          c.parent_id,
          c.user_id,
          c.created_at,
          c.updated_at,
          c.likes,
          u.username,
          u.role
        FROM comments c
        LEFT JOIN users u ON c.user_id = u.id
        WHERE c.article_id = ?
        ORDER BY c.parent_id IS NULL DESC, c.created_at ASC
      `;
      
      this.db.all(query, [articleId], (err, rows) => {
        if (err) {
          reject(err);
          return;
        }
        
        console.log(`文章 ${articleId} 共有 ${rows.length} 条评论:\n`);
        
        const topLevel = rows.filter(row => row.parent_id === null);
        const replies = rows.filter(row => row.parent_id !== null);
        
        console.log(`顶级评论: ${topLevel.length} 条`);
        console.log(`回复评论: ${replies.length} 条\n`);
        
        // 构建评论树
        const commentTree = topLevel.map(comment => {
          const commentReplies = replies.filter(reply => reply.parent_id === comment.id);
          return {
            ...comment,
            replies: commentReplies
          };
        });
        
        // 显示评论树
        commentTree.forEach(comment => {
          console.log(`📝 评论 ${comment.id} (${comment.username}):`);
          console.log(`   内容: "${comment.content}"`);
          console.log(`   创建时间: ${comment.created_at}`);
          console.log(`   点赞数: ${comment.likes}`);
          
          if (comment.replies.length > 0) {
            console.log(`   回复 (${comment.replies.length} 条):`);
            comment.replies.forEach(reply => {
              console.log(`     💬 回复 ${reply.id} (${reply.username}): "${reply.content}"`);
              console.log(`        时间: ${reply.created_at}`);
            });
          } else {
            console.log(`   回复: 无`);
          }
          console.log('');
        });
        
        resolve(commentTree);
      });
    });
  }

  // 关闭数据库连接
  close() {
    this.db.close();
  }
}

// 运行检查
async function runCheck() {
  const checker = new ReplyChecker();
  
  try {
    // 检查所有评论
    await checker.checkAllComments();
    
    // 检查文章1的评论（假设用户说的是文章1）
    console.log('\n' + '='.repeat(60));
    await checker.checkArticleComments(1);
    
    console.log('\n' + '='.repeat(60));
    console.log('检查完成！');
    
    if (process.argv.includes('--article-2')) {
      console.log('\n检查文章2的评论:');
      await checker.checkArticleComments(2);
    }
    
  } catch (error) {
    console.error('检查失败:', error);
  } finally {
    checker.close();
  }
}

runCheck();