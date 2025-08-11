const http = require('http');

// 测试前端渲染逻辑
class FrontendRenderingDebugger {
  constructor() {
    this.comments = [];
  }

  // 获取API数据
  async fetchAPIData() {
    console.log('=== 1. 获取API数据 ===');
    
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'localhost',
        port: 3001,
        path: '/api/comments?article_id=1',
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      };

      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            console.log('API响应:', {
              success: response.success,
              commentsCount: response.data?.comments?.length || 0
            });
            
            if (response.success && response.data?.comments) {
              this.comments = response.data.comments;
              console.log('获取到的评论数据:');
              this.comments.forEach((comment, index) => {
                console.log(`  ${index + 1}. 根评论 ID: ${comment.id}`);
                console.log(`     内容: ${comment.content.substring(0, 30)}...`);
                console.log(`     回复数量: ${comment.replies?.length || 0}`);
                if (comment.replies && comment.replies.length > 0) {
                  comment.replies.forEach((reply, replyIndex) => {
                    console.log(`       ${replyIndex + 1}. 回复 ID: ${reply.id}`);
                    console.log(`          内容: ${reply.content.substring(0, 30)}...`);
                  });
                }
              });
            }
            resolve(response);
          } catch (error) {
            reject(error);
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.end();
    });
  }

  // 模拟CommentList的ensureCommentTree函数
  ensureCommentTree(comments) {
    console.log('\n=== 2. CommentList.ensureCommentTree 处理 ===');
    
    if (!comments || comments.length === 0) {
      console.log('❌ 没有评论数据');
      return [];
    }
    
    console.log('输入数据检查:');
    console.log(`  评论数量: ${comments.length}`);
    
    // 检查是否已经是正确的树结构
    const hasProperTreeStructure = comments.length > 0 && 
      comments.every(c => c.parent_id === null) && 
      comments.every(c => Array.isArray(c.replies));
    
    console.log('树结构验证:');
    console.log(`  所有评论都是根评论: ${comments.every(c => c.parent_id === null)}`);
    console.log(`  所有评论都有replies数组: ${comments.every(c => Array.isArray(c.replies))}`);
    console.log(`  树结构正确: ${hasProperTreeStructure}`);
    
    if (hasProperTreeStructure) {
      console.log('✅ 使用已有的树结构');
      return comments;
    } else {
      console.log('❌ 需要重新构建树结构');
      return this.buildCommentTree(comments);
    }
  }

  // 模拟渲染过程
  simulateRendering(comments) {
    console.log('\n=== 3. 模拟渲染过程 ===');
    
    if (!comments || comments.length === 0) {
      console.log('❌ 没有评论可渲染');
      return;
    }
    
    console.log('渲染统计:');
    let totalRendered = 0;
    let totalRepliesRendered = 0;
    
    comments.forEach((comment, index) => {
      console.log(`\n渲染根评论 ${index + 1}:`);
      console.log(`  ID: ${comment.id}`);
      console.log(`  内容: ${comment.content.substring(0, 50)}...`);
      totalRendered++;
      
      if (comment.replies && comment.replies.length > 0) {
        console.log(`  渲染 ${comment.replies.length} 条回复:`);
        comment.replies.forEach((reply, replyIndex) => {
          console.log(`    ${replyIndex + 1}. 回复 ID: ${reply.id}`);
          console.log(`       内容: ${reply.content.substring(0, 40)}...`);
          totalRepliesRendered++;
        });
      } else {
        console.log('  ❌ 没有回复数据');
      }
    });
    
    console.log('\n渲染总结:');
    console.log(`  根评论渲染数量: ${totalRendered}`);
    console.log(`  回复渲染数量: ${totalRepliesRendered}`);
    console.log(`  总渲染数量: ${totalRendered + totalRepliesRendered}`);
  }

  // 检查可能的问题
  checkPotentialIssues(comments) {
    console.log('\n=== 4. 检查潜在问题 ===');
    
    if (!comments || comments.length === 0) {
      console.log('❌ 主要问题: 没有评论数据');
      return;
    }
    
    let issues = [];
    
    comments.forEach((comment, index) => {
      // 检查回复数据
      if (!comment.replies) {
        issues.push(`根评论 ${comment.id} 缺少 replies 属性`);
      } else if (!Array.isArray(comment.replies)) {
        issues.push(`根评论 ${comment.id} 的 replies 不是数组`);
      } else if (comment.replies.length === 0) {
        issues.push(`根评论 ${comment.id} 的 replies 数组为空`);
      }
      
      // 检查用户信息
      if (!comment.user) {
        issues.push(`根评论 ${comment.id} 缺少用户信息`);
      }
      
      // 检查回复的结构
      if (comment.replies && Array.isArray(comment.replies)) {
        comment.replies.forEach((reply, replyIndex) => {
          if (!reply.user) {
            issues.push(`回复 ${reply.id} 缺少用户信息`);
          }
          if (reply.parent_id !== comment.id) {
            issues.push(`回复 ${reply.id} 的 parent_id (${reply.parent_id}) 与父评论 ID (${comment.id}) 不匹配`);
          }
        });
      }
    });
    
    if (issues.length === 0) {
      console.log('✅ 没有发现明显问题');
    } else {
      console.log('❌ 发现以下问题:');
      issues.forEach((issue, index) => {
        console.log(`  ${index + 1}. ${issue}`);
      });
    }
  }

  // 运行完整调试
  async runFullDebug() {
    try {
      // 1. 获取API数据
      await this.fetchAPIData();
      
      // 2. 处理数据
      const processedComments = this.ensureCommentTree(this.comments);
      
      // 3. 模拟渲染
      this.simulateRendering(processedComments);
      
      // 4. 检查问题
      this.checkPotentialIssues(processedComments);
      
    } catch (error) {
      console.error('❌ 调试过程中出错:', error.message);
    }
  }
}

// 运行调试
const renderingDebugger = new FrontendRenderingDebugger();
renderingDebugger.runFullDebug();