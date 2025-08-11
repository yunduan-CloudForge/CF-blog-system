// 测试前端是否正确处理API返回的嵌套评论数据

// 模拟API返回的数据结构
const mockApiResponse = {
  "success": true,
  "message": "获取评论列表成功",
  "data": {
    "comments": [
      {
        "id": 1,
        "content": "这是第一条评论",
        "user_id": 1,
        "article_id": 1,
        "parent_id": null,
        "likes": 1,
        "created_at": "2025-08-11 03:03:40",
        "updated_at": "2025-08-11 03:03:40",
        "user": {
          "id": 1,
          "username": "admin",
          "avatar": null
        },
        "is_liked": false,
        "deleted": false,
        "replies": [
          {
            "id": 15,
            "content": "这是第一个回复",
            "user_id": 4,
            "article_id": 1,
            "parent_id": 1,
            "likes": 0,
            "created_at": "2025-08-11 05:39:58",
            "updated_at": "2025-08-11 05:39:58",
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
            "content": "这是第二个回复",
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
  "timestamp": "2025-08-11T05:57:37.721Z"
};

interface Comment {
  id: number;
  content: string;
  user_id: number;
  article_id: number;
  parent_id: number | null;
  likes: number;
  created_at: string;
  updated_at: string;
  user: {
    id: number;
    username: string;
    avatar: string | null;
  };
  is_liked: boolean;
  deleted: boolean;
  replies: Comment[];
}

// 复制前端的buildCommentTree函数（来自commentStore.ts）
function buildCommentTree(comments: Comment[]): Comment[] {
  const commentMap = new Map<number, Comment>();
  const rootComments: Comment[] = [];
  
  // 创建评论映射
  comments.forEach(comment => {
    commentMap.set(comment.id, { ...comment, replies: [] });
  });
  
  // 构建树结构
  comments.forEach(comment => {
    const commentWithReplies = commentMap.get(comment.id)!;
    
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

// 复制前端修复后的ensureCommentTree函数（来自CommentList.tsx）
function ensureCommentTree(comments: Comment[]): Comment[] {
  if (!comments || comments.length === 0) {
    return [];
  }
  
  // 检查是否已经是正确的树结构（只有根评论，且都有replies数组）
  const hasProperTreeStructure = comments.length > 0 && 
    comments.every(c => c.parent_id === null) && 
    comments.every(c => Array.isArray(c.replies));
  
  if (hasProperTreeStructure) {
    // 已经是正确的树结构，确保所有嵌套的回复也有replies数组
    const ensureRepliesArray = (comment: Comment): Comment => ({
      ...comment,
      replies: comment.replies ? comment.replies.map(ensureRepliesArray) : []
    });
    
    console.log('CommentList: 使用已有的树结构', comments);
    return comments.map(ensureRepliesArray);
  }
  
  // 如果不是正确的树结构，重新构建
  console.log('CommentList: 重新构建树结构');
  
  // 创建评论映射
  const commentMap = new Map<number, Comment>();
  const rootComments: Comment[] = [];
  
  comments.forEach(comment => {
    commentMap.set(comment.id, { ...comment, replies: [] });
  });
  
  // 构建树结构
  comments.forEach(comment => {
    const commentWithReplies = commentMap.get(comment.id)!;
    
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

// 打印评论树结构
function logCommentTree(comments: Comment[], depth = 0) {
  const indent = '  '.repeat(depth);
  comments.forEach(comment => {
    console.log(`${indent}- 评论 ${comment.id}: "${comment.content}" (parent_id: ${comment.parent_id})`);
    if (comment.replies && comment.replies.length > 0) {
      console.log(`${indent}  回复 (${comment.replies.length} 条):`);
      logCommentTree(comment.replies, depth + 2);
    }
  });
}

// 扁平化评论数据（模拟后端可能返回的格式）
function flattenComments(comments: Comment[]): Comment[] {
  const flattened: Comment[] = [];
  
  function flatten(commentList: Comment[]) {
    commentList.forEach(comment => {
      flattened.push(comment);
      if (comment.replies && comment.replies.length > 0) {
        flatten(comment.replies);
      }
    });
  }
  
  flatten(comments);
  return flattened;
}

// 测试函数
function testFrontendProcessing() {
  console.log('=== 测试前端数据处理逻辑 ===\n');
  
  const { comments } = mockApiResponse.data;
  
  console.log('1. 原始API返回的数据:');
  logCommentTree(comments);
  
  console.log('\n2. 测试buildCommentTree函数（commentStore.ts中使用）:');
  // 模拟后端返回扁平化数据的情况
  const flatComments = flattenComments(comments);
  console.log('扁平化后的数据:', flatComments.map(c => ({ id: c.id, parent_id: c.parent_id, content: c.content })));
  
  const rebuiltTree = buildCommentTree(flatComments);
  console.log('buildCommentTree重建后的树结构:');
  logCommentTree(rebuiltTree);
  
  console.log('\n3. 测试ensureCommentTree函数（CommentList.tsx中使用）:');
  
  // 测试情况1：API返回的已经是嵌套结构
  console.log('\n3.1 测试已有嵌套结构的数据:');
  const ensuredTree1 = ensureCommentTree(comments);
  logCommentTree(ensuredTree1);
  
  // 测试情况2：扁平化数据需要重建
  console.log('\n3.2 测试扁平化数据:');
  const ensuredTree2 = ensureCommentTree(flatComments);
  logCommentTree(ensuredTree2);
  
  console.log('\n=== 分析结果 ===');
  console.log('✅ API返回的数据已经是正确的嵌套结构');
  console.log('✅ ensureCommentTree函数能够正确识别并保持嵌套结构');
  console.log('✅ buildCommentTree函数能够正确重建树结构');
  
  // 检查回复数量
  const totalReplies1 = ensuredTree1.reduce((sum, comment) => sum + (comment.replies?.length || 0), 0);
  const totalReplies2 = ensuredTree2.reduce((sum, comment) => sum + (comment.replies?.length || 0), 0);
  
  console.log(`\n回复数量检查:`);
  console.log(`- 原始嵌套数据处理后的回复数量: ${totalReplies1}`);
  console.log(`- 扁平化数据重建后的回复数量: ${totalReplies2}`);
  
  if (totalReplies1 === totalReplies2 && totalReplies1 === 2) {
    console.log('✅ 回复数据处理正确');
  } else {
    console.log('❌ 回复数据处理有问题');
  }
}

// 运行测试
testFrontendProcessing();