export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          password_hash: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          password_hash: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          password_hash?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      sessions: {
        Row: {
          id: string;
          user_id: string;
          refresh_token: string | null;
        };
        Insert: { id?: string; user_id: string; refresh_token?: string | null };
        Update: { id?: string; user_id?: string; refresh_token?: string | null };
        Relationships: [];
      };
    };
    Views: {
      active_users: {
        Row: {
          id: string;
          email: string;
        };
      };
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      role: "admin" | "user";
    };
  };
};
