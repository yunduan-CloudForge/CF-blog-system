import React, { useState, useRef, useEffect } from 'react';
import { Send, X, User } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { commentUtils } from '../services/commentAPI';

// 评论表单Props接口
interface CommentFormProps {
  articleId: number;
  parentId?: number;
  placeholder?: string;
  initialContent?: string;
  onSubmit: (content: string) => Promise<boolean>;
  onCancel?: () => void;
  loading?: boolean;
  className?: string;
  autoFocus?: boolean;
  maxLength?: number;
}

// 评论表单组件
const CommentForm: React.FC<CommentFormProps> = ({
  // articleId: _articleId, // 暂时未使用
  parentId,
  placeholder = '写下你的评论...',
  initialContent = '',
  onSubmit,
  onCancel,
  loading = false,
  className = '',
  autoFocus = false,
  maxLength = 1000
}) => {
  // 状态管理
  const { isAuthenticated, user } = useAuthStore();
  const [content, setContent] = useState('');
  const [error, setError] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // 引用
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  // 设置初始内容
  useEffect(() => {
    if (initialContent) {
      setContent(initialContent);
      setIsFocused(true);
    }
  }, [initialContent]);
  
  // 自动聚焦
  useEffect(() => {
    if (autoFocus && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [autoFocus]);
  
  // 自动调整文本域高度
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [content]);
  
  // 处理内容变化
  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    
    // 长度限制
    if (newContent.length > maxLength) {
      return;
    }
    
    setContent(newContent);
    
    // 清除错误信息
    if (error) {
      setError('');
    }
  };
  
  // 处理键盘事件
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Ctrl/Cmd + Enter 提交
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
    
    // Escape 取消
    if (e.key === 'Escape' && onCancel) {
      e.preventDefault();
      onCancel();
    }
  };
  
  // 处理表单提交
  const handleSubmit = async () => {
    // 验证登录状态
    if (!isAuthenticated) {
      setError('请先登录后再发表评论');
      return;
    }
    
    // 验证内容
    const validation = commentUtils.validateCommentContent(content);
    if (!validation.isValid) {
      setError(validation.error || '评论内容无效');
      return;
    }
    
    setIsSubmitting(true);
    setError('');
    
    try {
      const success = await onSubmit(content);
      if (success) {
        // 提交成功，清空表单
        setContent('');
        setIsFocused(false);
        
        // 如果是回复表单，调用取消回调
        if (parentId && onCancel) {
          onCancel();
        }
      }
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : '提交失败，请重试');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // 处理取消
  const handleCancel = () => {
    setContent('');
    setError('');
    setIsFocused(false);
    
    if (onCancel) {
      onCancel();
    }
  };
  
  // 处理聚焦
  const handleFocus = () => {
    setIsFocused(true);
  };
  
  // 处理失焦
  const handleBlur = () => {
    // 延迟失焦，避免点击按钮时立即失焦
    setTimeout(() => {
      if (!content.trim() && !parentId) {
        setIsFocused(false);
      }
    }, 150);
  };
  
  // 计算剩余字符数
  const remainingChars = maxLength - content.length;
  const isNearLimit = remainingChars <= 50;
  
  // 判断是否可以提交
  const canSubmit = content.trim().length >= 2 && !isSubmitting && !loading;
  
  return (
    <div className={`space-y-3 ${className}`}>
      {/* 用户信息（仅在聚焦或有内容时显示） */}
      {(isFocused || content) && isAuthenticated && (
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
            {user?.avatar ? (
              <img
                src={user.avatar}
                alt={user.username}
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              <User className="w-3 h-3 text-white" />
            )}
          </div>
          <span>以 {user?.username} 身份发表{parentId ? '回复' : '评论'}</span>
        </div>
      )}
      
      {/* 文本输入区域 */}
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={content}
          onChange={handleContentChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder}
          disabled={loading || isSubmitting}
          className={`w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none transition-all duration-200 ${
            isFocused || content ? 'min-h-[100px]' : 'min-h-[60px]'
          } ${
            error ? 'border-red-300 focus:ring-red-500' : ''
          } ${
            loading || isSubmitting ? 'opacity-50 cursor-not-allowed' : ''
          }`}
          rows={isFocused || content ? 4 : 2}
        />
        
        {/* 字符计数 */}
        {(isFocused || content) && (
          <div className={`absolute bottom-2 right-2 text-xs ${
            isNearLimit ? 'text-red-500' : 'text-gray-400'
          }`}>
            {remainingChars}
          </div>
        )}
      </div>
      
      {/* 错误提示 */}
      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-2">
          {error}
        </div>
      )}
      
      {/* 操作按钮（仅在聚焦或有内容时显示） */}
      {(isFocused || content || parentId) && (
        <div className="flex items-center justify-between">
          {/* 提示信息 */}
          <div className="text-xs text-gray-500">
            {isAuthenticated ? (
              <span>按 Ctrl+Enter 快速发布</span>
            ) : (
              <span className="text-red-500">请先登录后再发表评论</span>
            )}
          </div>
          
          {/* 按钮组 */}
          <div className="flex items-center gap-2">
            {/* 取消按钮（仅回复时显示） */}
            {parentId && (
              <button
                type="button"
                onClick={handleCancel}
                disabled={isSubmitting}
                className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 transition-colors disabled:opacity-50"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            
            {/* 提交按钮 */}
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit}
              className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-all duration-200 flex items-center gap-1.5 ${
                canSubmit
                  ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              {isSubmitting ? (
                <>
                  <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                  <span>发布中...</span>
                </>
              ) : (
                <>
                  <Send className="w-3 h-3" />
                  <span>{parentId ? '回复' : '发表评论'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
      
      {/* 登录提示（未登录时显示） */}
      {!isAuthenticated && (isFocused || content) && (
        <div className="text-center py-4 bg-gray-50 rounded-lg border border-gray-200">
          <p className="text-sm text-gray-600 mb-2">请先登录后再发表评论</p>
          <button
            onClick={() => window.location.href = '/login'}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            立即登录
          </button>
        </div>
      )}
    </div>
  );
};

export default CommentForm;
export type { CommentFormProps };