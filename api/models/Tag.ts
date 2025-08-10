export interface Tag {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  updated_at: string;
}

export interface CreateTagData {
  name: string;
}

export interface UpdateTagData {
  name?: string;
}

export interface TagWithStats extends Tag {
  article_count: number;
}