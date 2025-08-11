/**
 * 用户个人资料API服务
 * 模块: 6.1 用户信息管理
 */

import { 
  UserProfile, 
  UpdateProfileRequest, 
  ChangePasswordRequest, 
  UpdateAvatarRequest,
  ProfileResponse,
  ProfileUpdateResponse
} from '../types/profile';

const API_BASE_URL = '/api/profile';

/**
 * 获取认证头部
 */
const getAuthHeaders = () => {
  // 从Zustand持久化存储中获取token
  const authStorage = localStorage.getItem('auth-storage');
  let token = null;
  
  if (authStorage) {
    try {
      const parsedAuth = JSON.parse(authStorage);
      token = parsedAuth.state?.token;
    } catch (error) {
      console.error('解析认证存储失败:', error);
    }
  }
  
  return {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` })
  };
};

/**
 * 获取当前用户个人资料
 */
export const getUserProfile = async (): Promise<UserProfile> => {
  const response = await fetch(API_BASE_URL, {
    method: 'GET',
    headers: getAuthHeaders()
  });
  
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || '获取用户信息失败');
  }
  
  const data: ProfileResponse = await response.json();
  if (!data.success || !data.data) {
    throw new Error('获取用户信息失败');
  }
  
  return data.data.user;
};

/**
 * 更新用户个人资料
 */
export const updateUserProfile = async (profileData: UpdateProfileRequest): Promise<void> => {
  const response = await fetch(API_BASE_URL, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(profileData)
  });
  
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || '更新个人信息失败');
  }
  
  const data: ProfileUpdateResponse = await response.json();
  if (!data.success) {
    throw new Error(data.error || '更新个人信息失败');
  }
};

/**
 * 修改密码
 */
export const changePassword = async (passwordData: ChangePasswordRequest): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/password`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(passwordData)
  });
  
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || '密码修改失败');
  }
  
  const data: ProfileUpdateResponse = await response.json();
  if (!data.success) {
    throw new Error(data.error || '密码修改失败');
  }
};

/**
 * 更新头像
 */
export const updateAvatar = async (avatarData: UpdateAvatarRequest): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/avatar`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(avatarData)
  });
  
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || '头像更新失败');
  }
  
  const data: ProfileUpdateResponse = await response.json();
  if (!data.success) {
    throw new Error(data.error || '头像更新失败');
  }
};

/**
 * 上传头像文件
 */
export const uploadAvatarFile = async (file: File): Promise<string> => {
  const formData = new FormData();
  formData.append('image', file);
  
  const token = localStorage.getItem('token');
  const response = await fetch('/api/upload', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    },
    body: formData
  });
  
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || '头像上传失败');
  }
  
  const data = await response.json();
  if (!data.success || !data.data?.url) {
    throw new Error('头像上传失败');
  }
  
  return data.data.url;
};