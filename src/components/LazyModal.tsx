import React, { useState, useEffect, lazy, Suspense } from 'react';
import { X } from 'lucide-react';
import { ComponentLoadingSpinner } from './LoadingSpinner';

// 定义模态框数据类型
interface SettingsData {
  siteTitle?: string;
  siteDescription?: string;
  allowComments?: boolean;
  openRegistration?: boolean;
}

interface ProfileData {
  username?: string;
  email?: string;
  bio?: string;
  avatar?: string;
}

interface AnalyticsData {
  totalViews?: number;
  articleCount?: number;
  commentCount?: number;
  userCount?: number;
}

type ModalData = SettingsData | ProfileData | AnalyticsData | undefined;
type ModalAction = 'save' | 'cancel' | 'delete' | 'update';

// 懒加载的模态框组件
const LazyModalContent = lazy(() => {
  // 模拟加载时间
  return new Promise<{ default: React.ComponentType<{
    type: 'settings' | 'profile' | 'analytics';
    data?: ModalData;
    onAction?: (action: ModalAction, data?: ModalData) => void;
  }> }>(resolve => {
    setTimeout(() => {
      resolve({
        default: ({ type, data, onAction }: {
          type: 'settings' | 'profile' | 'analytics';
          data?: ModalData;
          onAction?: (action: ModalAction, data?: ModalData) => void;
        }) => {
          if (type === 'settings') {
            return (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold">系统设置</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      网站标题
                    </label>
                    <input 
                      type="text" 
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      defaultValue="我的博客系统"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      网站描述
                    </label>
                    <textarea 
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows={3}
                      defaultValue="一个现代化的博客管理系统"
                    />
                  </div>
                  <div className="flex items-center">
                    <input type="checkbox" id="comments" className="mr-2" defaultChecked />
                    <label htmlFor="comments" className="text-sm text-gray-700">允许评论</label>
                  </div>
                  <div className="flex items-center">
                    <input type="checkbox" id="registration" className="mr-2" />
                    <label htmlFor="registration" className="text-sm text-gray-700">开放注册</label>
                  </div>
                </div>
                <div className="flex justify-end space-x-3">
                  <button 
                    onClick={() => onAction?.('cancel')}
                    className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    取消
                  </button>
                  <button 
                    onClick={() => onAction?.('save')}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    保存设置
                  </button>
                </div>
              </div>
            );
          }
          
          if (type === 'analytics') {
            return (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold">数据分析</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">1,234</div>
                    <div className="text-sm text-gray-600">总访问量</div>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">89</div>
                    <div className="text-sm text-gray-600">文章数量</div>
                  </div>
                  <div className="bg-yellow-50 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-yellow-600">456</div>
                    <div className="text-sm text-gray-600">评论数量</div>
                  </div>
                  <div className="bg-purple-50 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-purple-600">23</div>
                    <div className="text-sm text-gray-600">注册用户</div>
                  </div>
                </div>
                <div className="h-64 bg-gray-100 rounded-lg flex items-center justify-center">
                  <div className="text-gray-500">图表区域 (模拟)</div>
                </div>
              </div>
            );
          }
          
          // Profile type
          return (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold">个人资料</h3>
              <div className="flex items-center space-x-4">
                <div className="w-16 h-16 bg-gray-300 rounded-full flex items-center justify-center">
                  <span className="text-gray-600 text-xl">头像</span>
                </div>
                <div className="flex-1">
                  <input 
                    type="text" 
                    placeholder="用户名"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2"
                  />
                  <input 
                    type="email" 
                    placeholder="邮箱地址"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  个人简介
                </label>
                <textarea 
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={4}
                  placeholder="介绍一下自己..."
                />
              </div>
              <div className="flex justify-end space-x-3">
                <button 
                  onClick={() => onAction?.('cancel')}
                  className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  取消
                </button>
                <button 
                  onClick={() => onAction?.('save')}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  保存资料
                </button>
              </div>
            </div>
          );
        }
      });
    }, 600); // 模拟600ms加载时间
  });
});

interface LazyModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'settings' | 'profile' | 'analytics';
  data?: ModalData;
  onAction?: (action: ModalAction, data?: ModalData) => void;
}

export default function LazyModal({ isOpen, onClose, type, data, onAction }: LazyModalProps) {
  const [shouldRender, setShouldRender] = useState(false);
  
  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
    } else {
      // 延迟卸载，保持动画效果
      const timer = setTimeout(() => setShouldRender(false), 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);
  
  const handleAction = (action: ModalAction, actionData?: ModalData) => {
    if (action === 'cancel') {
      onClose();
    } else {
      onAction?.(action, actionData);
      onClose();
    }
  };
  
  if (!shouldRender) return null;
  
  return (
    <div className={`fixed inset-0 z-50 transition-opacity duration-300 ${
      isOpen ? 'opacity-100' : 'opacity-0'
    }`}>
      {/* 背景遮罩 */}
      <div 
        className="absolute inset-0 bg-black bg-opacity-50"
        onClick={onClose}
      />
      
      {/* 模态框 */}
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className={`relative bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto transform transition-transform duration-300 ${
          isOpen ? 'scale-100' : 'scale-95'
        }`}>
          {/* 关闭按钮 */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 z-10"
          >
            <X className="h-6 w-6" />
          </button>
          
          {/* 内容区域 */}
          <div className="p-6">
            <Suspense fallback={
              <div className="space-y-4">
                <div className="h-6 bg-gray-200 rounded w-1/3 animate-pulse"></div>
                <ComponentLoadingSpinner size="lg" />
                <p className="text-center text-gray-500">正在加载内容...</p>
              </div>
            }>
              <LazyModalContent 
                type={type} 
                data={data} 
                onAction={handleAction}
              />
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  );
}

// 导出懒加载版本
export const LazyModalComponent = lazy(() => import('./LazyModal'));