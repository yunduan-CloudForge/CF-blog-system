const http = require('http');

// 测试评论API响应
function testCommentsAPI() {
  console.log('🔍 测试评论API响应...');
  
  const options = {
    hostname: 'localhost',
    port: 3001,
    path: '/api/comments?article_id=1', // 获取文章1的所有评论
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
        console.log(`📊 API响应状态: ${res.statusCode}`);
        
        if (res.statusCode === 200) {
          const comments = response.data || response;
          console.log(`📝 API返回评论数量: ${Array.isArray(comments) ? comments.length : '非数组格式'}`);
          
          if (Array.isArray(comments)) {
            // 分析评论结构
            const rootComments = comments.filter(comment => !comment.parent_id);
            const replies = comments.filter(comment => comment.parent_id);
            
            console.log(`📋 根评论: ${rootComments.length} 条`);
            console.log(`💬 回复评论: ${replies.length} 条`);
            
            if (replies.length > 0) {
              console.log('\n🔍 API返回的回复详情:');
              replies.forEach((reply, index) => {
                console.log(`${index + 1}. ID: ${reply.id}, 内容: "${reply.content}", 回复给: ${reply.parent_id}`);
              });
            }
            
            // 检查嵌套结构
            console.log('\n🌳 检查评论树结构:');
            comments.forEach(comment => {
              if (comment.replies && comment.replies.length > 0) {
                console.log(`评论 ${comment.id} 有 ${comment.replies.length} 个嵌套回复`);
              }
            });
          } else {
            console.log('📄 API返回格式:', JSON.stringify(response, null, 2));
          }
          
        } else {
          console.error('❌ API请求失败:', response);
        }
      } catch (error) {
        console.error('❌ 解析API响应失败:', error.message);
        console.log('原始响应:', data);
      }
    });
  });

  req.on('error', (error) => {
    console.error('❌ API请求错误:', error.message);
  });

  req.end();
}

// 延迟执行，确保服务器启动
setTimeout(testCommentsAPI, 1000);

console.log('⏳ 等待服务器启动...');