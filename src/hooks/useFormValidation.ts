import { useState, useCallback } from 'react';

type ValidationRule = {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  custom?: (value: string) => string | null;
};

type ValidationRules = {
  [key: string]: ValidationRule;
};

type ValidationErrors = {
  [key: string]: string;
};

export function useFormValidation(rules: ValidationRules) {
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [touched, setTouched] = useState<{ [key: string]: boolean }>({});

  const validateField = useCallback((name: string, value: string): string | null => {
    const rule = rules[name];
    if (!rule) return null;

    // Required validation
    if (rule.required && (!value || value.trim() === '')) {
      return '此字段为必填项';
    }

    // Skip other validations if field is empty and not required
    if (!value || value.trim() === '') {
      return null;
    }

    // Min length validation
    if (rule.minLength && value.length < rule.minLength) {
      return `至少需要 ${rule.minLength} 个字符`;
    }

    // Max length validation
    if (rule.maxLength && value.length > rule.maxLength) {
      return `不能超过 ${rule.maxLength} 个字符`;
    }

    // Pattern validation
    if (rule.pattern && !rule.pattern.test(value)) {
      return '格式不正确';
    }

    // Custom validation
    if (rule.custom) {
      return rule.custom(value);
    }

    return null;
  }, [rules]);

  const validateForm = useCallback((formData: { [key: string]: string }): boolean => {
    const newErrors: ValidationErrors = {};
    let isValid = true;

    Object.keys(rules).forEach(fieldName => {
      const error = validateField(fieldName, formData[fieldName] || '');
      if (error) {
        newErrors[fieldName] = error;
        isValid = false;
      }
    });

    setErrors(newErrors);
    return isValid;
  }, [validateField, rules]);

  const validateSingleField = useCallback((name: string, value: string) => {
    const error = validateField(name, value);
    setErrors(prev => ({
      ...prev,
      [name]: error || ''
    }));
    return !error;
  }, [validateField]);

  const handleBlur = useCallback((name: string, value: string) => {
    setTouched(prev => ({ ...prev, [name]: true }));
    validateSingleField(name, value);
  }, [validateSingleField]);

  const handleChange = useCallback((name: string, value: string) => {
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
    
    // Validate on change if field was already touched
    if (touched[name]) {
      validateSingleField(name, value);
    }
  }, [errors, touched, validateSingleField]);

  const clearErrors = useCallback(() => {
    setErrors({});
    setTouched({});
  }, []);

  const getFieldError = useCallback((name: string): string => {
    return touched[name] ? errors[name] || '' : '';
  }, [errors, touched]);

  const hasError = useCallback((name: string): boolean => {
    return touched[name] && !!errors[name];
  }, [errors, touched]);

  return {
    errors,
    touched,
    validateForm,
    validateSingleField,
    handleBlur,
    handleChange,
    clearErrors,
    getFieldError,
    hasError
  };
}

// 常用验证规则
export const commonValidationRules = {
  email: {
    required: true,
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    custom: (value: string) => {
      if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        return '请输入有效的邮箱地址';
      }
      return null;
    }
  },
  password: {
    required: true,
    minLength: 6,
    custom: (value: string) => {
      if (value && value.length < 6) {
        return '密码至少需要6个字符';
      }
      if (value && !/(?=.*[a-zA-Z])(?=.*\d)/.test(value)) {
        return '密码需要包含字母和数字';
      }
      return null;
    }
  },
  username: {
    required: true,
    minLength: 3,
    maxLength: 20,
    pattern: /^[a-zA-Z0-9_]+$/,
    custom: (value: string) => {
      if (value && !/^[a-zA-Z0-9_]+$/.test(value)) {
        return '用户名只能包含字母、数字和下划线';
      }
      return null;
    }
  },
  title: {
    required: true,
    minLength: 1,
    maxLength: 100
  },
  content: {
    required: true,
    minLength: 10
  }
};