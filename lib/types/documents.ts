export interface Folder {
  id: string;
  name: string;
  parent_id: string | null;
  category: string;
  folder_number: string | null;
  status: string;
  created_at: string;
  created_by: string;
  description?: string | null;
  isOpen?: boolean;
  children?: Folder[];
  documents?: Document[];
}

export interface Document {
  id: string;
  name: string;
  description: string | null;
  file_path: string;
  file_size: number;
  file_type: string;
  folder_id: string | null;
  category: string;
  created_at: string;
  uploaded_by: string;
}

export interface UserPreferences {
  id: string;
  user_id: string;
  display_mode: 'very_large' | 'large' | 'medium';
  created_at: string;
  updated_at: string;
}

export type DisplayMode = 'very_large' | 'large' | 'medium';

export const DISPLAY_MODES = {
  very_large: { size: 80, label: 'Très grandes icônes', icon: '🔲' },
  large: { size: 60, label: 'Grandes icônes', icon: '🟦' },
  medium: { size: 40, label: 'Icônes moyennes', icon: '🟩' }
} as const;

export const STATUS_COLORS = {
  Archive: { bg: 'bg-red-100', text: 'text-red-800', dot: '🔴' },
  'En cours': { bg: 'bg-yellow-100', text: 'text-yellow-800', dot: '🟡' },
  Nouveau: { bg: 'bg-green-100', text: 'text-green-800', dot: '🟢' }
} as const;

export const categoryColors: Record<string, string> = {
  Administrative: 'bg-yellow-100 text-yellow-800',
  Technique: 'bg-blue-100 text-blue-800',
  'Financière': 'bg-green-100 text-green-800',
  'Légale': 'bg-purple-100 text-purple-800',
  Projet: 'bg-orange-100 text-orange-800',
  Formation: 'bg-pink-100 text-pink-800',
  Communication: 'bg-teal-100 text-teal-800',
  Archive: 'bg-red-100 text-red-800',
};
