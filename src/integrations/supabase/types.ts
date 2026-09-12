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
      app_settings: {
        Row: {
          bot_engine: string
          created_at: string
          id: string
          instansi_name: string
          jam_buka: string
          jam_tutup: string
          logo_url: string | null
          updated_at: string
        }
        Insert: {
          bot_engine?: string
          created_at?: string
          id?: string
          instansi_name?: string
          jam_buka?: string
          jam_tutup?: string
          logo_url?: string | null
          updated_at?: string
        }
        Update: {
          bot_engine?: string
          created_at?: string
          id?: string
          instansi_name?: string
          jam_buka?: string
          jam_tutup?: string
          logo_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      bot_menus: {
        Row: {
          body: string
          category: string
          created_at: string
          emoji: string
          id: string
          is_active: boolean
          key: string
          label: string
          parent_id: string | null
          path: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          body?: string
          category?: string
          created_at?: string
          emoji?: string
          id?: string
          is_active?: boolean
          key?: string
          label?: string
          parent_id?: string | null
          path: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          body?: string
          category?: string
          created_at?: string
          emoji?: string
          id?: string
          is_active?: boolean
          key?: string
          label?: string
          parent_id?: string | null
          path?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bot_menus_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "bot_menus"
            referencedColumns: ["id"]
          },
        ]
      }
      chatera_messages: {
        Row: {
          channel_id: string | null
          content_text: string | null
          conversation_id: string | null
          delivery_id: string
          direction: string
          event_timestamp: string | null
          event_type: string
          id: string
          message_id: string | null
          received_at: string
          sender_name: string | null
          sender_phone: string | null
        }
        Insert: {
          channel_id?: string | null
          content_text?: string | null
          conversation_id?: string | null
          delivery_id: string
          direction?: string
          event_timestamp?: string | null
          event_type: string
          id?: string
          message_id?: string | null
          received_at?: string
          sender_name?: string | null
          sender_phone?: string | null
        }
        Update: {
          channel_id?: string | null
          content_text?: string | null
          conversation_id?: string | null
          delivery_id?: string
          direction?: string
          event_timestamp?: string | null
          event_type?: string
          id?: string
          message_id?: string | null
          received_at?: string
          sender_name?: string | null
          sender_phone?: string | null
        }
        Relationships: []
      }
      contacts: {
        Row: {
          channel_id: string | null
          chatera_contact_id: string | null
          created_at: string
          email: string | null
          id: string
          name: string | null
          updated_at: string
          wa_number: string | null
        }
        Insert: {
          channel_id?: string | null
          chatera_contact_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string | null
          updated_at?: string
          wa_number?: string | null
        }
        Update: {
          channel_id?: string | null
          chatera_contact_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string | null
          updated_at?: string
          wa_number?: string | null
        }
        Relationships: []
      }
      conversation_status_events: {
        Row: {
          actor: string | null
          assignee_chatera_id: string | null
          chatera_conversation_id: string | null
          conversation_id: string | null
          created_at: string
          from_status: string | null
          id: string
          source: string
          to_status: string | null
        }
        Insert: {
          actor?: string | null
          assignee_chatera_id?: string | null
          chatera_conversation_id?: string | null
          conversation_id?: string | null
          created_at?: string
          from_status?: string | null
          id?: string
          source?: string
          to_status?: string | null
        }
        Update: {
          actor?: string | null
          assignee_chatera_id?: string | null
          chatera_conversation_id?: string | null
          conversation_id?: string | null
          created_at?: string
          from_status?: string | null
          id?: string
          source?: string
          to_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversation_status_events_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          agent_name: string | null
          agent_user_id: string | null
          assigned_agent_chatera_id: string | null
          awaiting_operator_confirmation: boolean
          chatera_conversation_id: string | null
          contact_id: string | null
          created_at: string
          current_menu_path: string | null
          id: string
          last_message_at: string
          status: Database["public"]["Enums"]["conversation_status"]
          survey_sent_at: string | null
        }
        Insert: {
          agent_name?: string | null
          agent_user_id?: string | null
          assigned_agent_chatera_id?: string | null
          awaiting_operator_confirmation?: boolean
          chatera_conversation_id?: string | null
          contact_id?: string | null
          created_at?: string
          current_menu_path?: string | null
          id?: string
          last_message_at?: string
          status?: Database["public"]["Enums"]["conversation_status"]
          survey_sent_at?: string | null
        }
        Update: {
          agent_name?: string | null
          agent_user_id?: string | null
          assigned_agent_chatera_id?: string | null
          awaiting_operator_confirmation?: boolean
          chatera_conversation_id?: string | null
          contact_id?: string | null
          created_at?: string
          current_menu_path?: string | null
          id?: string
          last_message_at?: string
          status?: Database["public"]["Enums"]["conversation_status"]
          survey_sent_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversations_agent_user_id_fkey"
            columns: ["agent_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_base: {
        Row: {
          answer: string
          category: string
          created_at: string
          id: string
          is_active: boolean
          keywords: string[]
          source_document_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          answer?: string
          category?: string
          created_at?: string
          id?: string
          is_active?: boolean
          keywords?: string[]
          source_document_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          answer?: string
          category?: string
          created_at?: string
          id?: string
          is_active?: boolean
          keywords?: string[]
          source_document_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_base_source_document_id_fkey"
            columns: ["source_document_id"]
            isOneToOne: false
            referencedRelation: "knowledge_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_documents: {
        Row: {
          category: string
          created_at: string
          entries_created: number
          error_message: string | null
          file_name: string
          file_type: string
          id: string
          status: Database["public"]["Enums"]["knowledge_document_status"]
          storage_path: string
        }
        Insert: {
          category?: string
          created_at?: string
          entries_created?: number
          error_message?: string | null
          file_name: string
          file_type: string
          id?: string
          status?: Database["public"]["Enums"]["knowledge_document_status"]
          storage_path: string
        }
        Update: {
          category?: string
          created_at?: string
          entries_created?: number
          error_message?: string | null
          file_name?: string
          file_type?: string
          id?: string
          status?: Database["public"]["Enums"]["knowledge_document_status"]
          storage_path?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          agent_name: string | null
          agent_user_id: string | null
          chatera_message_id: string | null
          content: Json
          content_type: string
          conversation_id: string | null
          created_at: string
          direction: string
          id: string
          matched_knowledge_category: string | null
          sender_type: Database["public"]["Enums"]["message_sender_type"]
          status: string | null
          whatsapp_message_id: string | null
        }
        Insert: {
          agent_name?: string | null
          agent_user_id?: string | null
          chatera_message_id?: string | null
          content?: Json
          content_type?: string
          conversation_id?: string | null
          created_at?: string
          direction?: string
          id?: string
          matched_knowledge_category?: string | null
          sender_type?: Database["public"]["Enums"]["message_sender_type"]
          status?: string | null
          whatsapp_message_id?: string | null
        }
        Update: {
          agent_name?: string | null
          agent_user_id?: string | null
          chatera_message_id?: string | null
          content?: Json
          content_type?: string
          conversation_id?: string | null
          created_at?: string
          direction?: string
          id?: string
          matched_knowledge_category?: string | null
          sender_type?: Database["public"]["Enums"]["message_sender_type"]
          status?: string | null
          whatsapp_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_agent_user_id_fkey"
            columns: ["agent_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string
          email: string
          full_name: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          created_at?: string
          email?: string
          full_name?: string
          id: string
          role?: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: []
      }
      webhook_deliveries: {
        Row: {
          delivery_id: string
          event: string
          id: string
          processed_at: string
        }
        Insert: {
          delivery_id: string
          event: string
          id?: string
          processed_at?: string
        }
        Update: {
          delivery_id?: string
          event?: string
          id?: string
          processed_at?: string
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
      app_role: "owner" | "admin"
      conversation_status:
        | "bot_active"
        | "waiting_agent"
        | "agent_active"
        | "closed"
      knowledge_document_status: "processing" | "done" | "failed"
      message_sender_type: "user" | "bot" | "agent"
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
      app_role: ["owner", "admin"],
      conversation_status: [
        "bot_active",
        "waiting_agent",
        "agent_active",
        "closed",
      ],
      knowledge_document_status: ["processing", "done", "failed"],
      message_sender_type: ["user", "bot", "agent"],
    },
  },
} as const
