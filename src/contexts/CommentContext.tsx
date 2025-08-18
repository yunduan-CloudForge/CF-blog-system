import React, { createContext, useContext, useReducer, ReactNode } from 'react';
import toast from 'react-hot-toast';

// 回复状态接口
interface ReplyState {
  activeReplyId: number | null;
  replyContent: string;
  isSubmitting: boolean;
  error: string | null;
  loading: boolean;
  submitting: boolean;
}

// 回复操作类型
type ReplyAction =
  | { type: 'START_REPLY'; commentId: number }
  | { type: 'CANCEL_REPLY' }
  | { type: 'SET_CONTENT'; content: string }
  | { type: 'SET_SUBMITTING'; isSubmitting: boolean }
  | { type: 'SET_ERROR'; error: string | null }
  | { type: 'SET_LOADING'; loading: boolean }
  | { type: 'RESET_FORM' }
  | { type: 'REPLY_SUCCESS' };

// 回复状态reducer
const replyReducer = (state: ReplyState, action: ReplyAction): ReplyState => {
  switch (action.type) {
    case 'START_REPLY':
      return {
        ...state,
        activeReplyId: action.commentId,
        replyContent: '',
        error: null
      };
    case 'CANCEL_REPLY':
      return {
        ...state,
        activeReplyId: null,
        replyContent: '',
        error: null,
        submitting: false
      };
    case 'SET_CONTENT':
      return {
        ...state,
        replyContent: action.content,
        error: null
      };
    case 'SET_SUBMITTING':
      return {
        ...state,
        isSubmitting: action.isSubmitting,
        submitting: action.isSubmitting,
        error: null
      };
    case 'SET_ERROR':
      return {
        ...state,
        error: action.error,
        isSubmitting: false,
        submitting: false
      };
    case 'SET_LOADING':
      return {
        ...state,
        loading: action.loading
      };
    case 'RESET_FORM':
      return {
        ...state,
        replyContent: '',
        error: null,
        isSubmitting: false,
        submitting: false
      };
    case 'REPLY_SUCCESS':
      return {
        ...state,
        activeReplyId: null,
        replyContent: '',
        isSubmitting: false,
        submitting: false,
        error: null
      };
    default:
      return state;
  }
};

// Context接口
interface CommentContextValue {
  // 回复状态
  replyState: ReplyState;
  
  // 回复操作
  startReply: (commentId: number) => void;
  cancelReply: () => void;
  setReplyContent: (content: string) => void;
  submitReply: (parentId: number, content: string) => Promise<boolean>;
  clearError: () => void;
  resetForm: () => void;
  
  // 其他评论操作
  onLike?: (commentId: number) => Promise<void>;
  onDelete?: (commentId: number) => Promise<void>;
  onEdit?: (commentId: number, content: string) => Promise<boolean>;
  
  // 配置
  articleId: number;
  maxDepth?: number;
  allowAnonymous?: boolean;
}

// 创建Context
const CommentContext = createContext<CommentContextValue | null>(null);

// Context Provider Props
interface CommentProviderProps {
  children: ReactNode;
  articleId: number;
  maxDepth?: number;
  allowAnonymous?: boolean;
  onReply: (parentId: number, content: string) => Promise<boolean>;
  onLike?: (commentId: number) => Promise<void>;
  onDelete?: (commentId: number) => Promise<void>;
  onEdit?: (commentId: number, content: string) => Promise<boolean>;
}

// Context Provider组件
export const CommentProvider: React.FC<CommentProviderProps> = ({
  children,
  articleId,
  maxDepth = 3,
  allowAnonymous = false,
  onReply,
  onLike,
  onDelete,
  onEdit
}) => {
  const [replyState, dispatch] = useReducer(replyReducer, {
    activeReplyId: null,
    replyContent: '',
    isSubmitting: false,
    error: null,
    loading: false,
    submitting: false
  });

  // 开始回复
  const startReply = (commentId: number) => {
    dispatch({ type: 'START_REPLY', commentId });
  };

  // 取消回复
  const cancelReply = () => {
    dispatch({ type: 'CANCEL_REPLY' });
  };

  // 设置回复内容
  const setReplyContent = (content: string) => {
    dispatch({ type: 'SET_CONTENT', content });
  };

  // 清除错误
  const clearError = () => {
    dispatch({ type: 'SET_ERROR', error: null });
  };

  // 重置表单
  const resetForm = () => {
    dispatch({ type: 'RESET_FORM' });
  };

  // 提交回复
  const submitReply = async (parentId: number, content: string): Promise<boolean> => {
    if (!content.trim()) {
      dispatch({ type: 'SET_ERROR', error: '回复内容不能为空' });
      return false;
    }

    dispatch({ type: 'SET_SUBMITTING', isSubmitting: true });
    dispatch({ type: 'SET_ERROR', error: null });

    try {
      const success = await onReply(parentId, content.trim());
      if (success) {
        dispatch({ type: 'REPLY_SUCCESS' });
        // 显示成功提示
         toast.success('回复发表成功');
        return true;
      } else {
        dispatch({ type: 'SET_ERROR', error: '回复失败，请重试' });
        return false;
      }
    } catch (error: unknown) {
      const errorMessage = (error as Error)?.message || '回复失败，请重试';
      dispatch({ type: 'SET_ERROR', error: errorMessage });
      // 显示错误提示
       toast.error(errorMessage);
      return false;
    }
  };

  const contextValue: CommentContextValue = {
    replyState,
    startReply,
    cancelReply,
    setReplyContent,
    submitReply,
    clearError,
    resetForm,
    onLike,
    onDelete,
    onEdit,
    articleId,
    maxDepth,
    allowAnonymous
  };

  return (
    <CommentContext.Provider value={contextValue}>
      {children}
    </CommentContext.Provider>
  );
};

// Hook for using comment context
export const useCommentContext = () => {
  const context = useContext(CommentContext);
  if (!context) {
    throw new Error('useCommentContext must be used within a CommentProvider');
  }
  return context;
};

export type { CommentContextValue, ReplyState };