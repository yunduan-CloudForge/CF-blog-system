const util = require('util');

// 模拟后端返回的嵌套评论数据（与API测试脚本中看到的相同）
const mockApiResponse = {
  "success": true,
  "data": {
    "comments": [
      {
        "id": 1,
        "content": "????????",
        "user_id": 1,
        "article_id": 1,
        "parent_id": null,
        "likes": 1,
        "created_at": "2025-08-11 03:03:40",
        "updated_at": "2025-08-11 03:04:00",
        "user": {
          "id": 1,
          "username": "Admin",
          "avatar": null
        },
        "is_liked": false,
        "deleted": false,
        "replies": [
          {
            "id": 15,
            "content": "这是对评论1的回复测试 - 2025-08-11T05:36:05.840Z",
            "user_id": 4,
            "article_id": 1,
            "parent_id": 1,
            "likes": 0,
            "created_at": "2025-08-11 05:36:05",
            "updated_at": "2025-08-11 05:36:05",
            "user": {
              "id": 4,
              "username": "testuser",
              "avatar": null
            },
            "is_liked": false,
            "deleted": false,
            "replies": []
          },
          {
            "id": 16,
            "content": "测试回复 - 2025-08-11T05:40:08.433Z",
            "user_id": 4,
            "article_id": 1,
            "parent_id": 1,
            "likes": 0,
            "created_at": "2025-08-11 05:40:08",
            "updated_at": "2025-08-11 05:40:08",
            "user": {
              "id": 4,
              "username": "testuser",
              "avatar": null
            },
            "is_liked": false,
            "deleted": false,
            "replies": []
          }
        ]
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 3,
      "totalPages": 1
    }
  },
  "timestamp": "2025-08-11T05:45:11.234Z"
};

// 复制修复后的ensureCommentTree函数
const ensureCommentTree = (comments) => {
  if (!comments || comments.length === 0) {
    return [];
  }
  
  // 检查是否已经是正确的树结构（所有根评论都有replies数组，且没有parent_id）
  const hasProperTreeStructure = comments.every(c => 
    c.parent_id === null && 
    Array.isArray(c.replies)
  );
  
  if (hasProperTreeStructure) {
    // 已经是正确的树结构，确保所有嵌套的回复也有replies数组
    const ensureRepliesArray = (comment) => ({
      ...comment,
      replies: comment.replies ? comment.replies.map(ensureRepliesArray) : []
    });
    
    return comments.map(ensureRepliesArray);
  }
  
  // 否则构建树结构（用于扁平化数据）
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
};

// 复制addReplyToTree函数
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

// 测试函数
function testFixedFrontend() {
  console.log('=== 测试修复后的前端逻辑 ===\n');
  
  const comments = mockApiResponse.data.comments;
  
  console.log('1. 原始API响应数据:');
  console.log('评论数量:', comments.length);
  console.log('第一个评论的回复数量:', comments[0].replies.length);
  console.log('回复内容:', comments[0].replies.map(r => r.content));
  
  console.log('\n2. 测试ensureCommentTree函数:');
  const processedComments = ensureCommentTree(comments);
  console.log('处理后评论数量:', processedComments.length);
  console.log('第一个评论的回复数量:', processedComments[0].replies.length);
  console.log('回复内容:', processedComments[0].replies.map(r => r.content));
  
  console.log('\n3. 测试添加新回复:');
  const newReply = {
    id: 17,
    content: '新的测试回复',
    user_id: 4,
    article_id: 1,
    parent_id: 1,
    likes: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    user: {
      id: 4,
      username: 'testuser',
      avatar: null
    },
    is_liked: false,
    deleted: false,
    replies: []
  };
  
  const updatedComments = addReplyToTree(processedComments, 1, newReply);
  console.log('添加回复后评论数量:', updatedComments.length);
  console.log('第一个评论的回复数量:', updatedComments[0].replies.length);
  console.log('所有回复内容:', updatedComments[0].replies.map(r => r.content));
  
  console.log('\n4. 验证数据结构完整性:');
  const firstComment = updatedComments[0];
  console.log('根评论有replies数组:', Array.isArray(firstComment.replies));
  console.log('所有回复都有replies数组:', firstComment.replies.every(r => Array.isArray(r.replies)));
  
  console.log('\n=== 测试完成 ===');
  
  // 检查是否所有回复都被正确保留
  const totalReplies = updatedComments[0].replies.length;
  if (totalReplies === 3) {
    console.log('✅ 成功：所有回复都被正确保留和添加');
  } else {
    console.log('❌ 失败：回复数量不正确，期望3个，实际', totalReplies);
  }
}

// 运行测试
testFixedFrontend();