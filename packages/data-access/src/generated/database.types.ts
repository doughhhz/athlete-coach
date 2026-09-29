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
      athlete_coach_preferences: {
        Row: {
          athlete_id: string
          autonomy_mode: string
          created_at: string
          draft_authority_mode: string
          updated_at: string
        }
        Insert: {
          athlete_id: string
          autonomy_mode?: string
          created_at?: string
          draft_authority_mode?: string
          updated_at?: string
        }
        Update: {
          athlete_id?: string
          autonomy_mode?: string
          created_at?: string
          draft_authority_mode?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "athlete_coach_preferences_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: true
            referencedRelation: "athletes"
            referencedColumns: ["id"]
          },
        ]
      }
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
      body_regions: {
        Row: {
          id: string
          name_en: string
          name_pt: string
          slug: string
        }
        Insert: {
          id: string
          name_en: string
          name_pt: string
          slug: string
        }
        Update: {
          id?: string
          name_en?: string
          name_pt?: string
          slug?: string
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
      coach_analysis_runs: {
        Row: {
          analysis_request_id: string
          analysis_schema_version: string
          analysis_snapshot: Json
          athlete_id: string
          created_at: string
          dossier_schema_version: string
          id: string
          model_identifier: string
          prompt_version: string
          provider: string
          request_fingerprint: string | null
          safety_policy_version: string
          source_program_id: string | null
          source_program_revision: number | null
          training_advice_blocked: boolean
        }
        Insert: {
          analysis_request_id: string
          analysis_schema_version: string
          analysis_snapshot: Json
          athlete_id: string
          created_at?: string
          dossier_schema_version: string
          id?: string
          model_identifier: string
          prompt_version: string
          provider: string
          request_fingerprint?: string | null
          safety_policy_version: string
          source_program_id?: string | null
          source_program_revision?: number | null
          training_advice_blocked: boolean
        }
        Update: {
          analysis_request_id?: string
          analysis_schema_version?: string
          analysis_snapshot?: Json
          athlete_id?: string
          created_at?: string
          dossier_schema_version?: string
          id?: string
          model_identifier?: string
          prompt_version?: string
          provider?: string
          request_fingerprint?: string | null
          safety_policy_version?: string
          source_program_id?: string | null
          source_program_revision?: number | null
          training_advice_blocked?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "coach_analysis_runs_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athletes"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_decisions: {
        Row: {
          analysis_request_id: string | null
          approved_at: string | null
          athlete_id: string
          auto_draft_eligibility: string | null
          auto_draft_policy_version: string | null
          auto_draft_reasons: Json
          autonomy_mode_at_creation: string | null
          created_at: string
          dossier_schema_version: string
          governance_policy_version: string | null
          governance_reasons: Json
          id: string
          materialization_origin: string | null
          materialized_at: string | null
          materialized_program_id: string | null
          model_identifier: string
          prompt_version: string
          proposal_origin: string
          proposal_schema_version: string
          proposal_snapshot: Json
          proposed_at: string
          provider: string
          rejected_at: string | null
          rejection_notes: string | null
          rejection_reason: string | null
          review_class: string | null
          safety_policy_version: string
          source_analysis_id: string
          source_program_id: string
          source_program_revision: number
          stale_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          analysis_request_id?: string | null
          approved_at?: string | null
          athlete_id: string
          auto_draft_eligibility?: string | null
          auto_draft_policy_version?: string | null
          auto_draft_reasons?: Json
          autonomy_mode_at_creation?: string | null
          created_at?: string
          dossier_schema_version: string
          governance_policy_version?: string | null
          governance_reasons?: Json
          id?: string
          materialization_origin?: string | null
          materialized_at?: string | null
          materialized_program_id?: string | null
          model_identifier: string
          prompt_version: string
          proposal_origin?: string
          proposal_schema_version: string
          proposal_snapshot: Json
          proposed_at?: string
          provider: string
          rejected_at?: string | null
          rejection_notes?: string | null
          rejection_reason?: string | null
          review_class?: string | null
          safety_policy_version: string
          source_analysis_id: string
          source_program_id: string
          source_program_revision: number
          stale_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          analysis_request_id?: string | null
          approved_at?: string | null
          athlete_id?: string
          auto_draft_eligibility?: string | null
          auto_draft_policy_version?: string | null
          auto_draft_reasons?: Json
          autonomy_mode_at_creation?: string | null
          created_at?: string
          dossier_schema_version?: string
          governance_policy_version?: string | null
          governance_reasons?: Json
          id?: string
          materialization_origin?: string | null
          materialized_at?: string | null
          materialized_program_id?: string | null
          model_identifier?: string
          prompt_version?: string
          proposal_origin?: string
          proposal_schema_version?: string
          proposal_snapshot?: Json
          proposed_at?: string
          provider?: string
          rejected_at?: string | null
          rejection_notes?: string | null
          rejection_reason?: string | null
          review_class?: string | null
          safety_policy_version?: string
          source_analysis_id?: string
          source_program_id?: string
          source_program_revision?: number
          stale_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "coach_decisions_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athletes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_decisions_materialized_program_id_fkey"
            columns: ["materialized_program_id"]
            isOneToOne: true
            referencedRelation: "training_programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_decisions_source_program_id_fkey"
            columns: ["source_program_id"]
            isOneToOne: false
            referencedRelation: "training_programs"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment: {
        Row: {
          id: string
          name_en: string
          name_pt: string
          slug: string
        }
        Insert: {
          id: string
          name_en: string
          name_pt: string
          slug: string
        }
        Update: {
          id?: string
          name_en?: string
          name_pt?: string
          slug?: string
        }
        Relationships: []
      }
      exercise_aliases: {
        Row: {
          alias: string
          exercise_id: string
          id: string
          language: string
          normalized_alias: string | null
        }
        Insert: {
          alias: string
          exercise_id: string
          id: string
          language: string
          normalized_alias?: string | null
        }
        Update: {
          alias?: string
          exercise_id?: string
          id?: string
          language?: string
          normalized_alias?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exercise_aliases_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
        ]
      }
      exercise_equipment: {
        Row: {
          equipment_id: string
          exercise_id: string
          is_primary: boolean
        }
        Insert: {
          equipment_id: string
          exercise_id: string
          is_primary?: boolean
        }
        Update: {
          equipment_id?: string
          exercise_id?: string
          is_primary?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "exercise_equipment_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exercise_equipment_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
        ]
      }
      exercise_external_mappings: {
        Row: {
          created_at: string
          exercise_id: string
          external_exercise_id: string
          id: string
          provider: string
        }
        Insert: {
          created_at?: string
          exercise_id: string
          external_exercise_id: string
          id: string
          provider: string
        }
        Update: {
          created_at?: string
          exercise_id?: string
          external_exercise_id?: string
          id?: string
          provider?: string
        }
        Relationships: [
          {
            foreignKeyName: "exercise_external_mappings_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
        ]
      }
      exercise_instruction_steps: {
        Row: {
          content_pt: string
          exercise_id: string
          id: string
          section: string
          sort_order: number
        }
        Insert: {
          content_pt: string
          exercise_id: string
          id: string
          section: string
          sort_order: number
        }
        Update: {
          content_pt?: string
          exercise_id?: string
          id?: string
          section?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "exercise_instruction_steps_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
        ]
      }
      exercise_media: {
        Row: {
          angle_view: string | null
          attribution: string | null
          cache_policy: string | null
          created_at: string
          exercise_id: string
          external_asset_id: string | null
          id: string
          is_primary: boolean
          license: string | null
          media_type: string
          provider: string | null
          source_type: string
          source_url: string | null
          storage_path: string | null
          usage_policy: string | null
        }
        Insert: {
          angle_view?: string | null
          attribution?: string | null
          cache_policy?: string | null
          created_at?: string
          exercise_id: string
          external_asset_id?: string | null
          id: string
          is_primary?: boolean
          license?: string | null
          media_type: string
          provider?: string | null
          source_type: string
          source_url?: string | null
          storage_path?: string | null
          usage_policy?: string | null
        }
        Update: {
          angle_view?: string | null
          attribution?: string | null
          cache_policy?: string | null
          created_at?: string
          exercise_id?: string
          external_asset_id?: string | null
          id?: string
          is_primary?: boolean
          license?: string | null
          media_type?: string
          provider?: string | null
          source_type?: string
          source_url?: string | null
          storage_path?: string | null
          usage_policy?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exercise_media_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
        ]
      }
      exercise_muscles: {
        Row: {
          exercise_id: string
          muscle_id: string
          role: string
          sort_order: number
        }
        Insert: {
          exercise_id: string
          muscle_id: string
          role: string
          sort_order?: number
        }
        Update: {
          exercise_id?: string
          muscle_id?: string
          role?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "exercise_muscles_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exercise_muscles_muscle_id_fkey"
            columns: ["muscle_id"]
            isOneToOne: false
            referencedRelation: "muscles"
            referencedColumns: ["id"]
          },
        ]
      }
      exercise_prescriptions: {
        Row: {
          athlete_cues: string | null
          created_at: string
          exercise_id: string
          id: string
          instructions: string | null
          sequence: number
          training_day_id: string
          updated_at: string
        }
        Insert: {
          athlete_cues?: string | null
          created_at?: string
          exercise_id: string
          id?: string
          instructions?: string | null
          sequence: number
          training_day_id: string
          updated_at?: string
        }
        Update: {
          athlete_cues?: string | null
          created_at?: string
          exercise_id?: string
          id?: string
          instructions?: string | null
          sequence?: number
          training_day_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "exercise_prescriptions_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exercise_prescriptions_training_day_id_fkey"
            columns: ["training_day_id"]
            isOneToOne: false
            referencedRelation: "training_days"
            referencedColumns: ["id"]
          },
        ]
      }
      exercise_relations: {
        Row: {
          note_pt: string | null
          relation_type: string
          source_exercise_id: string
          target_exercise_id: string
        }
        Insert: {
          note_pt?: string | null
          relation_type: string
          source_exercise_id: string
          target_exercise_id: string
        }
        Update: {
          note_pt?: string | null
          relation_type?: string
          source_exercise_id?: string
          target_exercise_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exercise_relations_source_id_fkey"
            columns: ["source_exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exercise_relations_target_id_fkey"
            columns: ["target_exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
        ]
      }
      exercises: {
        Row: {
          created_at: string
          difficulty: string | null
          id: string
          is_active: boolean
          laterality: string
          mechanics: string
          movement_pattern: string
          name_en: string
          name_pt: string
          short_description_pt: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          difficulty?: string | null
          id: string
          is_active?: boolean
          laterality: string
          mechanics: string
          movement_pattern: string
          name_en: string
          name_pt: string
          short_description_pt: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          difficulty?: string | null
          id?: string
          is_active?: boolean
          laterality?: string
          mechanics?: string
          movement_pattern?: string
          name_en?: string
          name_pt?: string
          short_description_pt?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      muscle_groups: {
        Row: {
          body_region_id: string
          description: string | null
          id: string
          name_en: string
          name_pt: string
          slug: string
        }
        Insert: {
          body_region_id: string
          description?: string | null
          id: string
          name_en: string
          name_pt: string
          slug: string
        }
        Update: {
          body_region_id?: string
          description?: string | null
          id?: string
          name_en?: string
          name_pt?: string
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "muscle_groups_body_region_id_fkey"
            columns: ["body_region_id"]
            isOneToOne: false
            referencedRelation: "body_regions"
            referencedColumns: ["id"]
          },
        ]
      }
      muscles: {
        Row: {
          anatomical_name: string | null
          description: string | null
          id: string
          muscle_group_id: string
          name_en: string
          name_pt: string
          slug: string
        }
        Insert: {
          anatomical_name?: string | null
          description?: string | null
          id: string
          muscle_group_id: string
          name_en: string
          name_pt: string
          slug: string
        }
        Update: {
          anatomical_name?: string | null
          description?: string | null
          id?: string
          muscle_group_id?: string
          name_en?: string
          name_pt?: string
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "muscles_muscle_group_id_fkey"
            columns: ["muscle_group_id"]
            isOneToOne: false
            referencedRelation: "muscle_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      prescription_sets: {
        Row: {
          created_at: string
          exercise_prescription_id: string
          id: string
          load_kg: number | null
          load_kind: string
          rest_max_seconds: number | null
          rest_min_seconds: number | null
          rir_max: number | null
          rir_min: number | null
          sequence: number
          target_max: number
          target_metric: string
          target_min: number
          tempo: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          exercise_prescription_id: string
          id?: string
          load_kg?: number | null
          load_kind?: string
          rest_max_seconds?: number | null
          rest_min_seconds?: number | null
          rir_max?: number | null
          rir_min?: number | null
          sequence: number
          target_max: number
          target_metric: string
          target_min: number
          tempo?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          exercise_prescription_id?: string
          id?: string
          load_kg?: number | null
          load_kind?: string
          rest_max_seconds?: number | null
          rest_min_seconds?: number | null
          rir_max?: number | null
          rir_min?: number | null
          sequence?: number
          target_max?: number
          target_metric?: string
          target_min?: number
          tempo?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prescription_sets_exercise_prescription_id_fkey"
            columns: ["exercise_prescription_id"]
            isOneToOne: false
            referencedRelation: "exercise_prescriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      training_blocks: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          sequence: number
          training_program_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          sequence: number
          training_program_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          sequence?: number
          training_program_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_blocks_training_program_id_fkey"
            columns: ["training_program_id"]
            isOneToOne: false
            referencedRelation: "training_programs"
            referencedColumns: ["id"]
          },
        ]
      }
      training_days: {
        Row: {
          created_at: string
          id: string
          name: string
          notes: string | null
          preferred_weekday: number | null
          sequence: number
          training_week_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          preferred_weekday?: number | null
          sequence: number
          training_week_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          preferred_weekday?: number | null
          sequence?: number
          training_week_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_days_training_week_id_fkey"
            columns: ["training_week_id"]
            isOneToOne: false
            referencedRelation: "training_weeks"
            referencedColumns: ["id"]
          },
        ]
      }
      training_programs: {
        Row: {
          activated_at: string | null
          archived_at: string | null
          athlete_goal_id: string | null
          athlete_id: string
          completed_at: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          revision: number
          status: string
          supersedes_program_id: string | null
          updated_at: string
        }
        Insert: {
          activated_at?: string | null
          archived_at?: string | null
          athlete_goal_id?: string | null
          athlete_id: string
          completed_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          revision?: number
          status?: string
          supersedes_program_id?: string | null
          updated_at?: string
        }
        Update: {
          activated_at?: string | null
          archived_at?: string | null
          athlete_goal_id?: string | null
          athlete_id?: string
          completed_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          revision?: number
          status?: string
          supersedes_program_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_program_goal_owner_fk"
            columns: ["athlete_goal_id", "athlete_id"]
            isOneToOne: false
            referencedRelation: "athlete_goals"
            referencedColumns: ["id", "athlete_id"]
          },
          {
            foreignKeyName: "training_programs_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athletes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_programs_supersedes_program_id_fkey"
            columns: ["supersedes_program_id"]
            isOneToOne: true
            referencedRelation: "training_programs"
            referencedColumns: ["id"]
          },
        ]
      }
      training_weeks: {
        Row: {
          created_at: string
          id: string
          name: string | null
          notes: string | null
          sequence: number
          training_block_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name?: string | null
          notes?: string | null
          sequence: number
          training_block_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string | null
          notes?: string | null
          sequence?: number
          training_block_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_weeks_training_block_id_fkey"
            columns: ["training_block_id"]
            isOneToOne: false
            referencedRelation: "training_blocks"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_exercises: {
        Row: {
          created_at: string
          exercise_id: string
          exercise_name_snapshot: string
          id: string
          planned_athlete_cues: string | null
          planned_instructions: string | null
          sequence: number
          source_exercise_prescription_id: string
          updated_at: string
          workout_session_id: string
        }
        Insert: {
          created_at?: string
          exercise_id: string
          exercise_name_snapshot: string
          id?: string
          planned_athlete_cues?: string | null
          planned_instructions?: string | null
          sequence: number
          source_exercise_prescription_id: string
          updated_at?: string
          workout_session_id: string
        }
        Update: {
          created_at?: string
          exercise_id?: string
          exercise_name_snapshot?: string
          id?: string
          planned_athlete_cues?: string | null
          planned_instructions?: string | null
          sequence?: number
          source_exercise_prescription_id?: string
          updated_at?: string
          workout_session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_exercises_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_exercises_source_exercise_prescription_id_fkey"
            columns: ["source_exercise_prescription_id"]
            isOneToOne: false
            referencedRelation: "exercise_prescriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_exercises_workout_session_id_fkey"
            columns: ["workout_session_id"]
            isOneToOne: false
            referencedRelation: "workout_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_sessions: {
        Row: {
          abandoned_at: string | null
          athlete_id: string
          athlete_notes: string | null
          completed_at: string | null
          created_at: string
          day_name_snapshot: string
          id: string
          program_name_snapshot: string
          source_training_day_id: string
          started_at: string
          status: string
          updated_at: string
        }
        Insert: {
          abandoned_at?: string | null
          athlete_id: string
          athlete_notes?: string | null
          completed_at?: string | null
          created_at?: string
          day_name_snapshot: string
          id?: string
          program_name_snapshot: string
          source_training_day_id: string
          started_at?: string
          status?: string
          updated_at?: string
        }
        Update: {
          abandoned_at?: string | null
          athlete_id?: string
          athlete_notes?: string | null
          completed_at?: string | null
          created_at?: string
          day_name_snapshot?: string
          id?: string
          program_name_snapshot?: string
          source_training_day_id?: string
          started_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_sessions_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athletes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_sessions_source_training_day_id_fkey"
            columns: ["source_training_day_id"]
            isOneToOne: false
            referencedRelation: "training_days"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_sets: {
        Row: {
          actual_load_kg: number | null
          actual_rir: number | null
          actual_value: number | null
          created_at: string
          id: string
          performed_at: string | null
          planned_load_kg: number | null
          planned_load_kind: string
          planned_metric: string
          planned_rest_max_seconds: number | null
          planned_rest_min_seconds: number | null
          planned_rir_max: number | null
          planned_rir_min: number | null
          planned_target_max: number
          planned_target_min: number
          planned_tempo: string | null
          rest_ended_at: string | null
          rest_started_at: string | null
          sequence: number
          source_prescription_set_id: string
          status: string
          updated_at: string
          workout_exercise_id: string
        }
        Insert: {
          actual_load_kg?: number | null
          actual_rir?: number | null
          actual_value?: number | null
          created_at?: string
          id?: string
          performed_at?: string | null
          planned_load_kg?: number | null
          planned_load_kind: string
          planned_metric: string
          planned_rest_max_seconds?: number | null
          planned_rest_min_seconds?: number | null
          planned_rir_max?: number | null
          planned_rir_min?: number | null
          planned_target_max: number
          planned_target_min: number
          planned_tempo?: string | null
          rest_ended_at?: string | null
          rest_started_at?: string | null
          sequence: number
          source_prescription_set_id: string
          status?: string
          updated_at?: string
          workout_exercise_id: string
        }
        Update: {
          actual_load_kg?: number | null
          actual_rir?: number | null
          actual_value?: number | null
          created_at?: string
          id?: string
          performed_at?: string | null
          planned_load_kg?: number | null
          planned_load_kind?: string
          planned_metric?: string
          planned_rest_max_seconds?: number | null
          planned_rest_min_seconds?: number | null
          planned_rir_max?: number | null
          planned_rir_min?: number | null
          planned_target_max?: number
          planned_target_min?: number
          planned_tempo?: string | null
          rest_ended_at?: string | null
          rest_started_at?: string | null
          sequence?: number
          source_prescription_set_id?: string
          status?: string
          updated_at?: string
          workout_exercise_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_sets_source_prescription_set_id_fkey"
            columns: ["source_prescription_set_id"]
            isOneToOne: false
            referencedRelation: "prescription_sets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_sets_workout_exercise_id_fkey"
            columns: ["workout_exercise_id"]
            isOneToOne: false
            referencedRelation: "workout_exercises"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      abandon_workout_session: {
        Args: { p_session_id: string }
        Returns: undefined
      }
      activate_training_program: {
        Args: { p_program_id: string }
        Returns: {
          activated_at: string | null
          archived_at: string | null
          athlete_goal_id: string | null
          athlete_id: string
          completed_at: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          revision: number
          status: string
          supersedes_program_id: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "training_programs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      auto_draft_coach_decision: {
        Args: { p_decision_id: string; p_user_id: string }
        Returns: Json
      }
      catalog_search_text: { Args: { value: string }; Returns: string }
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
      clone_training_program_as_draft: {
        Args: { p_program_id: string }
        Returns: {
          activated_at: string | null
          archived_at: string | null
          athlete_goal_id: string | null
          athlete_id: string
          completed_at: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          revision: number
          status: string
          supersedes_program_id: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "training_programs"
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
      complete_workout_session: {
        Args: { p_session_id: string }
        Returns: undefined
      }
      create_coach_decision:
        | {
            Args: { p_proposal: Json; p_user_id: string }
            Returns: {
              analysis_request_id: string | null
              approved_at: string | null
              athlete_id: string
              auto_draft_eligibility: string | null
              auto_draft_policy_version: string | null
              auto_draft_reasons: Json
              autonomy_mode_at_creation: string | null
              created_at: string
              dossier_schema_version: string
              governance_policy_version: string | null
              governance_reasons: Json
              id: string
              materialization_origin: string | null
              materialized_at: string | null
              materialized_program_id: string | null
              model_identifier: string
              prompt_version: string
              proposal_origin: string
              proposal_schema_version: string
              proposal_snapshot: Json
              proposed_at: string
              provider: string
              rejected_at: string | null
              rejection_notes: string | null
              rejection_reason: string | null
              review_class: string | null
              safety_policy_version: string
              source_analysis_id: string
              source_program_id: string
              source_program_revision: number
              stale_at: string | null
              status: string
              updated_at: string
            }
            SetofOptions: {
              from: "*"
              to: "coach_decisions"
              isOneToOne: true
              isSetofReturn: false
            }
          }
        | {
            Args: { p_envelope: Json; p_proposal: Json; p_user_id: string }
            Returns: {
              analysis_request_id: string | null
              approved_at: string | null
              athlete_id: string
              auto_draft_eligibility: string | null
              auto_draft_policy_version: string | null
              auto_draft_reasons: Json
              autonomy_mode_at_creation: string | null
              created_at: string
              dossier_schema_version: string
              governance_policy_version: string | null
              governance_reasons: Json
              id: string
              materialization_origin: string | null
              materialized_at: string | null
              materialized_program_id: string | null
              model_identifier: string
              prompt_version: string
              proposal_origin: string
              proposal_schema_version: string
              proposal_snapshot: Json
              proposed_at: string
              provider: string
              rejected_at: string | null
              rejection_notes: string | null
              rejection_reason: string | null
              review_class: string | null
              safety_policy_version: string
              source_analysis_id: string
              source_program_id: string
              source_program_revision: number
              stale_at: string | null
              status: string
              updated_at: string
            }
            SetofOptions: {
              from: "*"
              to: "coach_decisions"
              isOneToOne: true
              isSetofReturn: false
            }
          }
      create_coach_decision_for_analysis: {
        Args: { p_envelope: Json; p_proposal: Json; p_user_id: string }
        Returns: {
          analysis_request_id: string | null
          approved_at: string | null
          athlete_id: string
          auto_draft_eligibility: string | null
          auto_draft_policy_version: string | null
          auto_draft_reasons: Json
          autonomy_mode_at_creation: string | null
          created_at: string
          dossier_schema_version: string
          governance_policy_version: string | null
          governance_reasons: Json
          id: string
          materialization_origin: string | null
          materialized_at: string | null
          materialized_program_id: string | null
          model_identifier: string
          prompt_version: string
          proposal_origin: string
          proposal_schema_version: string
          proposal_snapshot: Json
          proposed_at: string
          provider: string
          rejected_at: string | null
          rejection_notes: string | null
          rejection_reason: string | null
          review_class: string | null
          safety_policy_version: string
          source_analysis_id: string
          source_program_id: string
          source_program_revision: number
          stale_at: string | null
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "coach_decisions"
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
      materialize_coach_decision: {
        Args: { p_decision_id: string; p_user_id: string }
        Returns: {
          analysis_request_id: string | null
          approved_at: string | null
          athlete_id: string
          auto_draft_eligibility: string | null
          auto_draft_policy_version: string | null
          auto_draft_reasons: Json
          autonomy_mode_at_creation: string | null
          created_at: string
          dossier_schema_version: string
          governance_policy_version: string | null
          governance_reasons: Json
          id: string
          materialization_origin: string | null
          materialized_at: string | null
          materialized_program_id: string | null
          model_identifier: string
          prompt_version: string
          proposal_origin: string
          proposal_schema_version: string
          proposal_snapshot: Json
          proposed_at: string
          provider: string
          rejected_at: string | null
          rejection_notes: string | null
          rejection_reason: string | null
          review_class: string | null
          safety_policy_version: string
          source_analysis_id: string
          source_program_id: string
          source_program_revision: number
          stale_at: string | null
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "coach_decisions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      record_coach_analysis_run:
        | {
            Args: {
              p_analysis: Json
              p_analysis_request_id: string
              p_source_program_id?: string
              p_source_program_revision?: number
              p_user_id: string
            }
            Returns: {
              analysis_request_id: string
              analysis_schema_version: string
              analysis_snapshot: Json
              athlete_id: string
              created_at: string
              dossier_schema_version: string
              id: string
              model_identifier: string
              prompt_version: string
              provider: string
              request_fingerprint: string | null
              safety_policy_version: string
              source_program_id: string | null
              source_program_revision: number | null
              training_advice_blocked: boolean
            }
            SetofOptions: {
              from: "*"
              to: "coach_analysis_runs"
              isOneToOne: true
              isSetofReturn: false
            }
          }
        | {
            Args: {
              p_analysis: Json
              p_analysis_request_id: string
              p_request_fingerprint: string
              p_source_program_id?: string
              p_source_program_revision?: number
              p_user_id: string
            }
            Returns: {
              analysis_request_id: string
              analysis_schema_version: string
              analysis_snapshot: Json
              athlete_id: string
              created_at: string
              dossier_schema_version: string
              id: string
              model_identifier: string
              prompt_version: string
              provider: string
              request_fingerprint: string | null
              safety_policy_version: string
              source_program_id: string | null
              source_program_revision: number | null
              training_advice_blocked: boolean
            }
            SetofOptions: {
              from: "*"
              to: "coach_analysis_runs"
              isOneToOne: true
              isSetofReturn: false
            }
          }
      record_workout_set: {
        Args: {
          p_actual_load_kg?: number
          p_actual_rir?: number
          p_actual_value: number
          p_rest_ended_at?: string
          p_rest_started_at?: string
          p_set_id: string
        }
        Returns: undefined
      }
      reject_coach_decision: {
        Args: {
          p_decision_id: string
          p_notes?: string
          p_reason: string
          p_user_id: string
        }
        Returns: {
          analysis_request_id: string | null
          approved_at: string | null
          athlete_id: string
          auto_draft_eligibility: string | null
          auto_draft_policy_version: string | null
          auto_draft_reasons: Json
          autonomy_mode_at_creation: string | null
          created_at: string
          dossier_schema_version: string
          governance_policy_version: string | null
          governance_reasons: Json
          id: string
          materialization_origin: string | null
          materialized_at: string | null
          materialized_program_id: string | null
          model_identifier: string
          prompt_version: string
          proposal_origin: string
          proposal_schema_version: string
          proposal_snapshot: Json
          proposed_at: string
          provider: string
          rejected_at: string | null
          rejection_notes: string | null
          rejection_reason: string | null
          review_class: string | null
          safety_policy_version: string
          source_analysis_id: string
          source_program_id: string
          source_program_revision: number
          stale_at: string | null
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "coach_decisions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      replace_training_program_structure: {
        Args: { p_program_id: string; p_structure: Json }
        Returns: undefined
      }
      search_exercise_catalog: {
        Args: {
          p_equipment_slug?: string
          p_movement_pattern?: string
          p_muscle_group_slug?: string
          p_muscle_slug?: string
          p_query?: string
        }
        Returns: {
          difficulty: string
          equipment: string[]
          id: string
          laterality: string
          mechanics: string
          movement_pattern: string
          name_en: string
          name_pt: string
          primary_muscle_groups: string[]
          primary_muscles: string[]
          short_description_pt: string
          slug: string
        }[]
      }
      set_current_training_availability: {
        Args: { p_available_weekdays: number[] }
        Returns: undefined
      }
      skip_workout_set: { Args: { p_set_id: string }; Returns: undefined }
      start_workout_session: {
        Args: { p_training_day_id: string }
        Returns: string
      }
      transition_training_program: {
        Args: { p_program_id: string; p_status: string }
        Returns: {
          activated_at: string | null
          archived_at: string | null
          athlete_goal_id: string | null
          athlete_id: string
          completed_at: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          revision: number
          status: string
          supersedes_program_id: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "training_programs"
          isOneToOne: true
          isSetofReturn: false
        }
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
