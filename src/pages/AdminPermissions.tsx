/**
 * 权限管理页面
 * 模块: 5.1 管理员权限系统 - 权限管理
 */

import React, { useState, useEffect } from 'react';
import {
  Users,
  Key,
  Plus,
  Edit,
  Trash2,
  Search,
  Check,
  X
} from 'lucide-react';
import { toast } from 'sonner';
import { authAPI } from '@/store/authStore';
import AdminNavigation from '@/components/AdminNavigation';

interface Permission {
  id: number;
  name: string;
  description: string;
  resource: string;
  action: string;
  created_at: string;
}

interface Role {
  name: string;
  description: string;
  permissions: Permission[];
}

interface RolePermission {
  role: string;
  permission_id: number;
  permission_name: string;
  resource: string;
  action: string;
}

export default function AdminPermissions() {
  const [activeTab, setActiveTab] = useState<'permissions' | 'roles'>('permissions');
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);

  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedPermission, setSelectedPermission] = useState<Permission | null>(null);
  const [newPermission, setNewPermission] = useState({
    name: '',
    description: '',
    resource: '',
    action: ''
  });

  // 获取权限列表
  const fetchPermissions = async () => {
    try {
      const response = await authAPI.authenticatedFetch('/admin/permissions');

      if (response.ok) {
        const data = await response.json();
        setPermissions(data.data || []);
      } else {
        toast.error('获取权限列表失败');
      }
    } catch (error) {
      console.error('获取权限列表失败:', error);
      toast.error('获取权限列表失败');
    }
  };

  // 获取角色权限映射
  const fetchRolePermissions = async () => {
    try {
      const response = await authAPI.authenticatedFetch('/admin/role-permissions');

      if (response.ok) {
        const data = await response.json();
        // Role permissions are now managed through the roles data structure
        
        // 组织角色数据
        const roleMap = new Map<string, Role>();
        data.data.forEach((rp: RolePermission) => {
          if (!roleMap.has(rp.role)) {
            roleMap.set(rp.role, {
              name: rp.role,
              description: getRoleDescription(rp.role),
              permissions: []
            });
          }
          roleMap.get(rp.role)?.permissions.push({
            id: rp.permission_id,
            name: rp.permission_name,
            description: '',
            resource: rp.resource,
            action: rp.action,
            created_at: ''
          });
        });
        
        setRoles(Array.from(roleMap.values()));
      } else {
        toast.error('获取角色权限失败');
      }
    } catch (error) {
      console.error('获取角色权限失败:', error);
      toast.error('获取角色权限失败');
    }
  };

  // 获取角色描述
  const getRoleDescription = (role: string) => {
    const descriptions = {
      admin: '系统管理员，拥有所有权限',
      author: '内容作者，可以创建和管理文章',
      user: '普通用户，基础权限'
    };
    return descriptions[role as keyof typeof descriptions] || '自定义角色';
  };

  // 创建权限
  const handleCreatePermission = async () => {
    try {
      const response = await authAPI.authenticatedFetch('/admin/permissions', {
        method: 'POST',
        body: JSON.stringify(newPermission)
      });

      if (response.ok) {
        toast.success('权限创建成功');
        setShowCreateModal(false);
        setNewPermission({ name: '', description: '', resource: '', action: '' });
        fetchPermissions();
      } else {
        toast.error('创建权限失败');
      }
    } catch (error) {
      console.error('创建权限失败:', error);
      toast.error('创建权限失败');
    }
  };

  // 更新权限
  const handleUpdatePermission = async () => {
    if (!selectedPermission) return;

    try {
      const response = await authAPI.authenticatedFetch(`/admin/permissions/${selectedPermission.id}`, {
        method: 'PUT',
        body: JSON.stringify(newPermission)
      });

      if (response.ok) {
        toast.success('权限更新成功');
        setShowEditModal(false);
        setSelectedPermission(null);
        setNewPermission({ name: '', description: '', resource: '', action: '' });
        fetchPermissions();
      } else {
        toast.error('更新权限失败');
      }
    } catch (error) {
      console.error('更新权限失败:', error);
      toast.error('更新权限失败');
    }
  };

  // 删除权限
  const handleDeletePermission = async (id: number) => {
    if (!confirm('确定要删除这个权限吗？')) return;

    try {
      const response = await authAPI.authenticatedFetch(`/admin/permissions/${id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        toast.success('权限删除成功');
        fetchPermissions();
      } else {
        toast.error('删除权限失败');
      }
    } catch (error) {
      console.error('删除权限失败:', error);
      toast.error('删除权限失败');
    }
  };

  // 切换角色权限
  const handleToggleRolePermission = async (role: string, permissionId: number, hasPermission: boolean) => {
    try {
      const method = hasPermission ? 'DELETE' : 'POST';
      const response = await authAPI.authenticatedFetch('/admin/role-permissions', {
        method,
        body: JSON.stringify({ role, permission_id: permissionId })
      });

      if (response.ok) {
        toast.success(hasPermission ? '权限已移除' : '权限已添加');
        fetchRolePermissions();
      } else {
        toast.error('权限更新失败');
      }
    } catch (error) {
      console.error('权限更新失败:', error);
      toast.error('权限更新失败');
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchPermissions(), fetchRolePermissions()]);
      setLoading(false);
    };
    loadData();
  }, []);

  const filteredPermissions = permissions.filter(permission =>
    permission.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    permission.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    permission.resource.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getResourceIcon = (resource: string) => {
    const icons = {
      articles: '📝',
      users: '👥',
      comments: '💬',
      categories: '📁',
      tags: '🏷️',
      permissions: '🔐',
      system: '⚙️'
    };
    return icons[resource as keyof typeof icons] || '📄';
  };

  const getActionColor = (action: string) => {
    const colors = {
      create: 'bg-green-100 text-green-800',
      read: 'bg-blue-100 text-blue-800',
      update: 'bg-yellow-100 text-yellow-800',
      delete: 'bg-red-100 text-red-800',
      manage: 'bg-purple-100 text-purple-800'
    };
    return colors[action as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <AdminNavigation className="w-64 flex-shrink-0" />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white shadow-sm border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">权限管理</h1>
            <div className="flex items-center gap-4">
              <div className="flex bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setActiveTab('permissions')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    activeTab === 'permissions'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Key className="w-4 h-4 inline mr-2" />
                  权限管理
                </button>
                <button
                  onClick={() => setActiveTab('roles')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    activeTab === 'roles'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Users className="w-4 h-4 inline mr-2" />
                  角色权限
                </button>
              </div>
              {activeTab === 'permissions' && (
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  新建权限
                </button>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-2 text-gray-500">加载中...</span>
            </div>
          ) : (
            <>
              {activeTab === 'permissions' && (
                <div className="space-y-6">
                  {/* 搜索 */}
                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <input
                        type="text"
                        placeholder="搜索权限名称、描述或资源..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>

                  {/* 权限列表 */}
                  <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50 border-b border-gray-200">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              权限信息
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              资源
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              操作
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              创建时间
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              管理
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {filteredPermissions.map((permission) => (
                            <tr key={permission.id} className="hover:bg-gray-50">
                              <td className="px-6 py-4">
                                <div>
                                  <h3 className="text-sm font-medium text-gray-900">
                                    {permission.name}
                                  </h3>
                                  <p className="text-sm text-gray-500">
                                    {permission.description}
                                  </p>
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex items-center">
                                  <span className="text-lg mr-2">
                                    {getResourceIcon(permission.resource)}
                                  </span>
                                  <span className="text-sm text-gray-900">
                                    {permission.resource}
                                  </span>
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                                  getActionColor(permission.action)
                                }`}>
                                  {permission.action}
                                </span>
                              </td>
                              <td className="px-6 py-4">
                                <span className="text-sm text-gray-500">
                                  {new Date(permission.created_at).toLocaleDateString()}
                                </span>
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => {
                                      setSelectedPermission(permission);
                                      setNewPermission({
                                        name: permission.name,
                                        description: permission.description,
                                        resource: permission.resource,
                                        action: permission.action
                                      });
                                      setShowEditModal(true);
                                    }}
                                    className="text-blue-600 hover:text-blue-800 p-1 rounded"
                                    title="编辑"
                                  >
                                    <Edit className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleDeletePermission(permission.id)}
                                    className="text-red-600 hover:text-red-800 p-1 rounded"
                                    title="删除"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'roles' && (
                <div className="space-y-6">
                  {roles.map((role) => (
                    <div key={role.name} className="bg-white rounded-lg shadow-sm border border-gray-200">
                      <div className="px-6 py-4 border-b border-gray-200">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="text-lg font-medium text-gray-900">
                              {role.name === 'admin' ? '管理员' : role.name === 'author' ? '作者' : role.name === 'user' ? '用户' : role.name}
                            </h3>
                            <p className="text-sm text-gray-500">{role.description}</p>
                          </div>
                          <div className="text-sm text-gray-500">
                            {role.permissions.length} 个权限
                          </div>
                        </div>
                      </div>
                      <div className="p-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {permissions.map((permission) => {
                            const hasPermission = role.permissions.some(p => p.id === permission.id);
                            return (
                              <div
                                key={permission.id}
                                className={`p-3 rounded-lg border-2 transition-colors cursor-pointer ${
                                  hasPermission
                                    ? 'border-green-200 bg-green-50'
                                    : 'border-gray-200 bg-gray-50 hover:border-gray-300'
                                }`}
                                onClick={() => handleToggleRolePermission(role.name, permission.id, hasPermission)}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center">
                                    <span className="text-lg mr-2">
                                      {getResourceIcon(permission.resource)}
                                    </span>
                                    <div>
                                      <h4 className="text-sm font-medium text-gray-900">
                                        {permission.name}
                                      </h4>
                                      <p className="text-xs text-gray-500">
                                        {permission.resource}.{permission.action}
                                      </p>
                                    </div>
                                  </div>
                                  <div className={`w-5 h-5 rounded-full flex items-center justify-center ${
                                    hasPermission ? 'bg-green-500' : 'bg-gray-300'
                                  }`}>
                                    {hasPermission ? (
                                      <Check className="w-3 h-3 text-white" />
                                    ) : (
                                      <X className="w-3 h-3 text-white" />
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* 创建权限模态框 */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-medium text-gray-900 mb-4">创建新权限</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  权限名称
                </label>
                <input
                  type="text"
                  value={newPermission.name}
                  onChange={(e) => setNewPermission({ ...newPermission, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="例如: articles.create"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  权限描述
                </label>
                <input
                  type="text"
                  value={newPermission.description}
                  onChange={(e) => setNewPermission({ ...newPermission, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="例如: 创建文章"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  资源类型
                </label>
                <select
                  value={newPermission.resource}
                  onChange={(e) => setNewPermission({ ...newPermission, resource: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">选择资源类型</option>
                  <option value="articles">文章</option>
                  <option value="users">用户</option>
                  <option value="comments">评论</option>
                  <option value="categories">分类</option>
                  <option value="tags">标签</option>
                  <option value="permissions">权限</option>
                  <option value="system">系统</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  操作类型
                </label>
                <select
                  value={newPermission.action}
                  onChange={(e) => setNewPermission({ ...newPermission, action: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">选择操作类型</option>
                  <option value="create">创建</option>
                  <option value="read">查看</option>
                  <option value="update">更新</option>
                  <option value="delete">删除</option>
                  <option value="manage">管理</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setNewPermission({ name: '', description: '', resource: '', action: '' });
                }}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={handleCreatePermission}
                disabled={!newPermission.name || !newPermission.resource || !newPermission.action}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                创建
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 编辑权限模态框 */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-medium text-gray-900 mb-4">编辑权限</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  权限名称
                </label>
                <input
                  type="text"
                  value={newPermission.name}
                  onChange={(e) => setNewPermission({ ...newPermission, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  权限描述
                </label>
                <input
                  type="text"
                  value={newPermission.description}
                  onChange={(e) => setNewPermission({ ...newPermission, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  资源类型
                </label>
                <select
                  value={newPermission.resource}
                  onChange={(e) => setNewPermission({ ...newPermission, resource: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="articles">文章</option>
                  <option value="users">用户</option>
                  <option value="comments">评论</option>
                  <option value="categories">分类</option>
                  <option value="tags">标签</option>
                  <option value="permissions">权限</option>
                  <option value="system">系统</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  操作类型
                </label>
                <select
                  value={newPermission.action}
                  onChange={(e) => setNewPermission({ ...newPermission, action: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="create">创建</option>
                  <option value="read">查看</option>
                  <option value="update">更新</option>
                  <option value="delete">删除</option>
                  <option value="manage">管理</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setSelectedPermission(null);
                  setNewPermission({ name: '', description: '', resource: '', action: '' });
                }}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={handleUpdatePermission}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                更新
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}