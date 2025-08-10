import React from 'react';
import { Skeleton, TextSkeleton, AvatarSkeleton, ButtonSkeleton } from '../ui/Skeleton';
import { cn } from '../../utils/cn';

// 用户卡片骨架屏
export const UserCardSkeleton: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <div className={cn('bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 space-y-4', className)}>
      {/* 用户头像和基本信息 */}
      <div className="flex items-center space-x-4">
        <AvatarSkeleton size="lg" />
        <div className="flex-1 space-y-2">
          <Skeleton height="1.25rem" width="8rem" />
          <Skeleton height="1rem" width="12rem" />
          <Skeleton height="0.875rem" width="6rem" />
        </div>
      </div>
      
      {/* 用户统计信息 */}
      <div className="grid grid-cols-3 gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <div className="text-center space-y-1">
          <Skeleton height="1.5rem" width="2rem" className="mx-auto" />
          <Skeleton height="0.875rem" width="3rem" className="mx-auto" />
        </div>
        <div className="text-center space-y-1">
          <Skeleton height="1.5rem" width="2rem" className="mx-auto" />
          <Skeleton height="0.875rem" width="3rem" className="mx-auto" />
        </div>
        <div className="text-center space-y-1">
          <Skeleton height="1.5rem" width="2rem" className="mx-auto" />
          <Skeleton height="0.875rem" width="3rem" className="mx-auto" />
        </div>
      </div>
      
      {/* 操作按钮 */}
      <div className="flex space-x-3 pt-4">
        <ButtonSkeleton className="flex-1" />
        <ButtonSkeleton className="flex-1" />
      </div>
    </div>
  );
};

// 用户列表骨架屏
export const UserListSkeleton: React.FC<{ 
  count?: number;
  className?: string;
  layout?: 'grid' | 'list';
}> = ({ count = 6, className, layout = 'grid' }) => {
  const containerClass = layout === 'grid' 
    ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'
    : 'space-y-4';
    
  return (
    <div className={cn(containerClass, className)}>
      {Array.from({ length: count }).map((_, index) => (
        layout === 'list' ? (
          <UserListItemSkeleton key={index} />
        ) : (
          <UserCardSkeleton key={index} />
        )
      ))}
    </div>
  );
};

// 用户列表项骨架屏（列表布局）
export const UserListItemSkeleton: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <div className={cn('flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-lg shadow-sm', className)}>
      <div className="flex items-center space-x-4">
        <AvatarSkeleton size="md" />
        <div className="space-y-2">
          <Skeleton height="1rem" width="8rem" />
          <Skeleton height="0.875rem" width="12rem" />
          <Skeleton height="0.75rem" width="6rem" />
        </div>
      </div>
      
      <div className="flex items-center space-x-3">
        <Skeleton height="0.875rem" width="4rem" />
        <ButtonSkeleton />
      </div>
    </div>
  );
};

// 用户资料骨架屏
export const UserProfileSkeleton: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <div className={cn('max-w-4xl mx-auto space-y-8', className)}>
      {/* 用户头部信息 */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8">
        <div className="flex flex-col md:flex-row items-center md:items-start space-y-6 md:space-y-0 md:space-x-8">
          <AvatarSkeleton size="lg" className="w-24 h-24" />
          
          <div className="flex-1 space-y-4 text-center md:text-left">
            <div className="space-y-2">
              <Skeleton height="2rem" width="12rem" className="mx-auto md:mx-0" />
              <Skeleton height="1.25rem" width="16rem" className="mx-auto md:mx-0" />
              <Skeleton height="1rem" width="8rem" className="mx-auto md:mx-0" />
            </div>
            
            <TextSkeleton lines={2} className="max-w-md mx-auto md:mx-0" />
            
            <div className="flex justify-center md:justify-start space-x-4">
              <ButtonSkeleton />
              <ButtonSkeleton />
            </div>
          </div>
        </div>
        
        {/* 统计信息 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-8 pt-8 border-t border-gray-200 dark:border-gray-700">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="text-center space-y-2">
              <Skeleton height="2rem" width="3rem" className="mx-auto" />
              <Skeleton height="1rem" width="5rem" className="mx-auto" />
            </div>
          ))}
        </div>
      </div>
      
      {/* 用户活动 */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <div className="space-y-6">
          <Skeleton height="1.5rem" width="8rem" />
          
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="flex items-center space-x-4 p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                <Skeleton height="2rem" width="2rem" />
                <div className="flex-1 space-y-2">
                  <Skeleton height="1rem" width="20rem" />
                  <Skeleton height="0.875rem" width="8rem" />
                </div>
                <Skeleton height="0.75rem" width="4rem" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// 用户设置表单骨架屏
export const UserSettingsSkeleton: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <div className={cn('max-w-2xl mx-auto space-y-8', className)}>
      {/* 基本信息 */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <div className="space-y-6">
          <Skeleton height="1.5rem" width="6rem" />
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Skeleton height="1rem" width="4rem" />
              <Skeleton height="2.5rem" className="w-full" />
            </div>
            
            <div className="space-y-2">
              <Skeleton height="1rem" width="4rem" />
              <Skeleton height="2.5rem" className="w-full" />
            </div>
            
            <div className="space-y-2">
              <Skeleton height="1rem" width="4rem" />
              <Skeleton height="6rem" className="w-full" />
            </div>
          </div>
          
          <div className="flex justify-end">
            <ButtonSkeleton />
          </div>
        </div>
      </div>
      
      {/* 头像设置 */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <div className="space-y-6">
          <Skeleton height="1.5rem" width="6rem" />
          
          <div className="flex items-center space-x-6">
            <AvatarSkeleton size="lg" className="w-20 h-20" />
            <div className="space-y-3">
              <ButtonSkeleton />
              <Skeleton height="0.875rem" width="16rem" />
            </div>
          </div>
        </div>
      </div>
      
      {/* 密码设置 */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <div className="space-y-6">
          <Skeleton height="1.5rem" width="6rem" />
          
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="space-y-2">
                <Skeleton height="1rem" width="6rem" />
                <Skeleton height="2.5rem" className="w-full" />
              </div>
            ))}
          </div>
          
          <div className="flex justify-end">
            <ButtonSkeleton />
          </div>
        </div>
      </div>
    </div>
  );
};