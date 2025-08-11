const http = require('http');

// 测试用户中心访问流程
async function testUserCenter() {
  console.log('=== 测试用户中心访问流程 ===');
  
  // 1. 先登录获取有效token
  console.log('\n1. 登录获取token...');
  const loginData = JSON.stringify({
    email: 'admin@blog.com',
    password: 'admin123'
  });
  
  const loginOptions = {
    hostname: 'localhost',
    port: 3001,
    path: '/api/auth/login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(loginData)
    }
  };
  
  try {
    const loginResponse = await makeRequest(loginOptions, loginData);
    console.log('登录响应:', loginResponse);
    
    if (loginResponse.success && loginResponse.data.token) {
      const token = loginResponse.data.token;
      console.log('登录成功，获取到token');
      
      // 2. 使用token访问profile接口
      console.log('\n2. 访问用户资料接口...');
      const profileOptions = {
        hostname: 'localhost',
        port: 3001,
        path: '/api/profile',
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      };
      
      const profileResponse = await makeRequest(profileOptions);
      console.log('用户资料响应:', profileResponse);
      
      if (profileResponse.success) {
        console.log('\n✅ 用户中心API访问正常');
        console.log('用户信息:', profileResponse.data.user);
      } else {
        console.log('\n❌ 用户资料获取失败:', profileResponse.error);
      }
    } else {
      console.log('\n❌ 登录失败:', loginResponse.error || loginResponse.message);
    }
  } catch (error) {
    console.error('测试过程中出错:', error.message);
  }
}

// 封装HTTP请求
function makeRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        try {
          const parsedData = JSON.parse(responseData);
          resolve(parsedData);
        } catch (error) {
          reject(new Error('解析响应数据失败: ' + responseData));
        }
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    if (data) {
      req.write(data);
    }
    
    req.end();
  });
}

// 运行测试
testUserCenter();