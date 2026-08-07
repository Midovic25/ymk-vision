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
      areas: {
        Row: {
          id: string
          name: string
        }
        Insert: {
          id?: string
          name: string
        }
        Update: {
          id?: string
          name?: string
        }
        Relationships: []
      }
      audit_entries: {
        Row: {
          audit_id: string
          created_at: string
          id: string
          item_id: string
          status: Database["public"]["Enums"]["entry_status"]
          workstation_id: string
        }
        Insert: {
          audit_id: string
          created_at?: string
          id?: string
          item_id: string
          status: Database["public"]["Enums"]["entry_status"]
          workstation_id: string
        }
        Update: {
          audit_id?: string
          created_at?: string
          id?: string
          item_id?: string
          status?: Database["public"]["Enums"]["entry_status"]
          workstation_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_entries_audit_id_fkey"
            columns: ["audit_id"]
            isOneToOne: false
            referencedRelation: "audits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_entries_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "audit_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_entries_workstation_id_fkey"
            columns: ["workstation_id"]
            isOneToOne: false
            referencedRelation: "workstations"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_items: {
        Row: {
          category: string | null
          code: number
          description: string | null
          id: string
          pillar_id: string | null
        }
        Insert: {
          category?: string | null
          code: number
          description?: string | null
          id?: string
          pillar_id?: string | null
        }
        Update: {
          category?: string | null
          code?: number
          description?: string | null
          id?: string
          pillar_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_items_pillar_id_fkey"
            columns: ["pillar_id"]
            isOneToOne: false
            referencedRelation: "pillars"
            referencedColumns: ["id"]
          },
        ]
      }
      audits: {
        Row: {
          area_id: string | null
          audit_date: string
          auditor_id: string
          closed_at: string | null
          created_at: string
          id: string
          line_id: string
          plant: string
          score: number | null
          status: Database["public"]["Enums"]["audit_status"]
        }
        Insert: {
          area_id?: string | null
          audit_date?: string
          auditor_id: string
          closed_at?: string | null
          created_at?: string
          id?: string
          line_id: string
          plant?: string
          score?: number | null
          status?: Database["public"]["Enums"]["audit_status"]
        }
        Update: {
          area_id?: string | null
          audit_date?: string
          auditor_id?: string
          closed_at?: string | null
          created_at?: string
          id?: string
          line_id?: string
          plant?: string
          score?: number | null
          status?: Database["public"]["Enums"]["audit_status"]
        }
        Relationships: [
          {
            foreignKeyName: "audits_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audits_line_id_fkey"
            columns: ["line_id"]
            isOneToOne: false
            referencedRelation: "lines"
            referencedColumns: ["id"]
          },
        ]
      }
      lines: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      ng_actions: {
        Row: {
          action_plan: string | null
          area_id: string | null
          assigned_to: string | null
          created_at: string
          department: string | null
          due_date: string | null
          entry_id: string
          evidence_correction_url: string | null
          evidence_url: string | null
          id: string
          issue_description: string
          priority: string
          resolution_comment: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["action_status"]
          updated_at: string
        }
        Insert: {
          action_plan?: string | null
          area_id?: string | null
          assigned_to?: string | null
          created_at?: string
          department?: string | null
          due_date?: string | null
          entry_id: string
          evidence_correction_url?: string | null
          evidence_url?: string | null
          id?: string
          issue_description: string
          priority?: string
          resolution_comment?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["action_status"]
          updated_at?: string
        }
        Update: {
          action_plan?: string | null
          area_id?: string | null
          assigned_to?: string | null
          created_at?: string
          department?: string | null
          due_date?: string | null
          entry_id?: string
          evidence_correction_url?: string | null
          evidence_url?: string | null
          id?: string
          issue_description?: string
          priority?: string
          resolution_comment?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["action_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ng_actions_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ng_actions_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: true
            referencedRelation: "audit_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          action_id: string | null
          body: string
          channel: string
          created_at: string
          id: string
          status: string
          subject: string
          user_id: string
        }
        Insert: {
          action_id?: string | null
          body: string
          channel?: string
          created_at?: string
          id?: string
          status?: string
          subject: string
          user_id: string
        }
        Update: {
          action_id?: string | null
          body?: string
          channel?: string
          created_at?: string
          id?: string
          status?: string
          subject?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_action_id_fkey"
            columns: ["action_id"]
            isOneToOne: false
            referencedRelation: "ng_actions"
            referencedColumns: ["id"]
          },
        ]
      }
      pillars: {
        Row: {
          id: string
          name: string
        }
        Insert: {
          id?: string
          name: string
        }
        Update: {
          id?: string
          name?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          approved: boolean
          approved_at: string | null
          avatar_url: string | null
          created_at: string
          department: string | null
          email: string | null
          full_name: string | null
          id: string
          line_id: string | null
          notify_email: string | null
        }
        Insert: {
          approved?: boolean
          approved_at?: string | null
          avatar_url?: string | null
          created_at?: string
          department?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          line_id?: string | null
          notify_email?: string | null
        }
        Update: {
          approved?: boolean
          approved_at?: string | null
          avatar_url?: string | null
          created_at?: string
          department?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          line_id?: string | null
          notify_email?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      workstation_items: {
        Row: {
          item_id: string
          workstation_id: string
        }
        Insert: {
          item_id: string
          workstation_id: string
        }
        Update: {
          item_id?: string
          workstation_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workstation_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "audit_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workstation_items_workstation_id_fkey"
            columns: ["workstation_id"]
            isOneToOne: false
            referencedRelation: "workstations"
            referencedColumns: ["id"]
          },
        ]
      }
      workstations: {
        Row: {
          area_id: string
          id: string
          line_id: string
          name: string
          pillar_id: string
        }
        Insert: {
          area_id: string
          id?: string
          line_id: string
          name: string
          pillar_id: string
        }
        Update: {
          area_id?: string
          id?: string
          line_id?: string
          name?: string
          pillar_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workstations_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workstations_line_id_fkey"
            columns: ["line_id"]
            isOneToOne: false
            referencedRelation: "lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workstations_pillar_id_fkey"
            columns: ["pillar_id"]
            isOneToOne: false
            referencedRelation: "pillars"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_access_evidence: { Args: { _path: string }; Returns: boolean }
      can_view_audit: { Args: { _audit_id: string }; Returns: boolean }
      evidence_audit_id: { Args: { _path: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_action_responsible: { Args: { _user_id: string }; Returns: boolean }
      is_approved: { Args: { _user_id: string }; Returns: boolean }
      list_action_responsibles: {
        Args: never
        Returns: {
          department: string
          email: string
          full_name: string
          id: string
        }[]
      }
    }
    Enums: {
      action_status: "Not started" | "On going" | "Close" | "In delay"
      app_role:
        | "admin"
        | "moto_responsible"
        | "action_responsible"
        | "department_manager"
      audit_status: "open" | "closed"
      entry_status: "OK" | "NG" | "NA"
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
      action_status: ["Not started", "On going", "Close", "In delay"],
      app_role: [
        "admin",
        "moto_responsible",
        "action_responsible",
        "department_manager",
      ],
      audit_status: ["open", "closed"],
      entry_status: ["OK", "NG", "NA"],
    },
  },
} as const
