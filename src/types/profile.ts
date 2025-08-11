/**
 * 用户个人资料相关类型定义
 * 模块: 6.1 用户信息管理
 */

export interface UserProfile {
  id: number;
  email: string;
  username: string;
  avatar?: string;
  bio?: string;
  role: 'user' | 'author' | 'admin';
  createdAt: string;
  updatedAt: string;
}

export interface UpdateProfileRequest {
  username: string;
  bio?: string;
  avatar?: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface UpdateAvatarRequest {
  avatar: string;
}

export interface ProfileResponse {
  success: boolean;
  data?: {
    user: UserProfile;
  };
  error?: string;
  message?: string;
}

export interface ProfileUpdateResponse {
  success: boolean;
  message?: string;
  error?: string;
}