import bcrypt from 'bcryptjs';
import crypto from 'crypto';

export interface PasswordValidationResult {
  isValid: boolean;
  errors: string[];
  strength: 'weak' | 'medium' | 'strong' | 'very_strong';
}

export interface PasswordPolicy {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
  forbidCommonPasswords: boolean;
  forbidPersonalInfo: boolean;
}

// 默认密码策略
const DEFAULT_PASSWORD_POLICY: PasswordPolicy = {
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: true,
  forbidCommonPasswords: true,
  forbidPersonalInfo: true
};

// 常见弱密码列表（简化版）
const COMMON_PASSWORDS = [
  'password', '123456', '123456789', 'qwerty', 'abc123', 'password123',
  '111111', '123123', 'admin', 'letmein', 'welcome', 'monkey',
  '1234567890', 'password1', '123qwe', 'qwerty123', 'iloveyou'
];

// 特殊字符集合
const SPECIAL_CHARS = '!@#$%^&*()_+-=[]{}|;:,.<>?';

/**
 * 验证密码复杂度
 */
export function validatePassword(
  password: string, 
  userInfo?: { email?: string; name?: string },
  policy: PasswordPolicy = DEFAULT_PASSWORD_POLICY
): PasswordValidationResult {
  const errors: string[] = [];
  let score = 0;
  
  // 检查最小长度
  if (password.length < policy.minLength) {
    errors.push(`密码长度至少需要 ${policy.minLength} 个字符`);
  } else {
    score += Math.min(password.length - policy.minLength, 4);
  }
  
  // 检查大写字母
  if (policy.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('密码必须包含至少一个大写字母');
  } else if (/[A-Z]/.test(password)) {
    score += 1;
  }
  
  // 检查小写字母
  if (policy.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('密码必须包含至少一个小写字母');
  } else if (/[a-z]/.test(password)) {
    score += 1;
  }
  
  // 检查数字
  if (policy.requireNumbers && !/\d/.test(password)) {
    errors.push('密码必须包含至少一个数字');
  } else if (/\d/.test(password)) {
    score += 1;
  }
  
  // 检查特殊字符
  const hasSpecialChar = SPECIAL_CHARS.split('').some(char => password.includes(char));
  if (policy.requireSpecialChars && !hasSpecialChar) {
    errors.push('密码必须包含至少一个特殊字符 (!@#$%^&*等)');
  } else if (hasSpecialChar) {
    score += 1;
  }
  
  // 检查常见密码
  if (policy.forbidCommonPasswords && COMMON_PASSWORDS.includes(password.toLowerCase())) {
    errors.push('不能使用常见的弱密码');
  }
  
  // 检查个人信息
  if (policy.forbidPersonalInfo && userInfo) {
    const lowerPassword = password.toLowerCase();
    if (userInfo.email && lowerPassword.includes(userInfo.email.split('@')[0].toLowerCase())) {
      errors.push('密码不能包含邮箱用户名');
    }
    if (userInfo.name && lowerPassword.includes(userInfo.name.toLowerCase())) {
      errors.push('密码不能包含用户姓名');
    }
  }
  
  // 检查重复字符
  if (/(..).*\1/.test(password)) {
    errors.push('密码不能包含重复的字符序列');
  }
  
  // 检查连续字符
  if (/(?:abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz|123|234|345|456|567|678|789)/i.test(password)) {
    errors.push('密码不能包含连续的字符序列');
  }
  
  // 计算密码强度
  let strength: 'weak' | 'medium' | 'strong' | 'very_strong';
  if (score < 3) {
    strength = 'weak';
  } else if (score < 5) {
    strength = 'medium';
  } else if (score < 7) {
    strength = 'strong';
  } else {
    strength = 'very_strong';
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    strength
  };
}

/**
 * 生成安全的盐值
 */
export function generateSalt(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * 使用增强的盐值加密密码
 */
export async function hashPasswordWithSalt(password: string, customSalt?: string): Promise<{ hash: string; salt: string }> {
  const salt = customSalt || generateSalt();
  
  // 使用更高的成本因子和自定义盐值
  const saltRounds = 14; // 增加到14轮，提高安全性
  
  // 结合自定义盐值和bcrypt的内置盐值
  const saltedPassword = password + salt;
  const hash = await bcrypt.hash(saltedPassword, saltRounds);
  
  return { hash, salt };
}

/**
 * 验证密码（使用盐值）
 */
export async function verifyPasswordWithSalt(password: string, hash: string, salt: string): Promise<boolean> {
  const saltedPassword = password + salt;
  return await bcrypt.compare(saltedPassword, hash);
}

/**
 * 检查密码是否需要重新哈希（升级安全性）
 */
export function needsRehash(hash: string): boolean {
  // 检查是否使用了足够的轮数
  const rounds = bcrypt.getRounds(hash);
  return rounds < 14;
}

/**
 * 生成安全的临时密码
 */
export function generateSecurePassword(length: number = 12): string {
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const specialChars = '!@#$%^&*';
  
  const allChars = uppercase + lowercase + numbers + specialChars;
  
  let password = '';
  
  // 确保至少包含每种类型的字符
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += specialChars[Math.floor(Math.random() * specialChars.length)];
  
  // 填充剩余长度
  for (let i = 4; i < length; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }
  
  // 打乱字符顺序
  return password.split('').sort(() => Math.random() - 0.5).join('');
}

/**
 * 密码强度评分
 */
export function calculatePasswordScore(password: string): number {
  let score = 0;
  
  // 长度评分
  score += Math.min(password.length * 2, 20);
  
  // 字符类型评分
  if (/[a-z]/.test(password)) score += 5;
  if (/[A-Z]/.test(password)) score += 5;
  if (/\d/.test(password)) score += 5;
  if (SPECIAL_CHARS.split('').some(char => password.includes(char))) score += 10;
  
  // 复杂度评分
  const uniqueChars = new Set(password).size;
  score += Math.min(uniqueChars * 2, 20);
  
  // 减分项
  if (/(..).*\1/.test(password)) score -= 10; // 重复序列
  if (COMMON_PASSWORDS.includes(password.toLowerCase())) score -= 20; // 常见密码
  
  return Math.max(0, Math.min(100, score));
}