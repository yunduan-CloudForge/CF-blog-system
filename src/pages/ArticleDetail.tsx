/**
 * 文章详情页面
 * 显示完整文章内容和评论
 */
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  ArrowLeft, 
  Heart, 
  Eye, 
  Calendar, 
  User, 
  Tag, 
  Edit, 
  Trash2
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useArticleStore } from '../store/articleStore';
import { useAuthStore } from '../store/authStore';
import CommentSection from '../components/CommentSection';



const ArticleDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  // 状态管理
  const {
    currentArticle,
    isLoading,
    error,
    fetchArticleById,
    deleteArticle,
    likeArticle,
    checkArticleLikeStatus
  } = useArticleStore();
  
  const { user, isAuthenticated } = useAuthStore();
  
  // 本地状态
  const [isLiked, setIsLiked] = useState(false);
  const [isLiking, setIsLiking] = useState(false);
  

  
  // 页面加载时获取文章详情
  useEffect(() => {
    if (id) {
      fetchArticleById(parseInt(id));
    }
  }, [id, fetchArticleById]);
  
  // 检查用户点赞状态
  useEffect(() => {
    const checkLikeStatus = async () => {
      if (id && isAuthenticated) {
        try {
          const liked = await checkArticleLikeStatus(parseInt(id));
          setIsLiked(liked);
        } catch (error) {
          console.error('检查点赞状态失败:', error);
        }
      } else {
        setIsLiked(false);
      }
    };
    
    checkLikeStatus();
  }, [id, isAuthenticated, checkArticleLikeStatus]);
  

  
  // 删除文章
  const handleDeleteArticle = async () => {
    if (window.confirm('确定要删除这篇文章吗？')) {
      const success = await deleteArticle(parseInt(id!));
      if (success) {
        navigate('/articles');
      }
    }
  };
  
  // 点赞文章
  const handleLikeArticle = async () => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    
    if (isLiking) return;
    
    setIsLiking(true);
    
    try {
      const result = await likeArticle(parseInt(id!));
      if (result) {
        setIsLiked(!isLiked);
      }
    } catch (error) {
      console.error('点赞操作失败:', error);
    } finally {
      setIsLiking(false);
    }
  };
  
  // 格式化日期
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  // 检查是否可以编辑/删除文章
  const canEditArticle = () => {
    return isAuthenticated && currentArticle && (user?.role === 'admin' || user?.id === currentArticle.author_id);
  };
  

  
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }
  
  if (error || !currentArticle) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error || '文章不存在'}</p>
          <Link
            to="/articles"
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            返回文章列表
          </Link>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gray-50">
      {/* 返回按钮 */}
      <div className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <Link
            to="/articles"
            className="inline-flex items-center text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            返回文章列表
          </Link>
        </div>
      </div>
      
      {/* 文章内容 */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <article className="bg-white rounded-lg shadow-sm border">
          {/* 文章头部 */}
          <div className="p-8 border-b">
            <div className="flex justify-between items-start mb-6">
              <h1 className="text-3xl font-bold text-gray-900 flex-1 mr-4">
                {currentArticle.title}
              </h1>
              
              {/* 操作按钮 */}
              {canEditArticle() && (
                <div className="flex items-center space-x-2">
                  <Link
                    to={`/articles/${currentArticle.id}/edit`}
                    className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                    title="编辑"
                  >
                    <Edit className="w-5 h-5" />
                  </Link>
                  <button
                    onClick={handleDeleteArticle}
                    className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                    title="删除"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              )}
            </div>
            
            {/* 文章元信息 */}
            <div className="flex items-center text-gray-500 space-x-6 mb-6">
              <div className="flex items-center">
                <User className="w-5 h-5 mr-2" />
                {currentArticle.author?.username || '未知作者'}
              </div>
              <div className="flex items-center">
                <Calendar className="w-5 h-5 mr-2" />
                {formatDate(currentArticle.created_at)}
              </div>
              <div className="flex items-center">
                <Eye className="w-5 h-5 mr-2" />
                {currentArticle.views} 次浏览
              </div>
              <div className="flex items-center">
                <Heart className="w-5 h-5 mr-2" />
                {currentArticle.likes} 个赞
              </div>
            </div>
            
            {/* 分类和标签 */}
            <div className="flex items-center space-x-4">
              {/* 分类 */}
              {currentArticle.category && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                  {currentArticle.category.name}
                </span>
              )}
              
              {/* 标签 */}
              {currentArticle.tags && currentArticle.tags.length > 0 && (
                <div className="flex items-center space-x-2">
                  <Tag className="w-4 h-4 text-gray-400" />
                  <div className="flex space-x-2">
                    {currentArticle.tags.map(tag => (
                      <span
                        key={tag.id}
                        className="inline-flex items-center px-2 py-1 rounded text-sm font-medium"
                        style={{ backgroundColor: tag.color + '20', color: tag.color }}
                      >
                        {tag.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {/* 文章内容 */}
          <div className="p-8">
            <div className="prose prose-lg max-w-none prose-headings:text-gray-900 prose-p:text-gray-700 prose-a:text-blue-600 prose-strong:text-gray-900 prose-code:text-pink-600 prose-code:bg-gray-100 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-pre:bg-gray-900 prose-pre:text-gray-100 prose-blockquote:border-l-blue-500 prose-blockquote:bg-blue-50 prose-blockquote:pl-4 prose-blockquote:py-2">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {currentArticle.content}
              </ReactMarkdown>
            </div>
          </div>
          
          {/* 点赞按钮 */}
          <div className="p-8 border-t bg-gray-50">
            <div className="flex justify-center">
              <button
                onClick={handleLikeArticle}
                disabled={isLiking || !isAuthenticated}
                className={`flex items-center space-x-2 px-6 py-3 rounded-lg transition-all duration-200 ${
                  isLiked
                    ? 'bg-red-50 border border-red-200 text-red-600 hover:bg-red-100'
                    : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 hover:text-red-600 hover:border-red-200'
                } disabled:opacity-50 disabled:cursor-not-allowed ${
                  isLiking ? 'scale-95' : 'hover:scale-105'
                }`}
                title={!isAuthenticated ? '请先登录' : (isLiked ? '取消点赞' : '点赞')}
              >
                <Heart 
                  className={`w-5 h-5 transition-all duration-200 ${
                    isLiked ? 'fill-current text-red-500' : 'text-red-500'
                  } ${
                    isLiking ? 'animate-pulse' : ''
                  }`} 
                />
                <span className="font-medium">
                  {isLiked ? '已赞' : '点赞'} ({currentArticle.likes})
                </span>
              </button>
            </div>
          </div>
        </article>
        
        {/* 评论区域 */}
        <div className="mt-8">
          <CommentSection 
            articleId={parseInt(id!)}
            maxDepth={10}
            className="bg-white rounded-lg shadow-sm border"
          />
        </div>
      </div>
    </div>
  );
};

export default ArticleDetail;