import React, { useState, useRef, useEffect } from 'react';
import { Heart, MessageCircle, MoreHorizontal, Reply, Trash2, Edit3, Flag, ChevronDown, ChevronUp, User } from 'lucide-react';
import { Comment } from '../store/commentStore';
import { useAuthStore } from '../store/authStore';
import { commentUtils } from '../services/commentAPI';
import CommentForm from './CommentForm';
import CommentActions from './CommentActions';

// 评论项Props接口
interface CommentItemProps {
  comment: Comment;
  depth?: number;
  maxDepth?: number;
  isCollapsed?: boolean;
  isExpanded?: boolean;
  onReply?: (parentId: number) => void;
  onLike?: (commentId: number) => void;
  onDelete?: (commentId: number) => void;
  onToggleCollapse?: () => void;
  onToggleExpansion?: () => void;
  className?: string;
  showActions?: boolean;
}

// 评论项组件
const CommentItem: React.FC<CommentItemProps> = ({
  comment,
  depth = 0,
  maxDepth = 3,
  isCollapsed = false,
  isExpanded = false,
  onReply,
  onLike,
  onDelete,
  onToggleCollapse,
  onToggleExpansion,
  className = '',
  showActions = true
}) => {
  // 状态管理
  const { user, isAuthenticated } = useAuthStore();
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [isLiking, setIsLiking] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [localLiked, setLocalLiked] = useState(comment.is_liked || false);
  const [localLikesCount, setLocalLikesCount] = useState(comment.likes_count || 0);
  
  // 引用
  const menuRef = useRef<HTMLDivElement>(null);
  
  // 处理点击外部关闭菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };
    
    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showMenu]);
  
  // 处理点赞
  const handleLike = async () => {
    if (!isAuthenticated || isLiking) return;
    
    setIsLiking(true);
    
    // 乐观更新
    const newLiked = !localLiked;
    const newCount = newLiked ? localLikesCount + 1 : localLikesCount - 1;
    
    setLocalLiked(newLiked);
    setLocalLikesCount(newCount);
    
    try {
      if (onLike) {
        await onLike(comment.id);
      }
    } catch (error) {
      // 回滚乐观更新
      setLocalLiked(!newLiked);
      setLocalLikesCount(localLikesCount);
      console.error('点赞失败:', error);
    } finally {
      setIsLiking(false);
    }
  };
  
  // 处理回复
  const handleReply = () => {
    if (!isAuthenticated) {
      // 跳转到登录页面
      window.location.href = '/login';
      return;
    }
    
    setShowReplyForm(!showReplyForm);
  };
  
  // 处理回复提交
  const handleReplySubmit = async (content: string): Promise<boolean> => {
    try {
      if (onReply) {
        await onReply(comment.id);
      }
      setShowReplyForm(false);
      return true;
    } catch (error) {
      console.error('回复失败:', error);
      return false;
    }
  };
  
  // 处理删除
  const handleDelete = async () => {
    if (!window.confirm('确定要删除这条评论吗？')) {
      return;
    }
    
    try {
      if (onDelete) {
        await onDelete(comment.id);
      }
      setShowMenu(false);
    } catch (error) {
      console.error('删除失败:', error);
    }
  };
  
  // 处理编辑
  const handleEdit = () => {
    setIsEditing(true);
    setShowMenu(false);
  };
  
  // 处理举报
  const handleReport = () => {
    // TODO: 实现举报功能
    alert('举报功能开发中...');
    setShowMenu(false);
  };
  
  // 判断是否是评论作者
  const isAuthor = user?.id === comment.user_id;
  
  // 判断是否可以删除（作者或管理员）
  const canDelete = isAuthor || user?.role === 'admin';
  
  // 判断是否可以编辑（仅作者）
  const canEdit = isAuthor;
  
  // 计算缩进样式
  const indentClass = depth > 0 ? `ml-${Math.min(depth * 4, 16)}` : '';
  
  // 格式化时间
  const formatTime = (dateString: string) => {
    return commentUtils.formatCommentTime(dateString);
  };
  
  // 渲染用户头像
  const renderAvatar = () => {
    if (comment.user?.avatar) {
      return (
        <img
          src={comment.user.avatar}
          alt={comment.user.username}
          className="w-8 h-8 rounded-full object-cover"
        />
      );
    }
    
    return (
      <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
        <User className="w-4 h-4 text-white" />
      </div>
    );
  };
  
  // 渲染评论内容
  const renderContent = () => {
    if (comment.is_deleted) {
      return (
        <div className="text-gray-400 italic py-2">
          此评论已被删除
        </div>
      );
    }
    
    if (isEditing) {
      return (
        <CommentForm
          articleId={comment.article_id}
          placeholder="编辑评论..."
          onSubmit={async (content) => {
            // TODO: 实现编辑评论API
            setIsEditing(false);
            return true;
          }}
          onCancel={() => setIsEditing(false)}
          autoFocus
          className="mt-2"
        />
      );
    }
    
    return (
      <div className="text-gray-800 leading-relaxed whitespace-pre-wrap break-words">
        {comment.content}
      </div>
    );
  };
  
  return (
    <div className={`comment-item ${className}`}>
      <div className="flex gap-3">
        {/* 用户头像 */}
        <div className="flex-shrink-0">
          {renderAvatar()}
        </div>
        
        {/* 评论主体 */}
        <div className="flex-1 min-w-0">
          {/* 用户信息和时间 */}
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-gray-900">
              {comment.user?.username || '匿名用户'}
            </span>
            
            {/* 作者标识 */}
            {comment.user?.role === 'admin' && (
              <span className="px-1.5 py-0.5 text-xs bg-red-100 text-red-600 rounded">
                管理员
              </span>
            )}
            
            {/* 时间 */}
            <span className="text-sm text-gray-500">
              {formatTime(comment.created_at)}
            </span>
            
            {/* 编辑标识 */}
            {comment.updated_at && comment.updated_at !== comment.created_at && (
              <span className="text-xs text-gray-400">
                已编辑
              </span>
            )}
          </div>
          
          {/* 评论内容 */}
          <div className="mb-3">
            {renderContent()}
          </div>
          
          {/* 操作按钮 */}
          {showActions && !comment.is_deleted && !isEditing && (
            <div className="flex items-center gap-4">
              {/* 点赞按钮 */}
              <button
                onClick={handleLike}
                disabled={!isAuthenticated || isLiking}
                className={`flex items-center gap-1 text-sm transition-colors ${
                  localLiked
                    ? 'text-red-500 hover:text-red-600'
                    : 'text-gray-500 hover:text-red-500'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <Heart
                  className={`w-4 h-4 transition-all ${
                    localLiked ? 'fill-current' : ''
                  } ${
                    isLiking ? 'scale-110' : ''
                  }`}
                />
                {localLikesCount > 0 && (
                  <span>{localLikesCount}</span>
                )}
              </button>
              
              {/* 回复按钮 */}
              <button
                onClick={handleReply}
                className="flex items-center gap-1 text-sm text-gray-500 hover:text-blue-500 transition-colors"
              >
                <Reply className="w-4 h-4" />
                <span>回复</span>
              </button>
              
              {/* 折叠按钮（有回复时显示） */}
              {comment.replies && comment.replies.length > 0 && onToggleCollapse && (
                <button
                  onClick={onToggleCollapse}
                  className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition-colors"
                >
                  {isCollapsed ? (
                    <>
                      <ChevronDown className="w-4 h-4" />
                      <span>展开 {comment.replies.length} 条回复</span>
                    </>
                  ) : (
                    <>
                      <ChevronUp className="w-4 h-4" />
                      <span>折叠回复</span>
                    </>
                  )}
                </button>
              )}
              
              {/* 更多操作菜单 */}
              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setShowMenu(!showMenu)}
                  className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <MoreHorizontal className="w-4 h-4" />
                </button>
                
                {showMenu && (
                  <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-10 min-w-[120px]">
                    {/* 编辑 */}
                    {canEdit && (
                      <button
                        onClick={handleEdit}
                        className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                      >
                        <Edit3 className="w-3 h-3" />
                        编辑
                      </button>
                    )}
                    
                    {/* 删除 */}
                    {canDelete && (
                      <button
                        onClick={handleDelete}
                        className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                      >
                        <Trash2 className="w-3 h-3" />
                        删除
                      </button>
                    )}
                    
                    {/* 举报 */}
                    {!isAuthor && (
                      <button
                        onClick={handleReport}
                        className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                      >
                        <Flag className="w-3 h-3" />
                        举报
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* 回复表单 */}
          {showReplyForm && (
            <div className="mt-3">
              <CommentForm
                articleId={comment.article_id}
                parentId={comment.id}
                placeholder={`回复 @${comment.user?.username}...`}
                onSubmit={handleReplySubmit}
                onCancel={() => setShowReplyForm(false)}
                autoFocus
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CommentItem;
export type { CommentItemProps