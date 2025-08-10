import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { articleApi, commentApi } from '@/utils/api';
import { useAuthStore } from '@/store/authStore';
import { Article, Comment, CommentWithUser } from '@/types';
import { Calendar, User, Eye, MessageCircle, Tag, ArrowLeft, Edit, Trash2, Reply, Send } from 'lucide-react';
import { toast } from 'sonner';
import { ArticleDetailSkeleton, CommentListSkeleton } from '@/components/skeletons';
import { ErrorBoundary, ErrorDisplay } from '@/components/ui/ErrorBoundary';
import { useAsyncState, ButtonLoading } from '@/components/ui/LoadingState';
import { useToastActions } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { formatDate } from '@/utils/date';
import { useKeyboardNavigation } from '@/hooks/useKeyboardNavigation';
import { useScreenReader } from '@/hooks/useAccessibility';
import { ContentTransition, ListItemTransition } from '@/components/ui/PageTransition';
import MetaTags from '@/components/SEO/MetaTags';
import { StructuredData, createArticleSchema } from '@/components/SEO/StructuredData';
import { LazyImage } from '@/components/LazyLoad/LazyImage';
import { usePerformanceMonitor } from '@/hooks/usePerformance';
import { useBehaviorAnalytics } from '@/hooks/useBehaviorAnalytics';

