import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          full_name: string;
          role: 'user' | 'admin' | 'super_admin';
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
      };
      documents: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          file_path: string;
          file_size: number;
          file_type: string;
          folder_id: string | null;
          category: string;
          tags: string[];
          uploaded_by: string | null;
          created_at: string;
          updated_at: string;
        };
      };
      folders: {
        Row: {
          id: string;
          name: string;
          parent_id: string | null;
          category: string;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
      };
      messages: {
        Row: {
          id: string;
          conversation_id: string;
          sender_id: string | null;
          content: string;
          is_read: boolean;
          created_at: string;
        };
      };
      access_requests: {
        Row: {
          id: string;
          document_id: string;
          requested_by: string;
          status: 'pending' | 'approved' | 'rejected';
          reviewed_by: string | null;
          created_at: string;
          reviewed_at: string | null;
        };
      };
      activity_logs: {
        Row: {
          id: string;
          user_id: string | null;
          activity_type: string;
          description: string;
          metadata: any;
          created_at: string;
        };
      };
    };
  };
};
