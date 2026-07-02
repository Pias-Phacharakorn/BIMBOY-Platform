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
      clash_reports: {
        Row: {
          id: string
          project_id: string
          name: string
          source_format: Database["public"]["Enums"]["clash_source_format"]
          total_count: number
          major_count: number
          minor_count: number
          regulation_count: number
          resolved_count: number
          imported_by: string | null
          imported_at: string
          is_deleted: boolean
        }
        Insert: {
          id?: string
          project_id: string
          name: string
          source_format?: Database["public"]["Enums"]["clash_source_format"]
          total_count?: number
          major_count?: number
          minor_count?: number
          regulation_count?: number
          resolved_count?: number
          imported_by?: string | null
          imported_at?: string
          is_deleted?: boolean
        }
        Update: {
          id?: string
          project_id?: string
          name?: string
          source_format?: Database["public"]["Enums"]["clash_source_format"]
          total_count?: number
          major_count?: number
          minor_count?: number
          regulation_count?: number
          resolved_count?: number
          imported_by?: string | null
          imported_at?: string
          is_deleted?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "clash_reports_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "active_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clash_reports_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clash_reports_imported_by_fkey"
            columns: ["imported_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["uid"]
          },
        ]
      }
      clash_viewpoints: {
        Row: {
          id: string
          project_id: string
          report_id: string | null
          guid: string
          name: string
          path: string | null
          type: Database["public"]["Enums"]["clash_type"]
          status: Database["public"]["Enums"]["clash_status"]
          markup: string | null
          solution: string | null
          comments: string | null
          image_url: string | null
          plan_image_url: string | null
          section_image_url: string | null
          camera: Json | null
          selection: Json | null
          occurred_at: string
          created_by: string | null
          created_at: string
          updated_at: string
          is_deleted: boolean
        }
        Insert: {
          id?: string
          project_id: string
          report_id?: string | null
          guid: string
          name: string
          path?: string | null
          type?: Database["public"]["Enums"]["clash_type"]
          status?: Database["public"]["Enums"]["clash_status"]
          markup?: string | null
          solution?: string | null
          comments?: string | null
          image_url?: string | null
          plan_image_url?: string | null
          section_image_url?: string | null
          camera?: Json | null
          selection?: Json | null
          occurred_at?: string
          created_by?: string | null
          created_at?: string
          updated_at?: string
          is_deleted?: boolean
        }
        Update: {
          id?: string
          project_id?: string
          report_id?: string | null
          guid?: string
          name?: string
          path?: string | null
          type?: Database["public"]["Enums"]["clash_type"]
          status?: Database["public"]["Enums"]["clash_status"]
          markup?: string | null
          solution?: string | null
          comments?: string | null
          image_url?: string | null
          plan_image_url?: string | null
          section_image_url?: string | null
          camera?: Json | null
          selection?: Json | null
          occurred_at?: string
          created_by?: string | null
          created_at?: string
          updated_at?: string
          is_deleted?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "clash_viewpoints_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "active_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clash_viewpoints_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clash_viewpoints_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "clash_reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clash_viewpoints_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["uid"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          diff: Json
          id: number
          ip_address: string | null
          performed_by: string | null
          project_id: string | null
          timestamp: string
        }
        Insert: {
          action: string
          diff?: Json
          id?: number
          ip_address?: string | null
          performed_by?: string | null
          project_id?: string | null
          timestamp?: string
        }
        Update: {
          action?: string
          diff?: Json
          id?: number
          ip_address?: string | null
          performed_by?: string | null
          project_id?: string | null
          timestamp?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["uid"]
          },
          {
            foreignKeyName: "audit_logs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "active_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          hub_role: Database["public"]["Enums"]["hub_role"]
          is_active: boolean
          uid: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          hub_role?: Database["public"]["Enums"]["hub_role"]
          is_active?: boolean
          uid: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          hub_role?: Database["public"]["Enums"]["hub_role"]
          is_active?: boolean
          uid?: string
          updated_at?: string
        }
        Relationships: []
      }
      project_members: {
        Row: {
          added_at: string
          added_by: string | null
          added_by_email: string | null
          is_active: boolean
          project_id: string
          role: Database["public"]["Enums"]["project_role"]
          uid: string
        }
        Insert: {
          added_at?: string
          added_by?: string | null
          added_by_email?: string | null
          is_active?: boolean
          project_id: string
          role?: Database["public"]["Enums"]["project_role"]
          uid: string
        }
        Update: {
          added_at?: string
          added_by?: string | null
          added_by_email?: string | null
          is_active?: boolean
          project_id?: string
          role?: Database["public"]["Enums"]["project_role"]
          uid?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_members_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["uid"]
          },
          {
            foreignKeyName: "project_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "active_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_members_uid_fkey"
            columns: ["uid"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["uid"]
          },
        ]
      }
      projects: {
        Row: {
          clash_folder_path: string | null
          created_at: string
          created_by: string | null
          description: string | null
          elevation: number | null
          finish_date: string
          frag_folder_path: string
          has_model: boolean
          id: string
          ifc_folder_path: string
          is_deleted: boolean
          latitude: number | null
          longitude: number | null
          project_name: string
          project_number: number
          rotation: number | null
          start_date: string
          status: Database["public"]["Enums"]["project_status"]
          updated_at: string
          powerbi_tabs: Json
        }
        Insert: {
          clash_folder_path?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          elevation?: number | null
          finish_date?: string
          frag_folder_path?: string
          has_model?: boolean
          id?: string
          ifc_folder_path?: string
          is_deleted?: boolean
          latitude?: number | null
          longitude?: number | null
          project_name: string
          project_number: number
          rotation?: number | null
          start_date?: string
          status?: Database["public"]["Enums"]["project_status"]
          updated_at?: string
          powerbi_tabs?: Json
        }
        Update: {
          clash_folder_path?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          elevation?: number | null
          finish_date?: string
          frag_folder_path?: string
          has_model?: boolean
          id?: string
          ifc_folder_path?: string
          is_deleted?: boolean
          latitude?: number | null
          longitude?: number | null
          project_name?: string
          project_number?: number
          rotation?: number | null
          start_date?: string
          status?: Database["public"]["Enums"]["project_status"]
          updated_at?: string
          powerbi_tabs?: Json
        }
        Relationships: [
          {
            foreignKeyName: "projects_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["uid"]
          },
        ]
      }
    }
    Views: {
      active_projects: {
        Row: {
          clash_folder_path: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          elevation: number | null
          finish_date: string | null
          frag_folder_path: string | null
          has_model: boolean | null
          id: string | null
          ifc_folder_path: string | null
          is_deleted: boolean | null
          latitude: number | null
          longitude: number | null
          project_name: string | null
          project_number: number | null
          rotation: number | null
          start_date: string | null
          status: Database["public"]["Enums"]["project_status"] | null
          updated_at: string | null
          powerbi_tabs: Json | null
        }
        Insert: {
          clash_folder_path?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          elevation?: number | null
          finish_date?: string | null
          frag_folder_path?: string | null
          has_model?: boolean | null
          id?: string | null
          ifc_folder_path?: string | null
          is_deleted?: boolean | null
          latitude?: number | null
          longitude?: number | null
          project_name?: string | null
          project_number?: number | null
          rotation?: number | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"] | null
          updated_at?: string | null
          powerbi_tabs?: Json | null
        }
        Update: {
          clash_folder_path?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          elevation?: number | null
          finish_date?: string | null
          frag_folder_path?: string | null
          has_model?: boolean | null
          id?: string | null
          ifc_folder_path?: string | null
          is_deleted?: boolean | null
          latitude?: number | null
          longitude?: number | null
          project_name?: string | null
          project_number?: number | null
          rotation?: number | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"] | null
          updated_at?: string | null
          powerbi_tabs?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["uid"]
          },
        ]
      }
    }
    Functions: {
      create_dummy_user: { Args: { p_email: string }; Returns: string }
      is_hub_admin: { Args: never; Returns: boolean }
      is_project_admin: {
        Args: { p_id: string; u_id: string }
        Returns: boolean
      }
      is_project_member: {
        Args: { p_id: string; u_id: string }
        Returns: boolean
      }
    }
    Enums: {
      hub_role: "hub_admin" | "hub_member"
      project_role: "project_admin" | "project_member"
      project_status: "bidding" | "active" | "finished"
      clash_type: "major" | "minor" | "regulation"
      clash_status: "new" | "unresolved" | "resolved" | "approved_as_note"
      clash_source_format: "navisworks" | "bcf" | "manual"
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
      hub_role: ["hub_admin", "hub_member"],
      project_role: ["project_admin", "project_member"],
      project_status: ["bidding", "active", "finished"],
      clash_type: ["major", "minor", "regulation"],
      clash_status: ["new", "unresolved", "resolved", "approved_as_note"],
      clash_source_format: ["navisworks", "bcf", "manual"],
    },
  },
} as const
