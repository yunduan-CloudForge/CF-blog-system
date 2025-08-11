const fetch = require('node-fetch');

// 模拟前端CommentList的数据处理逻辑
function ensureCommentTree(comments) {
  if (!comments || comments.length === 0) {
    return [];
  }
  
  console.log('ensureCommentTree: 输入数据', {
    commentsLength: comments.length,
    comments: comments.map(c => ({
      id: c.id,
      parent_id: c.parent_id,
      hasReplies: Array.isArray(c.replies),
      repliesCount: c.replies?.length || 0,
      repliesIds: c.replies?.map(r => r.id) || []
    }))
  });
  
  // 检查是否已经是正确的树结构（只有根评论，且都有replies数组）
  const hasProperTreeStructure = comments.length > 0 && 
    comments.every(c => c.parent_id === null) && 
    comments.every(c => Array.isArray(c.replies));
  
  console.log('ensureCommentTree: 树结构检查', {
    hasProperTreeStructure,
    allRootComments: comments.every(c => c.parent_id === null),
    allHaveRepliesArray: comments.every(c => Array.isArray(c.replies))
  });
  
  if (hasProperTreeStructure) {
    // 已经是正确的树结构，确保所有嵌套的回复也有replies数组
    const ensureRepliesArray = (comment) => ({
      ...comment,
      replies: comment.replies ? comment.replies.map(ensureRepliesArray) : []
    });
    
    const result = comments.map(ensureRepliesArray);
    console.log('ensureCommentTree: 使用已有的树结构，结果:', {
      resultLength: result.length,
      result: result.map(c => ({
        id: c.id,
        repliesCount: c.replies?.length || 0,
        repliesIds: c.replies?.map(r => r.id) || []
      }))
    });
    return result;
  }
  
  // 否则构建树结构（用于扁平化数据）
  console.log('ensureCommentTree: 构建树结构（扁平化数据）');
  const commentMap = new Map();
  const rootComments = [];
  
  // 创建评论映射
  comments.forEach(comment => {
    commentMap.set(comment.id, { ...comment, replies: [] });
  });
  
  // 构建树结构
  comments.forEach(comment => {
    const commentWithReplies = commentMap.get(comment.id);
    
    if (comment.parent_id) {
      const parent = commentMap.get(comment.parent_id);
      if (parent) {
        parent.replies = parent.replies || [];
        parent.replies.push(commentWithReplies);
      }
    } else {
      rootComments.push(commentWithReplies);
    }
  });
  
  return rootComments;
}

// 模拟渲染评论的逻辑
function renderComment(comment, depth = 0, maxDepth = 5) {
  const hasReplies = comment.replies && comment.replies.length > 0;
  const canNest = depth < maxDepth;
  
  console.log(`渲染评论 ${comment.id}:`, {
    depth,
    hasReplies,
    repliesCount: comment.replies?.length || 0,
    canNest,
    maxDepth,
    shouldRenderReplies: hasReplies && canNest
  });
  
  // 递归渲染回复
  if (hasReplies && canNest) {
    comment.replies.forEach(reply => {
      renderComment(reply, depth + 1, maxDepth);
    });
  }
}

async function testFrontendCommentList() {
  try {
    console.log('=== 测试前端CommentList数据处理逻辑 ===\n');
    
    // 获取API数据
    const response = await fetch('http://localhost:3001/api/comments?article_id=2');
    const data = await response.json();
    
    console.log('API响应状态:', response.status);
    console.log('API响应数据:', {
      success: data.success,
      commentsLength: data.data?.comments?.length || 0,
      pagination: data.data?.pagination
    });
    
    if (!data.success || !data.data?.comments) {
      console.error('API响应无效');
      return;
    }
    
    const comments = data.data.comments;
    
    console.log('\n=== 原始API数据分析 ===');
    console.log('评论总数:', comments.length);
    comments.forEach(comment => {
      console.log(`评论 ${comment.id}: parent_id=${comment.parent_id}, replies=${comment.replies?.length || 0}`);
    });
    
    console.log('\n=== 调用ensureCommentTree ===');
    const processedComments = ensureCommentTree(comments);
    
    console.log('\n=== 处理后的数据分析 ===');
    console.log('处理后评论数:', processedComments.length);
    processedComments.forEach(comment => {
      console.log(`根评论 ${comment.id}: replies=${comment.replies?.length || 0}`);
      if (comment.replies && comment.replies.length > 0) {
        comment.replies.forEach(reply => {
          console.log(`  回复 ${reply.id}: parent_id=${reply.parent_id}`);
        });
      }
    });
    
    console.log('\n=== 模拟渲染过程 ===');
    processedComments.forEach(comment => {
      renderComment(comment);
    });
    
  } catch (error) {
    console.error('测试失败:', error.message);
  }
}

testFrontendCommentList();