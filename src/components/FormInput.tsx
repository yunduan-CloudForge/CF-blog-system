import React from 'react';
import { cn } from '@/utils/cn';

interface FormInputProps {
  label?: string;
  name: string;
  value: string;
  onChange: (name: string, value: string) => void;
  onBlur?: (name: string) => void;
  error?: string;
  touched?: boolean;
  helperText?: string;
  required?: boolean;
  type?: 'text' | 'email' | 'password' | 'textarea' | 'url';
  placeholder?: string;
  className?: string;
  rows?: number;
  disabled?: boolean;
  autoComplete?: string;
  'aria-describedby'?: string;
}

export const FormInput: React.FC<FormInputProps> = ({
  label,
  name,
  value,
  onChange,
  onBlur,
  error,
  touched,
  helperText,
  required,
  type = 'text',
  placeholder,
  className,
  rows = 3,
  disabled,
  autoComplete,
  ...props
}) => {
  const hasError = touched && error;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    onChange(name, e.target.value);
  };

  const handleBlur = () => {
    if (onBlur) {
      onBlur(name);
    }
  };

  const inputClassName = cn(
    "w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm",
    "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500",
    "dark:bg-gray-800 dark:border-gray-600 dark:text-white",
    "dark:focus:ring-blue-400 dark:focus:border-blue-400",
    hasError && "border-red-500 focus:ring-red-500 focus:border-red-500",
    disabled && "opacity-50 cursor-not-allowed",
    className
  );

  return (
    <div className="space-y-2">
      {label && (
        <label htmlFor={name} className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      {type === 'textarea' ? (
        <textarea
          id={name}
          name={name}
          value={value}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder={placeholder}
          rows={rows}
          disabled={disabled}
          className={inputClassName}
          {...props}
        />
      ) : (
        <input
          id={name}
          name={name}
          type={type}
          value={value}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete={autoComplete}
          className={inputClassName}
          {...props}
        />
      )}
      {hasError && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
      {helperText && !hasError && (
        <p className="text-sm text-gray-500 dark:text-gray-400">{helperText}</p>
      )}
    </div>
  );
};

export default FormInput;