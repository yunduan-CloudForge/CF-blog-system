// 测试前端API调用
const http = require('http');

// 模拟前端API调用
function testFrontendAPI() {
  console.log('=== 测试前端API调用 ===\n');
  
  const options = {
    hostname: 'localhost',
    port: 3001,
    path: '/api/comments?article_id=2',
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
        console.log('响应成功:', response.success);
        console.log('消息:', response.message);
        
        if (response.success && response.data) {
          const { comments, pagination } = response.data;
          
          console.log('\n=== 评论数据分析 ===');
          console.log('总评论数:', comments.length);
          console.log('分页信息:', pagination);
          
          comments.forEach((comment, index) => {
            console.log(`\n评论 ${index + 1}:`);
            console.log(`  ID: ${comment.id}`);
            console.log(`  内容: "${comment.content}"`);
            console.log(`  用户: ${comment.user?.username}`);
            console.log(`  parent_id: ${comment.parent_id}`);
            console.log(`  回复数量: ${comment.replies?.length || 0}`);
            
            if (comment.replies && comment.replies.length > 0) {
              console.log(`  回复列表:`);
              comment.replies.forEach((reply, replyIndex) => {
                console.log(`    回复 ${replyIndex + 1}:`);
                console.log(`      ID: ${reply.id}`);
                console.log(`      内容: "${reply.content}"`);
                console.log(`      用户: ${reply.user?.username}`);
                console.log(`      parent_id: ${reply.parent_id}`);
              });
            }
          });
          
          // 验证数据完整性
          console.log('\n=== 数据完整性验证 ===');
          const totalReplies = comments.reduce((sum, comment) => {
            return sum + (comment.replies?.length || 0);
          }, 0);
          
          console.log(`根评论数: ${comments.length}`);
          console.log(`嵌套回复总数: ${totalReplies}`);
          console.log(`总评论数 (根+回复): ${comments.length + totalReplies}`);
          
          // 检查是否有回复数据丢失
          if (totalReplies === 0 && pagination.total > comments.length) {
            console.log('⚠️  警告: 可能存在回复数据丢失！');
            console.log(`   分页显示总数: ${pagination.total}`);
            console.log(`   实际接收到的评论数: ${comments.length}`);
            console.log(`   嵌套回复数: ${totalReplies}`);
          } else if (totalReplies > 0) {
            console.log('✅ 回复数据正常接收');
          }
          
        } else {
          console.log('❌ API响应失败或无数据');
          console.log('完整响应:', JSON.stringify(response, null, 2));
        }
        
      } catch (error) {
        console.error('解析响应失败:', error);
        console.log('原始响应:', data);
      }
    });
  });

  req.on('error', (error) => {
    console.error('请求失败:', error);
  });

  req.end();
}

testFrontendAPI();