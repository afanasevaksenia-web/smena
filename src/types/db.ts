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
      assignments: {
        Row: {
          actual_arrival: string | null
          actual_departure: string | null
          actual_work_stop: string | null
          call_time: string | null
          contact_id: string
          created_at: string
          id: string
          notes: string | null
          planned_wrap: string | null
          shift_id: string
          updated_at: string
        }
        Insert: {
          actual_arrival?: string | null
          actual_departure?: string | null
          actual_work_stop?: string | null
          call_time?: string | null
          contact_id: string
          created_at?: string
          id?: string
          notes?: string | null
          planned_wrap?: string | null
          shift_id: string
          updated_at?: string
        }
        Update: {
          actual_arrival?: string | null
          actual_departure?: string | null
          actual_work_stop?: string | null
          call_time?: string | null
          contact_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          planned_wrap?: string | null
          shift_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignments_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      board_events: {
        Row: {
          author_id: string
          client_op_id: string | null
          created_at: string
          id: string
          payload: Json
          project_id: string
          shift_id: string
          text: string
          type: Database["public"]["Enums"]["board_event_type"]
        }
        Insert: {
          author_id: string
          client_op_id?: string | null
          created_at?: string
          id?: string
          payload?: Json
          project_id: string
          shift_id: string
          text: string
          type: Database["public"]["Enums"]["board_event_type"]
        }
        Update: {
          author_id?: string
          client_op_id?: string | null
          created_at?: string
          id?: string
          payload?: Json
          project_id?: string
          shift_id?: string
          text?: string
          type?: Database["public"]["Enums"]["board_event_type"]
        }
        Relationships: [
          {
            foreignKeyName: "board_events_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "board_events_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      channels: {
        Row: {
          created_at: string
          department: string | null
          id: string
          name: string
          project_id: string
          scene_id: string | null
          type: Database["public"]["Enums"]["channel_type"]
        }
        Insert: {
          created_at?: string
          department?: string | null
          id?: string
          name: string
          project_id: string
          scene_id?: string | null
          type: Database["public"]["Enums"]["channel_type"]
        }
        Update: {
          created_at?: string
          department?: string | null
          id?: string
          name?: string
          project_id?: string
          scene_id?: string | null
          type?: Database["public"]["Enums"]["channel_type"]
        }
        Relationships: [
          {
            foreignKeyName: "channels_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channels_scene_id_fkey"
            columns: ["scene_id"]
            isOneToOne: false
            referencedRelation: "scenes"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          archived: boolean
          category: Database["public"]["Enums"]["contact_category"]
          created_at: string
          department: string | null
          full_name: string
          id: string
          linked_user_id: string | null
          phone: string | null
          project_id: string
          updated_at: string
        }
        Insert: {
          archived?: boolean
          category: Database["public"]["Enums"]["contact_category"]
          created_at?: string
          department?: string | null
          full_name: string
          id?: string
          linked_user_id?: string | null
          phone?: string | null
          project_id: string
          updated_at?: string
        }
        Update: {
          archived?: boolean
          category?: Database["public"]["Enums"]["contact_category"]
          created_at?: string
          department?: string | null
          full_name?: string
          id?: string
          linked_user_id?: string | null
          phone?: string | null
          project_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      invites: {
        Row: {
          code: string
          created_at: string
          created_by: string
          expires_at: string
          id: string
          max_uses: number
          project_id: string
          revoked_at: string | null
          role: Database["public"]["Enums"]["project_role"]
          uses_count: number
        }
        Insert: {
          code: string
          created_at?: string
          created_by: string
          expires_at: string
          id?: string
          max_uses?: number
          project_id: string
          revoked_at?: string | null
          role?: Database["public"]["Enums"]["project_role"]
          uses_count?: number
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string
          expires_at?: string
          id?: string
          max_uses?: number
          project_id?: string
          revoked_at?: string | null
          role?: Database["public"]["Enums"]["project_role"]
          uses_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "invites_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      join_attempts: {
        Row: {
          attempted_code: string
          created_at: string
          id: number
          success: boolean
          user_id: string
        }
        Insert: {
          attempted_code: string
          created_at?: string
          id?: never
          success: boolean
          user_id: string
        }
        Update: {
          attempted_code?: string
          created_at?: string
          id?: never
          success?: boolean
          user_id?: string
        }
        Relationships: []
      }
      kpp_days: {
        Row: {
          created_at: string
          date: string
          id: string
          location_id: string | null
          notes: string | null
          project_id: string
          shift_id: string | null
          type: Database["public"]["Enums"]["kpp_day_type"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          location_id?: string | null
          notes?: string | null
          project_id: string
          shift_id?: string | null
          type: Database["public"]["Enums"]["kpp_day_type"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          location_id?: string | null
          notes?: string | null
          project_id?: string
          shift_id?: string | null
          type?: Database["public"]["Enums"]["kpp_day_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kpp_days_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kpp_days_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kpp_days_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          address: string | null
          created_at: string
          directions: string | null
          group_name: string | null
          id: string
          name: string
          notes: string | null
          parking: string | null
          project_id: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          directions?: string | null
          group_name?: string | null
          id?: string
          name: string
          notes?: string | null
          parking?: string | null
          project_id: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          directions?: string | null
          group_name?: string | null
          id?: string
          name?: string
          notes?: string | null
          parking?: string | null
          project_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "locations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      member_shift_status: {
        Row: {
          shift_id: string
          status: Database["public"]["Enums"]["member_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          shift_id: string
          status?: Database["public"]["Enums"]["member_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          shift_id?: string
          status?: Database["public"]["Enums"]["member_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_shift_status_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          author_id: string
          channel_id: string
          client_op_id: string
          created_at: string
          deleted_at: string | null
          edited_at: string | null
          id: string
          reply_to_id: string | null
          text: string
        }
        Insert: {
          author_id: string
          channel_id: string
          client_op_id: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          reply_to_id?: string | null
          text: string
        }
        Update: {
          author_id?: string
          channel_id?: string
          client_op_id?: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          reply_to_id?: string | null
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string
          id: string
        }
        Insert: {
          created_at?: string
          display_name?: string
          id: string
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
        }
        Relationships: []
      }
      project_members: {
        Row: {
          display_name: string
          joined_at: string
          project_id: string
          role: Database["public"]["Enums"]["project_role"]
          status: string
          user_id: string
        }
        Insert: {
          display_name: string
          joined_at?: string
          project_id: string
          role?: Database["public"]["Enums"]["project_role"]
          status?: string
          user_id: string
        }
        Update: {
          display_name?: string
          joined_at?: string
          project_id?: string
          role?: Database["public"]["Enums"]["project_role"]
          status?: string
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
          created_at: string
          created_by: string
          current_shift_id: string | null
          first_shift_date: string | null
          id: string
          location_name: string | null
          name: string
          settings: Json
          status: Database["public"]["Enums"]["project_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          current_shift_id?: string | null
          first_shift_date?: string | null
          id?: string
          location_name?: string | null
          name: string
          settings?: Json
          status?: Database["public"]["Enums"]["project_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          current_shift_id?: string | null
          first_shift_date?: string | null
          id?: string
          location_name?: string | null
          name?: string
          settings?: Json
          status?: Database["public"]["Enums"]["project_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_projects_current_shift"
            columns: ["current_shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      scenes: {
        Row: {
          characters: string[]
          created_at: string
          day_night: string | null
          deleted_at: string | null
          episode: string | null
          full_text: string | null
          id: string
          int_ext: string | null
          location_id: string | null
          location_text: string | null
          order_hint: number
          project_id: string
          scene_number: string
          scheduled_time: string | null
          shift_id: string | null
          shot: boolean
          shot_at: string | null
          source: string
          stable_key: string
          synopsis: string | null
          updated_at: string
        }
        Insert: {
          characters?: string[]
          created_at?: string
          day_night?: string | null
          deleted_at?: string | null
          episode?: string | null
          full_text?: string | null
          id?: string
          int_ext?: string | null
          location_id?: string | null
          location_text?: string | null
          order_hint?: number
          project_id: string
          scene_number: string
          scheduled_time?: string | null
          shift_id?: string | null
          shot?: boolean
          shot_at?: string | null
          source?: string
          stable_key: string
          synopsis?: string | null
          updated_at?: string
        }
        Update: {
          characters?: string[]
          created_at?: string
          day_night?: string | null
          deleted_at?: string | null
          episode?: string | null
          full_text?: string | null
          id?: string
          int_ext?: string | null
          location_id?: string | null
          location_text?: string | null
          order_hint?: number
          project_id?: string
          scene_number?: string
          scheduled_time?: string | null
          shift_id?: string | null
          shot?: boolean
          shot_at?: string | null
          source?: string
          stable_key?: string
          synopsis?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scenes_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scenes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scenes_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_status_log: {
        Row: {
          changed_at: string
          changed_by: string
          id: number
          shift_id: string
          status: Database["public"]["Enums"]["shift_status"]
        }
        Insert: {
          changed_at?: string
          changed_by: string
          id?: never
          shift_id: string
          status: Database["public"]["Enums"]["shift_status"]
        }
        Update: {
          changed_at?: string
          changed_by?: string
          id?: never
          shift_id?: string
          status?: Database["public"]["Enums"]["shift_status"]
        }
        Relationships: [
          {
            foreignKeyName: "shift_status_log_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      shifts: {
        Row: {
          call_time: string | null
          created_at: string
          created_by: string
          id: string
          location_id: string | null
          lunch_time: string | null
          notes: string | null
          overtime_basis: string
          planned_wrap: string | null
          project_id: string
          shift_date: string
          shift_number: number
          status: Database["public"]["Enums"]["shift_status"]
          status_changed_at: string
          status_changed_by: string | null
          timezone: string
          updated_at: string
        }
        Insert: {
          call_time?: string | null
          created_at?: string
          created_by: string
          id?: string
          location_id?: string | null
          lunch_time?: string | null
          notes?: string | null
          overtime_basis?: string
          planned_wrap?: string | null
          project_id: string
          shift_date: string
          shift_number: number
          status?: Database["public"]["Enums"]["shift_status"]
          status_changed_at?: string
          status_changed_by?: string | null
          timezone?: string
          updated_at?: string
        }
        Update: {
          call_time?: string | null
          created_at?: string
          created_by?: string
          id?: string
          location_id?: string | null
          lunch_time?: string | null
          notes?: string | null
          overtime_basis?: string
          planned_wrap?: string | null
          project_id?: string
          shift_date?: string
          shift_number?: number
          status?: Database["public"]["Enums"]["shift_status"]
          status_changed_at?: string
          status_changed_by?: string | null
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shifts_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shifts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      time_edit_log: {
        Row: {
          assignment_id: string
          edited_at: string
          edited_by: string
          field: string
          id: number
          new_value: string | null
          old_value: string | null
          reason: string | null
        }
        Insert: {
          assignment_id: string
          edited_at?: string
          edited_by: string
          field: string
          id?: never
          new_value?: string | null
          old_value?: string | null
          reason?: string | null
        }
        Update: {
          assignment_id?: string
          edited_at?: string
          edited_by?: string
          field?: string
          id?: never
          new_value?: string | null
          old_value?: string | null
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "time_edit_log_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      assignment_shift: { Args: { p_assignment: string }; Returns: string }
      channel_project: { Args: { p_channel: string }; Returns: string }
      create_invite: {
        Args: {
          p_max_uses?: number
          p_project: string
          p_role?: Database["public"]["Enums"]["project_role"]
          p_ttl_hours?: number
        }
        Returns: {
          code: string
          created_at: string
          created_by: string
          expires_at: string
          id: string
          max_uses: number
          project_id: string
          revoked_at: string | null
          role: Database["public"]["Enums"]["project_role"]
          uses_count: number
        }
      }
      create_project: {
        Args: {
          p_display_name: string
          p_first_shift_date: string
          p_location_name: string
          p_name: string
        }
        Returns: {
          created_at: string
          created_by: string
          current_shift_id: string | null
          first_shift_date: string | null
          id: string
          location_name: string | null
          name: string
          settings: Json
          status: Database["public"]["Enums"]["project_status"]
          updated_at: string
        }
      }
      generate_invite_code: { Args: Record<string, never>; Returns: string }
      is_project_member: {
        Args: {
          p_min_role?: Database["public"]["Enums"]["project_role"]
          p_project: string
        }
        Returns: boolean
      }
      redeem_invite: {
        Args: { p_code: string; p_display_name: string }
        Returns: Json
      }
      remove_member: {
        Args: { p_project: string; p_user: string }
        Returns: undefined
      }
      revoke_invite: { Args: { p_invite: string }; Returns: undefined }
      role_rank: {
        Args: { r: Database["public"]["Enums"]["project_role"] }
        Returns: number
      }
      set_assignment_time: {
        Args: {
          p_assignment: string
          p_field: string
          p_reason?: string
          p_value: string
        }
        Returns: {
          actual_arrival: string | null
          actual_departure: string | null
          actual_work_stop: string | null
          call_time: string | null
          contact_id: string
          created_at: string
          id: string
          notes: string | null
          planned_wrap: string | null
          shift_id: string
          updated_at: string
        }
      }
      set_member_role: {
        Args: {
          p_project: string
          p_role: Database["public"]["Enums"]["project_role"]
          p_user: string
        }
        Returns: undefined
      }
      set_my_shift_status: {
        Args: {
          p_shift: string
          p_status: Database["public"]["Enums"]["member_status"]
        }
        Returns: undefined
      }
      set_shift_status: {
        Args: {
          p_shift: string
          p_status: Database["public"]["Enums"]["shift_status"]
        }
        Returns: {
          call_time: string | null
          created_at: string
          created_by: string
          id: string
          location_id: string | null
          lunch_time: string | null
          notes: string | null
          overtime_basis: string
          planned_wrap: string | null
          project_id: string
          shift_date: string
          shift_number: number
          status: Database["public"]["Enums"]["shift_status"]
          status_changed_at: string
          status_changed_by: string | null
          timezone: string
          updated_at: string
        }
      }
      shift_project: { Args: { p_shift: string }; Returns: string }
    }
    Enums: {
      board_event_type: "note" | "change" | "lunch" | "weather"
      channel_type: "general" | "department" | "scene"
      contact_category: "crew" | "actor" | "transport"
      kpp_day_type: "съёмка" | "снято" | "выходной" | "отсыпной"
      member_status: "not_seen" | "seen" | "on_way" | "on_site"
      project_role: "owner" | "coordinator" | "member"
      project_status: "active" | "archived"
      shift_status: "подготовка" | "мотор" | "обед" | "стоп"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database["public"]

export type Tables<T extends keyof DefaultSchema["Tables"]> = DefaultSchema["Tables"][T]["Row"]
export type TablesInsert<T extends keyof DefaultSchema["Tables"]> = DefaultSchema["Tables"][T]["Insert"]
export type TablesUpdate<T extends keyof DefaultSchema["Tables"]> = DefaultSchema["Tables"][T]["Update"]
export type Enums<T extends keyof DefaultSchema["Enums"]> = DefaultSchema["Enums"][T]
