/**
 * 用户个人资料功能测试
 * 模块: 6.1 用户信息管理
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getUserProfile,
  updateUserProfile,
  changePassword,
  uploadAvatarFile
} from '../services/profileAPI';

// Mock fetch
global.fetch = vi.fn();

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(() => 'mock-token'),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn()
};
Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage
});

describe('Profile API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getUserProfile', () => {
    it('should fetch user profile successfully', async () => {
      const mockProfile = {
        id: 1,
        email: 'test@example.com',
        username: 'testuser',
        avatar: 'avatar.jpg',
        bio: 'Test bio',
        role: 'user',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z'
      };

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: { user: mockProfile }
        })
      });

      const result = await getUserProfile();
      
      expect(fetch).toHaveBeenCalledWith('/api/profile', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer mock-token'
        }
      });
      expect(result).toEqual(mockProfile);
    });

    it('should throw error when fetch fails', async () => {
      (fetch as any).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Unauthorized' })
      });

      await expect(getUserProfile()).rejects.toThrow('Unauthorized');
    });
  });

  describe('updateUserProfile', () => {
    it('should update user profile successfully', async () => {
      const profileData = {
        username: 'newusername',
        bio: 'New bio',
        avatar: 'new-avatar.jpg'
      };

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          message: '个人信息更新成功'
        })
      });

      await updateUserProfile(profileData);
      
      expect(fetch).toHaveBeenCalledWith('/api/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer mock-token'
        },
        body: JSON.stringify(profileData)
      });
    });

    it('should throw error when update fails', async () => {
      (fetch as any).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Username already exists' })
      });

      await expect(updateUserProfile({
        username: 'existinguser',
        bio: 'Bio',
        avatar: 'avatar.jpg'
      })).rejects.toThrow('Username already exists');
    });
  });

  describe('changePassword', () => {
    it('should change password successfully', async () => {
      const passwordData = {
        currentPassword: 'oldpassword',
        newPassword: 'newpassword'
      };

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          message: '密码修改成功'
        })
      });

      await changePassword(passwordData);
      
      expect(fetch).toHaveBeenCalledWith('/api/profile/password', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer mock-token'
        },
        body: JSON.stringify(passwordData)
      });
    });

    it('should throw error when current password is wrong', async () => {
      (fetch as any).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: '当前密码不正确' })
      });

      await expect(changePassword({
        currentPassword: 'wrongpassword',
        newPassword: 'newpassword'
      })).rejects.toThrow('当前密码不正确');
    });
  });

  describe('uploadAvatarFile', () => {
    it('should upload avatar file successfully', async () => {
      const mockFile = new File([''], 'avatar.jpg', { type: 'image/jpeg' });
      const mockUrl = '/uploads/avatar-123.jpg';

      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: { url: mockUrl }
        })
      });

      const result = await uploadAvatarFile(mockFile);
      
      expect(fetch).toHaveBeenCalledWith('/api/upload', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer mock-token'
        },
        body: expect.any(FormData)
      });
      expect(result).toBe(mockUrl);
    });

    it('should throw error when upload fails', async () => {
      const mockFile = new File([''], 'avatar.jpg', { type: 'image/jpeg' });

      (fetch as any).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'File too large' })
      });

      await expect(uploadAvatarFile(mockFile)).rejects.toThrow('File too large');
    });
  });
});