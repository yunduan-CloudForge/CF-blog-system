const fetch = require('node-fetch');

// 模拟前端CommentList的完整渲染逻辑
async function debugCommentRendering() {
  try {
    console.log('=== 调试评论渲染逻辑 ===\n');
    
    // 1. 获取评论数据
    const response = await fetch('http://localhost:3001/api/comments?article_id=2');
    const data = await response.json();
    
    console.log('1. API响应状态:', response.status);
    console.log('2. API返回数据:', JSON.stringify(data, null, 2));
    
    if (!data.success || !data.data) {
      console.log('❌ API返回失败或无数据');
      return;
    }
    
    const comments = data.data.comments || [];
    console.log('\n3. 评论数据分析:');
    console.log('   - 总评论数:', comments.length);
    console.log('   - 分页信息:', data.data.pagination);
    
    // 2. 模拟ensureCommentTree函数
    function ensureCommentTree(comments) {
      console.log('\n=== ensureCommentTree 函数执行 ===');
      console.log('输入评论数量:', comments.length);
      
      // 检查是否已经是树形结构
      const hasProperTreeStructure = comments.some(comment => 
        comment.replies && Array.isArray(comment.replies) && comment.replies.length > 0
      );
      
      console.log('是否已有树形结构:', hasProperTreeStructure);
      
      if (hasProperTreeStructure) {
        console.log('✅ 数据已是树形结构，直接返回');
        return comments;
      }
      
      // 构建树形结构
      console.log('🔄 构建树形结构...');
      const commentMap = new Map();
      const rootComments = [];
      
      // 第一遍：创建所有评论的映射
      comments.forEach(comment => {
        commentMap.set(comment.id, { ...comment, replies: [] });
      });
      
      // 第二遍：构建父子关系
      comments.forEach(comment => {
        const commentWithReplies = commentMap.get(comment.id);
        
        if (comment.parent_id) {
          const parent = commentMap.get(comment.parent_id);
          if (parent) {
            parent.replies.push(commentWithReplies);
            console.log(`  - 评论 ${comment.id} 添加到父评论 ${comment.parent_id}`);
          } else {
            console.log(`  ⚠️ 评论 ${comment.id} 的父评论 ${comment.parent_id} 不存在`);
            rootComments.push(commentWithReplies);
          }
        } else {
          rootComments.push(commentWithReplies);
          console.log(`  - 评论 ${comment.id} 是根评论`);
        }
      });
      
      console.log('构建完成，根评论数量:', rootComments.length);
      return rootComments;
    }
    
    // 3. 处理评论数据
    const processedComments = ensureCommentTree(comments);
    
    console.log('\n4. 处理后的评论结构:');
    processedComments.forEach((comment, index) => {
      console.log(`根评论 ${index + 1}: ID=${comment.id}, 回复数=${comment.replies?.length || 0}`);
      if (comment.replies && comment.replies.length > 0) {
        comment.replies.forEach((reply, replyIndex) => {
          console.log(`  回复 ${replyIndex + 1}: ID=${reply.id}, 父ID=${reply.parent_id}`);
        });
      }
    });
    
    // 4. 模拟renderComment函数的渲染逻辑
    console.log('\n=== 模拟渲染逻辑 ===');
    const maxDepth = 10; // ArticleDetail中传入的值
    const collapsedThreads = new Set(); // 初始为空
    
    function simulateRenderComment(comment, depth = 0, path = '') {
      const isCollapsed = collapsedThreads.has(comment.id);
      const hasReplies = comment.replies && comment.replies.length > 0;
      const canNest = depth < maxDepth;
      
      const currentPath = path ? `${path} > ${comment.id}` : `${comment.id}`;
      
      console.log(`\n渲染评论 ${currentPath}:`);
      console.log(`  - 深度: ${depth}`);
      console.log(`  - 有回复: ${hasReplies}`);
      console.log(`  - 回复数量: ${comment.replies?.length || 0}`);
      console.log(`  - 是否折叠: ${isCollapsed}`);
      console.log(`  - 可以嵌套: ${canNest} (depth ${depth} < maxDepth ${maxDepth})`);
      console.log(`  - 渲染条件: hasReplies(${hasReplies}) && !isCollapsed(${!isCollapsed}) && canNest(${canNest})`);
      console.log(`  - 是否渲染回复: ${hasReplies && !isCollapsed && canNest}`);
      
      // 如果满足渲染回复的条件
      if (hasReplies && !isCollapsed && canNest) {
        console.log(`  ✅ 渲染 ${comment.replies.length} 条回复:`);
        comment.replies.forEach((reply, index) => {
          console.log(`    回复 ${index + 1}: ID=${reply.id}`);
          simulateRenderComment(reply, depth + 1, currentPath);
        });
      } else if (hasReplies && !isCollapsed && !canNest) {
        console.log(`  📋 显示"查看回复"按钮 (深度超限)`);
      } else if (hasReplies && isCollapsed) {
        console.log(`  📁 回复已折叠`);
      } else {
        console.log(`  📝 无回复需要渲染`);
      }
    }
    
    // 5. 模拟渲染所有评论
    console.log('\n开始模拟渲染:');
    processedComments.forEach((comment, index) => {
      console.log(`\n=== 渲染根评论 ${index + 1} ===`);
      simulateRenderComment(comment, 0);
    });
    
    // 6. 统计信息
    function getCommentStats(comments) {
      let totalCount = 0;
      
      const countRecursive = (commentList) => {
        commentList.forEach(comment => {
          totalCount++;
          if (comment.replies) {
            countRecursive(comment.replies);
          }
        });
      };
      
      countRecursive(comments);
      return { totalCount };
    }
    
    const stats = getCommentStats(processedComments);
    console.log('\n=== 最终统计 ===');
    console.log('总评论数:', stats.totalCount);
    console.log('根评论数:', processedComments.length);
    
  } catch (error) {
    console.error('调试过程中出错:', error);
  }
}

// 运行调试
debugCommentRendering();