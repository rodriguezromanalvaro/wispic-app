// lib/types.ts - Tipos compartidos de la aplicación

export type ProfilePromptTemplate = {
  id: number;
  key?: string;
  question: string;
  active: boolean;
  display_order?: number;
  max_len?: number | null;
  created_at?: string;
};

export type ProfilePrompt = {
  id: number;
  profile_id: string;
  prompt_id: number;
  response: string;
  created_at?: string;
  updated_at?: string;
  // Campo virtual - se llena al hacer join
  question?: string;
};

export type Profile = {
  id: string;
  display_name: string | null;
  bio: string | null;
  age: number | null;
  gender: 'male' | 'female' | 'other' | null;
  interests: string[] | null;
  is_premium?: boolean | null;
  birthdate?: string | null;  // Para compatibilidad con useAuth
  verified_at?: string | null;
  avatar_url?: string | null;  // URL de la foto de perfil
  city?: string | null;  // Ciudad del usuario
  // Campos virtuales para el estado de completitud
  prompts?: ProfilePrompt[];
  photos_count?: number;
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

// Constant for required profile fields
export const REQUIRED_PROFILE_FIELDS = [
  'display_name',
  'bio',
  'birthdate',
  'gender',
];

// Minimum number of prompts for a complete profile
export const MIN_PROMPTS = 3;

// Minimum number of photos for a complete profile
export const MIN_PHOTOS = 1;

// Re-export commonly used types
export type { FilterState as UserDefaultFilters };
export type { Profile as ProfileRow }; // For backward compatibility