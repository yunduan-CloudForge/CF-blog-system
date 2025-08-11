const http = require('http');

// 模拟前端数据处理流程
class FrontendDataFlow {
  constructor() {
    this.commentsByArticle = {};
  }

  // 模拟API调用
  async fetchCommentsFromAPI(articleId) {
    console.log('\n=== 1. 从API获取数据 ===');
    
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'localhost',
        port: 3001,
        path: `/api/comments?article_id=${articleId}`,
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
            console.log('API响应状态:', res.statusCode);
            console.log('API返回数据结构:', {
              success: response.success,
              dataKeys: Object.keys(response.data || {}),
              commentsType: Array.isArray(response.data?.comments) ? 'array' : typeof response.data?.comments,
              commentsLength: response.data?.comments?.length || 'N/A'
            });
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

  // 模拟commentStore的buildCommentTree函数
  buildCommentTree(comments) {
    console.log('\n=== 2. commentStore.buildCommentTree ===');
    console.log('输入评论数据:', comments.length, '条');
    
    const commentMap = new Map();
    const rootComments = [];
    
    // 创建评论映射
    comments.forEach(comment => {
      commentMap.set(comment.id, { ...comment, replies: [] });
    });
    
    // 构建树结构
    comments.forEach(comment => {
      const commentWithReplies = commentMap.get(comment.id);
      
      if (comment.parent_id === null) {
        rootComments.push(commentWithReplies);
      } else {
        const parent = commentMap.get(comment.parent_id);
        if (parent) {
          parent.replies.push(commentWithReplies);
        }
      }
    });
    
    console.log('构建的树结构:', {
      rootCommentsCount: rootComments.length,
      rootComments: rootComments.map(c => ({
        id: c.id,
        content: c.content.substring(0, 20) + '...',
        repliesCount: c.replies?.length || 0
      }))
    });
    
    return rootComments;
  }

  // 模拟CommentList的ensureCommentTree函数
  ensureCommentTree(comments) {
    console.log('\n=== 3. CommentList.ensureCommentTree ===');
    console.log('输入数据:', {
      length: comments.length,
      firstCommentStructure: comments[0] ? {
        id: comments[0].id,
        parent_id: comments[0].parent_id,
        hasReplies: Array.isArray(comments[0].replies),
        repliesCount: comments[0].replies?.length || 0
      } : null
    });
    
    if (!comments || comments.length === 0) {
      return [];
    }
    
    // 检查是否已经是正确的树结构
    const hasProperTreeStructure = comments.length > 0 && 
      comments.every(c => c.parent_id === null) && 
      comments.every(c => Array.isArray(c.replies));
    
    console.log('树结构检查:', {
      hasProperTreeStructure,
      allRootComments: comments.every(c => c.parent_id === null),
      allHaveRepliesArray: comments.every(c => Array.isArray(c.replies))
    });
    
    if (hasProperTreeStructure) {
      console.log('✅ 使用已有的树结构');
      return comments;
    }
    
    console.log('❌ 重新构建树结构');
    // 重新构建树结构的逻辑...
    return this.buildCommentTree(comments);
  }

  // 模拟完整的数据流
  async simulateFullFlow(articleId) {
    try {
      // 1. API调用
      const apiResponse = await this.fetchCommentsFromAPI(articleId);
      
      if (!apiResponse.success) {
        console.log('❌ API调用失败:', apiResponse.message);
        return;
      }
      
      const { comments, pagination } = apiResponse.data;
      
      // 2. commentStore处理
      const storeComments = this.buildCommentTree(comments);
      
      // 3. CommentList处理
      const finalComments = this.ensureCommentTree(storeComments);
      
      console.log('\n=== 4. 最终结果 ===');
      console.log('最终评论数据:', {
        rootCommentsCount: finalComments.length,
        totalRepliesCount: finalComments.reduce((total, comment) => {
          const countReplies = (c) => {
            let count = c.replies?.length || 0;
            c.replies?.forEach(reply => {
              count += countReplies(reply);
            });
            return count;
          };
          return total + countReplies(comment);
        }, 0)
      });
      
      // 详细显示每个根评论及其回复
      finalComments.forEach((comment, index) => {
        console.log(`根评论 ${index + 1}:`, {
          id: comment.id,
          content: comment.content.substring(0, 30) + '...',
          repliesCount: comment.replies?.length || 0,
          replies: comment.replies?.map(r => ({
            id: r.id,
            content: r.content.substring(0, 20) + '...'
          })) || []
        });
      });
      
    } catch (error) {
      console.error('❌ 数据流模拟失败:', error.message);
    }
  }
}

// 运行测试
const flowDebugger = new FrontendDataFlow();
flowDebugger.simulateFullFlow(1);