export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  color: string;
  created_at: string;
  updated_at: string;
}

export interface CreateCategoryData {
  name: string;
  description?: string;
  color: string;
}

export interface UpdateCategoryData {
  name?: string;
  description?: string;
  color?: string;
}

export interface CategoryWithStats extends Category {
  article_count: number;
}