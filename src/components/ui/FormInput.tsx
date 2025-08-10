import React, { forwardRef, useState } from 'react';
import { Eye, EyeOff, AlertCircle, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FormInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  success?: boolean;
  icon?: React.ReactNode;
  showPasswordToggle?: boolean;
  helpText?: string;
  containerClassName?: string;
}

export const FormInput = forwardRef<HTMLInputElement, FormInputProps>(
  ({
    label,
    error,
    success,
    icon,
    showPasswordToggle = false,
    helpText,
    containerClassName,
    className,
    type = 'text',
    id,
    ...props
  }, ref) => {
    const [showPassword, setShowPassword] = useState(false);
    const [isFocused, setIsFocused] = useState(false);
    
    const inputType = showPasswordToggle ? (showPassword ? 'text' : 'password') : type;
    const hasError = !!error;
    const hasSuccess = success && !hasError;
    
    const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;
    const errorId = `${inputId}-error`;
    const helpId = `${inputId}-help`;
    
    return (
      <div className={cn('space-y-1', containerClassName)}>
        {label && (
          <label 
            htmlFor={inputId}
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            {label}
            {props.required && (
              <span className="text-red-500 ml-1" aria-label="必填">
                *
              </span>
            )}
          </label>
        )}
        
        <div className="relative">
          {icon && (
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <div className={cn(
                'h-4 w-4 sm:h-5 sm:w-5',
                hasError ? 'text-red-400' : hasSuccess ? 'text-green-400' : 'text-gray-400'
              )}>
                {icon}
              </div>
            </div>
          )}
          
          <input
            ref={ref}
            type={inputType}
            id={inputId}
            className={cn(
              'block w-full rounded-md border-0 py-2 sm:py-2.5 text-gray-900 shadow-sm ring-1 ring-inset transition-all duration-200',
              'placeholder:text-gray-400 focus:ring-2 focus:ring-inset sm:text-sm sm:leading-6',
              icon ? 'pl-9 sm:pl-10' : 'pl-3',
              showPasswordToggle ? 'pr-10 sm:pr-12' : 'pr-3',
              hasError
                ? 'ring-red-300 focus:ring-red-500 bg-red-50'
                : hasSuccess
                ? 'ring-green-300 focus:ring-green-500 bg-green-50'
                : isFocused
                ? 'ring-blue-500 bg-white'
                : 'ring-gray-300 bg-white hover:ring-gray-400',
              className
            )}
            onFocus={(e) => {
              setIsFocused(true);
              props.onFocus?.(e);
            }}
            onBlur={(e) => {
              setIsFocused(false);
              props.onBlur?.(e);
            }}
            aria-invalid={hasError}
            aria-describedby={cn(
              error && errorId,
              helpText && helpId
            )}
            {...props}
          />
          
          {/* 状态图标 */}
          {(hasError || hasSuccess) && !showPasswordToggle && (
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
              {hasError ? (
                <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5 text-red-400" aria-hidden="true" />
              ) : (
                <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-green-400" aria-hidden="true" />
              )}
            </div>
          )}
          
          {/* 密码显示切换按钮 */}
          {showPasswordToggle && (
            <button
              type="button"
              className={cn(
                'absolute inset-y-0 right-0 pr-3 flex items-center',
                'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-md',
                'text-gray-400 hover:text-gray-600 transition-colors'
              )}
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? '隐藏密码' : '显示密码'}
              tabIndex={0}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4 sm:h-5 sm:w-5" />
              ) : (
                <Eye className="h-4 w-4 sm:h-5 sm:w-5" />
              )}
            </button>
          )}
        </div>
        
        {/* 错误信息 */}
        {error && (
          <p 
            id={errorId}
            className="text-sm text-red-600 flex items-center gap-1"
            role="alert"
            aria-live="polite"
          >
            <AlertCircle className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
            {error}
          </p>
        )}
        
        {/* 帮助文本 */}
        {helpText && !error && (
          <p 
            id={helpId}
            className="text-sm text-gray-500"
          >
            {helpText}
          </p>
        )}
      </div>
    );
  }
);

FormInput.displayName = 'FormInput';