// 测试后端的buildCommentTree函数

// 模拟后端的buildCommentTree函数
function buildCommentTree(comments) {
  const commentMap = new Map();
  const rootComments = [];

  // 初始化所有评论
  comments.forEach(comment => {
    comment.replies = [];
    commentMap.set(comment.id, comment);
  });

  // 构建树形结构
  comments.forEach(comment => {
    if (comment.parent_id === null) {
      rootComments.push(comment);
    } else {
      const parent = commentMap.get(comment.parent_id);
      if (parent) {
        parent.replies.push(comment);
      }
    }
  });

  return rootComments;
}

// 模拟从API获取的原始数据（文章2的评论）
const mockApiData = [
  {
    id: 3,
    content: "text\ntexttext",
    user_id: 2,
    article_id: 2,
    parent_id: null,
    likes: 0,
    created_at: "2025-08-11 03:49:51",
    updated_at: "2025-08-11 03:49:51",
    user: { id: 2, username: "Demo用户", avatar: null },
    is_liked: false,
    deleted: false
  },
  {
    id: 4,
    content: "text",
    user_id: 2,
    article_id: 2,
    parent_id: 3,
    likes: 0,
    created_at: "2025-08-11 04:45:01",
    updated_at: "2025-08-11 04:45:01",
    user: { id: 2, username: "Demo用户", avatar: null },
    is_liked: false,
    deleted: false
  },
  {
    id: 5,
    content: "test",
    user_id: 2,
    article_id: 2,
    parent_id: 3,
    likes: 0,
    created_at: "2025-08-11 04:51:47",
    updated_at: "2025-08-11 04:51:47",
    user: { id: 2, username: "Demo用户", avatar: null },
    is_liked: false,
    deleted: false
  },
  {
    id: 6,
    content: "text",
    user_id: 2,
    article_id: 2,
    parent_id: 3,
    likes: 0,
    created_at: "2025-08-11 04:52:35",
    updated_at: "2025-08-11 04:52:35",
    user: { id: 2, username: "Demo用户", avatar: null },
    is_liked: false,
    deleted: false
  },
  {
    id: 7,
    content: "text",
    user_id: 2,
    article_id: 2,
    parent_id: 3,
    likes: 0,
    created_at: "2025-08-11 04:55:01",
    updated_at: "2025-08-11 04:55:01",
    user: { id: 2, username: "Demo用户", avatar: null },
    is_liked: false,
    deleted: false
  },
  {
    id: 8,
    content: "text",
    user_id: 1,
    article_id: 2,
    parent_id: 3,
    likes: 0,
    created_at: "2025-08-11 04:56:01",
    updated_at: "2025-08-11 04:56:01",
    user: { id: 1, username: "Admin", avatar: null },
    is_liked: false,
    deleted: false
  },
  {
    id: 9,
    content: "text",
    user_id: 2,
    article_id: 2,
    parent_id: 3,
    likes: 0,
    created_at: "2025-08-11 05:01:54",
    updated_at: "2025-08-11 05:01:54",
    user: { id: 2, username: "Demo用户", avatar: null },
    is_liked: false,
    deleted: false
  },
  {
    id: 10,
    content: "text",
    user_id: 2,
    article_id: 2,
    parent_id: 3,
    likes: 0,
    created_at: "2025-08-11 05:11:41",
    updated_at: "2025-08-11 05:11:41",
    user: { id: 2, username: "Demo用户", avatar: null },
    is_liked: false,
    deleted: false
  },
  {
    id: 11,
    content: "test",
    user_id: 1,
    article_id: 2,
    parent_id: 3,
    likes: 0,
    created_at: "2025-08-11 05:15:07",
    updated_at: "2025-08-11 05:15:07",
    user: { id: 1, username: "Admin", avatar: null },
    is_liked: false,
    deleted: false
  },
  {
    id: 12,
    content: "test",
    user_id: 1,
    article_id: 2,
    parent_id: 3,
    likes: 0,
    created_at: "2025-08-11 05:21:35",
    updated_at: "2025-08-11 05:21:35",
    user: { id: 1, username: "Admin", avatar: null },
    is_liked: false,
    deleted: false
  },
  {
    id: 13,
    content: "text",
    user_id: 2,
    article_id: 2,
    parent_id: 3,
    likes: 0,
    created_at: "2025-08-11 05:21:48",
    updated_at: "2025-08-11 05:21:48",
    user: { id: 2, username: "Demo用户", avatar: null },
    is_liked: false,
    deleted: false
  },
  {
    id: 14,
    content: "text",
    user_id: 1,
    article_id: 2,
    parent_id: 3,
    likes: 0,
    created_at: "2025-08-11 05:26:29",
    updated_at: "2025-08-11 05:26:29",
    user: { id: 1, username: "Admin", avatar: null },
    is_liked: false,
    deleted: false
  },
  {
    id: 17,
    content: "text",
    user_id: 2,
    article_id: 2,
    parent_id: 3,
    likes: 0,
    created_at: "2025-08-11 05:48:29",
    updated_at: "2025-08-11 05:48:29",
    user: { id: 2, username: "Demo用户", avatar: null },
    is_liked: false,
    deleted: false
  }
];

console.log('=== 测试后端buildCommentTree函数 ===\n');

console.log('原始数据:');
console.log(`总评论数: ${mockApiData.length}`);
console.log('顶级评论:', mockApiData.filter(c => c.parent_id === null).length);
console.log('回复评论:', mockApiData.filter(c => c.parent_id !== null).length);
console.log('');

// 测试buildCommentTree函数
const result = buildCommentTree(JSON.parse(JSON.stringify(mockApiData))); // 深拷贝避免修改原数据

console.log('buildCommentTree处理后:');
console.log(`根评论数: ${result.length}`);

result.forEach(comment => {
  console.log(`\n📝 评论 ${comment.id} (${comment.user.username}):`);
  console.log(`   内容: "${comment.content}"`);
  console.log(`   回复数: ${comment.replies.length}`);
  
  if (comment.replies.length > 0) {
    comment.replies.forEach(reply => {
      console.log(`     💬 回复 ${reply.id} (${reply.user.username}): "${reply.content}"`);
    });
  }
});

console.log('\n=== 验证结果 ===');
const totalRepliesInTree = result.reduce((sum, comment) => sum + comment.replies.length, 0);
console.log(`树结构中的回复总数: ${totalRepliesInTree}`);
console.log(`原始数据中的回复总数: ${mockApiData.filter(c => c.parent_id !== null).length}`);
console.log(`是否匹配: ${totalRepliesInTree === mockApiData.filter(c => c.parent_id !== null).length ? '✅ 是' : '❌ 否'}`);