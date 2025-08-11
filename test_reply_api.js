import fetch from 'node-fetch';

// 测试回复API的脚本
const API_BASE_URL = 'http://localhost:3001/api';

// 测试用户凭据（需要确保这个用户存在）
const TEST_USER = {
  email: 'test@example.com',
  password: 'test123'
};

async function loginAndGetToken() {
  console.log('正在登录获取认证token...');
  
  try {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(TEST_USER)
    });
    
    const data = await response.json();
    console.log('登录响应:', JSON.stringify(data, null, 2));
    
    if (data.success && data.data.token) {
      console.log('✅ 登录成功，获取到token');
      return data.data.token;
    } else {
      console.log('❌ 登录失败:', data.message);
      return null;
    }
  } catch (error) {
    console.error('❌ 登录请求失败:', error.message);
    return null;
  }
}

async function testReplyAPI() {
  console.log('=== 测试回复API端点 ===\n');
  
  try {
    // 1. 先登录获取token
    const token = await loginAndGetToken();
    if (!token) {
      console.log('无法获取认证token，测试终止');
      return;
    }
    
    // 2. 获取现有评论
    console.log('\n1. 获取文章1的评论...');
    const commentsResponse = await fetch(`${API_BASE_URL}/comments?article_id=1`);
    const commentsData = await commentsResponse.json();
    
    console.log('评论响应状态:', commentsResponse.status);
    console.log('评论数据:', JSON.stringify(commentsData, null, 2));
    
    let parentCommentId;
    
    if (!commentsData.success || !commentsData.data.comments.length) {
      console.log('\n没有找到评论，先创建一个评论...');
      
      // 创建一个评论用于测试回复
      const createCommentResponse = await fetch(`${API_BASE_URL}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          content: '这是一个测试评论，用于测试回复功能',
          article_id: 1
        })
      });
      
      const createCommentData = await createCommentResponse.json();
      console.log('创建评论响应:', JSON.stringify(createCommentData, null, 2));
      
      if (!createCommentData.success) {
        console.error('创建评论失败，无法继续测试回复');
        return;
      }
      
      parentCommentId = createCommentData.data.comment.id;
    } else {
      // 使用第一个评论的ID
      parentCommentId = commentsData.data.comments[0].id;
    }
    
    console.log(`\n2. 对评论ID ${parentCommentId} 进行回复...`);
    
    // 3. 测试回复API
    const replyContent = `这是对评论${parentCommentId}的回复测试 - ${new Date().toISOString()}`;
    const replyResponse = await fetch(`${API_BASE_URL}/comments/${parentCommentId}/reply`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        content: replyContent
      })
    });
    
    console.log('回复响应状态:', replyResponse.status);
    console.log('回复响应头:', Object.fromEntries(replyResponse.headers.entries()));
    
    const replyData = await replyResponse.json();
    console.log('回复响应数据:', JSON.stringify(replyData, null, 2));
    
    // 4. 验证回复是否成功
    if (replyData.success) {
      console.log('\n✅ 回复API测试成功!');
      console.log('新回复ID:', replyData.data.comment.id);
      console.log('回复内容:', replyData.data.comment.content);
      console.log('父评论ID:', replyData.data.comment.parent_id);
      
      // 5. 再次获取评论验证数据是否持久化
      console.log('\n3. 重新获取评论验证数据持久化...');
      const verifyResponse = await fetch(`${API_BASE_URL}/comments?article_id=1`);
      const verifyData = await verifyResponse.json();
      
      console.log('验证响应状态:', verifyResponse.status);
      console.log('验证数据:', JSON.stringify(verifyData, null, 2));
      
      // 检查回复是否存在
      const allComments = verifyData.data.comments;
      const replyExists = allComments.some(comment => 
        comment.parent_id === parentCommentId && 
        comment.content === replyContent
      );
      
      if (replyExists) {
        console.log('\n✅ 数据持久化验证成功! 回复数据已保存到数据库');
      } else {
        console.log('\n❌ 数据持久化验证失败! 回复数据未找到');
        console.log('查找条件: parent_id =', parentCommentId, ', content =', replyContent);
        console.log('实际评论:', allComments.map(c => ({ id: c.id, parent_id: c.parent_id, content: c.content })));
      }
    } else {
      console.log('\n❌ 回复API测试失败!');
      console.log('错误信息:', replyData.message);
    }
    
  } catch (error) {
    console.error('\n❌ 测试过程中发生错误:', error.message);
    console.error('错误详情:', error);
  }
}

// 运行测试
testReplyAPI();