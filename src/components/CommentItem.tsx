import React, { useState, useRef, useEffect } from 'react';
import { Heart, MoreHorizontal, Reply, Trash2, Edit3, Flag, ChevronDown, ChevronUp } from 'lucide-react';
import { Comment } from '../store/commentStore';
import { useAuthStore } from '../store/authStore';
import { useCommentContext } from '../contexts/CommentContext';
import { commentUtils } from '../services/commentAPI';
import CommentForm from './CommentForm';

// 评论项Props接口
interface CommentItemProps {
  comment: Comment;
  depth?: number;
  isCollapsed?: boolean;
  isExpanded?: boolean;
  onToggleCollapse?: () => void;
  onToggleExpansion?: () => void;
  className?: string;
  showActions?: boolean;
}

// 评论项组件
const CommentItem: React.FC<CommentItemProps> = ({
  comment,
  depth = 0,
  isCollapsed = false,
  // isExpanded: _isExpanded = false, // 暂时未使用
  onToggleCollapse,
  // onToggleExpansion: _onToggleExpansion, // 暂时未使用
  className = '',
  showActions = true
}) => {
  // 获取认证状态
  const { user, isAuthenticated } = useAuthStore();
  
  // 获取评论上下文
  const {
    replyState,
    startReply,
    cancelReply,
    // setReplyContent, // 暂时未使用
    submitReply,
    clearError,
    // resetForm, // 暂时未使用
    onLike,
    onDelete,
    onEdit
    // maxDepth // 暂时未使用
  } = useCommentContext();
  
  const [isLiking, setIsLiking] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [localLiked, setLocalLiked] = useState(comment.is_liked || false);
  const [localLikesCount, setLocalLikesCount] = useState(comment.likes || 0);
  
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
    
    if (replyState.activeReplyId === comment.id) {
      cancelReply();
    } else {
      startReply(comment.id);
    }
  };
  
  // 处理回复提交
  const handleReplySubmit = async (content: string): Promise<boolean> => {
    try {
      const result = await submitReply(comment.id, content);
      return result;
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
  
  // 处理编辑提交
  const handleEditSubmit = async (content: string): Promise<boolean> => {
    try {
      if (onEdit) {
        const result = await onEdit(comment.id, content);
        if (result) {
          setIsEditing(false);
          return true;
        }
      }
      return false;
    } catch (error) {
      console.error('编辑失败:', error);
      return false;
    }
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
  
  // 计算缩进样式 - 使用固定的Tailwind类名
  // const getIndentClass = (depth: number) => {
  //   switch (depth) {
  //     case 0: return '';
  //     case 1: return 'ml-4';
  //     case 2: return 'ml-8';
  //     case 3: return 'ml-12';
  //     default: return 'ml-16';
  //   }
  // };
  
  // const indentClass = getIndentClass(depth); // 暂时未使用
  
  // 获取时间信息
  const getTimeInfo = (dateString: string) => {
    return commentUtils.getDetailedTimeInfo(dateString);
  };
  
  const timeInfo = getTimeInfo(comment.created_at);
  const editTimeInfo = comment.updated_at && comment.updated_at !== comment.created_at 
    ? getTimeInfo(comment.updated_at) 
    : null;
  
  // 渲染用户头像
  const renderAvatar = () => {
    const username = comment.user?.username || '匿名用户';
    const avatarColor = commentUtils.generateAvatarPlaceholder(username);
    
    if (comment.user?.avatar) {
      return (
        <div className="relative group">
          <img
            src={comment.user.avatar}
            alt={username}
            className="w-8 h-8 rounded-full object-cover border-2 border-gray-200 group-hover:border-blue-300 transition-colors"
            title={`${username}的头像`}
          />
          {comment.user?.role === 'admin' && (
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border border-white" 
                 title="管理员" />
          )}
        </div>
      );
    }
    
    return (
      <div 
        className="w-8 h-8 rounded-full flex items-center justify-center text-white font-medium text-sm border-2 border-gray-200 hover:border-blue-300 transition-colors group"
        style={{ backgroundColor: avatarColor }}
        title={`${username}的头像`}
      >
        {username.charAt(0).toUpperCase()}
        {comment.user?.role === 'admin' && (
          <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border border-white" 
               title="管理员" />
        )}
      </div>
    );
  };
  
  // 格式化评论内容
  const formatContent = (content: string) => {
    if (!content) return content;
    
    // 处理链接
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    let formattedContent = content.replace(urlRegex, '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:text-blue-700 underline">$1</a>');
    
    // 处理@用户提及
    const mentionRegex = /@([\w\u4e00-\u9fa5]+)/g;
    formattedContent = formattedContent.replace(mentionRegex, '<span class="text-blue-600 font-medium bg-blue-50 px-1 rounded">@$1</span>');
    
    // 处理换行
    formattedContent = formattedContent.replace(/\n/g, '<br>');
    
    return formattedContent;
  };

  // 渲染评论内容
  const renderContent = () => {
    if (comment.deleted) {
      return (
        <div className="text-gray-400 italic py-2 flex items-center gap-2">
          <Trash2 className="w-4 h-4" />
          <span>此评论已被删除</span>
        </div>
      );
    }
    
    if (isEditing) {
      return (
        <CommentForm
          articleId={comment.article_id}
          placeholder="编辑评论..."
          initialContent={comment.content}
          onSubmit={handleEditSubmit}
          onCancel={() => setIsEditing(false)}
          autoFocus
          className="mt-2"
        />
      );
    }
    
    return (
      <div 
        className="text-gray-800 leading-relaxed break-words prose prose-sm max-w-none"
        dangerouslySetInnerHTML={{ __html: formatContent(comment.content) }}
      />
    );
  };
  
  // 获取层级样式
  const getDepthStyles = (depth: number) => {
    const baseStyles = "rounded-lg transition-all duration-200";
    switch (depth) {
      case 0:
        return `${baseStyles} bg-white border border-gray-200 p-4`;
      case 1:
        return `${baseStyles} bg-blue-50 border border-blue-200 p-3 ml-4`;
      case 2:
        return `${baseStyles} bg-green-50 border border-green-200 p-3 ml-8`;
      case 3:
        return `${baseStyles} bg-yellow-50 border border-yellow-200 p-3 ml-12`;
      default:
        return `${baseStyles} bg-gray-50 border border-gray-200 p-3 ml-16`;
    }
  };

  return (
    <div className={`comment-item ${className} ${getDepthStyles(depth)}`}>
      <div className="flex gap-3 relative">
        {/* 用户头像 */}
        <div className="flex-shrink-0">
          {renderAvatar()}
        </div>
        
        {/* 评论主体 */}
        <div className="flex-1 min-w-0">
          {/* 用户信息和时间 */}
          <div className="flex items-center gap-2 mb-1">
            {/* 回复层级指示器 */}
            {depth > 0 && (
              <div className="flex items-center gap-1 text-xs text-gray-400">
                <Reply className="w-3 h-3" />
                <span>回复</span>
              </div>
            )}
            
            <span className="font-medium text-gray-900">
              {comment.user?.username || '匿名用户'}
            </span>
            
            {/* 作者标识 */}
            {comment.user?.role === 'admin' && (
              <span className="px-1.5 py-0.5 text-xs bg-red-100 text-red-600 rounded">
                管理员
              </span>
            )}
            
            {/* 层级标识 */}
            {depth > 0 && (
              <span className="px-1.5 py-0.5 text-xs bg-blue-100 text-blue-600 rounded">
                L{depth}
              </span>
            )}
            
            {/* 时间 */}
            <span 
              className="text-sm text-gray-500 hover:text-gray-700 cursor-help transition-colors"
              title={timeInfo.tooltip}
            >
              {timeInfo.relative}
            </span>
            
            {/* 编辑标识 */}
            {editTimeInfo && (
              <span 
                className="text-xs text-orange-500 hover:text-orange-600 cursor-help transition-colors flex items-center gap-1"
                title={`最后编辑于 ${editTimeInfo.absolute}`}
              >
                <Edit3 className="w-3 h-3" />
                <span>已编辑</span>
              </span>
            )}
          </div>
          
          {/* 评论内容 */}
          <div className="mb-3">
            {renderContent()}
          </div>
          
          {/* 操作按钮 */}
          {showActions && !comment.deleted && !isEditing && (
            <div className="flex items-center gap-2">
              {/* 点赞按钮 */}
              <button
                onClick={handleLike}
                disabled={!isAuthenticated || isLiking}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                  localLiked
                    ? 'text-red-600 bg-red-50 hover:bg-red-100 border border-red-200'
                    : 'text-gray-600 bg-gray-50 hover:bg-red-50 hover:text-red-600 border border-gray-200 hover:border-red-200'
                } disabled:opacity-50 disabled:cursor-not-allowed ${
                  isLiking ? 'scale-95' : 'hover:scale-105'
                }`}
                title={isAuthenticated ? (localLiked ? '取消点赞' : '点赞') : '请先登录'}
              >
                <Heart
                  className={`w-4 h-4 transition-all duration-200 ${
                    localLiked ? 'fill-current scale-110' : ''
                  } ${
                    isLiking ? 'animate-pulse' : ''
                  }`}
                />
                <span>{localLikesCount > 0 ? localLikesCount : '赞'}</span>
              </button>
              
              {/* 回复按钮 */}
              <button
                onClick={handleReply}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                  replyState.activeReplyId === comment.id
                    ? 'text-blue-600 bg-blue-50 border border-blue-200'
                    : 'text-gray-600 bg-gray-50 hover:bg-blue-50 hover:text-blue-600 border border-gray-200 hover:border-blue-200'
                } hover:scale-105`}
                title={isAuthenticated ? '回复评论' : '请先登录后回复'}
              >
                <Reply className="w-4 h-4" />
                <span>{replyState.activeReplyId === comment.id ? '取消' : '回复'}</span>
              </button>
              
              {/* 折叠按钮（有回复时显示） */}
              {comment.replies && comment.replies.length > 0 && onToggleCollapse && (
                <button
                  onClick={onToggleCollapse}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-gray-600 bg-gray-50 hover:bg-gray-100 border border-gray-200 hover:border-gray-300 transition-all duration-200 hover:scale-105"
                  title={isCollapsed ? '展开回复' : '折叠回复'}
                >
                  {isCollapsed ? (
                    <>
                      <ChevronDown className="w-4 h-4" />
                      <span>展开 {comment.replies.length}</span>
                    </>
                  ) : (
                    <>
                      <ChevronUp className="w-4 h-4" />
                      <span>折叠</span>
                    </>
                  )}
                </button>
              )}
              
              {/* 更多操作菜单 */}
              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setShowMenu(!showMenu)}
                  className={`p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all duration-200 ${
                    showMenu ? 'bg-gray-100 text-gray-600' : ''
                  }`}
                  title="更多操作"
                >
                  <MoreHorizontal className="w-4 h-4" />
                </button>
                
                {showMenu && (
                  <div className="absolute right-0 top-full mt-2 bg-white border border-gray-200 rounded-xl shadow-xl py-2 z-20 min-w-[140px] animate-in slide-in-from-top-2 duration-200">
                    {/* 编辑 */}
                    {canEdit && (
                      <button
                        onClick={handleEdit}
                        className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 flex items-center gap-3 transition-colors duration-200"
                      >
                        <Edit3 className="w-4 h-4" />
                        <span>编辑评论</span>
                      </button>
                    )}
                    
                    {/* 删除 */}
                    {canDelete && (
                      <button
                        onClick={handleDelete}
                        className="w-full px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50 hover:text-red-700 flex items-center gap-3 transition-colors duration-200"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span>删除评论</span>
                      </button>
                    )}
                    
                    {/* 分割线 */}
                    {(canEdit || canDelete) && !isAuthor && (
                      <div className="my-1 border-t border-gray-100" />
                    )}
                    
                    {/* 举报 */}
                    {!isAuthor && (
                      <button
                        onClick={handleReport}
                        className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-orange-50 hover:text-orange-600 flex items-center gap-3 transition-colors duration-200"
                      >
                        <Flag className="w-4 h-4" />
                        <span>举报评论</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* 回复表单 */}
          {replyState.activeReplyId === comment.id && (
            <div className="mt-3">
              <CommentForm
                articleId={comment.article_id}
                parentId={comment.id}
                placeholder={`回复 @${comment.user?.username}...`}
                onSubmit={handleReplySubmit}
                onCancel={cancelReply}
                autoFocus
                loading={replyState.submitting}
              />
              {replyState.error && (
                <div className="mt-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-2 flex items-center justify-between">
                  <span>{replyState.error}</span>
                  <button
                    onClick={clearError}
                    className="text-red-400 hover:text-red-600 ml-2"
                  >
                    ×
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CommentItem;
export type { CommentItemProps };