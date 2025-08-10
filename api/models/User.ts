export interface User {
  id: string;
  email: string;
  password_hash: string;
  salt?: string;
  name: string;
  avatar_url?: string;
  bio?: string;
  role: 'admin' | 'author' | 'reader';
  password_updated_at?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateUserData {
  email: string;
  password: string;
  name: string;
  role?: 'admin' | 'author' | 'reader';
}

export interface LoginData {
  email: string;
  password: string;
}

export interface UserResponse {
  id: string;
  email: string;
  name: string;
  avatar_url?: string;
  bio?: string;
  role: string;
  created_at: string;
}