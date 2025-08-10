import React from 'react';
import { Skeleton, TextSkeleton, AvatarSkeleton } from '../ui/Skeleton';
import { cn } from '../../utils/cn';

// 文章卡片骨架屏
export const ArticleCardSkeleton: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <div className={cn('bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 space-y-4', className)}>
      {/* 文章标题 */}
      <Skeleton height="1.5rem" className="w-3/4" />
      
      {/* 文章摘要 */}
      <TextSkeleton lines={3} />
      
      {/* 文章元信息 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <AvatarSkeleton size="sm" />
          <div className="space-y-1">
            <Skeleton height="0.875rem" width="4rem" />
            <Skeleton height="0.75rem" width="3rem" />
          </div>
        </div>
        
        <div className="flex items-center space-x-4">
          <Skeleton height="0.875rem" width="3rem" />
          <Skeleton height="0.875rem" width="3rem" />
        </div>
      </div>
      
      {/* 标签 */}
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton
            key={index}
            height="1.5rem"
            width={`${Math.random() * 3 + 3}rem`}
            className="rounded-full"
          />
        ))}
      </div>
    </div>
  );
};

// 文章列表骨架屏
export const ArticleListSkeleton: React.FC<{ count?: number; className?: string }> = ({ 
  count = 6, 
  className 
}) => {
  return (
    <div className={cn('space-y-6', className)}>
      {Array.from({ length: count }).map((_, index) => (
        <ArticleCardSkeleton key={index} />
      ))}
    </div>
  );
};

// 文章详情骨架屏
export const ArticleDetailSkeleton: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <div className={cn('max-w-4xl mx-auto space-y-8', className)}>
      {/* 文章标题 */}
      <div className="space-y-4">
        <Skeleton height="2.5rem" className="w-4/5" />
        <Skeleton height="2rem" className="w-3/5" />
      </div>
      
      {/* 文章元信息 */}
      <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 pb-4">
        <div className="flex items-center space-x-4">
          <AvatarSkeleton size="md" />
          <div className="space-y-2">
            <Skeleton height="1rem" width="5rem" />
            <Skeleton height="0.875rem" width="7rem" />
          </div>
        </div>
        
        <div className="flex items-center space-x-6">
          <Skeleton height="0.875rem" width="4rem" />
          <Skeleton height="0.875rem" width="4rem" />
        </div>
      </div>
      
      {/* 文章内容 */}
      <div className="space-y-6">
        {/* 段落1 */}
        <div className="space-y-3">
          <TextSkeleton lines={4} />
        </div>
        
        {/* 图片占位 */}
        <Skeleton height="12rem" className="w-full rounded-lg" />
        
        {/* 段落2 */}
        <div className="space-y-3">
          <TextSkeleton lines={5} />
        </div>
        
        {/* 段落3 */}
        <div className="space-y-3">
          <TextSkeleton lines={3} />
        </div>
        
        {/* 引用块 */}
        <div className="border-l-4 border-gray-300 dark:border-gray-600 pl-4 space-y-2">
          <TextSkeleton lines={2} />
        </div>
        
        {/* 段落4 */}
        <div className="space-y-3">
          <TextSkeleton lines={4} />
        </div>
      </div>
      
      {/* 标签和分类 */}
      <div className="flex flex-wrap gap-3 pt-6 border-t border-gray-200 dark:border-gray-700">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton
            key={index}
            height="2rem"
            width={`${Math.random() * 4 + 4}rem`}
            className="rounded-full"
          />
        ))}
      </div>
    </div>
  );
};

// 文章编辑器骨架屏
export const ArticleEditorSkeleton: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <div className={cn('space-y-6', className)}>
      {/* 标题输入框 */}
      <Skeleton height="3rem" className="w-full" />
      
      {/* 摘要输入框 */}
      <Skeleton height="6rem" className="w-full" />
      
      {/* 工具栏 */}
      <div className="flex items-center space-x-2 border-b border-gray-200 dark:border-gray-700 pb-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <Skeleton key={index} height="2rem" width="2rem" />
        ))}
      </div>
      
      {/* 编辑器内容区域 */}
      <Skeleton height="20rem" className="w-full" />
      
      {/* 底部操作按钮 */}
      <div className="flex justify-between items-center pt-4">
        <div className="flex space-x-3">
          <Skeleton height="2.5rem" width="5rem" />
          <Skeleton height="2.5rem" width="5rem" />
        </div>
        <div className="flex space-x-3">
          <Skeleton height="2.5rem" width="4rem" />
          <Skeleton height="2.5rem" width="6rem" />
        </div>
      </div>
    </div>
  );
};