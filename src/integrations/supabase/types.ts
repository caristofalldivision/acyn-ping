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
      calendar_events: {
        Row: {
          attendees: string[] | null
          created_at: string | null
          description: string | null
          end_time: string | null
          event_type: string | null
          id: string
          location: string | null
          reminder_minutes: number | null
          start_time: string
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          attendees?: string[] | null
          created_at?: string | null
          description?: string | null
          end_time?: string | null
          event_type?: string | null
          id?: string
          location?: string | null
          reminder_minutes?: number | null
          start_time: string
          title: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          attendees?: string[] | null
          created_at?: string | null
          description?: string | null
          end_time?: string | null
          event_type?: string | null
          id?: string
          location?: string | null
          reminder_minutes?: number | null
          start_time?: string
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          role: string
          user_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_conversation"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_scan_status: {
        Row: {
          conversation_id: string
          created_at: string | null
          id: string
          last_scanned_at: string | null
          last_scanned_message_id: string | null
          message_count_at_scan: number
          user_id: string
        }
        Insert: {
          conversation_id: string
          created_at?: string | null
          id?: string
          last_scanned_at?: string | null
          last_scanned_message_id?: string | null
          message_count_at_scan?: number
          user_id: string
        }
        Update: {
          conversation_id?: string
          created_at?: string | null
          id?: string
          last_scanned_at?: string | null
          last_scanned_message_id?: string | null
          message_count_at_scan?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_scan_status_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: true
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string
          id: string
          is_archived: boolean
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_archived?: boolean
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_archived?: boolean
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      device_agents: {
        Row: {
          agent_secret_hash: string | null
          created_at: string
          id: string
          last_seen_at: string | null
          name: string
          pairing_code: string | null
          pairing_code_expires_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          agent_secret_hash?: string | null
          created_at?: string
          id?: string
          last_seen_at?: string | null
          name?: string
          pairing_code?: string | null
          pairing_code_expires_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          agent_secret_hash?: string | null
          created_at?: string
          id?: string
          last_seen_at?: string | null
          name?: string
          pairing_code?: string | null
          pairing_code_expires_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      device_jobs: {
        Row: {
          created_at: string
          device_id: string
          error: string | null
          finished_at: string | null
          id: string
          kind: string
          output_log: string | null
          script_content: string | null
          started_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          device_id: string
          error?: string | null
          finished_at?: string | null
          id?: string
          kind: string
          output_log?: string | null
          script_content?: string | null
          started_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          device_id?: string
          error?: string | null
          finished_at?: string | null
          id?: string
          kind?: string
          output_log?: string | null
          script_content?: string | null
          started_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "device_jobs_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
        ]
      }
      devices: {
        Row: {
          agent_id: string | null
          connection_method: string
          created_at: string
          credential_encrypted: string | null
          host: string | null
          id: string
          last_connected_at: string | null
          model: string | null
          name: string
          port: number | null
          routeros_version: string | null
          status: string
          updated_at: string
          user_id: string
          username: string | null
          vendor: string
        }
        Insert: {
          agent_id?: string | null
          connection_method?: string
          created_at?: string
          credential_encrypted?: string | null
          host?: string | null
          id?: string
          last_connected_at?: string | null
          model?: string | null
          name: string
          port?: number | null
          routeros_version?: string | null
          status?: string
          updated_at?: string
          user_id: string
          username?: string | null
          vendor?: string
        }
        Update: {
          agent_id?: string | null
          connection_method?: string
          created_at?: string
          credential_encrypted?: string | null
          host?: string | null
          id?: string
          last_connected_at?: string | null
          model?: string | null
          name?: string
          port?: number | null
          routeros_version?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          username?: string | null
          vendor?: string
        }
        Relationships: [
          {
            foreignKeyName: "devices_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "device_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_history: {
        Row: {
          changed_at: string
          id: string
          knowledge_id: string
          new_value: string
          old_value: string
          reason: string | null
        }
        Insert: {
          changed_at?: string
          id?: string
          knowledge_id: string
          new_value: string
          old_value: string
          reason?: string | null
        }
        Update: {
          changed_at?: string
          id?: string
          knowledge_id?: string
          new_value?: string
          old_value?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_history_knowledge_id_fkey"
            columns: ["knowledge_id"]
            isOneToOne: false
            referencedRelation: "learned_knowledge"
            referencedColumns: ["id"]
          },
        ]
      }
      learned_knowledge: {
        Row: {
          category: Database["public"]["Enums"]["knowledge_category"]
          confidence: Database["public"]["Enums"]["knowledge_confidence"]
          id: string
          importance_score: number
          is_active: boolean
          key: string
          learned_at: string
          source_conversation_id: string | null
          updated_at: string
          user_approved: boolean | null
          user_id: string
          value: string
          version: number
        }
        Insert: {
          category: Database["public"]["Enums"]["knowledge_category"]
          confidence: Database["public"]["Enums"]["knowledge_confidence"]
          id?: string
          importance_score?: number
          is_active?: boolean
          key: string
          learned_at?: string
          source_conversation_id?: string | null
          updated_at?: string
          user_approved?: boolean | null
          user_id: string
          value: string
          version?: number
        }
        Update: {
          category?: Database["public"]["Enums"]["knowledge_category"]
          confidence?: Database["public"]["Enums"]["knowledge_confidence"]
          id?: string
          importance_score?: number
          is_active?: boolean
          key?: string
          learned_at?: string
          source_conversation_id?: string | null
          updated_at?: string
          user_approved?: boolean | null
          user_id?: string
          value?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "learned_knowledge_source_conversation_id_fkey"
            columns: ["source_conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_sessions: {
        Row: {
          analyzed_messages_count: number
          id: string
          new_knowledge_count: number
          run_at: string
          status: string
          updated_knowledge_count: number
          user_id: string
        }
        Insert: {
          analyzed_messages_count?: number
          id?: string
          new_knowledge_count?: number
          run_at?: string
          status?: string
          updated_knowledge_count?: number
          user_id: string
        }
        Update: {
          analyzed_messages_count?: number
          id?: string
          new_knowledge_count?: number
          run_at?: string
          status?: string
          updated_knowledge_count?: number
          user_id?: string
        }
        Relationships: []
      }
      message_logs: {
        Row: {
          body: string
          created_at: string | null
          error_message: string | null
          id: string
          message_type: string
          recipient: string
          sent_at: string | null
          status: string | null
          subject: string | null
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string | null
          error_message?: string | null
          id?: string
          message_type: string
          recipient: string
          sent_at?: string | null
          status?: string | null
          subject?: string | null
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string | null
          error_message?: string | null
          id?: string
          message_type?: string
          recipient?: string
          sent_at?: string | null
          status?: string | null
          subject?: string | null
          user_id?: string
        }
        Relationships: []
      }
      saved_scripts: {
        Row: {
          category: string
          created_at: string | null
          description: string | null
          form_values: Json | null
          id: string
          script_content: string
          template_id: string | null
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          category?: string
          created_at?: string | null
          description?: string | null
          form_values?: Json | null
          id?: string
          script_content: string
          template_id?: string | null
          title: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string | null
          description?: string | null
          form_values?: Json | null
          id?: string
          script_content?: string
          template_id?: string | null
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_contacts: {
        Row: {
          created_at: string | null
          email: string | null
          id: string
          name: string
          phone: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_knowledge: {
        Row: {
          category: string
          created_at: string
          id: string
          key: string
          updated_at: string
          user_id: string
          value: string
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          key: string
          updated_at?: string
          user_id: string
          value: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          key?: string
          updated_at?: string
          user_id?: string
          value?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_background_learning_status: {
        Args: never
        Returns: {
          active: boolean
          command: string
          jobid: number
          schedule: string
        }[]
      }
      trigger_background_learning: { Args: never; Returns: number }
    }
    Enums: {
      knowledge_category:
        | "facts"
        | "preferences"
        | "skills"
        | "goals"
        | "patterns"
        | "context"
      knowledge_confidence: "high" | "medium" | "low"
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
      knowledge_category: [
        "facts",
        "preferences",
        "skills",
        "goals",
        "patterns",
        "context",
      ],
      knowledge_confidence: ["high", "medium", "low"],
    },
  },
} as const
