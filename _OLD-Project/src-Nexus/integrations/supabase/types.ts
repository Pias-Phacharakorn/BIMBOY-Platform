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
      gis_pins: {
        Row: {
          bim_heading_deg: number
          bim_model_paths: string[] | null
          bim_model_url: string | null
          bim_pitch_deg: number
          bim_roll_deg: number
          bim_world_coordinates: boolean
          created_at: string
          elevation: number
          end_date: string | null
          id: string
          lat: number
          lng: number
          name: string
          progress_percentage: number
          project_id: string | null
          project_manager: string
          project_value_usd: number
          province: string
          slug: string
          sort_order: number
          start_date: string | null
          status: string
          type: string
          updated_at: string
          weather_station_id: string
        }
        Insert: {
          bim_heading_deg?: number
          bim_model_paths?: string[] | null
          bim_model_url?: string | null
          bim_pitch_deg?: number
          bim_roll_deg?: number
          bim_world_coordinates?: boolean
          created_at?: string
          elevation?: number
          end_date?: string | null
          id?: string
          lat: number
          lng: number
          name: string
          progress_percentage?: number
          project_id?: string | null
          project_manager?: string
          project_value_usd?: number
          province: string
          slug: string
          sort_order?: number
          start_date?: string | null
          status: string
          type: string
          updated_at?: string
          weather_station_id?: string
        }
        Update: {
          bim_heading_deg?: number
          bim_model_paths?: string[] | null
          bim_model_url?: string | null
          bim_pitch_deg?: number
          bim_roll_deg?: number
          bim_world_coordinates?: boolean
          created_at?: string
          elevation?: number
          end_date?: string | null
          id?: string
          lat?: number
          lng?: number
          name?: string
          progress_percentage?: number
          project_id?: string | null
          project_manager?: string
          project_value_usd?: number
          province?: string
          slug?: string
          sort_order?: number
          start_date?: string | null
          status?: string
          type?: string
          updated_at?: string
          weather_station_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gis_pins_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      mqtt_mappings: {
        Row: {
          created_at: string
          element_id: string
          id: string
          project_id: string
          topic: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          element_id: string
          id?: string
          project_id: string
          topic: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          element_id?: string
          id?: string
          project_id?: string
          topic?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mqtt_mappings_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_bim_models: {
        Row: {
          created_at: string
          file_type: string
          id: string
          model_id: string
          original_name: string
          project_id: string
          storage_path: string
          updated_at: string
          updated_by: string
        }
        Insert: {
          created_at?: string
          file_type: string
          id?: string
          model_id?: string
          original_name: string
          project_id: string
          storage_path: string
          updated_at?: string
          updated_by: string
        }
        Update: {
          created_at?: string
          file_type?: string
          id?: string
          model_id?: string
          original_name?: string
          project_id?: string
          storage_path?: string
          updated_at?: string
          updated_by?: string
        }
        Relationships: []
      }
      project_members: {
        Row: {
          added_at: string
          id: string
          project_id: string
          user_id: string
        }
        Insert: {
          added_at?: string
          id?: string
          project_id: string
          user_id: string
        }
        Update: {
          added_at?: string
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
      project_module_perms: {
        Row: {
          id: string
          level: Database["public"]["Enums"]["permission_level"]
          module: Database["public"]["Enums"]["module_key"]
          project_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          id?: string
          level: Database["public"]["Enums"]["permission_level"]
          module: Database["public"]["Enums"]["module_key"]
          project_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          id?: string
          level?: Database["public"]["Enums"]["permission_level"]
          module?: Database["public"]["Enums"]["module_key"]
          project_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_module_perms_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          updated_at?: string
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
      workflow_configs: {
        Row: {
          created_at: string
          edges: Json
          id: string
          nodes: Json
          project_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          edges?: Json
          id?: string
          nodes?: Json
          project_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          edges?: Json
          id?: string
          nodes?: Json
          project_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_configs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_edit_module: {
        Args: {
          _module: Database["public"]["Enums"]["module_key"]
          _pid: string
          _uid: string
        }
        Returns: boolean
      }
      can_view_module: {
        Args: {
          _module: Database["public"]["Enums"]["module_key"]
          _pid: string
          _uid: string
        }
        Returns: boolean
      }
      has_app_role: {
        Args: { _role: Database["public"]["Enums"]["app_role"]; _uid: string }
        Returns: boolean
      }
      is_project_member: {
        Args: { _pid: string; _uid: string }
        Returns: boolean
      }
      project_module_level: {
        Args: {
          _module: Database["public"]["Enums"]["module_key"]
          _pid: string
          _uid: string
        }
        Returns: Database["public"]["Enums"]["permission_level"]
      }
    }
    Enums: {
      app_role: "admin" | "user"
      module_key: "bim" | "iot" | "workflow" | "fm"
      permission_level: "full" | "editor" | "viewer"
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
      module_key: ["bim", "iot", "workflow", "fm"],
      permission_level: ["full", "editor", "viewer"],
    },
  },
} as const
