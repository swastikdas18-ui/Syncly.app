export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      tenants: {
        Row: {
          id: string;
          name: string;
          slug: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          tenant_id: string;
          full_name: string;
          avatar_url: string | null;
          role: string;
          status: string;
          created_at: string;
        };
        Insert: {
          id: string;
          tenant_id: string;
          full_name: string;
          avatar_url?: string | null;
          role?: string;
          status?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          full_name?: string;
          avatar_url?: string | null;
          role?: string;
          status?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "fk_profiles_auth_users";
            columns: ["id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "profiles_tenant_id_fkey";
            columns: ["tenant_id"];
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          }
        ];
      };
      channels: {
        Row: {
          id: string;
          tenant_id: string;
          name: string;
          description: string | null;
          is_private: boolean;
          created_at: string;
        };
        Insert: {
          id: string;
          tenant_id: string;
          name: string;
          description?: string | null;
          is_private?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          name?: string;
          description?: string | null;
          is_private?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "channels_tenant_id_fkey";
            columns: ["tenant_id"];
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          }
        ];
      };
      messages: {
        Row: {
          id: string;
          tenant_id: string;
          channel_id: string;
          user_id: string;
          content: string;
          media_urls: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          channel_id: string;
          user_id: string;
          content: string;
          media_urls?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          channel_id?: string;
          user_id?: string;
          content?: string;
          media_urls?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "fk_messages_channel";
            columns: ["tenant_id", "channel_id"];
            referencedRelation: "channels";
            referencedColumns: ["tenant_id", "id"];
          },
          {
            foreignKeyName: "messages_tenant_id_fkey";
            columns: ["tenant_id"];
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "messages_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      posts: {
        Row: {
          id: string;
          tenant_id: string;
          author_id: string;
          title: string | null;
          content: string;
          category: string;
          media_urls: string;
          likes_count: number;
          comments_count: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          author_id: string;
          title?: string | null;
          content: string;
          category?: string;
          media_urls?: string;
          likes_count?: number;
          comments_count?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          author_id?: string;
          title?: string | null;
          content?: string;
          category?: string;
          media_urls?: string;
          likes_count?: number;
          comments_count?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "posts_author_id_fkey";
            columns: ["author_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "posts_tenant_id_fkey";
            columns: ["tenant_id"];
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          }
        ];
      };
      post_comments: {
        Row: {
          id: string;
          tenant_id: string;
          post_id: string;
          author_id: string;
          content: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          post_id: string;
          author_id: string;
          content: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          post_id?: string;
          author_id?: string;
          content?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "post_comments_author_id_fkey";
            columns: ["author_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "post_comments_post_id_fkey";
            columns: ["post_id"];
            referencedRelation: "posts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "post_comments_tenant_id_fkey";
            columns: ["tenant_id"];
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          }
        ];
      };
    };
    Views: {
      users: {
        Row: {
          id: string;
          tenant_id: string;
          full_name: string;
          avatar_url: string | null;
          role: string;
          status: string;
          created_at: string;
        };
      };
    };
    Functions: {
      get_current_tenant_id: {
        Args: Record<PropertyKey, never>;
        Returns: string | null;
      };
    };
  };
}

// Convenient Entity Row Types
export type TenantRow = Database['public']['Tables']['tenants']['Row'];
export type ProfileRow = Database['public']['Tables']['profiles']['Row'];
export type ChannelRow = Database['public']['Tables']['channels']['Row'];
export type MessageRow = Database['public']['Tables']['messages']['Row'];
export type PostRow = Database['public']['Tables']['posts']['Row'];
export type PostCommentRow = Database['public']['Tables']['post_comments']['Row'];
export type UserViewRow = Database['public']['Views']['users']['Row'];
