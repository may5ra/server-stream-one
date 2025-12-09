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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      activity_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          id: string
          ip_address: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      epg_channels: {
        Row: {
          created_at: string
          epg_channel_id: string
          icon_url: string | null
          id: string
          name: string
          stream_id: string | null
        }
        Insert: {
          created_at?: string
          epg_channel_id: string
          icon_url?: string | null
          id?: string
          name: string
          stream_id?: string | null
        }
        Update: {
          created_at?: string
          epg_channel_id?: string
          icon_url?: string | null
          id?: string
          name?: string
          stream_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "epg_channels_stream_id_fkey"
            columns: ["stream_id"]
            isOneToOne: false
            referencedRelation: "streams"
            referencedColumns: ["id"]
          },
        ]
      }
      epg_programs: {
        Row: {
          channel_id: string
          created_at: string
          description: string | null
          end_time: string
          id: string
          start_time: string
          title: string
        }
        Insert: {
          channel_id: string
          created_at?: string
          description?: string | null
          end_time: string
          id?: string
          start_time: string
          title: string
        }
        Update: {
          channel_id?: string
          created_at?: string
          description?: string | null
          end_time?: string
          id?: string
          start_time?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "epg_programs_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "epg_channels"
            referencedColumns: ["id"]
          },
        ]
      }
      epg_sources: {
        Row: {
          created_at: string
          id: string
          last_import: string | null
          name: string
          status: string | null
          url: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_import?: string | null
          name: string
          status?: string | null
          url: string
        }
        Update: {
          created_at?: string
          id?: string
          last_import?: string | null
          name?: string
          status?: string | null
          url?: string
        }
        Relationships: []
      }
      live_categories: {
        Row: {
          created_at: string
          id: string
          name: string
          sort_order: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          sort_order?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          sort_order?: number | null
        }
        Relationships: []
      }
      load_balancers: {
        Row: {
          created_at: string
          current_streams: number | null
          id: string
          ip_address: string
          max_streams: number | null
          name: string
          port: number | null
          server_id: string | null
          status: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_streams?: number | null
          id?: string
          ip_address: string
          max_streams?: number | null
          name: string
          port?: number | null
          server_id?: string | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_streams?: number | null
          id?: string
          ip_address?: string
          max_streams?: number | null
          name?: string
          port?: number | null
          server_id?: string | null
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "load_balancers_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "servers"
            referencedColumns: ["id"]
          },
        ]
      }
      panel_settings: {
        Row: {
          created_at: string
          id: string
          key: string
          updated_at: string
          value: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          updated_at?: string
          value?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          updated_at?: string
          value?: string | null
        }
        Relationships: []
      }
      reseller_credits: {
        Row: {
          amount: number
          created_at: string
          id: string
          notes: string | null
          reseller_id: string
          type: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          notes?: string | null
          reseller_id: string
          type: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          notes?: string | null
          reseller_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "reseller_credits_reseller_id_fkey"
            columns: ["reseller_id"]
            isOneToOne: false
            referencedRelation: "resellers"
            referencedColumns: ["id"]
          },
        ]
      }
      resellers: {
        Row: {
          created_at: string
          credits: number | null
          id: string
          max_connections: number | null
          notes: string | null
          password: string
          status: string | null
          user_id: string
          username: string
        }
        Insert: {
          created_at?: string
          credits?: number | null
          id?: string
          max_connections?: number | null
          notes?: string | null
          password: string
          status?: string | null
          user_id: string
          username: string
        }
        Update: {
          created_at?: string
          credits?: number | null
          id?: string
          max_connections?: number | null
          notes?: string | null
          password?: string
          status?: string | null
          user_id?: string
          username?: string
        }
        Relationships: []
      }
      series: {
        Row: {
          cast_names: string | null
          category_id: string | null
          cover_url: string | null
          created_at: string
          director: string | null
          genre: string | null
          id: string
          name: string
          plot: string | null
          rating: number | null
          release_date: string | null
          status: string | null
          tmdb_id: number | null
        }
        Insert: {
          cast_names?: string | null
          category_id?: string | null
          cover_url?: string | null
          created_at?: string
          director?: string | null
          genre?: string | null
          id?: string
          name: string
          plot?: string | null
          rating?: number | null
          release_date?: string | null
          status?: string | null
          tmdb_id?: number | null
        }
        Update: {
          cast_names?: string | null
          category_id?: string | null
          cover_url?: string | null
          created_at?: string
          director?: string | null
          genre?: string | null
          id?: string
          name?: string
          plot?: string | null
          rating?: number | null
          release_date?: string | null
          status?: string | null
          tmdb_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "series_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "series_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      series_categories: {
        Row: {
          created_at: string
          id: string
          name: string
          sort_order: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          sort_order?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          sort_order?: number | null
        }
        Relationships: []
      }
      series_episodes: {
        Row: {
          container_extension: string | null
          cover_url: string | null
          created_at: string
          duration: number | null
          episode_number: number
          id: string
          plot: string | null
          season_number: number
          series_id: string
          stream_url: string
          title: string | null
        }
        Insert: {
          container_extension?: string | null
          cover_url?: string | null
          created_at?: string
          duration?: number | null
          episode_number: number
          id?: string
          plot?: string | null
          season_number?: number
          series_id: string
          stream_url: string
          title?: string | null
        }
        Update: {
          container_extension?: string | null
          cover_url?: string | null
          created_at?: string
          duration?: number | null
          episode_number?: number
          id?: string
          plot?: string | null
          season_number?: number
          series_id?: string
          stream_url?: string
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "series_episodes_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "series"
            referencedColumns: ["id"]
          },
        ]
      }
      servers: {
        Row: {
          cpu_usage: number | null
          created_at: string
          disk_usage: number | null
          id: string
          ip_address: string
          location: string | null
          memory_usage: number | null
          name: string
          network_usage: number | null
          os: string | null
          status: string
          updated_at: string
          uptime: string | null
        }
        Insert: {
          cpu_usage?: number | null
          created_at?: string
          disk_usage?: number | null
          id?: string
          ip_address: string
          location?: string | null
          memory_usage?: number | null
          name: string
          network_usage?: number | null
          os?: string | null
          status?: string
          updated_at?: string
          uptime?: string | null
        }
        Update: {
          cpu_usage?: number | null
          created_at?: string
          disk_usage?: number | null
          id?: string
          ip_address?: string
          location?: string | null
          memory_usage?: number | null
          name?: string
          network_usage?: number | null
          os?: string | null
          status?: string
          updated_at?: string
          uptime?: string | null
        }
        Relationships: []
      }
      streaming_users: {
        Row: {
          bouquets: string[] | null
          connections: number | null
          created_at: string
          expiry_date: string
          id: string
          last_active: string | null
          max_connections: number | null
          password: string
          reseller_id: string | null
          status: string
          updated_at: string
          username: string
        }
        Insert: {
          bouquets?: string[] | null
          connections?: number | null
          created_at?: string
          expiry_date: string
          id?: string
          last_active?: string | null
          max_connections?: number | null
          password: string
          reseller_id?: string | null
          status?: string
          updated_at?: string
          username: string
        }
        Update: {
          bouquets?: string[] | null
          connections?: number | null
          created_at?: string
          expiry_date?: string
          id?: string
          last_active?: string | null
          max_connections?: number | null
          password?: string
          reseller_id?: string | null
          status?: string
          updated_at?: string
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "streaming_users_reseller_id_fkey"
            columns: ["reseller_id"]
            isOneToOne: false
            referencedRelation: "resellers"
            referencedColumns: ["id"]
          },
        ]
      }
      streams: {
        Row: {
          abr_enabled: boolean | null
          bitrate: number | null
          bouquet: string | null
          category: string | null
          channel_number: number | null
          created_at: string
          dvr_duration: number | null
          dvr_enabled: boolean | null
          epg_channel_id: string | null
          id: string
          input_type: string
          input_url: string
          load_balancer_id: string | null
          name: string
          online_since: string | null
          output_formats: string[] | null
          proxy_mode: string | null
          resolution: string | null
          status: string
          stream_icon: string | null
          updated_at: string
          viewers: number | null
          webvtt_enabled: boolean | null
          webvtt_label: string | null
          webvtt_language: string | null
          webvtt_url: string | null
        }
        Insert: {
          abr_enabled?: boolean | null
          bitrate?: number | null
          bouquet?: string | null
          category?: string | null
          channel_number?: number | null
          created_at?: string
          dvr_duration?: number | null
          dvr_enabled?: boolean | null
          epg_channel_id?: string | null
          id?: string
          input_type?: string
          input_url: string
          load_balancer_id?: string | null
          name: string
          online_since?: string | null
          output_formats?: string[] | null
          proxy_mode?: string | null
          resolution?: string | null
          status?: string
          stream_icon?: string | null
          updated_at?: string
          viewers?: number | null
          webvtt_enabled?: boolean | null
          webvtt_label?: string | null
          webvtt_language?: string | null
          webvtt_url?: string | null
        }
        Update: {
          abr_enabled?: boolean | null
          bitrate?: number | null
          bouquet?: string | null
          category?: string | null
          channel_number?: number | null
          created_at?: string
          dvr_duration?: number | null
          dvr_enabled?: boolean | null
          epg_channel_id?: string | null
          id?: string
          input_type?: string
          input_url?: string
          load_balancer_id?: string | null
          name?: string
          online_since?: string | null
          output_formats?: string[] | null
          proxy_mode?: string | null
          resolution?: string | null
          status?: string
          stream_icon?: string | null
          updated_at?: string
          viewers?: number | null
          webvtt_enabled?: boolean | null
          webvtt_label?: string | null
          webvtt_language?: string | null
          webvtt_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "streams_load_balancer_id_fkey"
            columns: ["load_balancer_id"]
            isOneToOne: false
            referencedRelation: "load_balancers"
            referencedColumns: ["id"]
          },
        ]
      }
      system_updates: {
        Row: {
          applied_at: string | null
          changelog: string | null
          created_at: string
          id: string
          is_available: boolean | null
          released_at: string | null
          version: string
        }
        Insert: {
          applied_at?: string | null
          changelog?: string | null
          created_at?: string
          id?: string
          is_available?: boolean | null
          released_at?: string | null
          version: string
        }
        Update: {
          applied_at?: string | null
          changelog?: string | null
          created_at?: string
          id?: string
          is_available?: boolean | null
          released_at?: string | null
          version?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vod_categories: {
        Row: {
          created_at: string
          id: string
          name: string
          sort_order: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          sort_order?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          sort_order?: number | null
        }
        Relationships: []
      }
      vod_content: {
        Row: {
          added: string | null
          cast_names: string | null
          category_id: string | null
          container_extension: string | null
          cover_url: string | null
          created_at: string
          director: string | null
          duration: number | null
          genre: string | null
          id: string
          name: string
          plot: string | null
          rating: number | null
          release_date: string | null
          status: string | null
          stream_url: string
          tmdb_id: number | null
        }
        Insert: {
          added?: string | null
          cast_names?: string | null
          category_id?: string | null
          container_extension?: string | null
          cover_url?: string | null
          created_at?: string
          director?: string | null
          duration?: number | null
          genre?: string | null
          id?: string
          name: string
          plot?: string | null
          rating?: number | null
          release_date?: string | null
          status?: string | null
          stream_url: string
          tmdb_id?: number | null
        }
        Update: {
          added?: string | null
          cast_names?: string | null
          category_id?: string | null
          container_extension?: string | null
          cover_url?: string | null
          created_at?: string
          director?: string | null
          duration?: number | null
          genre?: string | null
          id?: string
          name?: string
          plot?: string | null
          rating?: number | null
          release_date?: string | null
          status?: string | null
          stream_url?: string
          tmdb_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vod_content_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "vod_categories"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
