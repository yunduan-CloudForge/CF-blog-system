/**
 * 系统设置页面
 * 模块: 5.4 系统配置管理
 */

import React, { useState, useEffect } from 'react';
import {
  Settings,
  Globe,
  Mail,
  Shield,
  Database,
  Bell,
  Palette,
  Save,
  RefreshCw,
  Upload,
  Download,
  AlertTriangle,
  Check,
  X
} from 'lucide-react';
import toast from 'react-hot-toast';
import AdminNavigation from '@/components/AdminNavigation';
import { authAPI } from '@/store/authStore';

interface SystemSettings {
  // 网站基本设置
  site_name: string;
  site_description: string;
  site_url: string;
  site_logo: string;
  site_favicon: string;
  
  // 邮件设置
  smtp_host: string;
  smtp_port: number;
  smtp_username: string;
  smtp_password: string;
  smtp_encryption: 'none' | 'tls' | 'ssl';
  mail_from_address: string;
  mail_from_name: string;
  
  // 安全设置
  max_login_attempts: number;
  session_timeout: number;
  password_min_length: number;
  require_email_verification: boolean;
  enable_two_factor: boolean;
  
  // 内容设置
  posts_per_page: number;
  allow_comments: boolean;
  moderate_comments: boolean;
  max_upload_size: number;
  allowed_file_types: string;
  
  // 缓存设置
  enable_cache: boolean;
  cache_duration: number;
  
  // 备份设置
  auto_backup: boolean;
  backup_frequency: 'daily' | 'weekly' | 'monthly';
  backup_retention: number;
}

