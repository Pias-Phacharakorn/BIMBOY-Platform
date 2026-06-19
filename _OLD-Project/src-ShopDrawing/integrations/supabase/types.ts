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
      bim_models: {
        Row: {
          created_at: string
          description: string | null
          file_size: number | null
          fragments_path: string | null
          id: string
          ifc_path: string
          name: string
          project_id: string
          properties_path: string | null
          updated_at: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          file_size?: number | null
          fragments_path?: string | null
          id?: string
          ifc_path: string
          name: string
          project_id: string
          properties_path?: string | null
          updated_at?: string
          uploaded_by: string
        }
        Update: {
          created_at?: string
          description?: string | null
          file_size?: number | null
          fragments_path?: string | null
          id?: string
          ifc_path?: string
          name?: string
          project_id?: string
          properties_path?: string | null
          updated_at?: string
          uploaded_by?: string
        }
        Relationships: []
      }
      cad_files: {
        Row: {
          annotations: Json | null
          created_at: string
          file_type: string
          file_url: string | null
          id: string
          name: string
          project_id: string
          updated_at: string
          uploaded_by: string
        }
        Insert: {
          annotations?: Json | null
          created_at?: string
          file_type?: string
          file_url?: string | null
          id?: string
          name: string
          project_id: string
          updated_at?: string
          uploaded_by: string
        }
        Update: {
          annotations?: Json | null
          created_at?: string
          file_type?: string
          file_url?: string | null
          id?: string
          name?: string
          project_id?: string
          updated_at?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "cad_files_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      clash_comments: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          project_id: string
          updated_at: string
          viewpoint_id: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          id?: string
          project_id: string
          updated_at?: string
          viewpoint_id: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          project_id?: string
          updated_at?: string
          viewpoint_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clash_comments_viewpoint_id_fkey"
            columns: ["viewpoint_id"]
            isOneToOne: false
            referencedRelation: "clash_viewpoints"
            referencedColumns: ["id"]
          },
        ]
      }
      clash_history: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          created_at: string
          details: Json | null
          id: string
          project_id: string
          viewpoint_id: string
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          project_id: string
          viewpoint_id: string
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          project_id?: string
          viewpoint_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clash_history_viewpoint_id_fkey"
            columns: ["viewpoint_id"]
            isOneToOne: false
            referencedRelation: "clash_viewpoints"
            referencedColumns: ["id"]
          },
        ]
      }
      clash_viewpoints: {
        Row: {
          assigned_to: string | null
          author_email: string | null
          created_at: string
          created_by: string
          description: string | null
          discipline: string | null
          due_date: string | null
          element_id: string | null
          folder: string | null
          id: string
          issue_number: number | null
          issue_type: string | null
          level: string | null
          markup: string | null
          name: string
          originator: string | null
          phase: string | null
          plan_view_url: string | null
          priority: string
          project_id: string
          section_view_url: string | null
          solution: string | null
          status: string
          thumbnail_url: string | null
          updated_at: string
          vp_key: string | null
          zone: string | null
        }
        Insert: {
          assigned_to?: string | null
          author_email?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          discipline?: string | null
          due_date?: string | null
          element_id?: string | null
          folder?: string | null
          id?: string
          issue_number?: number | null
          issue_type?: string | null
          level?: string | null
          markup?: string | null
          name: string
          originator?: string | null
          phase?: string | null
          plan_view_url?: string | null
          priority?: string
          project_id: string
          section_view_url?: string | null
          solution?: string | null
          status?: string
          thumbnail_url?: string | null
          updated_at?: string
          vp_key?: string | null
          zone?: string | null
        }
        Update: {
          assigned_to?: string | null
          author_email?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          discipline?: string | null
          due_date?: string | null
          element_id?: string | null
          folder?: string | null
          id?: string
          issue_number?: number | null
          issue_type?: string | null
          level?: string | null
          markup?: string | null
          name?: string
          originator?: string | null
          phase?: string | null
          plan_view_url?: string | null
          priority?: string
          project_id?: string
          section_view_url?: string | null
          solution?: string | null
          status?: string
          thumbnail_url?: string | null
          updated_at?: string
          vp_key?: string | null
          zone?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string | null
          first_name: string
          id: string
          last_name: string
        }
        Insert: {
          created_at?: string | null
          first_name: string
          id: string
          last_name: string
        }
        Update: {
          created_at?: string | null
          first_name?: string
          id?: string
          last_name?: string
        }
        Relationships: []
      }
      project_members: {
        Row: {
          added_at: string | null
          id: string
          project_id: string
          user_id: string
        }
        Insert: {
          added_at?: string | null
          id?: string
          project_id: string
          user_id: string
        }
        Update: {
          added_at?: string | null
          id?: string
          project_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          created_at: string | null
          created_by: string
          description: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          created_by: string
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          created_by?: string
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth_key: string
          created_at: string
          endpoint: string
          id: string
          p256dh_key: string
          updated_at: string
          user_id: string
        }
        Insert: {
          auth_key: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh_key: string
          updated_at?: string
          user_id: string
        }
        Update: {
          auth_key?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh_key?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_rules: {
        Row: {
          by_day: string[] | null
          created_at: string
          end_date: string | null
          end_time: string
          exception_dates: string[] | null
          frequency: string
          human_readable: string | null
          id: string
          interval_val: number
          start_date: string
          start_time: string
          timezone: string
          user_id: string
        }
        Insert: {
          by_day?: string[] | null
          created_at?: string
          end_date?: string | null
          end_time: string
          exception_dates?: string[] | null
          frequency: string
          human_readable?: string | null
          id?: string
          interval_val?: number
          start_date: string
          start_time: string
          timezone?: string
          user_id: string
        }
        Update: {
          by_day?: string[] | null
          created_at?: string
          end_date?: string | null
          end_time?: string
          exception_dates?: string[] | null
          frequency?: string
          human_readable?: string | null
          id?: string
          interval_val?: number
          start_date?: string
          start_time?: string
          timezone?: string
          user_id?: string
        }
        Relationships: []
      }
      scan_activities: {
        Row: {
          drawing_no: string
          id: string
          is_valid: boolean
          latest_revision: number
          project_id: string | null
          scanned_at: string
          scanned_revision: number
          user_id: string
        }
        Insert: {
          drawing_no: string
          id?: string
          is_valid: boolean
          latest_revision: number
          project_id?: string | null
          scanned_at?: string
          scanned_revision: number
          user_id: string
        }
        Update: {
          drawing_no?: string
          id?: string
          is_valid?: boolean
          latest_revision?: number
          project_id?: string | null
          scanned_at?: string
          scanned_revision?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scan_activities_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scan_activities_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_tasks: {
        Row: {
          assigned_to: string | null
          color: string | null
          created_at: string | null
          created_by: string
          dependencies: string[] | null
          end_date: string
          id: string
          name: string
          parent_id: string | null
          progress: number | null
          project_id: string
          shop_drawing_id: string | null
          start_date: string
          task_type: string | null
          updated_at: string | null
        }
        Insert: {
          assigned_to?: string | null
          color?: string | null
          created_at?: string | null
          created_by: string
          dependencies?: string[] | null
          end_date: string
          id?: string
          name: string
          parent_id?: string | null
          progress?: number | null
          project_id: string
          shop_drawing_id?: string | null
          start_date: string
          task_type?: string | null
          updated_at?: string | null
        }
        Update: {
          assigned_to?: string | null
          color?: string | null
          created_at?: string | null
          created_by?: string
          dependencies?: string[] | null
          end_date?: string
          id?: string
          name?: string
          parent_id?: string | null
          progress?: number | null
          project_id?: string
          shop_drawing_id?: string | null
          start_date?: string
          task_type?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "schedule_tasks_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "schedule_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_tasks_shop_drawing_id_fkey"
            columns: ["shop_drawing_id"]
            isOneToOne: false
            referencedRelation: "shop_drawings"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_drawings: {
        Row: {
          author: string | null
          created_at: string
          current_revision: number
          id: string
          is_latest: boolean
          last_updated: string
          name: string
          no: string
          pdf_url: string | null
          project_id: string | null
          sheet_id: string | null
        }
        Insert: {
          author?: string | null
          created_at?: string
          current_revision?: number
          id?: string
          is_latest?: boolean
          last_updated?: string
          name: string
          no: string
          pdf_url?: string | null
          project_id?: string | null
          sheet_id?: string | null
        }
        Update: {
          author?: string | null
          created_at?: string
          current_revision?: number
          id?: string
          is_latest?: boolean
          last_updated?: string
          name?: string
          no?: string
          pdf_url?: string | null
          project_id?: string | null
          sheet_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shop_drawings_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      workload_entries: {
        Row: {
          created_at: string
          description: string | null
          end_datetime: string
          estimated_hours: number | null
          id: string
          is_recurring: boolean
          priority: string
          project_id: string | null
          recurring_rule_id: string | null
          start_datetime: string
          task_type: string
          title: string
          updated_at: string
          user_id: string
          workload_percent: number | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          end_datetime: string
          estimated_hours?: number | null
          id?: string
          is_recurring?: boolean
          priority?: string
          project_id?: string | null
          recurring_rule_id?: string | null
          start_datetime: string
          task_type?: string
          title: string
          updated_at?: string
          user_id: string
          workload_percent?: number | null
        }
        Update: {
          created_at?: string
          description?: string | null
          end_datetime?: string
          estimated_hours?: number | null
          id?: string
          is_recurring?: boolean
          priority?: string
          project_id?: string | null
          recurring_rule_id?: string | null
          start_datetime?: string
          task_type?: string
          title?: string
          updated_at?: string
          user_id?: string
          workload_percent?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "workload_entries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workload_entries_recurring_rule_id_fkey"
            columns: ["recurring_rule_id"]
            isOneToOne: false
            referencedRelation: "recurring_rules"
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
      is_project_member: {
        Args: { _project_id: string; _user_id: string }
        Returns: boolean
      }
      user_has_elevated_role: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role:
        | "admin"
        | "user"
        | "project_admin"
        | "engineer"
        | "modeler"
        | "viewer"
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
      app_role: [
        "admin",
        "user",
        "project_admin",
        "engineer",
        "modeler",
        "viewer",
      ],
    },
  },
} as const
