/**
 * 用户中心页面
 * 模块: 6.1 用户信息管理
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
// import { useAuthStore } from '../store/authStore'; // 暂时不需要
import { useProfile } from '../hooks/useProfile';
import { User, Lock, Upload, Save, ArrowLeft, FileText } from 'lucide-react';
import { toast } from 'sonner';

const UserCenter: React.FC = () => {
  const navigate = useNavigate();
  // const {} = useAuthStore(); // 暂时不需要使用authStore的数据
  const { profile, loading, updateProfile, updatePassword, uploadAndUpdateAvatar } = useProfile();
  const [activeTab, setActiveTab] = useState<'profile' | 'password'>('profile');
  
  // 个人信息表单
  const [profileForm, setProfileForm] = useState({
    username: '',
    bio: '',
    avatar: ''
  });
  
  // 密码修改表单
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  
  // 头像上传
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string>('');

  // ProtectedRoute已经处理了认证检查，这里不需要重复检查
  // useEffect(() => {
  //   if (!isAuthenticated) {
  //     navigate('/login');
  //     return;
  //   }
  // }, [isAuthenticated, navigate]);

  // 当profile数据更新时，同步更新表单数据
  useEffect(() => {
    if (profile) {
      setProfileForm({
        username: profile.username || '',
        bio: profile.bio || '',
        avatar: profile.avatar || ''
      });
      setAvatarPreview(profile.avatar || '');
    }
  }, [profile]);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('图片大小不能超过5MB');
        return;
      }
      
      if (!file.type.startsWith('image/')) {
        toast.error('请选择图片文件');
        return;
      }
      
      setAvatarFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setAvatarPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };



  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      let avatarUrl = profileForm.avatar;
      
      // 如果有新头像，先上传
      if (avatarFile) {
        avatarUrl = await uploadAndUpdateAvatar(avatarFile);
        setAvatarFile(null);
      } else {
        // 没有新头像，只更新其他信息
        await updateProfile({
          username: profileForm.username,
          bio: profileForm.bio,
          avatar: avatarUrl
        });
      }
    } catch {
      // 错误处理已在Hook中完成
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error('新密码和确认密码不一致');
      return;
    }
    
    if (passwordForm.newPassword.length < 6) {
      toast.error('新密码长度至少6位');
      return;
    }
    
    try {
      await updatePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword
      });
      
      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
    } catch {
      // 错误处理已在Hook中完成
    }
  };

  // 移除可能导致问题的认证检查，让ProtectedRoute处理认证逻辑

  // 如果正在加载，显示简单的加载状态
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // 如果没有profile数据，显示错误信息
  if (!profile) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">无法加载用户信息</h2>
          <p className="text-gray-600 mb-4">请刷新页面重试</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            刷新页面
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 头部导航 */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/')}
                className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
              >
                <ArrowLeft className="h-5 w-5 mr-2" />
                返回首页
              </button>
              <h1 className="text-2xl font-bold text-gray-900">用户中心</h1>
            </div>
            <div className="flex items-center space-x-2">
              {profile?.avatar && (
                <img
                  src={profile.avatar}
                  alt="头像"
                  className="h-8 w-8 rounded-full object-cover"
                />
              )}
              <span className="text-gray-700">{profile?.username || '用户'}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-sm">
          {/* 标签页导航 */}
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-6">
              <button
                onClick={() => setActiveTab('profile')}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'profile'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <User className="h-4 w-4 inline mr-2" />
                个人信息
              </button>
              <button
                onClick={() => setActiveTab('password')}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'password'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Lock className="h-4 w-4 inline mr-2" />
                修改密码
              </button>
              <Link
                to="/my-articles"
                className="py-4 px-1 border-b-2 font-medium text-sm transition-colors border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              >
                <FileText className="h-4 w-4 inline mr-2" />
                我的文章
              </Link>
            </nav>
          </div>

          {/* 标签页内容 */}
          <div className="p-6">
            {activeTab === 'profile' && (
              <form onSubmit={handleProfileSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* 头像上传 */}
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      头像
                    </label>
                    <div className="flex items-center space-x-4">
                      <div className="relative">
                        {avatarPreview ? (
                          <img
                            src={avatarPreview}
                            alt="头像预览"
                            className="h-20 w-20 rounded-full object-cover border-2 border-gray-200"
                          />
                        ) : (
                          <div className="h-20 w-20 rounded-full bg-gray-200 flex items-center justify-center">
                            <User className="h-8 w-8 text-gray-400" />
                          </div>
                        )}
                      </div>
                      <div>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleAvatarChange}
                          className="hidden"
                          id="avatar-upload"
                        />
                        <label
                          htmlFor="avatar-upload"
                          className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 cursor-pointer transition-colors"
                        >
                          <Upload className="h-4 w-4 mr-2" />
                          选择图片
                        </label>
                        <p className="text-xs text-gray-500 mt-1">
                          支持 JPG、PNG 格式，大小不超过 5MB
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* 用户名 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      用户名 *
                    </label>
                    <input
                      type="text"
                      value={profileForm.username}
                      onChange={(e) => setProfileForm({ ...profileForm, username: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      required
                    />
                  </div>

                  {/* 邮箱（只读） */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      邮箱
                    </label>
                    <input
                      type="email"
                      value={profile?.email || ''}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-gray-50 text-gray-500"
                      disabled
                    />
                  </div>

                  {/* 个人简介 */}
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      个人简介
                    </label>
                    <textarea
                      value={profileForm.bio}
                      onChange={(e) => setProfileForm({ ...profileForm, bio: e.target.value })}
                      rows={4}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      placeholder="介绍一下自己..."
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={loading}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {loading ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    {loading ? '保存中...' : '保存更改'}
                  </button>
                </div>
              </form>
            )}

            {activeTab === 'password' && (
              <form onSubmit={handlePasswordSubmit} className="space-y-6 max-w-md">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    当前密码 *
                  </label>
                  <input
                    type="password"
                    value={passwordForm.currentPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    新密码 *
                  </label>
                  <input
                    type="password"
                    value={passwordForm.newPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    required
                    minLength={6}
                  />
                  <p className="text-xs text-gray-500 mt-1">密码长度至少6位</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    确认新密码 *
                  </label>
                  <input
                    type="password"
                    value={passwordForm.confirmPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={loading}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {loading ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    ) : (
                      <Lock className="h-4 w-4 mr-2" />
                    )}
                    {loading ? '修改中...' : '修改密码'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* 账户信息 */}
        <div className="mt-8 bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">账户信息</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">用户ID:</span>
              <span className="ml-2 text-gray-900">{profile?.id || '-'}</span>
            </div>
            <div>
              <span className="text-gray-500">角色:</span>
              <span className="ml-2 text-gray-900">
                {profile?.role === 'admin' ? '管理员' : profile?.role === 'author' ? '作者' : '用户'}
              </span>
            </div>
            <div>
              <span className="text-gray-500">注册时间:</span>
              <span className="ml-2 text-gray-900">
                {profile?.createdAt ? new Date(profile.createdAt).toLocaleString('zh-CN') : '-'}
              </span>
            </div>
            <div>
              <span className="text-gray-500">最后更新:</span>
              <span className="ml-2 text-gray-900">
                {profile?.updatedAt ? new Date(profile.updatedAt).toLocaleString('zh-CN') : '-'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserCenter;