import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { articleApi, categoryApi, tagApi } from '@/utils/api';
import { useAuthStore } from '@/store/authStore';
import type { Category, Tag, CreateArticleData } from '../types/index';
import { Save, ArrowLeft, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import RichTextEditor from '../components/RichTextEditor';
import { PageTransition } from '@/components/ui/PageTransition';
import { FormInput } from '../components/FormInput';
import { useFormValidation, commonValidationRules } from '../hooks/useFormValidation';
import MetaTags from '@/components/SEO/MetaTags';

export default function CreateArticle() {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuthStore();
  
  const [formData, setFormData] = useState<CreateArticleData>({
    title: '',
    content: '',
    excerpt: '',
    categoryId: 0,
    status: 'draft'
  });

  // 表单验证
  const {
    errors,
    touched,
    validateField,
    validateForm,
    handleBlur,
    handleChange,
    clearErrors,
    getFieldError,
    hasError
  } = useFormValidation({
    title: commonValidationRules.title,
    content: commonValidationRules.content,
    excerpt: {
      maxLength: 200
    }
  });
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);

  const hasFormError = (): boolean => {
    return Object.keys(errors).some(key => touched[key] && errors[key]);
  };
  
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedTags, setSelectedTags] = useState<Tag[]>([]);
  const [newTagName, setNewTagName] = useState('');
  const [loading, setLoading] = useState(false);
  const [showTagInput, setShowTagInput] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    
    fetchCategories();
    fetchTags();
  }, [isAuthenticated, navigate]);

  const fetchCategories = async () => {
    try {
      const response = await categoryApi.getCategories();
      setCategories(response);
    } catch (error) {
      console.error('获取分类失败:', error);
    }
  };

  const fetchTags = async () => {
    try {
      const response = await tagApi.getTags();
      setTags(response);
    } catch (error) {
      console.error('获取标签失败:', error);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    const newValue = name === 'categoryId' ? (value ? parseInt(value) : undefined) : value;
    
    setFormData(prev => ({
      ...prev,
      [name]: newValue
    }));
    
    // 表单验证
    if (name === 'title' || name === 'content' || name === 'excerpt') {
      handleChange(name, value);
    }
  };

  const handleFormInputChange = (name: string, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }));
    handleChange(name, value);
  };

  const handleFormInputBlur = (name: string) => {
    handleBlur(name);
  };

  const handleTagSelect = (tag: Tag) => {
    if (!selectedTags.find(t => t.id === tag.id)) {
      const newSelectedTags = [...selectedTags, tag];
      setSelectedTags(newSelectedTags);
      setFormData(prev => ({
        ...prev,
        tagIds: newSelectedTags.map(t => t.id)
      }));
    }
  };

  const handleTagRemove = (tagId: number) => {
    const newSelectedTags = selectedTags.filter(t => t.id !== tagId);
    setSelectedTags(newSelectedTags);
    setFormData(prev => ({
      ...prev,
      tagIds: newSelectedTags.map(t => t.id)
    }));
  };

  const handleCreateTag = async () => {
    if (!newTagName.trim()) {
      toast.error('标签名称不能为空');
      return;
    }

    try {
      const newTag = await tagApi.createTag({ name: newTagName.trim() });
      setTags(prev => [...prev, newTag]);
      handleTagSelect(newTag);
      setNewTagName('');
      setShowTagInput(false);
      toast.success('标签创建成功');
    } catch (error) {
      console.error('创建标签失败:', error);
      toast.error('创建标签失败，请重试');
    }
  };

  const handleSubmit = async (e: React.FormEvent, status: 'draft' | 'published') => {
    e.preventDefault();
    
    // 验证表单 - 转换数据类型以匹配验证函数期望的字符串类型
    const validationData = {
      title: formData.title || '',
      content: formData.content || '',
      excerpt: formData.excerpt || ''
    };
    const isValid = validateForm(validationData);
    if (!isValid) {
      toast.error('请检查表单输入');
      return;
    }

    try {
      setLoading(true);
      const submitData = { ...formData, status };
      
      const response = await articleApi.createArticle(submitData);
      
      toast.success(status === 'published' ? '文章发布成功' : '文章保存为草稿');
      navigate(`/articles/${response.slug}`);
    } catch (error) {
      console.error('提交文章失败:', error);
      toast.error('提交文章失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  const generateExcerpt = () => {
    if (formData.content.length > 200) {
      const excerpt = formData.content.substring(0, 200) + '...';
      setFormData(prev => ({ ...prev, excerpt }));
    } else {
      setFormData(prev => ({ ...prev, excerpt: formData.content }));
    }
  };

  if (!isAuthenticated) {
    return null;
  }

  return (
    <>
      <MetaTags
        title="创建文章 - 博客系统"
        description="在博客系统中创建新文章，分享您的想法和见解"
        keywords="创建文章,写作,博客,发布"
        url={`${window.location.origin}/articles/create`}
      />
      
      <PageTransition type="slide" direction="right">
        <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="flex items-center text-gray-600 hover:text-gray-900 mr-4"
            >
              <ArrowLeft className="h-5 w-5 mr-2" />
              返回
            </button>
            <h1 className="text-3xl font-bold text-gray-900">创建文章</h1>
          </div>
        </div>

        <form className="space-y-6">
          {/* Title */}
          <div className="bg-white rounded-lg shadow p-6">
            <FormInput
              label="文章标题"
              name="title"
              value={formData.title}
              onChange={handleFormInputChange}
              onBlur={handleFormInputBlur}
              placeholder="请输入文章标题"
              error={getFieldError('title')}
              required
              aria-describedby="title-help"
            />
            <p id="title-help" className="mt-1 text-sm text-gray-500">
              请输入一个简洁明了的标题
            </p>
          </div>

          {/* Content */}
          <div className="bg-white rounded-lg shadow p-6">
            <label htmlFor="content" className="block text-sm font-medium text-gray-700 mb-2">
              文章内容 *
            </label>
            <RichTextEditor
              value={formData.content}
              onChange={(value) => setFormData(prev => ({ ...prev, content: value }))}
              placeholder="开始编写您的文章内容..."
            />
          </div>

          {/* Excerpt */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                文章摘要
              </label>
              <button
                type="button"
                onClick={generateExcerpt}
                className="text-blue-600 hover:text-blue-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
                aria-label="自动生成摘要"
              >
                自动生成
              </button>
            </div>
            <FormInput
              name="excerpt"
              value={formData.excerpt}
              onChange={handleFormInputChange}
              onBlur={handleFormInputBlur}
              placeholder="请输入文章摘要（可选）"
              error={getFieldError('excerpt')}
              type="textarea"
              rows={3}
              aria-describedby="excerpt-help"
            />
            <p id="excerpt-help" className="mt-1 text-sm text-gray-500">
              摘要将显示在文章列表中，建议控制在200字以内
            </p>
          </div>

          {/* Category and Tags */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Category */}
              <div>
                <label htmlFor="categoryId" className="block text-sm font-medium text-gray-700 mb-2">
                  分类
                </label>
                <select
                  id="categoryId"
                  name="categoryId"
                  value={formData.categoryId || ''}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">请选择分类</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Tags */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  标签
                </label>
                
                {/* Selected Tags */}
                {selectedTags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {selectedTags.map((tag) => (
                      <span
                        key={tag.id}
                        className="inline-flex items-center bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm"
                      >
                        {tag.name}
                        <button
                          type="button"
                          onClick={() => handleTagRemove(tag.id)}
                          className="ml-2 text-blue-600 hover:text-blue-800"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                
                {/* Tag Selection */}
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    {tags
                      .filter(tag => !selectedTags.find(st => st.id === tag.id))
                      .map((tag) => (
                        <button
                          key={tag.id}
                          type="button"
                          onClick={() => handleTagSelect(tag)}
                          className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm hover:bg-gray-200 transition-colors"
                        >
                          {tag.name}
                        </button>
                      ))
                    }
                  </div>
                  
                  {/* Add New Tag */}
                  {showTagInput ? (
                    <div className="flex items-center space-x-2">
                      <input
                        type="text"
                        value={newTagName}
                        onChange={(e) => setNewTagName(e.target.value)}
                        placeholder="输入新标签名称"
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleCreateTag();
                          }
                        }}
                      />
                      <button
                        type="button"
                        onClick={handleCreateTag}
                        className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                      >
                        添加
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowTagInput(false);
                          setNewTagName('');
                        }}
                        className="px-3 py-2 text-gray-600 hover:text-gray-800"
                      >
                        取消
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowTagInput(true)}
                      className="flex items-center text-blue-600 hover:text-blue-800 text-sm"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      创建新标签
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-end space-x-4">
              <button
                type="button"
                onClick={(e) => handleSubmit(e, 'draft')}
                disabled={loading || hasFormError()}
                className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="保存为草稿"
              >
                {loading ? '保存中...' : '保存草稿'}
              </button>
              <button
                type="button"
                onClick={(e) => handleSubmit(e, 'published')}
                disabled={loading || hasFormError()}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                aria-label="发布文章"
              >
                <Save className="h-5 w-5 mr-2" />
                {loading ? '发布中...' : '发布文章'}
              </button>
            </div>
          </div>
        </form>
      </div>
      </div>
    </PageTransition>
    </>
  );
}