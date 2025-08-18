/**
 * 用户个人资料管理Hook
 * 模块: 6.1 用户信息管理
 */

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import {
  getUserProfile,
  updateUserProfile,
  changePassword,
  uploadAvatarFile
} from '../services/profileAPI';
import {
  UserProfile,
  UpdateProfileRequest,
  ChangePasswordRequest
} from '../types/profile';
import { useAuthStore } from '../store/authStore';

export const useProfile = () => {
  const { isAuthenticated } = useAuthStore();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * 获取用户个人资料
   */
  const fetchProfile = async () => {
    if (!isAuthenticated) {
      setError('用户未登录');
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const profileData = await getUserProfile();
      setProfile(profileData);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '获取用户信息失败';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  /**
   * 更新用户个人资料
   */
  const updateProfile = async (profileData: UpdateProfileRequest) => {
    setLoading(true);
    setError(null);
    
    try {
      await updateUserProfile(profileData);
      toast.success('个人信息更新成功');
      // 重新获取最新的用户信息
      await fetchProfile();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '更新个人信息失败';
      setError(errorMessage);
      toast.error(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  /**
   * 修改密码
   */
  const updatePassword = async (passwordData: ChangePasswordRequest) => {
    setLoading(true);
    setError(null);
    
    try {
      await changePassword(passwordData);
      toast.success('密码修改成功');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '密码修改失败';
      setError(errorMessage);
      toast.error(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  /**
   * 上传并更新头像
   */
  const uploadAndUpdateAvatar = async (file: File) => {
    setLoading(true);
    setError(null);
    
    try {
      // 验证文件
      if (file.size > 5 * 1024 * 1024) {
        throw new Error('图片大小不能超过5MB');
      }
      
      if (!file.type.startsWith('image/')) {
        throw new Error('请选择图片文件');
      }
      
      // 上传头像
      const avatarUrl = await uploadAvatarFile(file);
      
      // 更新用户资料中的头像
      if (profile) {
        await updateProfile({
          username: profile.username,
          bio: profile.bio,
          avatar: avatarUrl
        });
      }
      
      toast.success('头像更新成功');
      return avatarUrl;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '头像更新失败';
      setError(errorMessage);
      toast.error(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  /**
   * 重置错误状态
   */
  const clearError = () => {
    setError(null);
  };

  // 当认证状态改变时，自动获取用户信息
  useEffect(() => {
    if (isAuthenticated) {
      fetchProfile();
    } else {
      setProfile(null);
      setError(null);
    }
  }, [isAuthenticated]);

  return {
    profile,
    loading,
    error,
    fetchProfile,
    updateProfile,
    updatePassword,
    uploadAndUpdateAvatar,
    clearError
  };
};