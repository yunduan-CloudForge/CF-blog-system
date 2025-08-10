import React from 'react';
import { Skeleton, TextSkeleton, AvatarSkeleton, ButtonSkeleton } from '../ui/Skeleton';
import { cn } from '../../utils/cn';

// 单个评论骨架屏
export const CommentItemSkeleton: React.FC<{ 
  className?: string;
  showReplyButton?: boolean;
  isReply?: boolean;
}> = ({ className, showReplyButton = true, isReply = false }) => {
  return (
    <div className={cn(
      'flex space-x-3 p-4 bg-white dark:bg-gray-800 rounded-lg',
      isReply && 'ml-8 bg-gray-50 dark:bg-gray-750',
      className
    )}>
      {/* 用户头像 */}
      <AvatarSkeleton size="md" />
      
      {/* 评论内容 */}
      <div className="flex-1 space-y-3">
        {/* 用户名和时间 */}
        <div className="flex items-center space-x-3">
          <Skeleton height="1rem" width="5rem" />
          <Skeleton height="0.875rem" width="4rem" />
        </div>
        
        {/* 评论文本 */}
        <TextSkeleton lines={2} />
        
        {/* 操作按钮 */}
        {showReplyButton && (
          <div className="flex items-center space-x-4">
            <Skeleton height="1.5rem" width="3rem" />
            <Skeleton height="1.5rem" width="3rem" />
            <Skeleton height="1.5rem" width="4rem" />
          </div>
        )}
      </div>
    </div>
  );
};

// 评论列表骨架屏
export const CommentListSkeleton: React.FC<{ 
  count?: number;
  className?: string;
  showReplies?: boolean;
}> = ({ count = 5, className, showReplies = true }) => {
  return (
    <div className={cn('space-y-4', className)}>
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="space-y-3">
          <CommentItemSkeleton />
          
          {/* 随机显示回复 */}
          {showReplies && Math.random() > 0.6 && (
            <div className="space-y-2">
              {Array.from({ length: Math.floor(Math.random() * 2) + 1 }).map((_, replyIndex) => (
                <CommentItemSkeleton
                  key={replyIndex}
                  isReply
                  showReplyButton={false}
                />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

// 评论表单骨架屏
export const CommentFormSkeleton: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <div className={cn('bg-white dark:bg-gray-800 rounded-lg p-6 space-y-4', className)}>
      {/* 表单标题 */}
      <Skeleton height="1.5rem" width="6rem" />
      
      {/* 用户信息（如果未登录） */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Skeleton height="2.5rem" className="w-full" />
        <Skeleton height="2.5rem" className="w-full" />
      </div>
      
      {/* 评论内容输入框 */}
      <Skeleton height="8rem" className="w-full" />
      
      {/* 提交按钮 */}
      <div className="flex justify-end">
        <ButtonSkeleton />
      </div>
    </div>
  );
};

// 评论统计骨架屏
export const CommentStatsSkeleton: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <div className={cn('flex items-center space-x-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg', className)}>
      <div className="flex items-center space-x-2">
        <Skeleton height="1rem" width="1rem" />
        <Skeleton height="1rem" width="4rem" />
      </div>
      
      <div className="flex items-center space-x-2">
        <Skeleton height="1rem" width="1rem" />
        <Skeleton height="1rem" width="3rem" />
      </div>
      
      <div className="flex items-center space-x-2">
        <Skeleton height="1rem" width="1rem" />
        <Skeleton height="1rem" width="5rem" />
      </div>
    </div>
  );
};

// 评论回复表单骨架屏
export const ReplyFormSkeleton: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <div className={cn('ml-8 mt-3 p-4 bg-gray-50 dark:bg-gray-750 rounded-lg space-y-3', className)}>
      {/* 回复输入框 */}
      <Skeleton height="6rem" className="w-full" />
      
      {/* 操作按钮 */}
      <div className="flex justify-end space-x-2">
        <Skeleton height="2rem" width="4rem" />
        <Skeleton height="2rem" width="4rem" />
      </div>
    </div>
  );
};

// 评论加载更多骨架屏
export const LoadMoreCommentsSkeleton: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <div className={cn('flex justify-center py-6', className)}>
      <div className="flex items-center space-x-3">
        <Skeleton height="1rem" width="1rem" className="rounded-full" />
        <Skeleton height="1rem" width="8rem" />
      </div>
    </div>
  );
};

// 评论排序选择器骨架屏
export const CommentSortSkeleton: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <div className={cn('flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700', className)}>
      <Skeleton height="1.25rem" width="6rem" />
      
      <div className="flex items-center space-x-4">
        <Skeleton height="2rem" width="8rem" />
        <Skeleton height="2rem" width="6rem" />
      </div>
    </div>
  );
};