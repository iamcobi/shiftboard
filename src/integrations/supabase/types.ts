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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      default_availability: {
        Row: {
          dow: number
          employee_id: string
          end_hour: number
          id: string
          start_hour: number
        }
        Insert: {
          dow: number
          employee_id: string
          end_hour: number
          id?: string
          start_hour: number
        }
        Update: {
          dow?: number
          employee_id?: string
          end_hour?: number
          id?: string
          start_hour?: number
        }
        Relationships: [
          {
            foreignKeyName: "default_availability_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      emergencies: {
        Row: {
          created_at: string
          employee_id: string
          id: string
          reason: string
          replacement_employee_id: string | null
          shift_id: string
          status: Database["public"]["Enums"]["emergency_status"]
          suggestions: Json | null
        }
        Insert: {
          created_at?: string
          employee_id: string
          id?: string
          reason?: string
          replacement_employee_id?: string | null
          shift_id: string
          status?: Database["public"]["Enums"]["emergency_status"]
          suggestions?: Json | null
        }
        Update: {
          created_at?: string
          employee_id?: string
          id?: string
          reason?: string
          replacement_employee_id?: string | null
          shift_id?: string
          status?: Database["public"]["Enums"]["emergency_status"]
          suggestions?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "emergencies_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "emergencies_replacement_employee_id_fkey"
            columns: ["replacement_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "emergencies_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          active: boolean
          created_at: string
          email: string
          emp_type: Database["public"]["Enums"]["emp_type"]
          full_name: string
          id: string
          job_role_id: string | null
          user_id: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          email: string
          emp_type?: Database["public"]["Enums"]["emp_type"]
          full_name: string
          id?: string
          job_role_id?: string | null
          user_id?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          email?: string
          emp_type?: Database["public"]["Enums"]["emp_type"]
          full_name?: string
          id?: string
          job_role_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employees_job_role_id_fkey"
            columns: ["job_role_id"]
            isOneToOne: false
            referencedRelation: "job_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      job_roles: {
        Row: {
          created_at: string
          id: string
          min_staff: number
          name: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          min_staff?: number
          name: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          min_staff?: number
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      leave_requests: {
        Row: {
          created_at: string
          employee_id: string
          end_date: string
          id: string
          manager_note: string | null
          reason: string
          start_date: string
          status: Database["public"]["Enums"]["request_status"]
        }
        Insert: {
          created_at?: string
          employee_id: string
          end_date: string
          id?: string
          manager_note?: string | null
          reason?: string
          start_date: string
          status?: Database["public"]["Enums"]["request_status"]
        }
        Update: {
          created_at?: string
          employee_id?: string
          end_date?: string
          id?: string
          manager_note?: string | null
          reason?: string
          start_date?: string
          status?: Database["public"]["Enums"]["request_status"]
        }
        Relationships: [
          {
            foreignKeyName: "leave_requests_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      schedules: {
        Row: {
          ai_summary: string | null
          created_at: string
          gaps: Json
          id: string
          published_at: string | null
          status: Database["public"]["Enums"]["schedule_status"]
          week_start: string
        }
        Insert: {
          ai_summary?: string | null
          created_at?: string
          gaps?: Json
          id?: string
          published_at?: string | null
          status?: Database["public"]["Enums"]["schedule_status"]
          week_start: string
        }
        Update: {
          ai_summary?: string | null
          created_at?: string
          gaps?: Json
          id?: string
          published_at?: string | null
          status?: Database["public"]["Enums"]["schedule_status"]
          week_start?: string
        }
        Relationships: []
      }
      shifts: {
        Row: {
          employee_id: string
          end_hour: number
          id: string
          job_role_id: string | null
          schedule_id: string
          shift_date: string
          start_hour: number
        }
        Insert: {
          employee_id: string
          end_hour: number
          id?: string
          job_role_id?: string | null
          schedule_id: string
          shift_date: string
          start_hour: number
        }
        Update: {
          employee_id?: string
          end_hour?: number
          id?: string
          job_role_id?: string | null
          schedule_id?: string
          shift_date?: string
          start_hour?: number
        }
        Relationships: [
          {
            foreignKeyName: "shifts_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shifts_job_role_id_fkey"
            columns: ["job_role_id"]
            isOneToOne: false
            referencedRelation: "job_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shifts_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      staffing_rules: {
        Row: {
          created_at: string
          dow: number
          end_hour: number
          id: string
          job_role_id: string
          min_staff: number
          note: string | null
          start_hour: number
          week_start: string | null
        }
        Insert: {
          created_at?: string
          dow: number
          end_hour: number
          id?: string
          job_role_id: string
          min_staff: number
          note?: string | null
          start_hour: number
          week_start?: string | null
        }
        Update: {
          created_at?: string
          dow?: number
          end_hour?: number
          id?: string
          job_role_id?: string
          min_staff?: number
          note?: string | null
          start_hour?: number
          week_start?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staffing_rules_job_role_id_fkey"
            columns: ["job_role_id"]
            isOneToOne: false
            referencedRelation: "job_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      store_settings: {
        Row: {
          close_hour: number
          id: number
          open_hour: number
          setup_complete: boolean
          store_name: string
          updated_at: string
        }
        Insert: {
          close_hour?: number
          id?: number
          open_hour?: number
          setup_complete?: boolean
          store_name?: string
          updated_at?: string
        }
        Update: {
          close_hour?: number
          id?: number
          open_hour?: number
          setup_complete?: boolean
          store_name?: string
          updated_at?: string
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
      weekly_availability: {
        Row: {
          dow: number
          employee_id: string
          end_hour: number
          id: string
          start_hour: number
          week_start: string
        }
        Insert: {
          dow: number
          employee_id: string
          end_hour: number
          id?: string
          start_hour: number
          week_start: string
        }
        Update: {
          dow?: number
          employee_id?: string
          end_hour?: number
          id?: string
          start_hour?: number
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "weekly_availability_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      weekly_submissions: {
        Row: {
          employee_id: string
          id: string
          submitted_at: string
          week_start: string
        }
        Insert: {
          employee_id: string
          id?: string
          submitted_at?: string
          week_start: string
        }
        Update: {
          employee_id?: string
          id?: string
          submitted_at?: string
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "weekly_submissions_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
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
      my_employee_id: { Args: never; Returns: string }
      submit_week_availability: {
        Args: { _slots: Json; _week_start: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "manager" | "employee"
      emergency_status: "open" | "resolved" | "cancelled"
      emp_type: "full_time" | "part_time"
      request_status: "pending" | "approved" | "denied"
      schedule_status: "draft" | "published"
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
    Enums: {
      app_role: ["manager", "employee"],
      emergency_status: ["open", "resolved", "cancelled"],
      emp_type: ["full_time", "part_time"],
      request_status: ["pending", "approved", "denied"],
      schedule_status: ["draft", "published"],
    },
  },
} as const
