// lib/types.ts - Tipos compartidos de la aplicación

export type Profile = {
  id: string;
  display_name: string | null;
  bio: string | null;
  age: number | null;
  gender: 'male' | 'female' | 'other' | null;
  interests: string[] | null;
  is_premium?: boolean | null;
  birthdate?: string | null;  // Para compatibilidad con useAuth
};

export type FilterState = {
  minAge: string;
  maxAge: string;
  gender: 'any' | 'male' | 'female' | 'other';
  interest: string;
};

export type Status = 'match' | 'superlike' | 'like' | 'pass' | 'new';

export type ActionItem = {
  targetId: string;
  type: Status;
  likeRowId?: number | null;
};