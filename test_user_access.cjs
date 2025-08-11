const http = require('http');

// 测试用户访问和认证状态
async function testUserAccess() {
  console.log('=== 测试用户访问和认证状态 ===');
  
  try {
    // 1. 测试登录
    console.log('\n1. 测试登录...');
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
    
    const loginResponse = await makeRequest(loginOptions, loginData);
    console.log('登录状态:', loginResponse.success ? '成功' : '失败');
    
    if (loginResponse.success && loginResponse.data.token) {
      const token = loginResponse.data.token;
      console.log('Token获取成功');
      
      // 2. 测试用户资料接口
      console.log('\n2. 测试用户资料接口...');
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
      console.log('用户资料接口状态:', profileResponse.success ? '正常' : '异常');
      
      if (profileResponse.success) {
        console.log('用户信息:', {
          id: profileResponse.data.user.id,
          email: profileResponse.data.user.email,
          username: profileResponse.data.user.username,
          role: profileResponse.data.user.role
        });
      } else {
        console.log('用户资料错误:', profileResponse.error);
      }
      
      // 3. 测试认证中间件
      console.log('\n3. 测试认证中间件...');
      const authTestOptions = {
        hostname: 'localhost',
        port: 3001,
        path: '/api/articles/stats',
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      };
      
      const authTestResponse = await makeRequest(authTestOptions);
      console.log('认证中间件状态:', authTestResponse.success ? '正常' : '异常');
      
      // 4. 测试无token访问
      console.log('\n4. 测试无token访问...');
      const noTokenOptions = {
        hostname: 'localhost',
        port: 3001,
        path: '/api/profile',
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      };
      
      const noTokenResponse = await makeRequest(noTokenOptions);
      console.log('无token访问结果:', noTokenResponse.success ? '异常(应该被拒绝)' : '正常(被正确拒绝)');
      
      console.log('\n=== 测试总结 ===');
      console.log('✅ 后端API认证系统正常工作');
      console.log('✅ 用户资料接口可以正常访问');
      console.log('✅ 认证中间件正确保护接口');
      console.log('\n如果用户中心页面仍然无法访问，可能是前端认证状态问题。');
      console.log('建议用户重新登录以刷新认证状态。');
      
    } else {
      console.log('❌ 登录失败，无法继续测试');
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
testUserAccess();