import React, { useState, useEffect } from 'react';
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

interface TagType {
  id: number;
  name: string;
  color: string;
  article_count: number;
  created_at: string;
  updated_at: string;
}

interface TagFormData {
  name: string;
  color: string;
}

const DEFAULT_COLORS = [
  '#3B82F6', // blue
  '#EF4444', // red
  '#10B981', // green
  '#F59E0B', // yellow
  '#8B5CF6', // purple
  '#EC4899', // pink
  '#06B6D4', // cyan
  '#84CC16', // lime
  '#F97316', // orange
  '#6B7280'  // gray
];

export default function AdminTags() {
  const [tags, setTags] = useState<TagType[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [totalPages, setTotalPages] = useState(1);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedTag, setSelectedTag] = useState<TagType | null>(null);
  const [tagToDelete, setTagToDelete] = useState<number | null>(null);
  const [formData, setFormData] = useState<TagFormData>({
    name: '',
    color: DEFAULT_COLORS[0]
  });
  const [formErrors, setFormErrors] = useState<Partial<TagFormData>>({});
  const [submitting, setSubmitting] = useState(false);

  const itemsPerPage = 10;

  // 获取标签列表
  const fetchTags = async () => {
    try {
      setLoading(true);
      const response = await authAPI.authenticatedFetch('/tags');
      const data = await response.json();
      if (data.success) {
        setTags(data.data);
        setTotalPages(Math.ceil(data.data.length / itemsPerPage));
      }
    } catch (error) {
      console.error('获取标签列表失败:', error);
      toast.error('获取标签列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTags();
  }, [fetchTags]);

  // 过滤和分页
  const filteredTags = tags.filter(tag =>
    tag.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const paginatedTags = filteredTags.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // 表单验证
  const validateForm = (): boolean => {
    const errors: Partial<TagFormData> = {};
    
    if (!formData.name.trim()) {
      errors.name = '标签名称不能为空';
    } else if (formData.name.trim().length > 30) {
      errors.name = '标签名称不能超过30个字符';
    }
    
    if (!formData.color || !/^#[0-9A-Fa-f]{6}$/.test(formData.color)) {
      errors.color = '请选择有效的颜色';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // 重置表单
  const resetForm = () => {
    setFormData({ name: '', color: DEFAULT_COLORS[0] });
    setFormErrors({});
    setSelectedTag(null);
  };

  // 创建标签
  const handleCreateTag = async () => {
    if (!validateForm()) return;
    
    try {
      setSubmitting(true);
      const response = await authAPI.authenticatedFetch('/tags', {
        method: 'POST',
        body: JSON.stringify({
          name: formData.name.trim(),
          color: formData.color
        })
      });
      const data = await response.json();
      
      if (data.success) {
        toast.success('标签创建成功');
        setShowCreateModal(false);
        resetForm();
        fetchTags();
      }
    } catch (error: unknown) {
      console.error('创建标签失败:', error);
      const message = (error as { response?: { data?: { message?: string } } }).response?.data?.message || '创建标签失败';
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  // 更新标签
  const handleUpdateTag = async () => {
    if (!selectedTag || !validateForm()) return;
    
    try {
      setSubmitting(true);
      const response = await authAPI.authenticatedFetch(`/tags/${selectedTag.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: formData.name.trim(),
          color: formData.color
        })
      });
      const data = await response.json();
      
      if (data.success) {
        toast.success('标签更新成功');
        setShowEditModal(false);
        resetForm();
        fetchTags();
      }
    } catch (error: unknown) {
      console.error('更新标签失败:', error);
      const message = (error as { response?: { data?: { message?: string } } }).response?.data?.message || '更新标签失败';
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  // 删除标签
  const handleDeleteTag = async (tagId: number) => {
    try {
      const response = await authAPI.authenticatedFetch(`/tags/${tagId}`, {
        method: 'DELETE'
      });
      const data = await response.json();
      
      if (data.success) {
        toast.success('标签删除成功');
        setShowDeleteModal(false);
        setTagToDelete(null);
        fetchTags();
      }
    } catch (error: unknown) {
      console.error('删除标签失败:', error);
      const message = (error as { response?: { data?: { message?: string } } }).response?.data?.message || '删除标签失败';
      toast.error(message);
    }
  };

  // 打开编辑模态框
  const openEditModal = (tag: TagType) => {
    setSelectedTag(tag);
    setFormData({
      name: tag.name,
      color: tag.color
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
                  <h1 className="text-2xl font-bold text-gray-900">标签管理</h1>
                  <p className="text-gray-600 mt-1">管理博客文章标签</p>
                </div>
                <button
                  onClick={openCreateModal}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  新增标签
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
                      placeholder="搜索标签名称..."
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

            {/* 标签列表 */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              {loading ? (
                <div className="p-8 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="mt-2 text-gray-500">加载中...</p>
                </div>
              ) : filteredTags.length === 0 ? (
                <div className="p-8 text-center">
                  <Tag className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">
                    {searchTerm ? '未找到匹配的标签' : '暂无标签'}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          标签信息
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          颜色
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
                      {paginatedTags.map((tag) => (
                        <tr key={tag.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <span
                                className="px-2 py-1 text-xs text-white rounded-full"
                                style={{ backgroundColor: tag.color }}
                              >
                                {tag.name}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <div
                                className="w-6 h-6 rounded-full border border-gray-300"
                                style={{ backgroundColor: tag.color }}
                              ></div>
                              <span className="text-sm text-gray-600 font-mono">
                                {tag.color}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-1">
                              <FileText className="w-4 h-4 text-gray-400" />
                              <span className="text-sm text-gray-900">
                                {tag.article_count}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm text-gray-500">
                              <div className="flex items-center gap-1">
                                <Calendar className="w-4 h-4" />
                                {new Date(tag.created_at).toLocaleDateString()}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => openEditModal(tag)}
                                className="text-green-600 hover:text-green-800 p-1 rounded"
                                title="编辑"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => {
                                  setTagToDelete(tag.id);
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
              {Math.ceil(filteredTags.length / itemsPerPage) > 1 && (
                <div className="px-6 py-4 border-t border-gray-200">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-gray-500">
                      第 {currentPage} 页，共 {Math.ceil(filteredTags.length / itemsPerPage)} 页
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
                        onClick={() => setCurrentPage(Math.min(Math.ceil(filteredTags.length / itemsPerPage), currentPage + 1))}
                        disabled={currentPage === Math.ceil(filteredTags.length / itemsPerPage)}
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

      {/* 创建标签模态框 */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-medium text-gray-900 mb-4">新增标签</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  标签名称 *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    formErrors.name ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="请输入标签名称"
                />
                {formErrors.name && (
                  <p className="text-red-500 text-sm mt-1">{formErrors.name}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  标签颜色 *
                </label>
                <div className="space-y-3">
                  {/* 预设颜色 */}
                  <div className="grid grid-cols-5 gap-2">
                    {DEFAULT_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setFormData({ ...formData, color })}
                        className={`w-8 h-8 rounded-full border-2 ${
                          formData.color === color ? 'border-gray-800' : 'border-gray-300'
                        }`}
                        style={{ backgroundColor: color }}
                        title={color}
                      />
                    ))}
                  </div>
                  {/* 自定义颜色 */}
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={formData.color}
                      onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                      className="w-8 h-8 border border-gray-300 rounded cursor-pointer"
                    />
                    <input
                      type="text"
                      value={formData.color}
                      onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                      className={`flex-1 px-3 py-1 text-sm border rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono ${
                        formErrors.color ? 'border-red-300' : 'border-gray-300'
                      }`}
                      placeholder="#000000"
                    />
                  </div>
                  {formErrors.color && (
                    <p className="text-red-500 text-sm">{formErrors.color}</p>
                  )}
                </div>
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
                onClick={handleCreateTag}
                disabled={submitting}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? '创建中...' : '创建'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 编辑标签模态框 */}
      {showEditModal && selectedTag && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-medium text-gray-900 mb-4">编辑标签</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  标签名称 *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    formErrors.name ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="请输入标签名称"
                />
                {formErrors.name && (
                  <p className="text-red-500 text-sm mt-1">{formErrors.name}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  标签颜色 *
                </label>
                <div className="space-y-3">
                  {/* 预设颜色 */}
                  <div className="grid grid-cols-5 gap-2">
                    {DEFAULT_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setFormData({ ...formData, color })}
                        className={`w-8 h-8 rounded-full border-2 ${
                          formData.color === color ? 'border-gray-800' : 'border-gray-300'
                        }`}
                        style={{ backgroundColor: color }}
                        title={color}
                      />
                    ))}
                  </div>
                  {/* 自定义颜色 */}
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={formData.color}
                      onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                      className="w-8 h-8 border border-gray-300 rounded cursor-pointer"
                    />
                    <input
                      type="text"
                      value={formData.color}
                      onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                      className={`flex-1 px-3 py-1 text-sm border rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono ${
                        formErrors.color ? 'border-red-300' : 'border-gray-300'
                      }`}
                      placeholder="#000000"
                    />
                  </div>
                  {formErrors.color && (
                    <p className="text-red-500 text-sm">{formErrors.color}</p>
                  )}
                </div>
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
                onClick={handleUpdateTag}
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
              确定要删除这个标签吗？如果该标签下有文章，删除操作将会失败。
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setTagToDelete(null);
                }}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={() => tagToDelete && handleDeleteTag(tagToDelete)}
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