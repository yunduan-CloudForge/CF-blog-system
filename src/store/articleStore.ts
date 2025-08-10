import { create } from 'zustand';
import { Article, Category, Tag, PaginatedResponse } from '@/types/schemas';

export type ArticleListResponse = PaginatedResponse<Article>;

// 定义分页信息类型
interface PaginationInfo {
  readonly total: number;
  readonly page: number;
  readonly totalPages: number;
  readonly hasNext: boolean;
  readonly hasPrev: boolean;
}

// 定义状态接口
interface ArticleState {
  readonly articles: readonly Article[];
  readonly currentArticle: Article | null;
  readonly categories: readonly Category[];
  readonly tags: readonly Tag[];
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly pagination: PaginationInfo;
  
  // 状态更新方法
  setArticles: (articles: Article[]) => void;
  setCurrentArticle: (article: Article | null) => void;
  setCategories: (categories: Category[]) => void;
  setTags: (tags: Tag[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setPagination: (pagination: PaginationInfo) => void;
  addArticle: (article: Article) => void;
  updateArticle: (article: Article) => void;
  removeArticle: (articleId: string) => void;
  clearArticles: () => void;
}

export const useArticleStore = create<ArticleState>()((set) => ({
  articles: [],
  currentArticle: null,
  categories: [],
  tags: [],
  isLoading: false,
  error: null,
  pagination: {
    total: 0,
    page: 1,
    totalPages: 0,
    hasNext: false,
    hasPrev: false
  },
  setArticles: (articles) => set({ articles }),
  setCurrentArticle: (article) => set({ currentArticle: article }),
  setCategories: (categories) => set({ categories }),
  setTags: (tags) => set({ tags }),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
  setPagination: (pagination) => set({ pagination }),
  addArticle: (article) => set((state) => ({
    articles: [article, ...state.articles]
  })),
  updateArticle: (article) => set((state) => ({
    articles: state.articles.map(a => a.id === article.id ? article : a),
    currentArticle: state.currentArticle?.id === article.id ? article : state.currentArticle
  })),
  removeArticle: (articleId) => set((state) => ({
    articles: state.articles.filter(a => a.id !== Number(articleId)),
    currentArticle: state.currentArticle?.id === Number(articleId) ? null : state.currentArticle
  })),
  clearArticles: () => set({
    articles: [],
    currentArticle: null,
    pagination: {
      total: 0,
      page: 1,
      totalPages: 0,
      hasNext: false,
      hasPrev: false
    }
  })
}));