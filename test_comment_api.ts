// 测试评论API是否正确返回嵌套数据

async function testCommentAPI() {
  console.log('=== 测试评论API返回数据 ===\n');
  
  try {
    // 测试获取文章1的评论
    console.log('1. 测试获取文章1的评论API:');
    const response = await fetch('http://localhost:3001/api/comments?article_id=1&page=1&limit=20&sort=created_at&order=desc');
    
    if (!response.ok) {
      console.error(`❌ API请求失败: ${response.status} ${response.statusText}`);
      return;
    }
    
    const data = await response.json();
    console.log('✅ API响应成功');
    console.log('响应状态:', data.success);
    console.log('响应消息:', data.message);
    
    if (data.success && data.data) {
      const { comments, pagination } = data.data;
      console.log(`\n评论数据结构:`);
      console.log(`- 顶级评论数量: ${comments.length}`);
      console.log(`- 分页信息: 第${pagination.page}页，共${pagination.totalPages}页，总计${pagination.total}条`);
      
      // 分析评论结构
      comments.forEach((comment: any, index: number) => {
        console.log(`\n顶级评论 ${index + 1}:`);
        console.log(`  ID: ${comment.id}`);
        console.log(`  内容: "${comment.content}"`);
        console.log(`  用户: ${comment.user?.username}`);
        console.log(`  parent_id: ${comment.parent_id}`);
        console.log(`  回复数量: ${comment.replies ? comment.replies.length : 0}`);
        
        if (comment.replies && comment.replies.length > 0) {
          console.log(`  回复列表:`);
          comment.replies.forEach((reply: any, replyIndex: number) => {
            console.log(`    回复 ${replyIndex + 1}:`);
            console.log(`      ID: ${reply.id}`);
            console.log(`      内容: "${reply.content}"`);
            console.log(`      用户: ${reply.user?.username}`);
            console.log(`      parent_id: ${reply.parent_id}`);
            console.log(`      创建时间: ${reply.created_at}`);
          });
        }
      });
      
      // 检查数据完整性
      console.log('\n2. 数据完整性检查:');
      let totalReplies = 0;
      let hasNestedStructure = false;
      
      comments.forEach((comment: any) => {
        if (comment.replies && comment.replies.length > 0) {
          hasNestedStructure = true;
          totalReplies += comment.replies.length;
        }
      });
      
      console.log(`- 是否有嵌套结构: ${hasNestedStructure ? '✅ 是' : '❌ 否'}`);
      console.log(`- 总回复数量: ${totalReplies}`);
      
      if (!hasNestedStructure) {
        console.log('❌ 警告: API返回的数据没有嵌套结构，可能存在问题！');
      }
      
    } else {
      console.error('❌ API返回数据格式错误:', data);
    }
    
    // 测试获取文章2的评论（有更多回复的文章）
    console.log('\n3. 测试获取文章2的评论API:');
    const response2 = await fetch('http://localhost:3001/api/comments?article_id=2&page=1&limit=20&sort=created_at&order=desc');
    
    if (response2.ok) {
      const data2 = await response2.json();
      console.log('✅ 文章2 API响应成功');
      
      if (data2.success && data2.data) {
        const { comments } = data2.data;
        console.log(`文章2评论数量: ${comments.length}`);
        
        let article2Replies = 0;
        comments.forEach((comment: any) => {
          if (comment.replies) {
            article2Replies += comment.replies.length;
          }
        });
        console.log(`文章2回复数量: ${article2Replies}`);
      }
    } else {
      console.log('文章2可能没有评论或不存在');
    }
    
  } catch (error) {
    console.error('❌ 测试过程中出错:', error);
  }
}

// 运行测试
testCommentAPI().catch(console.error);