export default function ArticleDetail() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuthStore();
  
  const [newComment, setNewComment] = useState('');
  const [replyTo, setReplyTo] = useState<number | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);
  const { measureAsyncFunction } = usePerformanceMonitor();
  const toastActions = useToastActions();
  const { confirmDelete } = useConfirm();
  
  // 初始化用户行为分析
  const { trackCustomEvent, trackArticleRead } = useBehaviorAnalytics({
    trackClicks: true,
    trackScrolling: true,
    trackPageViews: true,
    trackFormInteractions: true,
    scrollThreshold: 25
  });
  
  const [readingStartTime] = useState(Date.now());
  const [maxScrollPercentage, setMaxScrollPercentage] = useState(0);
  
  const commentTextareaRef = useRef<HTMLTextAreaElement>(null);
  const replyTextareaRef = useRef<HTMLTextAreaElement>(null);
  const { announce } = useScreenReader();
  
  // 使用新的异步状态管理Hook
  const articleState = useAsyncState<Article | null>(null);
  const commentsState = useAsyncState<CommentWithUser[]>([]);

  const fetchArticle = async () => {
    if (!slug) return;
    
    await articleState.execute(async () => {
      const response = await measureAsyncFunction('fetchArticle', () => 
        articleApi.getArticle(slug)
      );
      return response;
    }).catch((error) => {
      console.error('获取文章失败:', error);
      toast.error('文章不存在或已被删除');
      // 不自动跳转，让用户选择
      throw error;
    });
  };

  const fetchComments = async () => {
    if (!articleState.data) return;
    
    await commentsState.execute(async () => {
      const response = await commentApi.getArticleComments(articleState.data!.id.toString());
      return response;
    }).catch((error) => {
      console.error('获取评论失败:', error);
      // 评论获取失败不阻塞页面显示
      return [];
    });
  };

  useEffect(() => {
    fetchArticle();
  }, [slug]);

  useEffect(() => {
    if (articleState.data) {
      fetchComments();
      // 跟踪文章访问
      trackCustomEvent('article_view', {
        articleId: articleState.data.id,
        title: articleState.data.title,
        author: articleState.data.author?.username,
        category: articleState.data.category
      });
    }
  }, [articleState.data]);
  
  // 跟踪文章阅读完成
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (articleState.data) {
        const readingTime = Date.now() - readingStartTime;
        trackArticleRead(
          articleState.data.id.toString(),
          readingTime,
          maxScrollPercentage
        );
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      // 组件卸载时也记录阅读数据
      if (articleState.data) {
        const readingTime = Date.now() - readingStartTime;
        trackArticleRead(
          articleState.data.id.toString(),
          readingTime,
          maxScrollPercentage
        );
      }
    };
  }, [articleState.data, readingStartTime, maxScrollPercentage, trackArticleRead]);

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isAuthenticated) {
      toast.error('请先登录后再评论');
      navigate('/login');
      return;
    }
    
    if (!newComment.trim()) {
      toast.error('评论内容不能为空');
      return;
    }
    
    if (!articleState.data) return;

    try {
      setIsSubmittingComment(true);
      await commentApi.createComment({
        content: newComment,
        articleId: articleState.data.id
      });
      
      setNewComment('');
      announce('评论发表成功');
      toastActions.success('评论成功', '您的评论已发布');
      
      // 跟踪评论行为
      trackCustomEvent('comment_submit', {
        articleId: articleState.data.id,
        commentLength: newComment.length,
        isReply: false
      });
      
      fetchComments();
    } catch (error) {
      console.error('提交评论失败:', error);
      toastActions.error('评论失败', '发布评论时发生错误，请稍后重试');
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleSubmitReply = async (e: React.FormEvent, parentId: number) => {
    e.preventDefault();
    
    if (!isAuthenticated) {
      toast.error('请先登录后再回复');
      navigate('/login');
      return;
    }
    
    if (!replyContent.trim()) {
      toast.error('回复内容不能为空');
      return;
    }
    
    if (!articleState.data) return;

    try {
      setIsSubmittingReply(true);
      await commentApi.createComment({
        content: replyContent,
        articleId: articleState.data.id,
        parentId
      });
      
      setReplyContent('');
      setReplyTo(null);
      announce('回复发表成功');
      toastActions.success('回复成功', '您的回复已发布');
      
      // 跟踪回复行为
      trackCustomEvent('comment_submit', {
        articleId: articleState.data.id,
        commentLength: replyContent.length,
        isReply: true,
        parentId
      });
      
      fetchComments();
    } catch (error) {
      console.error('提交回复失败:', error);
      toastActions.error('回复失败', '发布回复时发生错误，请稍后重试');
    } finally {
      setIsSubmittingReply(false);
    }
  };

  const handleDeleteArticle = async () => {
    if (!articleState.data) return;

    const confirmed = await confirmDelete(articleState.data.title);
    if (!confirmed) return;

    try {
      await articleApi.deleteArticle(articleState.data.id.toString());
      announce('文章删除成功，正在返回首页');
      toastActions.success('删除成功', '文章已成功删除');
      navigate('/');
    } catch (error) {
      console.error('删除文章失败:', error);
      toastActions.error('删除失败', '删除文章时发生错误，请稍后重试');
    }
  };

  const formatDate = (dateString: string, format: 'full' | 'short' = 'full') => {
    const date = new Date(dateString);
    if (format === 'short') {
      return date.toLocaleDateString('zh-CN', {
        month: 'short',
        day: 'numeric'
      });
    }
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const canEditArticle = () => {
    return user && (user.role === 'admin' || user.id.toString() === article?.authorId?.toString());
  };

  const renderComment = (comment: CommentWithUser, depth = 0) => {
    return (
      <div key={comment.id} className={`${depth > 0 ? 'ml-4 sm:ml-8 mt-3 sm:mt-4' : 'mt-4 sm:mt-6'}`} role="listitem">
        <div className="bg-gray-50 rounded-lg p-3 sm:p-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0 mb-2 sm:mb-2">
            <div className="flex items-center space-x-2">
              <div className="w-6 h-6 sm:w-8 sm:h-8 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-white text-xs sm:text-sm font-medium">
                  {comment.user.username.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-2 min-w-0">
                <span className="font-medium text-gray-900 text-sm sm:text-base truncate">{comment.user.name}</span>
                <span className="text-gray-500 text-xs sm:text-sm">
                  <span className="hidden sm:inline">{formatDate(comment.createdAt)}</span>
                  <span className="sm:hidden">{formatDate(comment.createdAt, 'short')}</span>
                </span>
                {comment.status === 'pending' && (
                  <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full text-xs">
                    待审核
                  </span>
                )}
              </div>
            </div>
            
            {isAuthenticated && (
              <button
                onClick={() => setReplyTo(replyTo === comment.id ? null : comment.id)}
                className="text-blue-600 hover:text-blue-800 text-xs sm:text-sm flex items-center self-start sm:self-center mt-1 sm:mt-0 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-md"
                aria-expanded={replyTo === comment.id}
                aria-label={replyTo === comment.id ? '取消回复' : `回复${comment.user.name}的评论`}
              >
                <Reply className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                回复
              </button>
            )}
          </div>
          
          <p className="text-gray-700 whitespace-pre-wrap text-sm sm:text-base leading-relaxed">{comment.content}</p>
          
          {replyTo === comment.id && (
            <form onSubmit={(e) => handleSubmitReply(e, comment.id)} className="mt-3 sm:mt-4">
              <textarea
                ref={replyTextareaRef}
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                placeholder="写下你的回复..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm sm:text-base"
                rows={3}
                required
                aria-label="回复内容"
              />
              <div className="flex justify-end space-x-2 mt-2">
                <button
                  type="button"
                  onClick={() => {
                    setReplyTo(null);
                    setReplyContent('');
                  }}
                  className="px-3 sm:px-4 py-2 text-gray-600 hover:text-gray-800 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 rounded-md"
                  aria-label="取消回复"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm sm:text-base focus:ring-offset-2"
                  aria-label="发表回复"
                >
                  提交回复
                </button>
              </div>
            </form>
          )}
        </div>
        
        {comment.replies && comment.replies.map(reply => renderComment(reply as CommentWithUser, depth + 1))}
      </div>
    );
  };

  // 加载状态
  if (articleState.loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4">
          <ArticleDetailSkeleton />
        </div>
      </div>
    );
  }

  // 错误状态
  if (articleState.error) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4">
          <ErrorDisplay 
            error={articleState.error}
            onRetry={() => fetchArticle()}
            showRetry
          />
        </div>
      </div>
    );
  }

  // 文章不存在
  if (!articleState.data) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4">
          <div className="bg-white rounded-lg shadow-sm p-8 text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">文章不存在</h1>
            <p className="text-gray-600 mb-6">抱歉，您访问的文章不存在或已被删除。</p>
            <Link 
              to="/" 
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              返回首页
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const article = articleState.data;

  // 生成SEO数据
  const pageTitle = `${article.title} - 博客系统`;
  const pageDescription = article.excerpt || article.content.substring(0, 160).replace(/\n/g, ' ') + '...';
  const keywords = article.tags?.map(tag => tag.name).join(', ') || '';
  const canonicalUrl = `${window.location.origin}/articles/${article.slug}`;
  const imageUrl = article.featuredImage || `${window.location.origin}/default-article-image.jpg`;
  
  // 生成结构化数据
  const articleSchema = createArticleSchema({
    headline: article.title,
    description: pageDescription,
    author: article.author?.name || '匿名',
    datePublished: article.createdAt,
    dateModified: article.updatedAt || article.createdAt,
    image: imageUrl,
    url: canonicalUrl,
    publisher: {
      name: '博客系统',
      url: window.location.origin
    },
    keywords: article.tags?.map(tag => tag.name) || [],
    articleSection: article.category?.name || '未分类'
  });

  return (
    <>
      <MetaTags
        title={pageTitle}
        description={pageDescription}
        keywords={keywords}
        image={imageUrl}
        url={canonicalUrl}
        type="article"
        author={article.author?.name}
        publishedTime={article.createdAt}
        modifiedTime={article.updatedAt}
        section={article.category?.name}
        tags={article.tags?.map(tag => tag.name)}
      />
      
      <StructuredData schema={articleSchema} />
      
      <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        {/* Back Button */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center text-gray-600 hover:text-gray-900 mb-4 sm:mb-6 p-2 -ml-2 rounded-lg hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          aria-label="返回上一页"
        >
          <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5 mr-1 sm:mr-2" />
          <span className="text-sm sm:text-base">返回</span>
        </button>

        {/* Article */}
        <article className="bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="p-4 sm:p-6 lg:p-8">
            {/* Article Header */}
            <div className="mb-6 sm:mb-8">
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 mb-3 sm:mb-4 leading-tight">
                {article.title}
              </h1>
              
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
                <div className="flex flex-wrap items-center gap-3 sm:gap-6 text-xs sm:text-sm text-gray-500">
                  <div className="flex items-center">
                    <User className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                    <span className="truncate max-w-20 sm:max-w-none">{article.author?.username || '匿名'}</span>
                  </div>
                  <div className="flex items-center">
                    <Calendar className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                    <span className="hidden sm:inline">{formatDate(article.createdAt)}</span>
                    <span className="sm:hidden">{formatDate(article.createdAt, 'short')}</span>
                  </div>
                  <div className="flex items-center">
                    <Eye className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                    {article.viewCount}
                  </div>
                  <div className="flex items-center">
                    <MessageCircle className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                    {article.commentCount}
                  </div>
                </div>
                
                {canEditArticle() && (
                  <div className="flex space-x-1 sm:space-x-2">
                    <Link
                      to={`/articles/${article.slug}/edit`}
                      className="flex items-center px-2 sm:px-3 py-1 text-blue-600 hover:text-blue-800 rounded hover:bg-blue-50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                      aria-label="编辑文章"
                    >
                      <Edit className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                      <span className="text-xs sm:text-sm">编辑</span>
                    </Link>
                    <button
                      onClick={handleDeleteArticle}
                      className="flex items-center px-2 sm:px-3 py-1 text-red-600 hover:text-red-800 rounded hover:bg-red-50 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                      aria-label="删除文章"
                    >
                      <Trash2 className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                      <span className="text-xs sm:text-sm">删除</span>
                    </button>
                  </div>
                )}
              </div>
              
              {/* Category and Tags */}
              <div className="flex flex-wrap items-center gap-2 sm:gap-4 mt-3 sm:mt-4">
                {article.category && (
                  <span className="bg-blue-100 text-blue-800 px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm">
                    {article.category.name}
                  </span>
                )}
                
                {article.tags && article.tags.length > 0 && (
                  <div className="flex items-center space-x-1 sm:space-x-2">
                    <Tag className="h-3 w-3 sm:h-4 sm:w-4 text-gray-400" />
                    <div className="flex flex-wrap gap-1 sm:gap-2">
                      {article.tags.slice(0, 3).map((tag) => (
                        <span
                          key={tag.id}
                          className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs sm:text-sm"
                        >
                          {tag.name}
                        </span>
                      ))}
                      {article.tags.length > 3 && (
                        <span className="text-xs sm:text-sm text-gray-400">+{article.tags.length - 3}</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Article Content */}
            <div className="prose prose-sm sm:prose-base lg:prose-lg max-w-none">
              <div className="whitespace-pre-wrap text-gray-800 leading-relaxed text-sm sm:text-base">
                {article.content}
              </div>
            </div>
          </div>
        </article>

        {/* Comments Section */}
        <ContentTransition show={true} className="mt-6 sm:mt-8">
          <div className="bg-white rounded-lg shadow-lg p-4 sm:p-6 lg:p-8">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4 sm:mb-6">
            评论 ({commentsState.data?.length || 0})
          </h2>
          
          {/* Comment Form */}
          {isAuthenticated ? (
            <form onSubmit={handleSubmitComment} className="mb-6 sm:mb-8">
              <textarea
                ref={commentTextareaRef}
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="写下你的评论..."
                className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm sm:text-base"
                rows={3}
                required
                aria-label="评论内容"
              />
              <div className="flex justify-end mt-3 sm:mt-4">
                <ButtonLoading
                  type="submit"
                  loading={isSubmittingComment}
                  disabled={!newComment.trim()}
                  className="px-4 sm:px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base focus:ring-offset-2"
                  aria-label="发表评论"
                >
                  发表评论
                </ButtonLoading>
              </div>
            </form>
          ) : (
            <div className="mb-6 sm:mb-8 p-3 sm:p-4 bg-gray-100 rounded-lg text-center">
              <p className="text-gray-600 mb-2 text-sm sm:text-base">请登录后发表评论</p>
              <Link
                to="/login"
                className="text-blue-600 hover:text-blue-800 font-medium text-sm sm:text-base"
              >
                立即登录
              </Link>
            </div>
          )}
          
          {/* Comments List */}
          <ErrorBoundary>
            {commentsState.loading ? (
              <CommentListSkeleton count={3} />
            ) : commentsState.error ? (
              <ErrorDisplay 
                error={commentsState.error}
                onRetry={() => fetchComments()}
                showRetry
                className="py-8"
              />
            ) : !commentsState.data || commentsState.data.length === 0 ? (
              <p className="text-gray-500 text-center py-6 sm:py-8 text-sm sm:text-base" role="status">暂无评论，快来发表第一条评论吧！</p>
            ) : (
              <div className="space-y-4 sm:space-y-6" role="list" aria-label="评论列表">
                {commentsState.data.map((comment, index) => (
                  <ListItemTransition key={comment.id} index={index} delay={150}>
                    {renderComment(comment)}
                  </ListItemTransition>
                ))}
              </div>
            )}
          </ErrorBoundary>
          </div>
        </ContentTransition>
      </div>
    </div>
    </>
  );
}