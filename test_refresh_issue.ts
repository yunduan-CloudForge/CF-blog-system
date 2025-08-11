// 测试页面刷新后回复数据丢失的问题

import { commentAPI } from './src/services/commentAPI';

interface Comment {
  id: number;
  content: string;
  user_id: number;
  article_id: number;
  parent_id: number | null;
  likes: number;
  created_at: string;
  updated_at: string;
  username: string;
  avatar: string | null;
  is_liked: boolean;
  replies: Comment[];
}

// 模拟前端状态管理的逻辑
class CommentStateManager {
  private commentsByArticle: Record<number, Comment[]> = {};

  // 构建评论树结构（来自commentStore.ts）
  private buildCommentTree(comments: Comment[]): Comment[] {
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

  // 在评论树中添加新回复（来自commentStore.ts）
  private addReplyToTree(comments: Comment[], parentId: number, newReply: Comment): Comment[] {
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
          replies: this.addReplyToTree(comment.replies, parentId, newReply)
        };
      }
      return comment;
    });
  }

  // 模拟fetchComments（来自commentStore.ts）
  async fetchComments(articleId: number) {
    console.log(`\n=== 模拟fetchComments(${articleId}) ===`);
    
    try {
      const response = await fetch(`http://localhost:3001/api/comments?article_id=${articleId}&page=1&limit=20&sort=created_at&order=desc`);
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.message || '获取评论失败');
      }
      
      const { comments } = data.data;
      console.log(`从API获取到 ${comments.length} 条评论数据`);
      
      // 关键问题：这里会重新构建树结构，覆盖之前的本地状态
      const commentTree = this.buildCommentTree(comments);
      
      console.log('构建后的评论树:');
      this.logCommentTree(commentTree);
      
      // 这里会覆盖之前的数据！
      this.commentsByArticle[articleId] = commentTree;
      
      return commentTree;
    } catch (error) {
      console.error('获取评论失败:', error);
      return [];
    }
  }

  // 模拟replyToComment（来自commentStore.ts）
  async replyToComment(articleId: number, parentId: number, content: string) {
    console.log(`\n=== 模拟replyToComment(${articleId}, ${parentId}, "${content}") ===`);
    
    try {
      const response = await fetch(`http://localhost:3001/api/comments/${parentId}/reply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token') || 'test-token'}`
        },
        body: JSON.stringify({ content })
      });
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.message || '回复失败');
      }
      
      const newReply = data.data.comment;
      console.log('新回复数据:', newReply);
      
      // 获取当前文章的评论
      const articleComments = this.commentsByArticle[articleId] || [];
      console.log('当前本地评论数据:');
      this.logCommentTree(articleComments);
      
      // 添加回复到树结构
      const updatedComments = this.addReplyToTree(articleComments, parentId, newReply);
      console.log('添加回复后的评论数据:');
      this.logCommentTree(updatedComments);
      
      // 更新本地状态
      this.commentsByArticle[articleId] = updatedComments;
      
      return newReply;
    } catch (error) {
      console.error('回复失败:', error);
      return null;
    }
  }

  // 获取评论
  getComments(articleId: number): Comment[] {
    return this.commentsByArticle[articleId] || [];
  }

  // 打印评论树结构
  private logCommentTree(comments: Comment[], depth = 0) {
    const indent = '  '.repeat(depth);
    comments.forEach(comment => {
      console.log(`${indent}- 评论 ${comment.id}: "${comment.content}" (parent_id: ${comment.parent_id})`);
      if (comment.replies && comment.replies.length > 0) {
        console.log(`${indent}  回复 (${comment.replies.length} 条):`);
        this.logCommentTree(comment.replies, depth + 2);
      }
    });
  }
}

// 测试函数
async function testRefreshIssue() {
  console.log('=== 测试页面刷新后回复数据丢失问题 ===\n');
  
  const manager = new CommentStateManager();
  
  try {
    // 1. 模拟页面初始加载 - 获取评论
    console.log('1. 模拟页面初始加载...');
    await manager.fetchComments(1);
    
    console.log('\n初始加载后的本地状态:');
    const initialComments = manager.getComments(1);
    manager.logCommentTree(initialComments);
    
    // 2. 模拟用户添加回复
    console.log('\n2. 模拟用户添加回复...');
    const firstComment = initialComments[0];
    if (firstComment) {
      await manager.replyToComment(1, firstComment.id, '这是一个测试回复');
      
      console.log('\n添加回复后的本地状态:');
      const afterReplyComments = manager.getComments(1);
      manager.logCommentTree(afterReplyComments);
    }
    
    // 3. 模拟页面刷新 - 重新获取评论
    console.log('\n3. 模拟页面刷新（重新获取评论）...');
    await manager.fetchComments(1);
    
    console.log('\n页面刷新后的本地状态:');
    const afterRefreshComments = manager.getComments(1);
    manager.logCommentTree(afterRefreshComments);
    
    // 4. 分析问题
    console.log('\n=== 问题分析 ===');
    console.log('问题：页面刷新后，fetchComments会重新从API获取数据并调用buildCommentTree');
    console.log('这会覆盖本地状态中通过addReplyToTree添加的回复数据');
    console.log('解决方案：确保API返回的数据包含所有回复，或者改进本地状态管理逻辑');
    
  } catch (error) {
    console.error('测试失败:', error);
  }
}

// 运行测试
testRefreshIssue().catch(console.error);