export default function AdminSettings() {
  const [activeTab, setActiveTab] = useState<'general' | 'mail' | 'security' | 'content' | 'system'>('general');
  const [settings, setSettings] = useState<SystemSettings>({
    site_name: '',
    site_description: '',
    site_url: '',
    site_logo: '',
    site_favicon: '',
    smtp_host: '',
    smtp_port: 587,
    smtp_username: '',
    smtp_password: '',
    smtp_encryption: 'tls',
    mail_from_address: '',
    mail_from_name: '',
    max_login_attempts: 5,
    session_timeout: 3600,
    password_min_length: 8,
    require_email_verification: true,
    enable_two_factor: false,
    posts_per_page: 10,
    allow_comments: true,
    moderate_comments: true,
    max_upload_size: 10,
    allowed_file_types: 'jpg,jpeg,png,gif,pdf,doc,docx',
    enable_cache: true,
    cache_duration: 3600,
    auto_backup: true,
    backup_frequency: 'daily',
    backup_retention: 30
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [testingEmail, setTestingEmail] = useState(false);
  const [testEmailAddress, setTestEmailAddress] = useState('');
  const [backupStatus, setBackupStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle');

  // 获取系统设置
  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await authAPI.authenticatedFetch('/admin/settings');

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setSettings(prev => ({ ...prev, ...data.data }));
        } else {
          toast.error(data.message || '获取系统设置失败');
        }
      } else {
        toast.error('获取系统设置失败');
      }
    } catch (error) {
      console.error('获取系统设置失败:', error);
      toast.error('获取系统设置失败');
    } finally {
      setLoading(false);
    }
  };

  // 保存设置
  const handleSaveSettings = async () => {
    try {
      console.log('开始保存设置...');
      console.log('当前设置数据:', settings);
      setSaving(true);
      
      const response = await authAPI.authenticatedFetch('/admin/settings', {
        method: 'PUT',
        body: JSON.stringify(settings)
      });

      console.log('保存设置响应状态:', response.status);
      console.log('保存设置响应头:', response.headers);

      if (response.ok) {
        const data = await response.json();
        console.log('保存设置响应数据:', data);
        if (data.success) {
          toast.success(data.message || '设置保存成功！', {
            duration: 3000,
            style: {
              background: '#10b981',
              color: '#fff',
              fontWeight: '500'
            }
          });
          setSaveSuccess(true);
          // 3秒后重置成功状态
          setTimeout(() => setSaveSuccess(false), 3000);
        } else {
          console.error('保存设置失败 - 服务器返回错误:', data);
          toast.error(data.message || '保存设置失败', {
            duration: 4000
          });
        }
      } else {
        const errorText = await response.text();
        console.error('保存设置HTTP错误:', response.status, errorText);
        toast.error('保存设置失败，请稍后重试', {
          duration: 4000
        });
      }
    } catch (error) {
      console.error('保存设置异常:', error);
      toast.error('网络错误，请检查连接后重试', {
        duration: 4000
      });
    } finally {
      setSaving(false);
      console.log('保存设置操作完成');
    }
  };

  // 测试邮件配置
  const handleTestEmail = async () => {
    if (!testEmailAddress) {
      toast.error('请输入测试邮箱地址');
      return;
    }
    
    try {
      console.log('开始测试邮件配置...');
      const emailConfig = {
        smtp_host: settings.smtp_host,
        smtp_port: settings.smtp_port,
        smtp_username: settings.smtp_username,
        smtp_password: settings.smtp_password,
        smtp_encryption: settings.smtp_encryption,
        mail_from_address: settings.mail_from_address,
        mail_from_name: settings.mail_from_name,
        test_email: testEmailAddress
      };
      console.log('邮件配置数据:', { ...emailConfig, smtp_password: '***' });
      setTestingEmail(true);
      
      const response = await authAPI.authenticatedFetch('/admin/settings/test-email', {
        method: 'POST',
        body: JSON.stringify(emailConfig)
      });

      console.log('测试邮件响应状态:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('测试邮件响应数据:', data);
        if (data.success) {
          toast.success(data.message || '测试邮件发送成功');
        } else {
          console.error('测试邮件失败 - 服务器返回错误:', data);
          toast.error(data.message || '测试邮件发送失败');
        }
      } else {
        const errorText = await response.text();
        console.error('测试邮件HTTP错误:', response.status, errorText);
        toast.error('测试邮件发送失败');
      }
    } catch (error) {
      console.error('测试邮件异常:', error);
      toast.error('测试邮件失败');
    } finally {
      setTestingEmail(false);
      console.log('测试邮件操作完成');
    }
  };

  // 创建备份
  const handleCreateBackup = async () => {
    try {
      setBackupStatus('running');
      const response = await authAPI.authenticatedFetch('/admin/backup', {
        method: 'POST'
      });

      if (response.ok) {
        const data = await response.json();
        setBackupStatus('success');
        toast.success('备份创建成功');
        
        // 下载备份文件
        const downloadUrl = `/api/admin/backup/download/${data.data.filename}`;
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = data.data.filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } else {
        setBackupStatus('error');
        toast.error('创建备份失败');
      }
    } catch (error) {
      console.error('创建备份失败:', error);
      setBackupStatus('error');
      toast.error('创建备份失败');
    }
  };

  // 清理缓存
  const handleClearCache = async () => {
    try {
      const response = await authAPI.authenticatedFetch('/admin/cache/clear', {
        method: 'DELETE'
      });

      if (response.ok) {
        toast.success('缓存清理成功');
      } else {
        toast.error('清理缓存失败');
      }
    } catch (error) {
      console.error('清理缓存失败:', error);
      toast.error('清理缓存失败');
    }
  };

  useEffect(() => {
    fetchSettings();
    
    // 添加键盘快捷键支持
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        handleSaveSettings();
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const updateSetting = (key: keyof SystemSettings, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const tabs = [
    { id: 'general', name: '基本设置', icon: Globe },
    { id: 'mail', name: '邮件设置', icon: Mail },
    { id: 'security', name: '安全设置', icon: Shield },
    { id: 'content', name: '内容设置', icon: Settings },
    { id: 'system', name: '系统管理', icon: Database }
  ];

  if (loading) {
    return (
      <div className="flex h-screen bg-gray-50">
        <AdminNavigation className="w-64 flex-shrink-0" />
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-2 text-gray-500">加载中...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <AdminNavigation className="w-64 flex-shrink-0" />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white shadow-sm border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">系统设置</h1>
            <button
              onClick={handleSaveSettings}
              disabled={saving}
              className={`px-4 py-2 rounded-lg transition-all duration-300 flex items-center gap-2 font-medium transform ${
                saveSuccess
                  ? 'bg-green-600 text-white scale-105 shadow-lg'
                  : saving
                  ? 'bg-blue-400 text-white cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700 hover:shadow-md hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
              }`}
            >
              {saveSuccess ? (
                <Check className="w-4 h-4" />
              ) : saving ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {saveSuccess ? '保存成功！' : saving ? '保存中...' : '保存设置'}
            </button>
          </div>
        </header>

        <div className="flex-1 flex overflow-hidden">
          {/* 侧边栏标签 */}
          <div className="w-64 bg-white border-r border-gray-200 p-4">
            <nav className="space-y-2">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                      activeTab === tab.id
                        ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-600'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="font-medium">{tab.name}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* 主内容区 */}
          <main className="flex-1 overflow-auto p-6">
            {activeTab === 'general' && (
              <div className="space-y-6">
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">网站基本信息</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        网站名称
                      </label>
                      <input
                        type="text"
                        value={settings.site_name}
                        onChange={(e) => updateSetting('site_name', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        网站URL
                      </label>
                      <input
                        type="url"
                        value={settings.site_url}
                        onChange={(e) => updateSetting('site_url', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        网站描述
                      </label>
                      <textarea
                        value={settings.site_description}
                        onChange={(e) => updateSetting('site_description', e.target.value)}
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        网站Logo URL
                      </label>
                      <input
                        type="url"
                        value={settings.site_logo}
                        onChange={(e) => updateSetting('site_logo', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        网站图标 URL
                      </label>
                      <input
                        type="url"
                        value={settings.site_favicon}
                        onChange={(e) => updateSetting('site_favicon', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'mail' && (
              <div className="space-y-6">
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-medium text-gray-900">SMTP 邮件配置</h3>
                    <div className="flex items-center gap-3">
                      <input
                        type="email"
                        value={testEmailAddress}
                        onChange={(e) => setTestEmailAddress(e.target.value)}
                        placeholder="输入测试邮箱地址"
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent w-64"
                      />
                      <button
                        onClick={handleTestEmail}
                        disabled={testingEmail || !testEmailAddress}
                        className={`px-4 py-2 rounded-lg transition-all duration-200 flex items-center gap-2 font-medium ${
                          testingEmail || !testEmailAddress
                            ? 'bg-green-400 text-white cursor-not-allowed'
                            : 'bg-green-600 text-white hover:bg-green-700 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2'
                        }`}
                      >
                        {testingEmail ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <Mail className="w-4 h-4" />
                        )}
                        {testingEmail ? '测试中...' : '测试邮件'}
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        SMTP 主机
                      </label>
                      <input
                        type="text"
                        value={settings.smtp_host}
                        onChange={(e) => updateSetting('smtp_host', e.target.value)}
                        placeholder="smtp.gmail.com"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        SMTP 端口
                      </label>
                      <input
                        type="number"
                        value={settings.smtp_port}
                        onChange={(e) => updateSetting('smtp_port', parseInt(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        用户名
                      </label>
                      <input
                        type="text"
                        value={settings.smtp_username}
                        onChange={(e) => updateSetting('smtp_username', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        密码
                      </label>
                      <input
                        type="password"
                        value={settings.smtp_password}
                        onChange={(e) => updateSetting('smtp_password', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        加密方式
                      </label>
                      <select
                        value={settings.smtp_encryption}
                        onChange={(e) => updateSetting('smtp_encryption', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="none">无加密</option>
                        <option value="tls">TLS</option>
                        <option value="ssl">SSL</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        发件人邮箱
                      </label>
                      <input
                        type="email"
                        value={settings.mail_from_address}
                        onChange={(e) => updateSetting('mail_from_address', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        发件人名称
                      </label>
                      <input
                        type="text"
                        value={settings.mail_from_name}
                        onChange={(e) => updateSetting('mail_from_name', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'security' && (
              <div className="space-y-6">
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">安全设置</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        最大登录尝试次数
                      </label>
                      <input
                        type="number"
                        value={settings.max_login_attempts}
                        onChange={(e) => updateSetting('max_login_attempts', parseInt(e.target.value))}
                        min="1"
                        max="10"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        会话超时时间（秒）
                      </label>
                      <input
                        type="number"
                        value={settings.session_timeout}
                        onChange={(e) => updateSetting('session_timeout', parseInt(e.target.value))}
                        min="300"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        密码最小长度
                      </label>
                      <input
                        type="number"
                        value={settings.password_min_length}
                        onChange={(e) => updateSetting('password_min_length', parseInt(e.target.value))}
                        min="6"
                        max="20"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <div className="space-y-4">
                        <div className="flex items-center">
                          <input
                            type="checkbox"
                            id="require_email_verification"
                            checked={settings.require_email_verification}
                            onChange={(e) => updateSetting('require_email_verification', e.target.checked)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <label htmlFor="require_email_verification" className="ml-2 text-sm text-gray-700">
                            要求邮箱验证
                          </label>
                        </div>
                        <div className="flex items-center">
                          <input
                            type="checkbox"
                            id="enable_two_factor"
                            checked={settings.enable_two_factor}
                            onChange={(e) => updateSetting('enable_two_factor', e.target.checked)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <label htmlFor="enable_two_factor" className="ml-2 text-sm text-gray-700">
                            启用双因素认证
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'content' && (
              <div className="space-y-6">
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">内容管理设置</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        每页文章数量
                      </label>
                      <input
                        type="number"
                        value={settings.posts_per_page}
                        onChange={(e) => updateSetting('posts_per_page', parseInt(e.target.value))}
                        min="5"
                        max="50"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        最大上传文件大小（MB）
                      </label>
                      <input
                        type="number"
                        value={settings.max_upload_size}
                        onChange={(e) => updateSetting('max_upload_size', parseInt(e.target.value))}
                        min="1"
                        max="100"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        允许的文件类型（用逗号分隔）
                      </label>
                      <input
                        type="text"
                        value={settings.allowed_file_types}
                        onChange={(e) => updateSetting('allowed_file_types', e.target.value)}
                        placeholder="jpg,jpeg,png,gif,pdf,doc,docx"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <div className="space-y-4">
                        <div className="flex items-center">
                          <input
                            type="checkbox"
                            id="allow_comments"
                            checked={settings.allow_comments}
                            onChange={(e) => updateSetting('allow_comments', e.target.checked)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <label htmlFor="allow_comments" className="ml-2 text-sm text-gray-700">
                            允许评论
                          </label>
                        </div>
                        <div className="flex items-center">
                          <input
                            type="checkbox"
                            id="moderate_comments"
                            checked={settings.moderate_comments}
                            onChange={(e) => updateSetting('moderate_comments', e.target.checked)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <label htmlFor="moderate_comments" className="ml-2 text-sm text-gray-700">
                            评论需要审核
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'system' && (
              <div className="space-y-6">
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">缓存设置</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        缓存持续时间（秒）
                      </label>
                      <input
                        type="number"
                        value={settings.cache_duration}
                        onChange={(e) => updateSetting('cache_duration', parseInt(e.target.value))}
                        min="60"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="enable_cache"
                        checked={settings.enable_cache}
                        onChange={(e) => updateSetting('enable_cache', e.target.checked)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <label htmlFor="enable_cache" className="ml-2 text-sm text-gray-700">
                        启用缓存
                      </label>
                    </div>
                    <div className="md:col-span-2">
                      <button
                        onClick={handleClearCache}
                        className="bg-yellow-600 text-white px-4 py-2 rounded-lg hover:bg-yellow-700 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2 transition-all duration-200 flex items-center gap-2 font-medium"
                      >
                        <RefreshCw className="w-4 h-4" />
                        清理缓存
                      </button>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">备份设置</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        备份频率
                      </label>
                      <select
                        value={settings.backup_frequency}
                        onChange={(e) => updateSetting('backup_frequency', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="daily">每日</option>
                        <option value="weekly">每周</option>
                        <option value="monthly">每月</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        备份保留天数
                      </label>
                      <input
                        type="number"
                        value={settings.backup_retention}
                        onChange={(e) => updateSetting('backup_retention', parseInt(e.target.value))}
                        min="7"
                        max="365"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="auto_backup"
                        checked={settings.auto_backup}
                        onChange={(e) => updateSetting('auto_backup', e.target.checked)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <label htmlFor="auto_backup" className="ml-2 text-sm text-gray-700">
                        启用自动备份
                      </label>
                    </div>
                    <div>
                      <button
                        onClick={handleCreateBackup}
                        disabled={backupStatus === 'running'}
                        className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 ${
                          backupStatus === 'success'
                            ? 'bg-green-600 text-white hover:bg-green-700'
                            : backupStatus === 'error'
                            ? 'bg-red-600 text-white hover:bg-red-700'
                            : 'bg-blue-600 text-white hover:bg-blue-700'
                        }`}
                      >
                        {backupStatus === 'running' ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : backupStatus === 'success' ? (
                          <Check className="w-4 h-4" />
                        ) : backupStatus === 'error' ? (
                          <X className="w-4 h-4" />
                        ) : (
                          <Download className="w-4 h-4" />
                        )}
                        {backupStatus === 'running'
                          ? '创建中...'
                          : backupStatus === 'success'
                          ? '备份成功'
                          : backupStatus === 'error'
                          ? '备份失败'
                          : '立即备份'
                        }
                      </button>
                    </div>
                  </div>
                </div>

                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex items-start">
                    <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5 mr-3" />
                    <div>
                      <h4 className="text-sm font-medium text-yellow-800">注意事项</h4>
                      <p className="text-sm text-yellow-700 mt-1">
                        修改系统设置可能会影响网站的正常运行，请谨慎操作。建议在修改前先创建备份。
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}