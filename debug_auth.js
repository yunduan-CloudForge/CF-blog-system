// 调试认证问题的脚本
import fetch from 'node-fetch';

// 模拟前端发送的请求
async function testArticleDelete() {
  console.log('测试文章删除API...');
  
  // 首先登录获取token
  try {
    const loginResponse = await fetch('http://localhost:3001/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: 'admin@example.com',
        password: 'admin123'
      })
    });
    
    const loginData = await loginResponse.json();
    console.log('登录响应:', loginData);
    
    if (!loginData.success) {
      console.log('登录失败，无法测试删除功能');
      return;
    }
    
    const token = loginData.data.token;
    console.log('获取到token:', token.substring(0, 20) + '...');
    
    // 测试删除文章
    const deleteResponse = await fetch('http://localhost:3001/api/articles/1', {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    const deleteData = await deleteResponse.json();
    console.log('删除响应状态:', deleteResponse.status);
    console.log('删除响应:', deleteData);
    
  } catch (error) {
    console.error('测试失败:', error);
  }
}

testArticleDelete();