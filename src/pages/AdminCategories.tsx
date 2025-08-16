import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Search, 
  Plus, 
  Edit, 
  Trash2, 
  FileText,
  Calendar,
  Tag
} from 'lucide-react';
import AdminNavigation from '../components/AdminNavigation';
import { authAPI } from '../store/authStore';
import { toast } from 'sonner';

interface Category {
  id: number;
  name: string;
  description?: string;
  article_count: number;
  created_at: string;
  updated_at: string;
}

interface CategoryFormData {
  name: string;
  description: string;
}

export default function AdminCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [categoryToDelete, setCategoryToDelete] = useState<number | null>(null);
  const [formData, setFormData] = useState<CategoryFormData>({
    name: '',
    description: ''
  });
  const [formErrors, setFormErrors] = useState<Partial<CategoryFormData>>({});
  const [submitting, setSubmitting] = useState(false);

  const itemsPerPage = 10;

  // 获取分类列表
  const fetchCategories = async () => {
    try {
      setLoading(true);
      const response = await authAPI.authenticatedFetch('/categories');
      const data = await response.json();
      if (data.success) {
        setCategories(data.data);
        setTotalPages(Math.ceil(data.data.length / itemsPerPage));
      }
    } catch (error) {
      console.error('获取分类列表失败:', error);
      toast.error('获取分类列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  // 过滤和分页
  const filteredCategories = categories.filter(category =>
    category.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (category.description && category.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const paginatedCategories = filteredCategories.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // 表单验证
  const validateForm = (): boolean => {
    const errors: Partial<CategoryFormData> = {};
    
    if (!formData.name.trim()) {
      errors.name = '分类名称不能为空';
    } else if (formData.name.trim().length > 50) {
      errors.name = '分类名称不能超过50个字符';
    }
    
    if (formData.description && formData.description.length > 200) {
      errors.description = '分类描述不能超过200个字符';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // 重置表单
  const resetForm = () => {
    setFormData({ name: '', description: '' });
    setFormErrors({});
    setSelectedCategory(null);
  };

  // 创建分类
  const handleCreateCategory = async () => {
    if (!validateForm()) return;
    
    try {
      setSubmitting(true);
      const response = await authAPI.authenticatedFetch('/categories', {
        method: 'POST',
        body: JSON.stringify({
          name: formData.name.trim(),
          description: formData.description.trim() || undefined
        })
      });
      const data = await response.json();
      
      if (data.success) {
        toast.success('分类创建成功');
        setShowCreateModal(false);
        resetForm();
        fetchCategories();
      }
    } catch (error: any) {
      console.error('创建分类失败:', error);
      const message = error.response?.data?.message || '创建分类失败';
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  // 更新分类
  const handleUpdateCategory = async () => {
    if (!selectedCategory || !validateForm()) return;
    
    try {
      setSubmitting(true);
      const response = await authAPI.authenticatedFetch(`/categories/${selectedCategory.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: formData.name.trim(),
          description: formData.description.trim() || undefined
        })
      });
      const data = await response.json();
      
      if (data.success) {
        toast.success('分类更新成功');
        setShowEditModal(false);
        resetForm();
        fetchCategories();
      }
    } catch (error: any) {
      console.error('更新分类失败:', error);
      const message = error.response?.data?.message || '更新分类失败';
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  // 删除分类
  const handleDeleteCategory = async (categoryId: number) => {
    try {
      const response = await authAPI.authenticatedFetch(`/categories/${categoryId}`, {
        method: 'DELETE'
      });
      const data = await response.json();
      
      if (data.success) {
        toast.success('分类删除成功');
        setShowDeleteModal(false);
        setCategoryToDelete(null);
        fetchCategories();
      }
    } catch (error: any) {
      console.error('删除分类失败:', error);
      const message = error.response?.data?.message || '删除分类失败';
      toast.error(message);
    }
  };

  // 打开编辑模态框
  const openEditModal = (category: Category) => {
    setSelectedCategory(category);
    setFormData({
      name: category.name,
      description: category.description || ''
    });
    setShowEditModal(true);
  };

  // 打开创建模态框
  const openCreateModal = () => {
    resetForm();
    setShowCreateModal(true);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex">
        <AdminNavigation />
        
        <div className="flex-1 flex flex-col">
          {/* 头部 */}
          <header className="bg-white shadow-sm border-b border-gray-200">
            <div className="px-6 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">分类管理</h1>
                  <p className="text-gray-600 mt-1">管理博客文章分类</p>
                </div>
                <button
                  onClick={openCreateModal}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  新增分类
                </button>
              </div>
            </div>
          </header>

          <main className="flex-1 overflow-auto p-6">
            {/* 搜索 */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                      type="text"
                      placeholder="搜索分类名称或描述..."
                      value={searchTerm}
                      onChange={(e) => {
                        setSearchTerm(e.target.value);
                        setCurrentPage(1);
                      }}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* 分类列表 */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              {loading ? (
                <div className="p-8 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="mt-2 text-gray-500">加载中...</p>
                </div>
              ) : filteredCategories.length === 0 ? (
                <div className="p-8 text-center">
                  <Tag className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">
                    {searchTerm ? '未找到匹配的分类' : '暂无分类'}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          分类信息
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          文章数量
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          创建时间
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          操作
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {paginatedCategories.map((category) => (
                        <tr key={category.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4">
                            <div>
                              <h3 className="text-sm font-medium text-gray-900 mb-1">
                                {category.name}
                              </h3>
                              {category.description && (
                                <p className="text-sm text-gray-500 line-clamp-2">
                                  {category.description}
                                </p>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-1">
                              <FileText className="w-4 h-4 text-gray-400" />
                              <span className="text-sm text-gray-900">
                                {category.article_count}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm text-gray-500">
                              <div className="flex items-center gap-1">
                                <Calendar className="w-4 h-4" />
                                {new Date(category.created_at).toLocaleDateString()}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => openEditModal(category)}
                                className="text-green-600 hover:text-green-800 p-1 rounded"
                                title="编辑"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => {
                                  setCategoryToDelete(category.id);
                                  setShowDeleteModal(true);
                                }}
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
              )}

              {/* 分页 */}
              {Math.ceil(filteredCategories.length / itemsPerPage) > 1 && (
                <div className="px-6 py-4 border-t border-gray-200">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-gray-500">
                      第 {currentPage} 页，共 {Math.ceil(filteredCategories.length / itemsPerPage)} 页
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                        disabled={currentPage === 1}
                        className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        上一页
                      </button>
                      <button
                        onClick={() => setCurrentPage(Math.min(Math.ceil(filteredCategories.length / itemsPerPage), currentPage + 1))}
                        disabled={currentPage === Math.ceil(filteredCategories.length / itemsPerPage)}
                        className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        下一页
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </main>
        </div>
      </div>

      {/* 创建分类模态框 */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-medium text-gray-900 mb-4">新增分类</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  分类名称 *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    formErrors.name ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="请输入分类名称"
                />
                {formErrors.name && (
                  <p className="text-red-500 text-sm mt-1">{formErrors.name}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  分类描述
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    formErrors.description ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="请输入分类描述（可选）"
                  rows={3}
                />
                {formErrors.description && (
                  <p className="text-red-500 text-sm mt-1">{formErrors.description}</p>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  resetForm();
                }}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                disabled={submitting}
              >
                取消
              </button>
              <button
                onClick={handleCreateCategory}
                disabled={submitting}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? '创建中...' : '创建'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 编辑分类模态框 */}
      {showEditModal && selectedCategory && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-medium text-gray-900 mb-4">编辑分类</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  分类名称 *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    formErrors.name ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="请输入分类名称"
                />
                {formErrors.name && (
                  <p className="text-red-500 text-sm mt-1">{formErrors.name}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  分类描述
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    formErrors.description ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="请输入分类描述（可选）"
                  rows={3}
                />
                {formErrors.description && (
                  <p className="text-red-500 text-sm mt-1">{formErrors.description}</p>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowEditModal(false);
                  resetForm();
                }}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                disabled={submitting}
              >
                取消
              </button>
              <button
                onClick={handleUpdateCategory}
                disabled={submitting}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? '更新中...' : '更新'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 删除确认模态框 */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-medium text-gray-900 mb-4">确认删除</h3>
            <p className="text-gray-500 mb-6">
              确定要删除这个分类吗？如果该分类下有文章，删除操作将会失败。
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setCategoryToDelete(null);
                }}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={() => categoryToDelete && handleDeleteCategory(categoryToDelete)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}