const http = require('http');
const { URL } = require('url');

// 配置
const API_BASE_URL = 'http://localhost:3001/api';

// HTTP请求工具函数
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === 'https:';
    const httpModule = isHttps ? require('https') : http;
    
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

// 测试API直接调用
async function testApiDirect() {
  console.log('=== 直接测试API ===\n');
  
  try {
    // 1. 测试获取文章1的评论
    console.log('1. 获取文章1的评论...');
    const response = await makeRequest(`${API_BASE_URL}/comments?article_id=1`);
    
    console.log('响应状态:', response.status);
    console.log('响应数据:', JSON.stringify(response.data, null, 2));
    
    if (response.status === 200 && response.data.success) {
      const { comments, pagination } = response.data.data;
      console.log(`\n评论数量: ${comments.length}`);
      console.log(`分页信息:`, pagination);
      
      // 分析评论结构
      console.log('\n评论结构分析:');
      comments.forEach((comment, index) => {
        console.log(`评论 ${index + 1}:`);
        console.log(`  - ID: ${comment.id}`);
        console.log(`  - 内容: "${comment.content}"`);
        console.log(`  - 用户: ${comment.user.username}`);
        console.log(`  - 父评论: ${comment.parent_id || 'null'}`);
        console.log(`  - 回复数量: ${comment.replies ? comment.replies.length : 0}`);
        
        if (comment.replies && comment.replies.length > 0) {
          console.log(`  - 回复列表:`);
          comment.replies.forEach((reply, replyIndex) => {
            console.log(`    回复 ${replyIndex + 1}: ID ${reply.id}, 内容: "${reply.content}", 用户: ${reply.user.username}`);
          });
        }
        console.log('');
      });
      
      // 统计回复总数
      let totalReplies = 0;
      comments.forEach(comment => {
        if (comment.replies) {
          totalReplies += comment.replies.length;
        }
      });
      console.log(`总回复数: ${totalReplies}`);
      
    } else {
      console.log('❌ 获取评论失败');
    }
    
  } catch (error) {
    console.error('测试失败:', error.message);
  }
}

// 运行测试
testApiDirect();