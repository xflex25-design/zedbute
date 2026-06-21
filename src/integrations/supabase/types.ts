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
      artist_verifications: {
        Row: {
          additional_notes: string | null
          admin_notes: string | null
          artist_name: string
          bio: string | null
          created_at: string
          deposit_amount: number | null
          distributor_default: string | null
          distributor_name: string | null
          facebook_url: string | null
          id: string
          instagram_url: string | null
          legal_name: string | null
          payment_phone_number: string | null
          payment_status: string | null
          payment_transaction_id: string | null
          platform: string | null
          platform_email: string | null
          platform_user_id: string | null
          review_date: string | null
          screenshot_url: string | null
          soundcloud_url: string | null
          spotify_url: string | null
          status: string | null
          submission_date: string
          tiktok_url: string | null
          topic_channel_url: string | null
          twitter_url: string | null
          updated_at: string
          user_id: string
          website_url: string | null
          youtube_url: string | null
        }
        Insert: {
          additional_notes?: string | null
          admin_notes?: string | null
          artist_name: string
          bio?: string | null
          created_at?: string
          deposit_amount?: number | null
          distributor_default?: string | null
          distributor_name?: string | null
          facebook_url?: string | null
          id?: string
          instagram_url?: string | null
          legal_name?: string | null
          payment_phone_number?: string | null
          payment_status?: string | null
          payment_transaction_id?: string | null
          platform?: string | null
          platform_email?: string | null
          platform_user_id?: string | null
          review_date?: string | null
          screenshot_url?: string | null
          soundcloud_url?: string | null
          spotify_url?: string | null
          status?: string | null
          submission_date?: string
          tiktok_url?: string | null
          topic_channel_url?: string | null
          twitter_url?: string | null
          updated_at?: string
          user_id: string
          website_url?: string | null
          youtube_url?: string | null
        }
        Update: {
          additional_notes?: string | null
          admin_notes?: string | null
          artist_name?: string
          bio?: string | null
          created_at?: string
          deposit_amount?: number | null
          distributor_default?: string | null
          distributor_name?: string | null
          facebook_url?: string | null
          id?: string
          instagram_url?: string | null
          legal_name?: string | null
          payment_phone_number?: string | null
          payment_status?: string | null
          payment_transaction_id?: string | null
          platform?: string | null
          platform_email?: string | null
          platform_user_id?: string | null
          review_date?: string | null
          screenshot_url?: string | null
          soundcloud_url?: string | null
          spotify_url?: string | null
          status?: string | null
          submission_date?: string
          tiktok_url?: string | null
          topic_channel_url?: string | null
          twitter_url?: string | null
          updated_at?: string
          user_id?: string
          website_url?: string | null
          youtube_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "artist_verifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      music_releases: {
        Row: {
          artist_name: string
          audio_url: string | null
          completion_email_sent_at: string | null
          cover_art_url: string | null
          created_at: string
          distribution_platforms: Json | null
          genre: string | null
          id: string
          language: string[] | null
          release_date: string | null
          release_type: string | null
          rights_confirmed: boolean | null
          status: string | null
          title: string
          updated_at: string
          upload_progress: number | null
          user_id: string
        }
        Insert: {
          artist_name: string
          audio_url?: string | null
          completion_email_sent_at?: string | null
          cover_art_url?: string | null
          created_at?: string
          distribution_platforms?: Json | null
          genre?: string | null
          id?: string
          language?: string[] | null
          release_date?: string | null
          release_type?: string | null
          rights_confirmed?: boolean | null
          status?: string | null
          title: string
          updated_at?: string
          upload_progress?: number | null
          user_id: string
        }
        Update: {
          artist_name?: string
          audio_url?: string | null
          completion_email_sent_at?: string | null
          cover_art_url?: string | null
          created_at?: string
          distribution_platforms?: Json | null
          genre?: string | null
          id?: string
          language?: string[] | null
          release_date?: string | null
          release_type?: string | null
          rights_confirmed?: boolean | null
          status?: string | null
          title?: string
          updated_at?: string
          upload_progress?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "music_releases_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          artist_name: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          phone_number: string | null
          updated_at: string
        }
        Insert: {
          artist_name?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          phone_number?: string | null
          updated_at?: string
        }
        Update: {
          artist_name?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          phone_number?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      release_payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          payment_date: string
          payment_method: string
          phone_number: string
          status: string
          transaction_id: string
          updated_at: string
          user_id: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          payment_date?: string
          payment_method: string
          phone_number: string
          status?: string
          transaction_id: string
          updated_at?: string
          user_id: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          payment_date?: string
          payment_method?: string
          phone_number?: string
          status?: string
          transaction_id?: string
          updated_at?: string
          user_id?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: []
      }
      royalty_records: {
        Row: {
          created_at: string
          date_earned: string
          id: string
          amount: number
          song_id: string
          source: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          date_earned?: string
          id?: string
          song_id: string
          source?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          date_earned?: string
          id?: string
          song_id?: string
          source?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "royalty_records_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "royalty_records_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "songs"
            referencedColumns: ["id"]
          },
        ]
      }
      songs: {
        Row: {
          artist_id: string
          created_at: string
          genre: string | null
          id: string
          isrc: string | null
          metadata: Json | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          artist_id: string
          created_at?: string
          genre?: string | null
          id?: string
          isrc?: string | null
          metadata?: Json | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          artist_id?: string
          created_at?: string
          genre?: string | null
          id?: string
          isrc?: string | null
          metadata?: Json | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "songs_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
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
          role: Database["public"]["Enums"]["app_role"]
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
      withdrawal_requests: {
        Row: {
          admin_notes: string | null
          amount: number
          bank_account_number: string
          bank_code: string
          bank_name: string
          created_at: string
          id: string
          processed_at: string | null
          requested_at: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          amount: number
          bank_account_number: string
          bank_code: string
          bank_name: string
          created_at?: string
          id?: string
          processed_at?: string | null
          requested_at?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          amount?: number
          bank_account_number?: string
          bank_code?: string
          bank_name?: string
          created_at?: string
          id?: string
          processed_at?: string | null
          requested_at?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "withdrawal_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_stats: {
        Row: {
          created_at: string
          estimated_royalties: number
          listeners_change_pct: number
          monthly_listeners: number
          monthly_streams: number
          royalties_change_pct: number
          streams_change_pct: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          estimated_royalties?: number
          listeners_change_pct?: number
          monthly_listeners?: number
          monthly_streams?: number
          royalties_change_pct?: number
          streams_change_pct?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          estimated_royalties?: number
          listeners_change_pct?: number
          monthly_listeners?: number
          monthly_streams?: number
          royalties_change_pct?: number
          streams_change_pct?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
      app_role: "admin" | "moderator" | "user"
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
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
