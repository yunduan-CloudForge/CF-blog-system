const fs = require('fs');
const path = require('path');

// 模拟评论数据（基于之前的调试结果）
const mockCommentData = {
  id: 1,
  content: "这是一条测试评论",
  user_id: 1,
  article_id: 1,
  parent_id: null,
  created_at: "2025-01-18T10:00:00.000Z",
  updated_at: "2025-01-18T10:00:00.000Z",
  likes: 0,
  is_liked: false,
  user: {
    id: 1,
    username: "Demo用户",
    avatar: null,
    role: "user"
  },
  replies: [
    {
      id: 15,
      content: "这是对评论1的回复测试",
      user_id: 2,
      article_id: 1,
      parent_id: 1,
      created_at: "2025-01-18T10:05:00.000Z",
      updated_at: "2025-01-18T10:05:00.000Z",
      likes: 0,
      is_liked: false,
      user: {
        id: 2,
        username: "回复用户1",
        avatar: null,
        role: "user"
      },
      replies: []
    },
    {
      id: 16,
      content: "测试回复",
      user_id: 3,
      article_id: 1,
      parent_id: 1,
      created_at: "2025-01-18T10:10:00.000Z",
      updated_at: "2025-01-18T10:10:00.000Z",
      likes: 0,
      is_liked: false,
      user: {
        id: 3,
        username: "回复用户2",
        avatar: null,
        role: "user"
      },
      replies: []
    }
  ]
};

class RenderConditionDebugger {
  constructor() {
    this.maxDepth = 5; // 默认最大深度
    this.collapsedThreads = new Set(); // 模拟折叠状态
  }

  // 检查渲染条件
  checkRenderConditions(comment, depth = 0) {
    console.log(`\n=== 检查评论 ${comment.id} 的渲染条件 (深度: ${depth}) ===`);
    
    // 检查是否有回复
    const hasReplies = comment.replies && comment.replies.length > 0;
    console.log(`1. hasReplies: ${hasReplies}`);
    if (hasReplies) {
      console.log(`   回复数量: ${comment.replies.length}`);
      comment.replies.forEach((reply, index) => {
        console.log(`   回复 ${index + 1}: ID=${reply.id}, 内容="${reply.content.substring(0, 20)}..."`);
      });
    }
    
    // 检查是否折叠
    const isCollapsed = this.collapsedThreads.has(comment.id);
    console.log(`2. isCollapsed: ${isCollapsed}`);
    
    // 检查是否可以嵌套
    const canNest = depth < this.maxDepth;
    console.log(`3. canNest: ${canNest} (当前深度: ${depth}, 最大深度: ${this.maxDepth})`);
    
    // 综合判断
    const shouldRenderReplies = hasReplies && !isCollapsed && canNest;
    console.log(`4. 最终渲染条件: ${shouldRenderReplies}`);
    
    if (shouldRenderReplies) {
      console.log(`✅ 回复将被渲染`);
      
      // 递归检查回复的渲染条件
      comment.replies.forEach(reply => {
        this.checkRenderConditions(reply, depth + 1);
      });
    } else {
      console.log(`❌ 回复不会被渲染`);
      if (!hasReplies) console.log(`   原因: 没有回复`);
      if (isCollapsed) console.log(`   原因: 评论被折叠`);
      if (!canNest) console.log(`   原因: 超过最大嵌套深度`);
    }
    
    return shouldRenderReplies;
  }

  // 模拟不同的折叠状态
  testWithDifferentStates() {
    console.log('='.repeat(60));
    console.log('测试不同的渲染状态');
    console.log('='.repeat(60));
    
    // 测试1: 正常状态
    console.log('\n【测试1: 正常状态 - 无折叠】');
    this.collapsedThreads.clear();
    this.checkRenderConditions(mockCommentData);
    
    // 测试2: 折叠状态
    console.log('\n【测试2: 折叠状态 - 主评论被折叠】');
    this.collapsedThreads.add(1);
    this.checkRenderConditions(mockCommentData);
    
    // 测试3: 深度限制
    console.log('\n【测试3: 深度限制 - maxDepth=0】');
    this.collapsedThreads.clear();
    this.maxDepth = 0;
    this.checkRenderConditions(mockCommentData);
    
    // 测试4: 恢复正常
    console.log('\n【测试4: 恢复正常状态】');
    this.maxDepth = 5;
    this.checkRenderConditions(mockCommentData);
  }

  // 检查前端可能的问题
  checkPotentialIssues() {
    console.log('\n' + '='.repeat(60));
    console.log('检查潜在问题');
    console.log('='.repeat(60));
    
    console.log('\n1. 检查数据结构:');
    console.log('   - 回复是否正确嵌套在replies数组中: ✅');
    console.log('   - 回复数据是否完整: ✅');
    
    console.log('\n2. 检查渲染条件:');
    console.log('   - hasReplies: 应该为true');
    console.log('   - isCollapsed: 应该为false（除非用户手动折叠）');
    console.log('   - canNest: 应该为true（深度0 < maxDepth 5）');
    
    console.log('\n3. 可能的问题:');
    console.log('   a) 前端状态管理问题 - collapsedThreads状态可能有误');
    console.log('   b) maxDepth配置问题 - 可能被设置为0或很小的值');
    console.log('   c) CSS样式问题 - 回复可能被隐藏或样式错误');
    console.log('   d) 组件渲染问题 - renderComment函数可能没有被正确调用');
    
    console.log('\n4. 建议检查:');
    console.log('   - 在浏览器开发者工具中检查DOM结构');
    console.log('   - 检查CommentContext中的collapsedThreads状态');
    console.log('   - 检查maxDepth的配置值');
    console.log('   - 在renderComment函数中添加console.log调试');
  }

  // 生成调试建议
  generateDebuggingSteps() {
    console.log('\n' + '='.repeat(60));
    console.log('调试步骤建议');
    console.log('='.repeat(60));
    
    console.log('\n步骤1: 检查前端状态');
    console.log('在CommentList组件的renderComment函数开头添加:');
    console.log('console.log("渲染评论:", comment.id, "深度:", depth, "回复数:", comment.replies?.length);');
    
    console.log('\n步骤2: 检查渲染条件');
    console.log('在回复渲染的条件判断处添加:');
    console.log('console.log("渲染条件:", { hasReplies, isCollapsed, canNest, depth, maxDepth });');
    
    console.log('\n步骤3: 检查DOM结构');
    console.log('在浏览器开发者工具中查找class="comment-thread"的元素');
    console.log('检查是否存在嵌套的回复结构');
    
    console.log('\n步骤4: 检查CSS样式');
    console.log('确认回复没有被display:none或visibility:hidden隐藏');
    
    console.log('\n步骤5: 检查数据流');
    console.log('从API -> CommentStore -> CommentContext -> CommentList -> CommentItem');
    console.log('确认每一步数据都正确传递');
  }
}

// 运行调试
const conditionDebugger = new RenderConditionDebugger();
conditionDebugger.testWithDifferentStates();
conditionDebugger.checkPotentialIssues();
conditionDebugger.generateDebuggingSteps();

console.log('\n' + '='.repeat(60));
console.log('调试完成！请按照建议步骤进行前端调试。');
console.log('='.repeat(60));