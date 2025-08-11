import React, { useState, useEffect, useCallback } from 'react';
import { ChevronDown, ChevronUp, MessageCircle, Loader2 } from 'lucide-react';
import { Comment } from '../store/commentStore';
import CommentItem from './CommentItem';

// 评论列表Props接口
interface CommentListProps {
  comments: Comment[];
  loading?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
  onReply?: (parentId: number) => void;
  onLike?: (commentId: number) => void;
  onDelete?: (commentId: number) => void;
  className?: string;
  maxDepth?: number;
  sortBy?: 'newest' | 'oldest' | 'likes';
  onSortChange?: (sortBy: 'newest' | 'oldest' | 'likes') => void;
}

// 排序选项
const SORT_OPTIONS = [
  { value: 'newest', label: '最新' },
  { value: 'oldest', label: '最早' },
  { value: 'likes', label: '最热' }
] as const;

// 评论列表组件
const CommentList: React.FC<CommentListProps> = ({
  comments,
  loading = false,
  hasMore = false,
  onLoadMore,
  onReply,
  onLike,
  onDelete,
  className = '',
  maxDepth = 3,
  sortBy = 'newest',
  onSortChange
}) => {
  // 状态管理
  const [expandedComments, setExpandedComments] = useState<Set<number>>(new Set());
  const [collapsedThreads, setCollapsedThreads] = useState<Set<number>>(new Set());
  const [loadingMore, setLoadingMore] = useState(false);
  
  // 构建评论树结构
  const buildCommentTree = useCallback((comments: Comment[]): Comment[] => {
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
  }, []);
  
  // 排序评论
  const sortComments = useCallback((comments: Comment[], sortBy: string): Comment[] => {
    const sorted = [...comments].sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'oldest':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case 'likes':
          return (b.likes_count || 0) - (a.likes_count || 0);
        default:
          return 0;
      }
    });
    
    // 递归排序回复
    return sorted.map(comment => ({
      ...comment,
      replies: comment.replies ? sortComments(comment.replies, sortBy) : []
    }));
  }, []);
  
  // 处理展开/折叠评论
  const toggleCommentExpansion = useCallback((commentId: number) => {
    setExpandedComments(prev => {
      const newSet = new Set(prev);
      if (newSet.has(commentId)) {
        newSet.delete(commentId);
      } else {
        newSet.add(commentId);
      }
      return newSet;
    });
  }, []);
  
  // 处理折叠/展开整个评论线程
  const toggleThreadCollapse = useCallback((commentId: number) => {
    setCollapsedThreads(prev => {
      const newSet = new Set(prev);
      if (newSet.has(commentId)) {
        newSet.delete(commentId);
      } else {
        newSet.add(commentId);
      }
      return newSet;
    });
  }, []);
  
  // 处理加载更多
  const handleLoadMore = useCallback(async () => {
    if (!onLoadMore || loadingMore || loading) return;
    
    setLoadingMore(true);
    try {
      await onLoadMore();
    } finally {
      setLoadingMore(false);
    }
  }, [onLoadMore, loadingMore, loading]);
  
  // 计算评论统计
  const getCommentStats = useCallback((comments: Comment[]) => {
    let totalCount = 0;
    let totalLikes = 0;
    
    const countRecursive = (commentList: Comment[]) => {
      commentList.forEach(comment => {
        totalCount++;
        totalLikes += comment.likes_count || 0;
        if (comment.replies) {
          countRecursive(comment.replies);
        }
      });
    };
    
    countRecursive(comments);
    return { totalCount, totalLikes };
  }, []);
  
  // 渲染评论项
  const renderComment = useCallback((comment: Comment, depth: number = 0) => {
    const isCollapsed = collapsedThreads.has(comment.id);
    const hasReplies = comment.replies && comment.replies.length > 0;
    const canNest = depth < maxDepth;
    
    return (
      <div key={comment.id} className="comment-thread">
        {/* 评论项 */}
        <CommentItem
          comment={comment}
          depth={depth}
          maxDepth={maxDepth}
          isCollapsed={isCollapsed}
          onReply={onReply}
          onLike={onLike}
          onDelete={onDelete}
          onToggleCollapse={() => toggleThreadCollapse(comment.id)}
          onToggleExpansion={() => toggleCommentExpansion(comment.id)}
          isExpanded={expandedComments.has(comment.id)}
        />
        
        {/* 回复列表 */}
        {hasReplies && !isCollapsed && canNest && (
          <div className="ml-4 md:ml-8 border-l-2 border-gray-100 pl-4 space-y-3">
            {comment.replies!.map(reply => renderComment(reply, depth + 1))}
          </div>
        )}
        
        {/* 深度超限提示 */}
        {hasReplies && !isCollapsed && !canNest && (
          <div className="ml-4 md:ml-8 mt-2">
            <button
              onClick={() => toggleCommentExpansion(comment.id)}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              查看 {comment.replies!.length} 条回复
            </button>
          </div>
        )}
      </div>
    );
  }, [collapsedThreads, maxDepth, onReply, onLike, onDelete, toggleThreadCollapse, toggleCommentExpansion, expandedComments]);
  
  // 处理的评论数据
  const processedComments = React.useMemo(() => {
    const tree = buildCommentTree(comments);
    return sortComments(tree, sortBy);
  }, [comments, buildCommentTree, sortComments, sortBy]);
  
  // 计算统计信息
  const stats = React.useMemo(() => {
    return getCommentStats(processedComments);
  }, [processedComments, getCommentStats]);
  
  // 如果没有评论
  if (!loading && processedComments.length === 0) {
    return (
      <div className={`text-center py-12 ${className}`}>
        <MessageCircle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <p className="text-gray-500 text-lg mb-2">还没有评论</p>
        <p className="text-gray-400 text-sm">成为第一个发表评论的人吧！</p>
      </div>
    );
  }
  
  return (
    <div className={`space-y-4 ${className}`}>
      {/* 评论统计和排序 */}
      {processedComments.length > 0 && (
        <div className="flex items-center justify-between py-3 border-b border-gray-200">
          {/* 统计信息 */}
          <div className="text-sm text-gray-600">
            共 {stats.totalCount} 条评论
            {stats.totalLikes > 0 && (
              <span className="ml-2">· {stats.totalLikes} 个赞</span>
            )}
          </div>
          
          {/* 排序选择 */}
          {onSortChange && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">排序：</span>
              <select
                value={sortBy}
                onChange={(e) => onSortChange(e.target.value as any)}
                className="text-sm border border-gray-300 rounded px-2 py-1 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {SORT_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}
      
      {/* 加载状态 */}
      {loading && processedComments.length === 0 && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600 mr-2" />
          <span className="text-gray-600">加载评论中...</span>
        </div>
      )}
      
      {/* 评论列表 */}
      <div className="space-y-4">
        {processedComments.map(comment => renderComment(comment))}
      </div>
      
      {/* 加载更多按钮 */}
      {hasMore && (
        <div className="text-center pt-6">
          <button
            onClick={handleLoadMore}
            disabled={loadingMore || loading}
            className="px-6 py-2 text-sm font-medium text-blue-600 border border-blue-600 rounded-lg hover:bg-blue-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 mx-auto"
          >
            {loadingMore ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>加载中...</span>
              </>
            ) : (
              <>
                <ChevronDown className="w-4 h-4" />
                <span>加载更多评论</span>
              </>
            )}
          </button>
        </div>
      )}
      
      {/* 底部加载状态 */}
      {loading && processedComments.length > 0 && (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="w-5 h-5 animate-spin text-blue-600 mr-2" />
          <span className="text-sm text-gray-600">加载更多评论...</span>
        </div>
      )}
    </div>
  );
};

export default CommentList;
export type { CommentListProps };