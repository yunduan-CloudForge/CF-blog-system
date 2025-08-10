export interface Comment {
  id: string;
  article_id: string;
  user_id: string;
  parent_id?: string;
  content: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  updated_at: string;
}

export interface CommentWithUser extends Comment {
  user_name: string;
  user_email: string;
  replies?: CommentWithUser[];
}

export interface CreateCommentData {
  article_id: string;
  content: string;
  parent_id?: string;
}

export interface UpdateCommentData {
  content?: string;
  status?: 'pending' | 'approved' | 'rejected';
}

export interface CommentListQuery {
  page?: number;
  limit?: number;
  article_id?: string;
  user_id?: string;
  status?: 'pending' | 'approved' | 'rejected';
  parent_id?: string;
}

export interface CommentListResponse {
  comments: CommentWithUser[];
  total: number;
  page: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}