import React, { useEffect, useState } from 'react';
import { MessageCircle, Users } from 'lucide-react';
import { useCommentStore, Comment } from '../store/commentStore';
import { useAuthStore } from '../store/authStore';
import { commentUtils } from '../services/commentAPI';
import { CommentProvider } from '../contexts/CommentContext';
import CommentForm from './CommentForm';
import CommentList from './CommentList';

// 评论区域Props接口
interface CommentSectionProps {
  articleId: number;
  initialComments?: Comment[];
  allowAnonymous?: boolean;
  maxDepth?: number;
  pageSize?: number;
  className?: string;
}

// 评论统计组件
interface CommentStatsProps {
  totalComments: number;
  className?: string;
}

const CommentStats: React.FC<CommentStatsProps> = ({ totalComments, className = '' }) => {
  return (
    <div className={`flex items-center gap-4 text-sm text-gray-600 ${className}`}>
      <div className="flex items-center gap-1">
        <MessageCircle className="w-4 h-4" />
        <span>{totalComments} 条评论</span>
      </div>
      <div className="flex items-center gap-1">
        <Users className="w-4 h-4" />
        <span>参与讨论</span>
      </div>
    </div>
  );
};

// 评论区域主组件
const CommentSection: React.FC<CommentSectionProps> = ({
  articleId,
  initialComments = [],
  allowAnonymous = false,
  maxDepth = 3,
  pageSize = 20,
  className = ''
}) => {
  // 状态管理
  const {
    getComments,
    fetchComments,
    addComment,
    replyToComment,
    likeComment,
    deleteComment,
    editComment,
    loading,
    error,
    pagination
  } = useCommentStore();
  
  const { isAuthenticated } = useAuthStore(); // user 暂时未使用
  
  // 本地状态
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // 获取当前文章的评论
  const comments = getComments(articleId);
  const totalComments = commentUtils.countComments(comments);
  const currentPagination = pagination[articleId];
  
  // 组件挂载时获取评论
  useEffect(() => {
    if (initialComments.length > 0) {
      // 如果有初始评论数据，直接使用
      // 这里可以考虑将初始数据设置到store中
    } else {
      // 否则从API获取
      fetchComments(articleId, { limit: pageSize });
    }
  }, [articleId, initialComments.length, pageSize]); // 移除fetchComments依赖
  
  // 处理评论提交
  const handleCommentSubmit = async (content: string) => {
    if (!isAuthenticated && !allowAnonymous) {
      setShowLoginPrompt(true);
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const result = await addComment({
        content: content.trim(),
        article_id: articleId
      });
      
      if (result) {
        // 评论提交成功，表单会自动清空
        return true;
      }
      return false;
    } catch (error) {
      console.error('提交评论失败:', error);
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // 处理加载更多评论
  const handleLoadMore = async () => {
    if (!currentPagination?.hasMore || loading) return;
    
    await fetchComments(articleId, {
      page: (currentPagination.page || 1) + 1,
      limit: pageSize
    });
  };
  
  // 处理登录提示关闭
  const handleLoginPromptClose = () => {
    setShowLoginPrompt(false);
  };
  
  // 处理跳转登录
  const handleGoToLogin = () => {
    // 这里可以使用路由跳转到登录页面
    window.location.href = '/login';
  };

  // 处理回复评论
  const handleReply = async (parentId: number, content: string) => {
    if (!isAuthenticated && !allowAnonymous) {
      setShowLoginPrompt(true);
      return false;
    }

    try {
      const result = await replyToComment(articleId, parentId, content);
      return !!result;
    } catch (error) {
      console.error('回复评论失败:', error);
      return false;
    }
  };

  // 处理点赞评论
  const handleLike = async (commentId: number) => {
    if (!isAuthenticated && !allowAnonymous) {
      setShowLoginPrompt(true);
      return;
    }

    try {
      await likeComment(articleId, commentId);
    } catch (error) {
      console.error('点赞失败:', error);
    }
  };

  // 处理删除评论
  const handleDelete = async (commentId: number) => {
    try {
      await deleteComment(articleId, commentId);
    } catch (error) {
      console.error('删除失败:', error);
    }
  };
  
  return (
    <CommentProvider
      articleId={articleId}
      maxDepth={maxDepth}
      allowAnonymous={allowAnonymous}
      onReply={handleReply}
      onLike={handleLike}
      onDelete={handleDelete}
      onEdit={async (commentId: number, content: string) => {
        try {
          const result = await editComment(articleId, commentId, content);
          return !!result;
        } catch (error) {
          console.error('编辑失败:', error);
          return false;
        }
      }}
    >
      <section className={`mt-8 bg-white rounded-lg shadow-sm border ${className}`}>
        {/* 评论区域头部 */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">评论区</h3>
            <CommentStats totalComments={totalComments} />
          </div>
          
          {/* 错误提示 */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}
          
          {/* 评论表单 */}
          <CommentForm
            articleId={articleId}
            onSubmit={handleCommentSubmit}
            loading={isSubmitting}
            placeholder="写下你的评论..."
            className="mt-4"
          />
        </div>
        
        {/* 评论列表区域 */}
        <div className="p-6">
          {loading && comments.length === 0 ? (
            // 初始加载状态
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            </div>
          ) : comments.length > 0 ? (
            // 评论列表
            <CommentList
              comments={comments}
              maxDepth={maxDepth}
              loading={loading}
              onLoadMore={currentPagination?.hasMore ? handleLoadMore : undefined}
              hasMore={currentPagination?.hasMore || false}
            />
          ) : (
            // 空状态
            <div className="text-center py-12">
              <MessageCircle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h4 className="text-lg font-medium text-gray-500 mb-2">暂无评论</h4>
              <p className="text-gray-400">
                {isAuthenticated || allowAnonymous
                  ? '成为第一个评论的人吧！'
                  : '登录后即可参与评论讨论'}
              </p>
            </div>
          )}
        </div>
        
        {/* 登录提示弹窗 */}
        {showLoginPrompt && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-sm mx-4">
              <div className="text-center">
                <MessageCircle className="w-12 h-12 text-blue-500 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">需要登录</h3>
                <p className="text-gray-600 mb-6">请先登录后再发表评论</p>
                
                <div className="flex gap-3">
                  <button
                    onClick={handleLoginPromptClose}
                    className="flex-1 px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleGoToLogin}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    去登录
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>
     </CommentProvider>
   );
 };

export default CommentSection;
export type { CommentSectionProps };