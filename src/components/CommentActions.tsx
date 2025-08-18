import React, { useState, useRef, useEffect } from 'react';
import { Heart, MessageCircle, Share2, MoreHorizontal, Edit3, Trash2, Flag, Copy, Link } from 'lucide-react';
import { Comment } from '../store/commentStore';
import { useAuthStore } from '../store/authStore';

// 评论操作Props接口
interface CommentActionsProps {
  comment: Comment;
  onLike?: (commentId: number) => Promise<void>;
  onReply?: (commentId: number) => void;
  onEdit?: (commentId: number) => void;
  onDelete?: (commentId: number) => Promise<void>;
  onReport?: (commentId: number) => void;
  onShare?: (commentId: number) => void;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showLabels?: boolean;
  disabled?: boolean;
}

// 评论操作组件
const CommentActions: React.FC<CommentActionsProps> = ({
  comment,
  onLike,
  onReply,
  onEdit,
  onDelete,
  onReport,
  // onShare: _onShare, // 暂时未实现分享功能
  className = '',
  size = 'md',
  showLabels = true,
  disabled = false
}) => {
  // 状态管理
  const { user, isAuthenticated } = useAuthStore();
  const [isLiking, setIsLiking] = useState(false);
  const [localLiked, setLocalLiked] = useState(comment.is_liked || false);
  const [localLikesCount, setLocalLikesCount] = useState(comment.likes || 0);
  const [showMenu, setShowMenu] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  
  // 引用
  const menuRef = useRef<HTMLDivElement>(null);
  const shareMenuRef = useRef<HTMLDivElement>(null);
  
  // 处理点击外部关闭菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
      if (shareMenuRef.current && !shareMenuRef.current.contains(event.target as Node)) {
        setShowShareMenu(false);
      }
    };
    
    if (showMenu || showShareMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showMenu, showShareMenu]);
  
  // 处理点赞
  const handleLike = async () => {
    if (!isAuthenticated || isLiking || disabled) {
      if (!isAuthenticated) {
        // 提示登录
        alert('请先登录后再点赞');
      }
      return;
    }
    
    setIsLiking(true);
    
    // 乐观更新
    const newLiked = !localLiked;
    const newCount = newLiked ? localLikesCount + 1 : localLikesCount - 1;
    
    setLocalLiked(newLiked);
    setLocalLikesCount(Math.max(0, newCount));
    
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
      alert('请先登录后再回复');
      return;
    }
    
    if (onReply && !disabled) {
      onReply(comment.id);
    }
  };
  
  // 处理编辑
  const handleEdit = () => {
    if (onEdit && !disabled) {
      onEdit(comment.id);
      setShowMenu(false);
    }
  };
  
  // 处理删除
  const handleDelete = async () => {
    if (!window.confirm('确定要删除这条评论吗？删除后无法恢复。')) {
      return;
    }
    
    try {
      if (onDelete && !disabled) {
        await onDelete(comment.id);
        setShowMenu(false);
      }
    } catch (error) {
      console.error('删除失败:', error);
      alert('删除失败，请重试');
    }
  };
  
  // 处理举报
  const handleReport = () => {
    if (onReport && !disabled) {
      onReport(comment.id);
      setShowMenu(false);
    } else {
      // 默认举报处理
      alert('举报功能开发中...');
      setShowMenu(false);
    }
  };
  
  // 处理分享
  const handleShare = () => {
    setShowShareMenu(!showShareMenu);
  };
  
  // 复制评论链接
  const handleCopyLink = async () => {
    try {
      const url = `${window.location.origin}${window.location.pathname}#comment-${comment.id}`;
      await navigator.clipboard.writeText(url);
      alert('链接已复制到剪贴板');
      setShowShareMenu(false);
    } catch (error) {
      console.error('复制失败:', error);
      alert('复制失败，请手动复制');
    }
  };
  
  // 复制评论内容
  const handleCopyContent = async () => {
    try {
      await navigator.clipboard.writeText(comment.content);
      alert('评论内容已复制到剪贴板');
      setShowShareMenu(false);
    } catch (error) {
      console.error('复制失败:', error);
      alert('复制失败，请手动复制');
    }
  };
  
  // 判断权限
  const isAuthor = user?.id === comment.user_id;
  const canEdit = isAuthor && !comment.deleted;
  const canDelete = (isAuthor || user?.role === 'admin') && !comment.deleted;
  const canReport = !isAuthor && !comment.deleted;
  
  // 尺寸样式
  const sizeClasses = {
    sm: {
      icon: 'w-3 h-3',
      text: 'text-xs',
      button: 'p-1',
      gap: 'gap-1'
    },
    md: {
      icon: 'w-4 h-4',
      text: 'text-sm',
      button: 'p-1.5',
      gap: 'gap-1.5'
    },
    lg: {
      icon: 'w-5 h-5',
      text: 'text-base',
      button: 'p-2',
      gap: 'gap-2'
    }
  };
  
  const sizeClass = sizeClasses[size];
  
  return (
    <div className={`flex items-center ${sizeClass.gap} ${className}`}>
      {/* 点赞按钮 */}
      <button
        onClick={handleLike}
        disabled={!isAuthenticated || isLiking || disabled}
        className={`flex items-center ${sizeClass.gap} ${sizeClass.text} transition-all duration-200 ${
          localLiked
            ? 'text-red-500 hover:text-red-600'
            : 'text-gray-500 hover:text-red-500'
        } disabled:opacity-50 disabled:cursor-not-allowed ${
          isLiking ? 'scale-105' : 'hover:scale-105'
        }`}
        title={localLiked ? '取消点赞' : '点赞'}
      >
        <Heart
          className={`${sizeClass.icon} transition-all ${
            localLiked ? 'fill-current' : ''
          } ${
            isLiking ? 'animate-pulse' : ''
          }`}
        />
        {showLabels && localLikesCount > 0 && (
          <span className="font-medium">{localLikesCount}</span>
        )}
      </button>
      
      {/* 回复按钮 */}
      <button
        onClick={handleReply}
        disabled={disabled}
        className={`flex items-center ${sizeClass.gap} ${sizeClass.text} text-gray-500 hover:text-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
        title="回复"
      >
        <MessageCircle className={sizeClass.icon} />
        {showLabels && <span>回复</span>}
      </button>
      
      {/* 分享按钮 */}
      <div className="relative" ref={shareMenuRef}>
        <button
          onClick={handleShare}
          disabled={disabled}
          className={`flex items-center ${sizeClass.gap} ${sizeClass.text} text-gray-500 hover:text-green-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
          title="分享"
        >
          <Share2 className={sizeClass.icon} />
          {showLabels && <span>分享</span>}
        </button>
        
        {/* 分享菜单 */}
        {showShareMenu && (
          <div className="absolute left-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-20 min-w-[140px]">
            <button
              onClick={handleCopyLink}
              className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
            >
              <Link className="w-3 h-3" />
              复制链接
            </button>
            <button
              onClick={handleCopyContent}
              className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
            >
              <Copy className="w-3 h-3" />
              复制内容
            </button>
          </div>
        )}
      </div>
      
      {/* 更多操作菜单 */}
      {(canEdit || canDelete || canReport) && (
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setShowMenu(!showMenu)}
            disabled={disabled}
            className={`${sizeClass.button} text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
            title="更多操作"
          >
            <MoreHorizontal className={sizeClass.icon} />
          </button>
          
          {showMenu && (
            <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-20 min-w-[120px]">
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
              
              {/* 分隔线 */}
              {(canEdit || canDelete) && canReport && (
                <div className="border-t border-gray-100 my-1" />
              )}
              
              {/* 举报 */}
              {canReport && (
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
      )}
    </div>
  );
};

export default CommentActions;
export type { CommentActionsProps };