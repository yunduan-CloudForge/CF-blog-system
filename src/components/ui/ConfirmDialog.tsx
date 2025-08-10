import React, { createContext, useContext, useState, useCallback } from 'react';
import { AlertTriangle, Info, HelpCircle, X } from 'lucide-react';
import { cn } from '@/utils/cn';

type DialogType = 'warning' | 'info' | 'question' | 'danger';

interface ConfirmDialogOptions {
  type?: DialogType;
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void | Promise<void>;
  onCancel?: () => void;
  showCancel?: boolean;
  confirmButtonVariant?: 'primary' | 'danger' | 'warning';
}

interface DialogState extends ConfirmDialogOptions {
  isOpen: boolean;
  isLoading?: boolean;
}

interface ConfirmDialogContextType {
  confirm: (options: ConfirmDialogOptions) => Promise<boolean>;
  alert: (options: Omit<ConfirmDialogOptions, 'onConfirm' | 'onCancel' | 'showCancel'>) => Promise<void>;
}

const ConfirmDialogContext = createContext<ConfirmDialogContextType | undefined>(undefined);

export const useConfirmDialog = () => {
  const context = useContext(ConfirmDialogContext);
  if (!context) {
    throw new Error('useConfirmDialog must be used within a ConfirmDialogProvider');
  }
  return context;
};

const dialogIcons = {
  warning: AlertTriangle,
  info: Info,
  question: HelpCircle,
  danger: AlertTriangle,
};

const iconStyles = {
  warning: 'text-yellow-400',
  info: 'text-blue-400',
  question: 'text-gray-400',
  danger: 'text-red-400',
};

const buttonVariants = {
  primary: 'bg-blue-600 hover:bg-blue-700 text-white',
  danger: 'bg-red-600 hover:bg-red-700 text-white',
  warning: 'bg-yellow-600 hover:bg-yellow-700 text-white',
};

interface ConfirmDialogProps {
  dialog: DialogState;
  onConfirm: () => void;
  onCancel: () => void;
}

function ConfirmDialog({ dialog, onConfirm, onCancel }: ConfirmDialogProps) {
  if (!dialog.isOpen) return null;

  const Icon = dialogIcons[dialog.type || 'question'];
  const confirmVariant = dialog.confirmButtonVariant || 'primary';

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onCancel}
      />
      
      {/* Dialog */}
      <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
        <div className="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
          {/* Close button */}
          <div className="absolute right-0 top-0 pr-4 pt-4">
            <button
              type="button"
              className="rounded-md bg-white text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              onClick={onCancel}
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          <div className="sm:flex sm:items-start">
            {/* Icon */}
            <div className="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-gray-100 sm:mx-0 sm:h-10 sm:w-10">
              <Icon className={cn('h-6 w-6', iconStyles[dialog.type || 'question'])} />
            </div>

            {/* Content */}
            <div className="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left">
              <h3 className="text-lg font-medium leading-6 text-gray-900">
                {dialog.title}
              </h3>
              {dialog.description && (
                <div className="mt-2">
                  <p className="text-sm text-gray-500">
                    {dialog.description}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
            <button
              type="button"
              disabled={dialog.isLoading}
              className={cn(
                'inline-flex w-full justify-center rounded-md px-3 py-2 text-sm font-semibold shadow-sm sm:ml-3 sm:w-auto',
                'focus:outline-none focus:ring-2 focus:ring-offset-2',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                buttonVariants[confirmVariant],
                confirmVariant === 'primary' && 'focus:ring-blue-500',
                confirmVariant === 'danger' && 'focus:ring-red-500',
                confirmVariant === 'warning' && 'focus:ring-yellow-500'
              )}
              onClick={onConfirm}
            >
              {dialog.isLoading ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  处理中...
                </div>
              ) : (
                dialog.confirmText || '确认'
              )}
            </button>
            
            {dialog.showCancel !== false && (
              <button
                type="button"
                disabled={dialog.isLoading}
                className="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:mt-0 sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={onCancel}
              >
                {dialog.cancelText || '取消'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

interface ConfirmDialogProviderProps {
  children: React.ReactNode;
}

export function ConfirmDialogProvider({ children }: ConfirmDialogProviderProps) {
  const [dialog, setDialog] = useState<DialogState>({
    isOpen: false,
    title: '',
  });
  const [resolveRef, setResolveRef] = useState<{
    resolve: (value: boolean) => void;
  } | null>(null);

  const confirm = useCallback((options: ConfirmDialogOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setDialog({
        ...options,
        isOpen: true,
        showCancel: options.showCancel !== false,
      });
      setResolveRef({ resolve });
    });
  }, []);

  const alert = useCallback((options: Omit<ConfirmDialogOptions, 'onConfirm' | 'onCancel' | 'showCancel'>): Promise<void> => {
    return new Promise((resolve) => {
      setDialog({
        ...options,
        isOpen: true,
        showCancel: false,
      });
      setResolveRef({ resolve: () => resolve() });
    });
  }, []);

  const handleConfirm = useCallback(async () => {
    if (dialog.onConfirm) {
      setDialog(prev => ({ ...prev, isLoading: true }));
      try {
        await dialog.onConfirm();
      } catch (error) {
        console.error('Confirm action failed:', error);
        setDialog(prev => ({ ...prev, isLoading: false }));
        return;
      }
    }
    
    setDialog(prev => ({ ...prev, isOpen: false, isLoading: false }));
    if (resolveRef) {
      resolveRef.resolve(true);
      setResolveRef(null);
    }
  }, [dialog.onConfirm, resolveRef]);

  const handleCancel = useCallback(() => {
    if (dialog.onCancel) {
      dialog.onCancel();
    }
    
    setDialog(prev => ({ ...prev, isOpen: false, isLoading: false }));
    if (resolveRef) {
      resolveRef.resolve(false);
      setResolveRef(null);
    }
  }, [dialog.onCancel, resolveRef]);

  return (
    <ConfirmDialogContext.Provider value={{ confirm, alert }}>
      {children}
      <ConfirmDialog
        dialog={dialog}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </ConfirmDialogContext.Provider>
  );
}

// 便捷的确认对话框hooks
export function useConfirm() {
  const { confirm } = useConfirmDialog();
  
  return {
    confirmDelete: (itemName?: string) => 
      confirm({
        type: 'danger',
        title: '确认删除',
        description: itemName ? `确定要删除"${itemName}"吗？此操作无法撤销。` : '确定要删除吗？此操作无法撤销。',
        confirmText: '删除',
        confirmButtonVariant: 'danger',
      }),
    
    confirmAction: (title: string, description?: string) =>
      confirm({
        type: 'question',
        title,
        description,
      }),
    
    confirmWarning: (title: string, description?: string) =>
      confirm({
        type: 'warning',
        title,
        description,
        confirmButtonVariant: 'warning',
      }),
  };
}

export function useAlert() {
  const { alert } = useConfirmDialog();
  
  return {
    info: (title: string, description?: string) =>
      alert({
        type: 'info',
        title,
        description,
        confirmText: '知道了',
      }),
    
    warning: (title: string, description?: string) =>
      alert({
        type: 'warning',
        title,
        description,
        confirmText: '知道了',
      }),
  };
}