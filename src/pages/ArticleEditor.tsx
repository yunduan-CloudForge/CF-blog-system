/**
 * 文章编辑/创建页面
 * 支持Markdown编辑
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  ArrowLeft, 
  Save, 
  Eye, 
  EyeOff, 
  FileText, 
  Tag as TagIcon,
  Folder,
  AlertCircle,
  Image,
  Upload
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useArticleStore } from '../store/articleStore';
import { useAuthStore } from '../store/authStore';

const ArticleEditor: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEditing = Boolean(id);
  
  // 状态管理
  const {
    currentArticle,
    categories,
    tags,
    isLoading,
    error,
    fetchArticleById,
    fetchCategories,
    fetchTags,
    createArticle,
    updateArticle
  } = useArticleStore();
  
  const { user, isAuthenticated } = useAuthStore();
  
  // 表单状态
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    summary: '',
    status: 'draft' as 'draft' | 'published' | 'archived',
    category_id: '',
    tag_ids: [] as number[]
  });
  
  const [showPreview, setShowPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [autoSaving, setAutoSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  
  // 检查权限
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    
    // 如果是编辑模式，检查是否有权限编辑
    if (isEditing && currentArticle) {
      const canEdit = user?.role === 'admin' || user?.id === currentArticle.author_id;
      if (!canEdit) {
        navigate('/articles');
        return;
      }
    }
  }, [isAuthenticated, isEditing, currentArticle, user, navigate]);
  
  // 页面加载时获取数据
  useEffect(() => {
    const loadData = async () => {
      await Promise.all([
        fetchCategories(),
        fetchTags()
      ]);
      
      if (isEditing && id) {
        await fetchArticleById(parseInt(id));
      }
    };
    
    loadData();
  }, [id, isEditing, fetchCategories, fetchTags, fetchArticleById]);
  
  // 当获取到文章数据时，填充表单
  useEffect(() => {
    if (isEditing && currentArticle) {
      setFormData({
        title: currentArticle.title || '',
        content: currentArticle.content || '',
        summary: currentArticle.summary || '',
        status: currentArticle.status || 'draft',
        category_id: currentArticle.category_id?.toString() || '',
        tag_ids: Array.isArray(currentArticle.tags) ? currentArticle.tags.map(tag => tag.id) : []
      });
    }
  }, [currentArticle, isEditing]);
  
  // 表单验证
  const validateForm = () => {
    const errors: Record<string, string> = {};
    
    if (!formData.title.trim()) {
      errors.title = '标题不能为空';
    }
    
    if (!formData.content.trim()) {
      errors.content = '内容不能为空';
    }
    
    if (!formData.summary.trim()) {
      errors.summary = '摘要不能为空';
    }
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };
  
  // 处理表单提交
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    setSaving(true);
    
    try {
      const articleData = {
        ...formData,
        category_id: formData.category_id ? parseInt(formData.category_id) : null,
        tag_ids: formData.tag_ids
      };
      
      let success;
      if (isEditing) {
        success = await updateArticle(parseInt(id!), articleData);
      } else {
        success = await createArticle(articleData);
      }
      
      if (success) {
        // 显示成功消息
        alert(isEditing ? '文章更新成功！' : '文章创建成功！');
        navigate('/articles');
      } else {
        // 显示失败消息
        alert(isEditing ? '文章更新失败，请重试' : '文章创建失败，请重试');
      }
    } catch (error) {
      console.error('保存文章失败:', error);
      alert('保存文章时发生错误，请检查网络连接后重试');
    } finally {
      setSaving(false);
    }
  };
  
  // 处理标签选择
  const handleTagToggle = (tagId: number) => {
    setFormData(prev => ({
      ...prev,
      tag_ids: prev.tag_ids.includes(tagId)
        ? prev.tag_ids.filter(id => id !== tagId)
        : [...prev.tag_ids, tagId]
    }));
  };
  
  // 自动保存功能
  const autoSave = useCallback(async () => {
    if (!formData.title.trim() || !formData.content.trim()) {
      return; // 标题和内容为空时不自动保存
    }
    
    setAutoSaving(true);
    
    try {
      const articleData = {
        ...formData,
        status: 'draft' as const, // 自动保存时总是保存为草稿
        category_id: formData.category_id ? parseInt(formData.category_id) : null,
        tag_ids: formData.tag_ids
      };
      
      let success;
      if (isEditing) {
        success = await updateArticle(parseInt(id!), articleData);
      } else {
        // 对于新文章，第一次自动保存后需要获取文章ID
        const result = await createArticle(articleData);
        if (result && !isEditing) {
          // 如果是新创建的文章，需要重定向到编辑页面
          // 这里我们假设createArticle返回了文章ID
          // 实际实现中可能需要调整
        }
        success = result;
      }
      
      if (success) {
        setLastSaved(new Date());
      }
    } catch (error) {
      console.error('自动保存失败:', error);
    } finally {
      setAutoSaving(false);
    }
  }, [formData, isEditing, id, updateArticle, createArticle]);
  
  // 自动保存定时器
  useEffect(() => {
    const timer = setInterval(() => {
      autoSave();
    }, 30000); // 每30秒自动保存一次
    
    return () => clearInterval(timer);
  }, [formData, isEditing, id, autoSave]);
  
  // 监听表单变化，重置最后保存时间
  useEffect(() => {
    if (lastSaved) {
      setLastSaved(null);
    }
  }, [formData.title, formData.content, formData.summary, lastSaved]);
  
  // 图片上传功能
  const uploadImage = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('请选择图片文件');
      return;
    }
    
    if (file.size > 5 * 1024 * 1024) {
      alert('图片大小不能超过5MB');
      return;
    }
    
    setUploading(true);
    
    try {
      const formData = new FormData();
      formData.append('image', file);
      
      const { token } = useAuthStore.getState();
      const response = await fetch('http://localhost:3001/api/upload/image', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });
      
      const result = await response.json();
      
      if (result.success) {
        // 插入Markdown图片语法到光标位置
        const imageMarkdown = `![${result.data.originalName}](${result.data.url})`;
        insertTextAtCursor(imageMarkdown);
      } else {
        alert(result.message || '图片上传失败');
      }
    } catch (error) {
      console.error('图片上传错误:', error);
      alert('图片上传失败，请重试');
    } finally {
      setUploading(false);
    }
  };
  
  // 在光标位置插入文本
  const insertTextAtCursor = (text: string) => {
    const textarea = document.querySelector('textarea[placeholder*="开始写作"]') as HTMLTextAreaElement;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const currentContent = formData.content;
      const newContent = currentContent.substring(0, start) + text + currentContent.substring(end);
      
      setFormData(prev => ({ ...prev, content: newContent }));
      
      // 设置光标位置到插入文本之后
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + text.length, start + text.length);
      }, 0);
    }
  };
  
  // 处理文件选择
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      uploadImage(file);
    }
    // 清空input值，允许重复选择同一文件
    event.target.value = '';
  };
  
  // 处理拖拽上传
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };
  
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };
  
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    const imageFile = files.find(file => file.type.startsWith('image/'));
    
    if (imageFile) {
      uploadImage(imageFile);
    } else {
      alert('请拖拽图片文件');
    }
  };
  
  // 自动生成摘要
  const generateSummary = () => {
    const content = formData.content.trim();
    if (content) {
      const summary = content.substring(0, 200) + (content.length > 200 ? '...' : '');
      setFormData(prev => ({ ...prev, summary }));
    }
  };
  
  // 渲染Markdown预览
  const renderMarkdownPreview = (content: string) => {
    return (
      <div className="prose prose-lg max-w-none prose-headings:text-gray-900 prose-p:text-gray-700 prose-a:text-blue-600 prose-strong:text-gray-900 prose-code:text-pink-600 prose-code:bg-gray-100 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-pre:bg-gray-900 prose-pre:text-gray-100">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {content || '开始写作以查看预览...'}
        </ReactMarkdown>
      </div>
    );
  };
  
  if (!isAuthenticated) {
    return null;
  }
  
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gray-50">
      {/* 页面头部 */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-4">
              <Link
                to="/articles"
                className="inline-flex items-center text-gray-600 hover:text-gray-900 transition-colors"
              >
                <ArrowLeft className="w-5 h-5 mr-2" />
                返回文章列表
              </Link>
              <h1 className="text-2xl font-bold text-gray-900">
                {isEditing ? '编辑文章' : '创建文章'}
              </h1>
            </div>
            
            <div className="flex items-center space-x-4">
              {/* 自动保存状态 */}
              <div className="text-sm text-gray-500">
                {autoSaving ? (
                  <span className="flex items-center">
                    <div className="animate-spin rounded-full h-3 w-3 border-b border-gray-400 mr-2"></div>
                    自动保存中...
                  </span>
                ) : lastSaved ? (
                  <span>已保存于 {lastSaved.toLocaleTimeString()}</span>
                ) : (
                  <span>未保存的更改</span>
                )}
              </div>
              
              <button
                type="button"
                onClick={() => setShowPreview(!showPreview)}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                {showPreview ? (
                  <>
                    <EyeOff className="w-4 h-4 mr-2" />
                    编辑模式
                  </>
                ) : (
                  <>
                    <Eye className="w-4 h-4 mr-2" />
                    预览模式
                  </>
                )}
              </button>
              
              <button
                onClick={handleSubmit}
                disabled={saving || autoSaving}
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Save className="w-4 h-4 mr-2" />
                {saving ? '保存中...' : '保存文章'}
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {/* 错误提示 */}
      {error && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center">
              <AlertCircle className="w-5 h-5 text-red-500 mr-2" />
              <p className="text-red-600">{error}</p>
            </div>
          </div>
        </div>
      )}
      
      {/* 主要内容区域 */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* 主编辑区域 */}
            <div className="lg:col-span-2 space-y-6">
              {/* 标题 */}
              <div className="bg-white rounded-lg shadow-sm border p-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  文章标题 *
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="输入文章标题..."
                  className={`w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    validationErrors.title ? 'border-red-300' : 'border-gray-300'
                  }`}
                />
                {validationErrors.title && (
                  <p className="mt-1 text-sm text-red-600">{validationErrors.title}</p>
                )}
              </div>
              
              {/* 内容编辑器 */}
              <div className="bg-white rounded-lg shadow-sm border">
                <div className="border-b px-6 py-4">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-gray-700">
                      文章内容 *
                    </label>
                    <div className="flex items-center space-x-4">
                      {/* 图片上传按钮 */}
                      <div className="relative">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleFileSelect}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                          disabled={uploading}
                        />
                        <button
                          type="button"
                          disabled={uploading}
                          className="inline-flex items-center px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          {uploading ? (
                            <>
                              <div className="animate-spin rounded-full h-3 w-3 border-b border-gray-400 mr-2"></div>
                              上传中...
                            </>
                          ) : (
                            <>
                              <Image className="w-4 h-4 mr-1" />
                              插入图片
                            </>
                          )}
                        </button>
                      </div>
                      
                      <div className="text-sm text-gray-500">
                        支持 Markdown 语法
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="p-6">
                  {showPreview ? (
                    <div className="min-h-96 border border-gray-200 rounded-lg p-4">
                      {renderMarkdownPreview(formData.content)}
                    </div>
                  ) : (
                    <div
                      className={`relative ${
                        dragOver ? 'ring-2 ring-blue-500 ring-opacity-50' : ''
                      }`}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                    >
                      <textarea
                        value={formData.content}
                        onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                        placeholder="开始写作...\n\n支持Markdown语法：\n# 标题\n**粗体**\n*斜体*\n- 列表\n[链接](url)\n![图片](url)\n\n提示：可以直接拖拽图片到此区域上传"
                        rows={20}
                        className={`w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none font-mono ${
                          validationErrors.content ? 'border-red-300' : 'border-gray-300'
                        }`}
                      />
                      
                      {/* 拖拽上传提示 */}
                      {dragOver && (
                        <div className="absolute inset-0 bg-blue-50 bg-opacity-90 border-2 border-dashed border-blue-300 rounded-lg flex items-center justify-center">
                          <div className="text-center">
                            <Upload className="w-8 h-8 text-blue-500 mx-auto mb-2" />
                            <p className="text-blue-600 font-medium">释放以上传图片</p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  {validationErrors.content && (
                    <p className="mt-1 text-sm text-red-600">{validationErrors.content}</p>
                  )}
                </div>
              </div>
              
              {/* 摘要 */}
              <div className="bg-white rounded-lg shadow-sm border p-6">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-700">
                    文章摘要 *
                  </label>
                  <button
                    type="button"
                    onClick={generateSummary}
                    className="text-sm text-blue-600 hover:text-blue-800 transition-colors"
                  >
                    自动生成
                  </button>
                </div>
                <textarea
                  value={formData.summary}
                  onChange={(e) => setFormData(prev => ({ ...prev, summary: e.target.value }))}
                  placeholder="输入文章摘要，用于在列表页面显示..."
                  rows={3}
                  className={`w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none ${
                    validationErrors.summary ? 'border-red-300' : 'border-gray-300'
                  }`}
                />
                {validationErrors.summary && (
                  <p className="mt-1 text-sm text-red-600">{validationErrors.summary}</p>
                )}
                <div className="mt-1 text-sm text-gray-500">
                  {(formData.summary || '').length}/200 字符
                </div>
              </div>
            </div>
            
            {/* 侧边栏设置 */}
            <div className="space-y-6">
              {/* 发布设置 */}
              <div className="bg-white rounded-lg shadow-sm border p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                  <FileText className="w-5 h-5 mr-2" />
                  发布设置
                </h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      状态
                    </label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData(prev => ({ 
                        ...prev, 
                        status: e.target.value as 'draft' | 'published' | 'archived'
                      }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="draft">草稿</option>
                      <option value="published">已发布</option>
                      <option value="archived">已归档</option>
                    </select>
                  </div>
                </div>
              </div>
              
              {/* 分类设置 */}
              <div className="bg-white rounded-lg shadow-sm border p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                  <Folder className="w-5 h-5 mr-2" />
                  分类
                </h3>
                
                <select
                  value={formData.category_id}
                  onChange={(e) => setFormData(prev => ({ ...prev, category_id: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">选择分类</option>
                  {Array.isArray(categories) && categories.map(category => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
                {!Array.isArray(categories) && (
                  <p className="text-sm text-gray-500 mt-2">分类加载中...</p>
                )}
              </div>
              
              {/* 标签设置 */}
              <div className="bg-white rounded-lg shadow-sm border p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                  <TagIcon className="w-5 h-5 mr-2" />
                  标签
                </h3>
                
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {Array.isArray(tags) && tags.map(tag => (
                    <label key={tag.id} className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={(formData.tag_ids || []).includes(tag.id)}
                        onChange={() => handleTagToggle(tag.id)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span
                        className="inline-flex items-center px-2 py-1 rounded text-sm font-medium"
                        style={{ backgroundColor: tag.color + '20', color: tag.color }}
                      >
                        {tag.name}
                      </span>
                    </label>
                  ))}
                </div>
                
                {!Array.isArray(tags) && (
                  <p className="text-sm text-gray-500 mt-2">标签加载中...</p>
                )}
                {Array.isArray(tags) && (formData.tag_ids || []).length === 0 && (
                  <p className="text-sm text-gray-500 mt-2">未选择标签</p>
                )}
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ArticleEditor;