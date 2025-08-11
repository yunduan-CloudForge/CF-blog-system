const http = require('http');
const https = require('https');
const { URL } = require('url');

// 配置
const API_BASE_URL = 'http://localhost:3001/api';
const TEST_USER = {
  email: 'test@example.com',
  password: 'test123'
};

// HTTP请求工具函数
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === 'https:';
    const httpModule = isHttps ? https : http;
    
    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    };
    
    const req = httpModule.request(requestOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve({ status: res.statusCode, data: jsonData, headers: res.headers });
        } catch (e) {
          resolve({ status: res.statusCode, data: data, headers: res.headers });
        }
      });
    });
    
    req.on('error', reject);
    
    if (options.body) {
      req.write(options.body);
    }
    
    req.end();
  });
}

// 模拟前端状态管理
class MockCommentStore {
  constructor() {
    this.commentsByArticle = {};
    this.token = null;
  }
  
  // 模拟登录
  async login(email, password) {
    try {
      const response = await makeRequest(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });
      
      if (response.status === 200) {
        this.token = response.data.data.token;
        console.log('✅ 登录成功，获取到token');
        return true;
      } else {
        console.log('❌ 登录失败:', response.data.message);
        return false;
      }
    } catch (error) {
      console.log('❌ 登录错误:', error.message);
      return false;
    }
  }
  
  // 获取评论列表
  async fetchComments(articleId) {
    try {
      const response = await makeRequest(`${API_BASE_URL}/comments?article_id=${articleId}`);
      
      if (response.status === 200) {
        const { comments } = response.data.data;
        const commentTree = this.buildCommentTree(comments);
        this.commentsByArticle[articleId] = commentTree;
        console.log(`✅ 获取文章${articleId}的评论成功，共${comments.length}条`);
        return commentTree;
      } else {
        console.log('❌ 获取评论失败:', response.data.message);
        return [];
      }
    } catch (error) {
      console.log('❌ 获取评论错误:', error.message);
      return [];
    }
  }
  
  // 回复评论
  async replyToComment(articleId, parentId, content) {
    if (!this.token) {
      console.log('❌ 未登录，无法回复');
      return null;
    }
    
    try {
      const response = await makeRequest(`${API_BASE_URL}/comments/${parentId}/reply`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.token}`
        },
        body: JSON.stringify({ content })
      });
      
      if (response.status === 201) {
        const newReply = response.data.data.comment;
        console.log('✅ 回复API调用成功，返回数据:', newReply);
        
        // 更新本地状态
        const articleComments = this.commentsByArticle[articleId] || [];
        const updatedComments = this.addReplyToTree(articleComments, parentId, newReply);
        this.commentsByArticle[articleId] = updatedComments;
        
        console.log('✅ 本地状态更新完成');
        return newReply;
      } else {
        console.log('❌ 回复失败:', response.data.message);
        return null;
      }
    } catch (error) {
      console.log('❌ 回复错误:', error.message);
      return null;
    }
  }
  
  // 构建评论树
  buildCommentTree(comments) {
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
    
    return rootComments;
  }
  
  // 添加回复到树
  addReplyToTree(comments, parentId, newReply) {
    return comments.map(comment => {
      if (comment.id === parentId) {
        return {
          ...comment,
          replies: [...(comment.replies || []), newReply]
        };
      }
      if (comment.replies && comment.replies.length > 0) {
        return {
          ...comment,
          replies: this.addReplyToTree(comment.replies, parentId, newReply)
        };
      }
      return comment;
    });
  }
  
  // 验证回复是否存在
  verifyReplyExists(articleId, parentId, replyContent) {
    const comments = this.commentsByArticle[articleId] || [];
    
    const findReply = (commentList) => {
      for (const comment of commentList) {
        if (comment.id === parentId && comment.replies) {
          return comment.replies.find(reply => reply.content === replyContent);
        }
        if (comment.replies && comment.replies.length > 0) {
          const found = findReply(comment.replies);
          if (found) return found;
        }
      }
      return null;
    };
    
    return findReply(comments);
  }
}

// 主测试函数
async function testE2EReply() {
  console.log('=== 端到端回复测试 ===\n');
  
  const store = new MockCommentStore();
  const articleId = 1;
  const replyContent = `测试回复 - ${new Date().toISOString()}`;
  
  // 1. 登录
  console.log('1. 执行登录...');
  const loginSuccess = await store.login(TEST_USER.email, TEST_USER.password);
  if (!loginSuccess) {
    console.log('❌ 测试终止：登录失败');
    return;
  }
  
  // 2. 获取评论列表
  console.log('\n2. 获取评论列表...');
  const comments = await store.fetchComments(articleId);
  if (comments.length === 0) {
    console.log('❌ 测试终止：没有评论可回复');
    return;
  }
  
  console.log('当前评论结构:');
  console.log(JSON.stringify(comments, null, 2));
  
  // 3. 找到第一个根评论进行回复
  const parentComment = comments[0];
  if (!parentComment) {
    console.log('❌ 测试终止：找不到父评论');
    return;
  }
  
  console.log(`\n3. 对评论ID ${parentComment.id} 进行回复...`);
  console.log('回复内容:', replyContent);
  
  // 4. 发送回复
  const newReply = await store.replyToComment(articleId, parentComment.id, replyContent);
  if (!newReply) {
    console.log('❌ 测试终止：回复失败');
    return;
  }
  
  // 5. 验证本地状态
  console.log('\n4. 验证本地状态...');
  const localReply = store.verifyReplyExists(articleId, parentComment.id, replyContent);
  if (localReply) {
    console.log('✅ 本地状态验证成功，找到新回复:', localReply.content);
  } else {
    console.log('❌ 本地状态验证失败，未找到新回复');
  }
  
  // 6. 重新获取评论验证持久化
  console.log('\n5. 重新获取评论验证持久化...');
  const refreshedComments = await store.fetchComments(articleId);
  
  // 在刷新的评论中查找回复
  const persistedReply = store.verifyReplyExists(articleId, parentComment.id, replyContent);
  if (persistedReply) {
    console.log('✅ 数据持久化验证成功，回复已保存到数据库');
    console.log('持久化的回复:', persistedReply.content);
  } else {
    console.log('❌ 数据持久化验证失败，回复未保存到数据库');
  }
  
  console.log('\n刷新后的评论结构:');
  console.log(JSON.stringify(refreshedComments, null, 2));
  
  console.log('\n=== 测试完成 ===');
}

// 运行测试
testE2EReply().catch(console.error);