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
      analysis_audit_log: {
        Row: {
          analyzed_content: Json | null
          created_at: string | null
          event_type: string
          id: string
          media_group_id: string | null
          message_id: string | null
          new_state: string | null
          old_state: string | null
          processing_details: Json | null
        }
        Insert: {
          analyzed_content?: Json | null
          created_at?: string | null
          event_type: string
          id?: string
          media_group_id?: string | null
          message_id?: string | null
          new_state?: string | null
          old_state?: string | null
          processing_details?: Json | null
        }
        Update: {
          analyzed_content?: Json | null
          created_at?: string | null
          event_type?: string
          id?: string
          media_group_id?: string | null
          message_id?: string | null
          new_state?: string | null
          old_state?: string | null
          processing_details?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "analysis_audit_log_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          analyzed_content: Json | null
          caption: string | null
          chat_id: number | null
          chat_type: string | null
          created_at: string | null
          duration: number | null
          error_message: string | null
          file_id: string | null
          file_size: number | null
          file_unique_id: string | null
          group_caption_synced: boolean | null
          group_first_message_time: string | null
          group_last_message_time: string | null
          group_message_count: number | null
          height: number | null
          id: string
          is_original_caption: boolean | null
          media_group_id: string | null
          message_caption_id: string | null
          mime_type: string | null
          processing_completed_at: string | null
          processing_lock_acquired_at: string | null
          processing_lock_id: string | null
          processing_started_at: string | null
          processing_state:
            | Database["public"]["Enums"]["message_processing_state"]
            | null
          public_url: string | null
          storage_path: string | null
          telegram_data: Json | null
          telegram_message_id: number | null
          updated_at: string | null
          user_id: string
          width: number | null
        }
        Insert: {
          analyzed_content?: Json | null
          caption?: string | null
          chat_id?: number | null
          chat_type?: string | null
          created_at?: string | null
          duration?: number | null
          error_message?: string | null
          file_id?: string | null
          file_size?: number | null
          file_unique_id?: string | null
          group_caption_synced?: boolean | null
          group_first_message_time?: string | null
          group_last_message_time?: string | null
          group_message_count?: number | null
          height?: number | null
          id?: string
          is_original_caption?: boolean | null
          media_group_id?: string | null
          message_caption_id?: string | null
          mime_type?: string | null
          processing_completed_at?: string | null
          processing_lock_acquired_at?: string | null
          processing_lock_id?: string | null
          processing_started_at?: string | null
          processing_state?:
            | Database["public"]["Enums"]["message_processing_state"]
            | null
          public_url?: string | null
          storage_path?: string | null
          telegram_data?: Json | null
          telegram_message_id?: number | null
          updated_at?: string | null
          user_id: string
          width?: number | null
        }
        Update: {
          analyzed_content?: Json | null
          caption?: string | null
          chat_id?: number | null
          chat_type?: string | null
          created_at?: string | null
          duration?: number | null
          error_message?: string | null
          file_id?: string | null
          file_size?: number | null
          file_unique_id?: string | null
          group_caption_synced?: boolean | null
          group_first_message_time?: string | null
          group_last_message_time?: string | null
          group_message_count?: number | null
          height?: number | null
          id?: string
          is_original_caption?: boolean | null
          media_group_id?: string | null
          message_caption_id?: string | null
          mime_type?: string | null
          processing_completed_at?: string | null
          processing_lock_acquired_at?: string | null
          processing_lock_id?: string | null
          processing_started_at?: string | null
          processing_state?:
            | Database["public"]["Enums"]["message_processing_state"]
            | null
          public_url?: string | null
          storage_path?: string | null
          telegram_data?: Json | null
          telegram_message_id?: number | null
          updated_at?: string | null
          user_id?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_message_caption_id_fkey"
            columns: ["message_caption_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      other_messages: {
        Row: {
          chat_id: number | null
          chat_title: string | null
          chat_type: string | null
          created_at: string | null
          id: string
          message_text: string | null
          message_type: string
          processing_completed_at: string | null
          processing_state: string | null
          telegram_data: Json | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          chat_id?: number | null
          chat_title?: string | null
          chat_type?: string | null
          created_at?: string | null
          id?: string
          message_text?: string | null
          message_type: string
          processing_completed_at?: string | null
          processing_state?: string | null
          telegram_data?: Json | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          chat_id?: number | null
          chat_title?: string | null
          chat_type?: string | null
          created_at?: string | null
          id?: string
          message_text?: string | null
          message_type?: string
          processing_completed_at?: string | null
          processing_state?: string | null
          telegram_data?: Json | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string | null
          id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      bytea_to_text: {
        Args: {
          data: string
        }
        Returns: string
      }
      http: {
        Args: {
          request: Database["public"]["CompositeTypes"]["http_request"]
        }
        Returns: unknown
      }
      http_delete:
        | {
            Args: {
              uri: string
            }
            Returns: unknown
          }
        | {
            Args: {
              uri: string
              content: string
              content_type: string
            }
            Returns: unknown
          }
      http_get:
        | {
            Args: {
              uri: string
            }
            Returns: unknown
          }
        | {
            Args: {
              uri: string
              data: Json
            }
            Returns: unknown
          }
      http_head: {
        Args: {
          uri: string
        }
        Returns: unknown
      }
      http_header: {
        Args: {
          field: string
          value: string
        }
        Returns: Database["public"]["CompositeTypes"]["http_header"]
      }
      http_list_curlopt: {
        Args: Record<PropertyKey, never>
        Returns: {
          curlopt: string
          value: string
        }[]
      }
      http_patch: {
        Args: {
          uri: string
          content: string
          content_type: string
        }
        Returns: unknown
      }
      http_post:
        | {
            Args: {
              uri: string
              content: string
              content_type: string
            }
            Returns: unknown
          }
        | {
            Args: {
              uri: string
              data: Json
            }
            Returns: unknown
          }
        | {
            Args: {
              url: string
              headers: Json
              body: Json
            }
            Returns: unknown
          }
      http_put: {
        Args: {
          uri: string
          content: string
          content_type: string
        }
        Returns: unknown
      }
      http_reset_curlopt: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      http_set_curlopt: {
        Args: {
          curlopt: string
          value: string
        }
        Returns: boolean
      }
      process_media_group_analysis: {
        Args: {
          p_message_id: string
          p_media_group_id: string
          p_analyzed_content: Json
          p_processing_completed_at: string
          p_correlation_id?: string
        }
        Returns: undefined
      }
      text_to_bytea: {
        Args: {
          data: string
        }
        Returns: string
      }
      urlencode:
        | {
            Args: {
              data: Json
            }
            Returns: string
          }
        | {
            Args: {
              string: string
            }
            Returns: string
          }
        | {
            Args: {
              string: string
            }
            Returns: string
          }
    }
    Enums: {
      message_processing_state:
        | "initialized"
        | "pending"
        | "processing"
        | "completed"
        | "error"
    }
    CompositeTypes: {
      http_header: {
        field: string | null
        value: string | null
      }
      http_request: {
        method: unknown | null
        uri: string | null
        headers: Database["public"]["CompositeTypes"]["http_header"][] | null
        content_type: string | null
        content: string | null
      }
      http_response: {
        status: number | null
        content_type: string | null
        headers: Database["public"]["CompositeTypes"]["http_header"][] | null
        content: string | null
      }
    }
  }
}

type PublicSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema["Tables"] & PublicSchema["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (PublicSchema["Tables"] &
        PublicSchema["Views"])
    ? (PublicSchema["Tables"] &
        PublicSchema["Views"])[PublicTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof PublicSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema["Enums"]
    ? PublicSchema["Enums"][PublicEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof PublicSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof PublicSchema["CompositeTypes"]
    ? PublicSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never
