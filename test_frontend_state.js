const fs = require('fs');
const path = require('path');

// 模拟评论数据结构
const mockComments = [
  {
    id: 1,
    content: "这是第一条评论",
    parent_id: null,
    article_id: 1,
    user: { id: 1, username: "user1" },
    replies: []
  },
  {
    id: 2,
    content: "这是第二条评论",
    parent_id: null,
    article_id: 1,
    user: { id: 2, username: "user2" },
    replies: []
  }
];

// 模拟新回复
const newReply = {
  id: 3,
  content: "这是对第一条评论的回复",
  parent_id: 1,
  article_id: 1,
  user: { id: 3, username: "user3" },
  replies: []
};

// 复制前端的addReplyToTree函数
const addReplyToTree = (comments, parentId, newReply) => {
  return comments.map(comment => {
    if (comment.id === parentId) {
      return {
        ...comment,
        replies: [...(comment.replies || []), newReply]
      };
    }
    if (comment.replies && comment.replies.length > 0) {
      return {
        ...comment,
        replies: addReplyToTree(comment.replies, parentId, newReply)
      };
    }
    return comment;
  });
};

// 复制前端的buildCommentTree函数
const buildCommentTree = (comments) => {
  const commentMap = new Map();
  const rootComments = [];
  
  // 创建评论映射
  comments.forEach(comment => {
    commentMap.set(comment.id, { ...comment, replies: [] });
  });
  
  // 构建树结构
  comments.forEach(comment => {
    const commentWithReplies = commentMap.get(comment.id);
    
    if (comment.parent_id === null) {
      rootComments.push(commentWithReplies);
    } else {
      const parent = commentMap.get(comment.parent_id);
      if (parent) {
        parent.replies.push(commentWithReplies);
      }
    }
  });
  
  return rootComments;
};

// 测试函数
function testFrontendState() {
  console.log('=== 测试前端状态管理 ===\n');
  
  console.log('1. 初始评论数据:');
  console.log(JSON.stringify(mockComments, null, 2));
  
  console.log('\n2. 新回复数据:');
  console.log(JSON.stringify(newReply, null, 2));
  
  console.log('\n3. 使用addReplyToTree添加回复:');
  const updatedComments = addReplyToTree(mockComments, 1, newReply);
  console.log(JSON.stringify(updatedComments, null, 2));
  
  console.log('\n4. 验证回复是否正确添加:');
  const parentComment = updatedComments.find(c => c.id === 1);
  if (parentComment && parentComment.replies && parentComment.replies.length > 0) {
    console.log('✅ 回复添加成功!');
    console.log('父评论的回复数量:', parentComment.replies.length);
    console.log('回复内容:', parentComment.replies[0].content);
  } else {
    console.log('❌ 回复添加失败!');
  }
  
  // 测试从扁平化数据构建树结构
  console.log('\n5. 测试从扁平化数据构建树结构:');
  const flatComments = [
    {
      id: 1,
      content: "这是第一条评论",
      parent_id: null,
      article_id: 1,
      user: { id: 1, username: "user1" }
    },
    {
      id: 2,
      content: "这是第二条评论",
      parent_id: null,
      article_id: 1,
      user: { id: 2, username: "user2" }
    },
    {
      id: 3,
      content: "这是对第一条评论的回复",
      parent_id: 1,
      article_id: 1,
      user: { id: 3, username: "user3" }
    }
  ];
  
  const treeFromFlat = buildCommentTree(flatComments);
  console.log('从扁平化数据构建的树结构:');
  console.log(JSON.stringify(treeFromFlat, null, 2));
  
  // 验证树结构
  const rootComment = treeFromFlat.find(c => c.id === 1);
  if (rootComment && rootComment.replies && rootComment.replies.length > 0) {
    console.log('✅ 树结构构建成功!');
    console.log('根评论的回复数量:', rootComment.replies.length);
  } else {
    console.log('❌ 树结构构建失败!');
  }
}

// 运行测试
testFrontendState();