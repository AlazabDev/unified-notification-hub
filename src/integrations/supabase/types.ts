export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      notification_api_keys: {
        Row: {
          active: boolean
          created_at: string
          id: string
          key_hash: string
          last_used_at: string | null
          name: string
          scopes: string[]
          tenant_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          key_hash: string
          last_used_at?: string | null
          name: string
          scopes?: string[]
          tenant_id?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          key_hash?: string
          last_used_at?: string | null
          name?: string
          scopes?: string[]
          tenant_id?: string
        }
        Relationships: []
      }
      notification_delivery_attempts: {
        Row: {
          attempt_count: number
          channel: string
          created_at: string
          delivered_at: string | null
          id: string
          last_error: string | null
          notification_id: string
          provider: string | null
          scheduled_at: string | null
          status: string
        }
        Insert: {
          attempt_count?: number
          channel: string
          created_at?: string
          delivered_at?: string | null
          id?: string
          last_error?: string | null
          notification_id: string
          provider?: string | null
          scheduled_at?: string | null
          status?: string
        }
        Update: {
          attempt_count?: number
          channel?: string
          created_at?: string
          delivered_at?: string | null
          id?: string
          last_error?: string | null
          notification_id?: string
          provider?: string | null
          scheduled_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_delivery_attempts_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_events_log: {
        Row: {
          created_at: string
          dedupe_key: string | null
          error_code: string | null
          error_message: string | null
          event_type: string | null
          id: string
          ip_hash: string | null
          normalized_notification_id: string | null
          raw_payload: Json | null
          request_id: string | null
          source_id: string | null
          status: string
          status_code: number
          tenant_id: string
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          dedupe_key?: string | null
          error_code?: string | null
          error_message?: string | null
          event_type?: string | null
          id?: string
          ip_hash?: string | null
          normalized_notification_id?: string | null
          raw_payload?: Json | null
          request_id?: string | null
          source_id?: string | null
          status: string
          status_code: number
          tenant_id?: string
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          dedupe_key?: string | null
          error_code?: string | null
          error_message?: string | null
          event_type?: string | null
          id?: string
          ip_hash?: string | null
          normalized_notification_id?: string | null
          raw_payload?: Json | null
          request_id?: string | null
          source_id?: string | null
          status?: string
          status_code?: number
          tenant_id?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_events_log_normalized_notification_id_fkey"
            columns: ["normalized_notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_events_log_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "notification_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_jobs: {
        Row: {
          attempts: number
          created_at: string
          id: string
          job_type: string
          last_error: string | null
          max_attempts: number
          notification_id: string | null
          payload: Json | null
          run_at: string
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          id?: string
          job_type: string
          last_error?: string | null
          max_attempts?: number
          notification_id?: string | null
          payload?: Json | null
          run_at?: string
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          id?: string
          job_type?: string
          last_error?: string | null
          max_attempts?: number
          notification_id?: string | null
          payload?: Json | null
          run_at?: string
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_jobs_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          global: Json
          id: string
          recipient_user_id: string | null
          tenant_id: string
          updated_at: string
          workflows: Json
        }
        Insert: {
          global: Json
          id?: string
          recipient_user_id?: string | null
          tenant_id?: string
          updated_at?: string
          workflows?: Json
        }
        Update: {
          global?: Json
          id?: string
          recipient_user_id?: string | null
          tenant_id?: string
          updated_at?: string
          workflows?: Json
        }
        Relationships: []
      }
      notification_sources: {
        Row: {
          active: boolean
          bearer_token_hash: string | null
          created_at: string
          domain: string
          hmac_enabled: boolean
          hmac_secret_env_name: string | null
          id: string
          last_seen_at: string | null
          name: string
          rate_limit_per_minute: number
          source_key: string
          source_type: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          bearer_token_hash?: string | null
          created_at?: string
          domain: string
          hmac_enabled?: boolean
          hmac_secret_env_name?: string | null
          id?: string
          last_seen_at?: string | null
          name: string
          rate_limit_per_minute?: number
          source_key: string
          source_type?: string
          tenant_id?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          bearer_token_hash?: string | null
          created_at?: string
          domain?: string
          hmac_enabled?: boolean
          hmac_secret_env_name?: string | null
          id?: string
          last_seen_at?: string | null
          name?: string
          rate_limit_per_minute?: number
          source_key?: string
          source_type?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          actions: Json | null
          avatar_url: string | null
          body: string
          category: string
          channels: string[]
          created_at: string
          dedupe_key: string | null
          event_type: string | null
          id: string
          raw: Json | null
          read: boolean
          read_at: string | null
          recipient_user_id: string | null
          severity: string
          source: string
          source_id: string | null
          status: string
          subject: string | null
          tenant_id: string
          title: string
          updated_at: string
        }
        Insert: {
          actions?: Json | null
          avatar_url?: string | null
          body: string
          category: string
          channels?: string[]
          created_at?: string
          dedupe_key?: string | null
          event_type?: string | null
          id?: string
          raw?: Json | null
          read?: boolean
          read_at?: string | null
          recipient_user_id?: string | null
          severity?: string
          source: string
          source_id?: string | null
          status?: string
          subject?: string | null
          tenant_id?: string
          title: string
          updated_at?: string
        }
        Update: {
          actions?: Json | null
          avatar_url?: string | null
          body?: string
          category?: string
          channels?: string[]
          created_at?: string
          dedupe_key?: string | null
          event_type?: string | null
          id?: string
          raw?: Json | null
          read?: boolean
          read_at?: string | null
          recipient_user_id?: string | null
          severity?: string
          source?: string
          source_id?: string | null
          status?: string
          subject?: string | null
          tenant_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "notification_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      supcloud_keepalive: {
        Row: {
          id: number
          marker: string
        }
        Insert: {
          id: number
          marker?: string
        }
        Update: {
          id?: number
          marker?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          tenant_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          tenant_id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          tenant_id?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      app_role: "admin" | "operator" | "viewer"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "operator", "viewer"],
    },
  },
} as const
