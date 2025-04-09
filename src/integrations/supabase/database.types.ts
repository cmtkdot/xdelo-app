
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      deleted_messages: {
        Row: {
          id: string
          original_message_id: string
          telegram_message_id: number | null
          message_caption_id: string | null
          analyzed_content: Json | null
          media_group_id: string | null
          caption: string | null
          file_id: string | null
          file_unique_id: string | null
          public_url: string | null
          deleted_from_telegram: boolean | null
          mime_type: string | null
          deletion_error: string | null
          user_id: string | null
          deleted_via_telegram: boolean | null
          deleted_at: string | null
          telegram_data: Json | null
        }
        Insert: {
          id?: string
          original_message_id: string
          telegram_message_id?: number | null
          message_caption_id?: string | null
          analyzed_content?: Json | null
          media_group_id?: string | null
          caption?: string | null
          file_id?: string | null
          file_unique_id?: string | null
          public_url?: string | null
          deleted_from_telegram?: boolean | null
          mime_type?: string | null
          deletion_error?: string | null
          user_id?: string | null
          deleted_via_telegram?: boolean | null
          deleted_at?: string | null
          telegram_data?: Json | null
        }
        Update: {
          id?: string
          original_message_id?: string
          telegram_message_id?: number | null
          message_caption_id?: string | null
          analyzed_content?: Json | null
          media_group_id?: string | null
          caption?: string | null
          file_id?: string | null
          file_unique_id?: string | null
          public_url?: string | null
          deleted_from_telegram?: boolean | null
          mime_type?: string | null
          deletion_error?: string | null
          user_id?: string | null
          deleted_via_telegram?: boolean | null
          deleted_at?: string | null
          telegram_data?: Json | null
        }
        Relationships: []
      }
      messages: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          telegram_data: Json | null
          telegram_message_id: number | null
          chat_id: number | null
          chat_type: string | null
          chat_title: string | null
          caption: string | null
          text: string | null
          file_id: string | null
          file_unique_id: string | null
          media_group_id: string | null
          public_url: string | null
          mime_type: string | null
          processing_state: string
          analyzed_content: Json | null
          correlation_id: string | null
          error_message: string | null
          retry_count: number | null
          message_caption_id: string | null
          is_original_caption: boolean | null
          group_caption_synced: boolean | null
          is_edited: boolean | null
          edit_date: string | null
          edit_history: Json | null
          edit_count: number | null
          storage_path: string | null
          product_name: string | null
          product_code: string | null
          vendor_uid: string | null
          purchase_date: string | null
          product_quantity: number | null
          notes: string | null
          message_url: string | null
          file_size: number | null
          width: number | null
          height: number | null
          duration: number | null
          is_forward: boolean | null
          original_message_id: string | null
          forward_count: number | null
          user_id: string | null
        }
        Insert: {
          // Insert type definitions
          id?: string
          created_at?: string
          updated_at?: string
          telegram_data?: Json | null
          // More insert fields
        }
        Update: {
          // Update type definitions
          id?: string
          created_at?: string
          updated_at?: string
          telegram_data?: Json | null
          // More update fields
        }
        Relationships: []
      }
      make_test_payloads: {
        Row: {
          id: string
          name: string
          description: string | null
          event_type: string
          payload: Json
          is_template: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          event_type: string
          payload: Json
          is_template: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          event_type?: string
          payload?: Json
          is_template?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      make_webhook_configs: {
        Row: {
          id: string
          name: string
          description: string | null
          url: string
          event_types: string[]
          is_active: boolean
          field_selection: Json | null
          payload_template: Json | null
          transformation_code: string | null
          headers: Json | null
          retry_config: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          url: string
          event_types: string[]
          is_active?: boolean
          field_selection?: Json | null
          payload_template?: Json | null
          transformation_code?: string | null
          headers?: Json | null
          retry_config?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          url?: string
          event_types?: string[]
          is_active?: boolean
          field_selection?: Json | null
          payload_template?: Json | null
          transformation_code?: string | null
          headers?: Json | null
          retry_config?: Json | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      gl_products: {
        Row: {
          id: string
          glide_id: string | null
          new_product_name: string | null
          vendor_product_name: string | null
          vendor_uid: string | null
          product_purchase_date: string | null
          created_at: string | null
          updated_at: string | null
          product_name_display: string | null
        }
        Insert: {
          id?: string
          glide_id?: string | null
          new_product_name?: string | null
          vendor_product_name?: string | null
          vendor_uid?: string | null
          product_purchase_date?: string | null
          created_at?: string | null
          updated_at?: string | null
          product_name_display?: string | null
        }
        Update: {
          id?: string
          glide_id?: string | null
          new_product_name?: string | null
          vendor_product_name?: string | null
          vendor_uid?: string | null
          product_purchase_date?: string | null
          created_at?: string | null
          updated_at?: string | null
          product_name_display?: string | null
        }
        Relationships: []
      }
      // Add other tables that appear in the errors
      migrations: {
        Row: {
          id: number
          name: string
          timestamp: number
        }
        Insert: {
          id?: number
          name: string
          timestamp: number
        }
        Update: {
          id?: number
          name?: string
          timestamp?: number
        }
        Relationships: []
      }
      n8_telegram_message: {
        Row: {
          id: number
          created_at: string
          message: string | null
          telegram_data: Json | null
        }
        Insert: {
          id: number
          created_at?: string
          message?: string | null
          telegram_data?: Json | null
        }
        Update: {
          id?: number
          created_at?: string
          message?: string | null
          telegram_data?: Json | null
        }
        Relationships: []
      }
      n8n_chat_histories: {
        Row: {
          id: number
          session_id: string
          message: Json
        }
        Insert: {
          id?: number
          session_id: string
          message: Json
        }
        Update: {
          id?: number
          session_id?: string
          message?: Json
        }
        Relationships: []
      }
      other_messages: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          // Add other fields as needed
        }
        Insert: {
          id?: string
          created_at?: string
          updated_at?: string
          // Add other fields as needed
        }
        Update: {
          id?: string
          created_at?: string
          updated_at?: string
          // Add other fields as needed
        }
        Relationships: []
      }
      product_matching_config: {
        Row: {
          id: string
          similarity_threshold: number
          partial_match_enabled: boolean
          partial_match_min_length: number | null
          partial_match_date_format: string | null
          weight_name: number | null
          weight_vendor: number | null
          weight_purchase_date: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          similarity_threshold: number
          partial_match_enabled: boolean
          partial_match_min_length?: number | null
          partial_match_date_format?: string | null
          weight_name?: number | null
          weight_vendor?: number | null
          weight_purchase_date?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          similarity_threshold?: number
          partial_match_enabled?: boolean
          partial_match_min_length?: number | null
          partial_match_date_format?: string | null
          weight_name?: number | null
          weight_vendor?: number | null
          weight_purchase_date?: number | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          id: string
          updated_at: string | null
          email: string | null
          created_at: string | null
        }
        Insert: {
          id: string
          updated_at?: string | null
          email?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          updated_at?: string | null
          email?: string | null
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      raw_product_entries: {
        Row: {
          id: string
          created_at: string | null
          audio_url: string | null
          processing_status: string | null
          updated_at: string | null
          needs_manual_review: boolean | null
          extracted_data: Json | null
        }
        Insert: {
          id?: string
          created_at?: string | null
          audio_url?: string | null
          processing_status?: string | null
          updated_at?: string | null
          needs_manual_review?: boolean | null
          extracted_data?: Json | null
        }
        Update: {
          id?: string
          created_at?: string | null
          audio_url?: string | null
          processing_status?: string | null
          updated_at?: string | null
          needs_manual_review?: boolean | null
          extracted_data?: Json | null
        }
        Relationships: []
      }
      settings: {
        Row: {
          id: string
          webhook_url: string | null
          bot_token: string | null
          product_matching_config: Json | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          webhook_url?: string | null
          bot_token?: string | null
          product_matching_config?: Json | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          webhook_url?: string | null
          bot_token?: string | null
          product_matching_config?: Json | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      sync_matches: {
        Row: {
          id: string
          message_id: string | null
          product_id: string | null
          confidence_score: number | null
          match_priority: number | null
          match_details: Json | null
          status: string | null
          applied: boolean | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          message_id?: string | null
          product_id?: string | null
          confidence_score?: number | null
          match_priority?: number | null
          match_details?: Json | null
          status?: string | null
          applied?: boolean | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          message_id?: string | null
          product_id?: string | null
          confidence_score?: number | null
          match_priority?: number | null
          match_details?: Json | null
          status?: string | null
          applied?: boolean | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      webhook_logs: {
        Row: {
          id: number
          created_at: string | null
        }
        Insert: {
          id: number
          created_at?: string | null
        }
        Update: {
          id?: number
          created_at?: string | null
        }
        Relationships: []
      }
      unified_audit_logs: {
        Row: {
          id: string
          event_timestamp: string
          event_type: string
          operation_type: string | null
          target_message_id: string | null
          source_message_id: string | null
          user_id: string | null
          metadata: Json | null
          new_state: Json | null
          previous_state: Json | null
          chat_id: number | null
          telegram_message_id: number | null
          correlation_id: string | null
          entity_id: string
          error_message: string | null
          message_type: string | null
        }
        Insert: {
          id?: string
          event_timestamp?: string
          event_type: string
          operation_type?: string | null
          target_message_id?: string | null
          source_message_id?: string | null
          user_id?: string | null
          metadata?: Json | null
          new_state?: Json | null
          previous_state?: Json | null
          chat_id?: number | null
          telegram_message_id?: number | null
          correlation_id?: string | null
          entity_id: string
          error_message?: string | null
          message_type?: string | null
        }
        Update: {
          id?: string
          event_timestamp?: string
          event_type?: string
          operation_type?: string | null
          target_message_id?: string | null
          source_message_id?: string | null
          user_id?: string | null
          metadata?: Json | null
          new_state?: Json | null
          previous_state?: Json | null
          chat_id?: number | null
          telegram_message_id?: number | null
          correlation_id?: string | null
          entity_id?: string
          error_message?: string | null
          message_type?: string | null
        }
        Relationships: []
      }
      // Add more tables as needed
    }
    Views: {
      messages_view: {
        Row: {
          id: string | null
          caption: string | null 
          // Add other fields as needed
        }
        Relationships: []
      }
      v_messages_compatibility: {
        Row: {
          id: string | null
          // Add other fields as needed
        }
        Relationships: []
      }
      gl_current_status: {
        Row: {
          category: string | null
          // Add other fields as needed
        }
        Relationships: []
      }
      gl_tables_view: {
        Row: {
          table_name: string | null
        }
        Relationships: []
      }
      pg_stat_statements: {
        Row: {
          query: string | null
          // Add other fields as needed
        }
        Relationships: []
      }
      pg_stat_statements_info: {
        Row: {
          dealloc: number | null
          stats_reset: string | null
        }
        Relationships: []
      }
      v_audit_log_stats: {
        Row: {
          event_type: string | null
          // Add other fields as needed
        }
        Relationships: []
      }
      v_function_operations: {
        Row: {
          event_type: string | null
          // Add other fields as needed
        }
        Relationships: []
      }
      v_media_group_consistency: {
        Row: {
          media_group_id: string | null
          // Add other fields as needed
        }
        Relationships: []
      }
      v_media_group_operations: {
        Row: {
          media_group_id: string | null
          // Add other fields as needed
        }
        Relationships: []
      }
      v_product_matching_history: {
        Row: {
          id: string | null
          // Add other fields as needed
        }
        Relationships: []
      }
    }
    Functions: {
      // Add functions if needed
    }
    Enums: {
      // Add enums if needed
    }
    CompositeTypes: {
      // Add composite types if needed
    }
  }
}

export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
export type Enums<T extends keyof Database['public']['Enums']> = Database['public']['Enums'][T]
