export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      athlete_goals: {
        Row: {
          athlete_id: string
          created_at: string
          ended_at: string | null
          goal_type: string
          id: string
          notes: string | null
          started_at: string
          status: string
          target_weight_kg: number | null
          updated_at: string
        }
        Insert: {
          athlete_id: string
          created_at?: string
          ended_at?: string | null
          goal_type: string
          id?: string
          notes?: string | null
          started_at?: string
          status?: string
          target_weight_kg?: number | null
          updated_at?: string
        }
        Update: {
          athlete_id?: string
          created_at?: string
          ended_at?: string | null
          goal_type?: string
          id?: string
          notes?: string | null
          started_at?: string
          status?: string
          target_weight_kg?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "athlete_goals_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athletes"
            referencedColumns: ["id"]
          },
        ]
      }
      athlete_profiles: {
        Row: {
          athlete_id: string
          birth_date: string
          created_at: string
          height_cm: number
          preferred_name: string
          timezone: string
          updated_at: string
        }
        Insert: {
          athlete_id: string
          birth_date: string
          created_at?: string
          height_cm: number
          preferred_name: string
          timezone: string
          updated_at?: string
        }
        Update: {
          athlete_id?: string
          birth_date?: string
          created_at?: string
          height_cm?: number
          preferred_name?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "athlete_profiles_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: true
            referencedRelation: "athletes"
            referencedColumns: ["id"]
          },
        ]
      }
      athlete_training_availability: {
        Row: {
          athlete_id: string
          created_at: string
          weekday: number
        }
        Insert: {
          athlete_id: string
          created_at?: string
          weekday: number
        }
        Update: {
          athlete_id?: string
          created_at?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "athlete_training_availability_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athletes"
            referencedColumns: ["id"]
          },
        ]
      }
      athlete_training_contexts: {
        Row: {
          athlete_id: string
          average_sleep_minutes: number | null
          constraints_notes: string | null
          created_at: string
          preferences_notes: string | null
          preferred_session_duration_minutes: number
          recent_training_consistency: string
          resistance_training_months: number
          routine_summary: string
          training_environment: string
          updated_at: string
        }
        Insert: {
          athlete_id: string
          average_sleep_minutes?: number | null
          constraints_notes?: string | null
          created_at?: string
          preferences_notes?: string | null
          preferred_session_duration_minutes: number
          recent_training_consistency: string
          resistance_training_months: number
          routine_summary: string
          training_environment: string
          updated_at?: string
        }
        Update: {
          athlete_id?: string
          average_sleep_minutes?: number | null
          constraints_notes?: string | null
          created_at?: string
          preferences_notes?: string | null
          preferred_session_duration_minutes?: number
          recent_training_consistency?: string
          resistance_training_months?: number
          routine_summary?: string
          training_environment?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "athlete_training_contexts_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: true
            referencedRelation: "athletes"
            referencedColumns: ["id"]
          },
        ]
      }
      athletes: {
        Row: {
          created_at: string
          id: string
          onboarding_completed_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          onboarding_completed_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          onboarding_completed_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      body_weight_entries: {
        Row: {
          athlete_id: string
          created_at: string
          id: string
          measured_at: string
          source: string
          weight_kg: number
        }
        Insert: {
          athlete_id: string
          created_at?: string
          id?: string
          measured_at: string
          source?: string
          weight_kg: number
        }
        Update: {
          athlete_id?: string
          created_at?: string
          id?: string
          measured_at?: string
          source?: string
          weight_kg?: number
        }
        Relationships: [
          {
            foreignKeyName: "body_weight_entries_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athletes"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      change_current_athlete_goal: {
        Args: {
          p_goal_type: string
          p_notes?: string
          p_target_weight_kg?: number
        }
        Returns: {
          athlete_id: string
          created_at: string
          ended_at: string | null
          goal_type: string
          id: string
          notes: string | null
          started_at: string
          status: string
          target_weight_kg: number | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "athlete_goals"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      complete_athlete_onboarding: {
        Args: {
          p_available_weekdays: number[]
          p_average_sleep_minutes?: number
          p_birth_date: string
          p_constraints_notes?: string
          p_goal_notes?: string
          p_goal_type: string
          p_height_cm: number
          p_preferences_notes?: string
          p_preferred_name: string
          p_preferred_session_duration_minutes: number
          p_recent_training_consistency: string
          p_resistance_training_months: number
          p_routine_summary: string
          p_target_weight_kg?: number
          p_timezone: string
          p_training_environment: string
          p_weight_kg: number
          p_weight_measured_at: string
        }
        Returns: {
          created_at: string
          id: string
          onboarding_completed_at: string | null
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "athletes"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      current_athlete_id: { Args: never; Returns: string }
      ensure_current_athlete: {
        Args: never
        Returns: {
          created_at: string
          id: string
          onboarding_completed_at: string | null
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "athletes"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_current_training_availability: {
        Args: { p_available_weekdays: number[] }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
