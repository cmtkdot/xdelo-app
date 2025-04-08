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
      deleted_messages: {
        Row: {
          analyzed_content: Json | null
          caption: string | null
          deleted_at: string | null
          deleted_from_telegram: boolean | null
          deleted_via_telegram: boolean | null
          deletion_error: string | null
          file_id: string | null
          file_unique_id: string | null
          id: string
          media_group_id: string | null
          message_caption_id: string | null
          mime_type: string | null
          original_message_id: string
          public_url: string | null
          telegram_data: Json | null
          telegram_message_id: number | null
          user_id: string | null
        }
        Insert: {
          analyzed_content?: Json | null
          caption?: string | null
          deleted_at?: string | null
          deleted_from_telegram?: boolean | null
          deleted_via_telegram?: boolean | null
          deletion_error?: string | null
          file_id?: string | null
          file_unique_id?: string | null
          id?: string
          media_group_id?: string | null
          message_caption_id?: string | null
          mime_type?: string | null
          original_message_id: string
          public_url?: string | null
          telegram_data?: Json | null
          telegram_message_id?: number | null
          user_id?: string | null
        }
        Update: {
          analyzed_content?: Json | null
          caption?: string | null
          deleted_at?: string | null
          deleted_from_telegram?: boolean | null
          deleted_via_telegram?: boolean | null
          deletion_error?: string | null
          file_id?: string | null
          file_unique_id?: string | null
          id?: string
          media_group_id?: string | null
          message_caption_id?: string | null
          mime_type?: string | null
          original_message_id?: string
          public_url?: string | null
          telegram_data?: Json | null
          telegram_message_id?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
      messages: {
        Row: {
          analyzed_content: Json | null
          caption: string | null
          chat_id: number | null
          chat_title: string | null
          chat_type: Database["public"]["Enums"]["telegram_chat_type"] | null
          correlation_id: string | null
          created_at: string
          deleted_from_telegram: boolean | null
          duplicate_reference_id: string | null
          duration: number | null
          edit_count: number | null
          edit_date: string | null
          edit_history: Json | null
          edited_channel_post: boolean | null
          error_code: string | null
          error_message: string | null
          file_id: string | null
          file_id_expires_at: string | null
          file_size: number | null
          file_unique_id: string | null
          forward_chain: Json[] | null
          forward_count: number | null
          forward_date: string | null
          forward_from: Json | null
          forward_from_chat: Json | null
          forward_info: Json | null
          glide_row_id: string | null
          group_caption_synced: boolean | null
          group_first_message_time: string | null
          group_last_message_time: string | null
          group_message_count: string | null
          height: number | null
          id: string
          is_channel_post: string | null
          is_duplicate: boolean | null
          is_edit: boolean | null
          is_edited: boolean | null
          is_edited_channel_post: boolean | null
          is_forward: boolean | null
          is_forward_from: string | null
          is_forwarded: string | null
          is_forwarded_from: string | null
          is_miscellaneous_item: boolean | null
          is_original_caption: boolean | null
          last_error_at: string | null
          last_processing_attempt: string | null
          media_group_id: string | null
          media_group_sync: boolean | null
          message_caption_id: string | null
          message_type: string
          message_url: string | null
          mime_type: string | null
          mime_type_original: string | null
          needs_redownload: boolean | null
          notes: string | null
          old_analyzed_content: Json[] | null
          old_product_code: string | null
          old_product_name: string | null
          old_product_quantity: number | null
          old_purchase_date: string | null
          old_vendor_uid: string | null
          original_file_id: string | null
          original_message_id: string | null
          processing_attempts: number | null
          processing_completed_at: string | null
          processing_started_at: string | null
          processing_state: Database["public"]["Enums"]["processing_state_type"]
          product_code: string | null
          product_name: string | null
          product_quantity: number | null
          product_sku: string | null
          public_url: string | null
          purchase_date: string | null
          purchase_order_uid: string | null
          redownload_attempts: number | null
          redownload_completed_at: string | null
          redownload_flagged_at: string | null
          redownload_reason: string | null
          redownload_strategy: string | null
          retry_count: number | null
          storage_exists: boolean | null
          storage_path: string | null
          storage_path_standardized: boolean | null
          sync_attempt: number | null
          telegram_data: Json | null
          telegram_message_id: number | null
          telegram_metadata: Json | null
          text: string | null
          trigger_source: string | null
          update_id: string | null
          updated_at: string
          user_id: string | null
          vendor_uid: string | null
          width: number | null
        }
        Insert: {
          analyzed_content?: Json | null
          caption?: string | null
          chat_id?: number | null
          chat_title?: string | null
          chat_type?: Database["public"]["Enums"]["telegram_chat_type"] | null
          correlation_id?: string | null
          created_at?: string
          deleted_from_telegram?: boolean | null
          duplicate_reference_id?: string | null
          duration?: number | null
          edit_count?: number | null
          edit_date?: string | null
          edit_history?: Json | null
          edited_channel_post?: boolean | null
          error_code?: string | null
          error_message?: string | null
          file_id?: string | null
          file_id_expires_at?: string | null
          file_size?: number | null
          file_unique_id?: string | null
          forward_chain?: Json[] | null
          forward_count?: number | null
          forward_date?: string | null
          forward_from?: Json | null
          forward_from_chat?: Json | null
          forward_info?: Json | null
          glide_row_id?: string | null
          group_caption_synced?: boolean | null
          group_first_message_time?: string | null
          group_last_message_time?: string | null
          group_message_count?: string | null
          height?: number | null
          id?: string
          is_channel_post?: string | null
          is_duplicate?: boolean | null
          is_edit?: boolean | null
          is_edited?: boolean | null
          is_edited_channel_post?: boolean | null
          is_forward?: boolean | null
          is_forward_from?: string | null
          is_forwarded?: string | null
          is_forwarded_from?: string | null
          is_miscellaneous_item?: boolean | null
          is_original_caption?: boolean | null
          last_error_at?: string | null
          last_processing_attempt?: string | null
          media_group_id?: string | null
          media_group_sync?: boolean | null
          message_caption_id?: string | null
          message_type?: string
          message_url?: string | null
          mime_type?: string | null
          mime_type_original?: string | null
          needs_redownload?: boolean | null
          notes?: string | null
          old_analyzed_content?: Json[] | null
          old_product_code?: string | null
          old_product_name?: string | null
          old_product_quantity?: number | null
          old_purchase_date?: string | null
          old_vendor_uid?: string | null
          original_file_id?: string | null
          original_message_id?: string | null
          processing_attempts?: number | null
          processing_completed_at?: string | null
          processing_started_at?: string | null
          processing_state?: Database["public"]["Enums"]["processing_state_type"]
          product_code?: string | null
          product_name?: string | null
          product_quantity?: number | null
          product_sku?: string | null
          public_url?: string | null
          purchase_date?: string | null
          purchase_order_uid?: string | null
          redownload_attempts?: number | null
          redownload_completed_at?: string | null
          redownload_flagged_at?: string | null
          redownload_reason?: string | null
          redownload_strategy?: string | null
          retry_count?: number | null
          storage_exists?: boolean | null
          storage_path?: string | null
          storage_path_standardized?: boolean | null
          sync_attempt?: number | null
          telegram_data?: Json | null
          telegram_message_id?: number | null
          telegram_metadata?: Json | null
          text?: string | null
          trigger_source?: string | null
          update_id?: string | null
          updated_at?: string
          user_id?: string | null
          vendor_uid?: string | null
          width?: number | null
        }
        Update: {
          analyzed_content?: Json | null
          caption?: string | null
          chat_id?: number | null
          chat_title?: string | null
          chat_type?: Database["public"]["Enums"]["telegram_chat_type"] | null
          correlation_id?: string | null
          created_at?: string
          deleted_from_telegram?: boolean | null
          duplicate_reference_id?: string | null
          duration?: number | null
          edit_count?: number | null
          edit_date?: string | null
          edit_history?: Json | null
          edited_channel_post?: boolean | null
          error_code?: string | null
          error_message?: string | null
          file_id?: string | null
          file_id_expires_at?: string | null
          file_size?: number | null
          file_unique_id?: string | null
          forward_chain?: Json[] | null
          forward_count?: number | null
          forward_date?: string | null
          forward_from?: Json | null
          forward_from_chat?: Json | null
          forward_info?: Json | null
          glide_row_id?: string | null
          group_caption_synced?: boolean | null
          group_first_message_time?: string | null
          group_last_message_time?: string | null
          group_message_count?: string | null
          height?: number | null
          id?: string
          is_channel_post?: string | null
          is_duplicate?: boolean | null
          is_edit?: boolean | null
          is_edited?: boolean | null
          is_edited_channel_post?: boolean | null
          is_forward?: boolean | null
          is_forward_from?: string | null
          is_forwarded?: string | null
          is_forwarded_from?: string | null
          is_miscellaneous_item?: boolean | null
          is_original_caption?: boolean | null
          last_error_at?: string | null
          last_processing_attempt?: string | null
          media_group_id?: string | null
          media_group_sync?: boolean | null
          message_caption_id?: string | null
          message_type?: string
          message_url?: string | null
          mime_type?: string | null
          mime_type_original?: string | null
          needs_redownload?: boolean | null
          notes?: string | null
          old_analyzed_content?: Json[] | null
          old_product_code?: string | null
          old_product_name?: string | null
          old_product_quantity?: number | null
          old_purchase_date?: string | null
          old_vendor_uid?: string | null
          original_file_id?: string | null
          original_message_id?: string | null
          processing_attempts?: number | null
          processing_completed_at?: string | null
          processing_started_at?: string | null
          processing_state?: Database["public"]["Enums"]["processing_state_type"]
          product_code?: string | null
          product_name?: string | null
          product_quantity?: number | null
          product_sku?: string | null
          public_url?: string | null
          purchase_date?: string | null
          purchase_order_uid?: string | null
          redownload_attempts?: number | null
          redownload_completed_at?: string | null
          redownload_flagged_at?: string | null
          redownload_reason?: string | null
          redownload_strategy?: string | null
          retry_count?: number | null
          storage_exists?: boolean | null
          storage_path?: string | null
          storage_path_standardized?: boolean | null
          sync_attempt?: number | null
          telegram_data?: Json | null
          telegram_message_id?: number | null
          telegram_metadata?: Json | null
          text?: string | null
          trigger_source?: string | null
          update_id?: string | null
          updated_at?: string
          user_id?: string | null
          vendor_uid?: string | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_message_caption"
            columns: ["message_caption_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_message_caption"
            columns: ["message_caption_id"]
            isOneToOne: false
            referencedRelation: "messages_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_message_caption"
            columns: ["message_caption_id"]
            isOneToOne: false
            referencedRelation: "v_messages_compatibility"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_message_caption_id_fkey"
            columns: ["message_caption_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_message_caption_id_fkey"
            columns: ["message_caption_id"]
            isOneToOne: false
            referencedRelation: "messages_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_message_caption_id_fkey"
            columns: ["message_caption_id"]
            isOneToOne: false
            referencedRelation: "v_messages_compatibility"
            referencedColumns: ["id"]
          },
        ]
      }
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
          created_at: string
          id: number
          message: string | null
          telegram_data: Json | null
        }
        Insert: {
          created_at?: string
          id?: number
          message?: string | null
          telegram_data?: Json | null
        }
        Update: {
          created_at?: string
          id?: number
          message?: string | null
          telegram_data?: Json | null
        }
        Relationships: []
      }
      n8n_chat_histories: {
        Row: {
          id: number
          message: Json
          session_id: string
        }
        Insert: {
          id?: number
          message: Json
          session_id: string
        }
        Update: {
          id?: number
          message?: Json
          session_id?: string
        }
        Relationships: []
      }
      other_messages: {
        Row: {
          analyzed_content: Json | null
          chat_id: number
          chat_title: string | null
          chat_type: Database["public"]["Enums"]["telegram_chat_type"]
          correlation_id: string | null
          created_at: string
          edit_date: string | null
          edit_history: Json | null
          error_message: string | null
          forward_info: Json | null
          id: string
          is_edited: boolean
          is_forward: string | null
          last_error_at: string | null
          message_text: string | null
          message_type: string
          message_url: string | null
          notes: string | null
          processing_completed_at: string | null
          processing_correlation_id: string | null
          processing_started_at: string | null
          processing_state: Database["public"]["Enums"]["processing_state_type"]
          product_code: string | null
          product_name: string | null
          product_quantity: number | null
          purchase_date: string | null
          retry_count: number | null
          telegram_data: Json | null
          telegram_message_id: number
          updated_at: string
          user_id: string | null
          vendor_uid: string | null
        }
        Insert: {
          analyzed_content?: Json | null
          chat_id: number
          chat_title?: string | null
          chat_type: Database["public"]["Enums"]["telegram_chat_type"]
          correlation_id?: string | null
          created_at?: string
          edit_date?: string | null
          edit_history?: Json | null
          error_message?: string | null
          forward_info?: Json | null
          id?: string
          is_edited?: boolean
          is_forward?: string | null
          last_error_at?: string | null
          message_text?: string | null
          message_type: string
          message_url?: string | null
          notes?: string | null
          processing_completed_at?: string | null
          processing_correlation_id?: string | null
          processing_started_at?: string | null
          processing_state?: Database["public"]["Enums"]["processing_state_type"]
          product_code?: string | null
          product_name?: string | null
          product_quantity?: number | null
          purchase_date?: string | null
          retry_count?: number | null
          telegram_data?: Json | null
          telegram_message_id: number
          updated_at?: string
          user_id?: string | null
          vendor_uid?: string | null
        }
        Update: {
          analyzed_content?: Json | null
          chat_id?: number
          chat_title?: string | null
          chat_type?: Database["public"]["Enums"]["telegram_chat_type"]
          correlation_id?: string | null
          created_at?: string
          edit_date?: string | null
          edit_history?: Json | null
          error_message?: string | null
          forward_info?: Json | null
          id?: string
          is_edited?: boolean
          is_forward?: string | null
          last_error_at?: string | null
          message_text?: string | null
          message_type?: string
          message_url?: string | null
          notes?: string | null
          processing_completed_at?: string | null
          processing_correlation_id?: string | null
          processing_started_at?: string | null
          processing_state?: Database["public"]["Enums"]["processing_state_type"]
          product_code?: string | null
          product_name?: string | null
          product_quantity?: number | null
          purchase_date?: string | null
          retry_count?: number | null
          telegram_data?: Json | null
          telegram_message_id?: number
          updated_at?: string
          user_id?: string | null
          vendor_uid?: string | null
        }
        Relationships: []
      }
      product_matching_config: {
        Row: {
          created_at: string
          id: string
          partial_match_date_format: string | null
          partial_match_enabled: boolean
          partial_match_min_length: number | null
          similarity_threshold: number
          updated_at: string
          weight_name: number | null
          weight_purchase_date: number | null
          weight_vendor: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          partial_match_date_format?: string | null
          partial_match_enabled?: boolean
          partial_match_min_length?: number | null
          similarity_threshold?: number
          updated_at?: string
          weight_name?: number | null
          weight_purchase_date?: number | null
          weight_vendor?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          partial_match_date_format?: string | null
          partial_match_enabled?: boolean
          partial_match_min_length?: number | null
          similarity_threshold?: number
          updated_at?: string
          weight_name?: number | null
          weight_purchase_date?: number | null
          weight_vendor?: number | null
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
      raw_product_entries: {
        Row: {
          audio_url: string | null
          created_at: string | null
          extracted_data: Json | null
          id: string
          needs_manual_review: boolean | null
          processing_status: string | null
          updated_at: string | null
        }
        Insert: {
          audio_url?: string | null
          created_at?: string | null
          extracted_data?: Json | null
          id?: string
          needs_manual_review?: boolean | null
          processing_status?: string | null
          updated_at?: string | null
        }
        Update: {
          audio_url?: string | null
          created_at?: string | null
          extracted_data?: Json | null
          id?: string
          needs_manual_review?: boolean | null
          processing_status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      settings: {
        Row: {
          bot_token: string | null
          created_at: string | null
          id: string
          product_matching_config: Json | null
          updated_at: string | null
          webhook_url: string | null
        }
        Insert: {
          bot_token?: string | null
          created_at?: string | null
          id?: string
          product_matching_config?: Json | null
          updated_at?: string | null
          webhook_url?: string | null
        }
        Update: {
          bot_token?: string | null
          created_at?: string | null
          id?: string
          product_matching_config?: Json | null
          updated_at?: string | null
          webhook_url?: string | null
        }
        Relationships: []
      }
      sync_matches: {
        Row: {
          applied: boolean | null
          confidence_score: number | null
          created_at: string | null
          id: string
          match_details: Json | null
          match_priority: number | null
          message_id: string | null
          product_id: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          applied?: boolean | null
          confidence_score?: number | null
          created_at?: string | null
          id?: string
          match_details?: Json | null
          match_priority?: number | null
          message_id?: string | null
          product_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          applied?: boolean | null
          confidence_score?: number | null
          created_at?: string | null
          id?: string
          match_details?: Json | null
          match_priority?: number | null
          message_id?: string | null
          product_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      unified_audit_logs: {
        Row: {
          chat_id: number | null
          correlation_id: string | null
          entity_id: string
          error_message: string | null
          event_timestamp: string
          event_type: string
          id: string
          message_type: string | null
          metadata: Json | null
          new_state: Json | null
          operation_type:
            | Database["public"]["Enums"]["message_operation_type"]
            | null
          previous_state: Json | null
          source_message_id: string | null
          target_message_id: string | null
          telegram_message_id: number | null
          user_id: string | null
        }
        Insert: {
          chat_id?: number | null
          correlation_id?: string | null
          entity_id: string
          error_message?: string | null
          event_timestamp?: string
          event_type: string
          id?: string
          message_type?: string | null
          metadata?: Json | null
          new_state?: Json | null
          operation_type?:
            | Database["public"]["Enums"]["message_operation_type"]
            | null
          previous_state?: Json | null
          source_message_id?: string | null
          target_message_id?: string | null
          telegram_message_id?: number | null
          user_id?: string | null
        }
        Update: {
          chat_id?: number | null
          correlation_id?: string | null
          entity_id?: string
          error_message?: string | null
          event_timestamp?: string
          event_type?: string
          id?: string
          message_type?: string | null
          metadata?: Json | null
          new_state?: Json | null
          operation_type?:
            | Database["public"]["Enums"]["message_operation_type"]
            | null
          previous_state?: Json | null
          source_message_id?: string | null
          target_message_id?: string | null
          telegram_message_id?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_unified_audit_logs_messages"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_unified_audit_logs_messages"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "messages_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_unified_audit_logs_messages"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "v_messages_compatibility"
            referencedColumns: ["id"]
          },
        ]
      }
      vector_documents: {
        Row: {
          content: string | null
          embedding: string | null
          id: number
          metadata: Json | null
        }
        Insert: {
          content?: string | null
          embedding?: string | null
          id?: number
          metadata?: Json | null
        }
        Update: {
          content?: string | null
          embedding?: string | null
          id?: number
          metadata?: Json | null
        }
        Relationships: []
      }
      webhook_entity: {
        Row: {
          method: string
          node: string
          pathLength: number | null
          webhookId: string | null
          webhookPath: string
          workflowId: number
        }
        Insert: {
          method: string
          node: string
          pathLength?: number | null
          webhookId?: string | null
          webhookPath: string
          workflowId: number
        }
        Update: {
          method?: string
          node?: string
          pathLength?: number | null
          webhookId?: string | null
          webhookPath?: string
          workflowId?: number
        }
        Relationships: []
      }
      webhook_events: {
        Row: {
          created_at: string | null
          id: number
        }
        Insert: {
          created_at?: string | null
          id?: never
        }
        Update: {
          created_at?: string | null
          id?: never
        }
        Relationships: []
      }
      webhook_logs: {
        Row: {
          created_at: string | null
          id: number
        }
        Insert: {
          created_at?: string | null
          id?: never
        }
        Update: {
          created_at?: string | null
          id?: never
        }
        Relationships: []
      }
    }
    Views: {
      gl_current_status: {
        Row: {
          balance_amount: number | null
          category: string | null
          draft_count: number | null
          paid_count: number | null
          total_amount: number | null
          total_count: number | null
          total_paid: number | null
          unpaid_count: number | null
        }
        Relationships: []
      }
      gl_tables_view: {
        Row: {
          table_name: unknown | null
        }
        Relationships: []
      }
      messages_view: {
        Row: {
          analyzed_content: Json | null
          caption: string | null
          correlation_id: string | null
          edit_history: Json | null
          edited_channel_post: boolean | null
          error_message: string | null
          file_unique_id: string | null
          forward_date: string | null
          forward_info: Json | null
          glide_row_id: string | null
          group_caption_synced: boolean | null
          id: string | null
          is_channel_post: string | null
          is_edited: boolean | null
          is_edited_channel_post: boolean | null
          is_forwarded: string | null
          is_original_caption: boolean | null
          media_group_id: string | null
          message_caption_id: string | null
          message_url: string | null
          mime_type: string | null
          notes: string | null
          old_analyzed_content: Json[] | null
          processing_state:
            | Database["public"]["Enums"]["processing_state_type"]
            | null
          product_code: string | null
          product_name: string | null
          product_quantity: number | null
          product_sku: string | null
          public_url: string | null
          purchase_date: string | null
          storage_path: string | null
          telegram_data: Json | null
          vendor_uid: string | null
        }
        Insert: {
          analyzed_content?: Json | null
          caption?: string | null
          correlation_id?: string | null
          edit_history?: Json | null
          edited_channel_post?: boolean | null
          error_message?: string | null
          file_unique_id?: string | null
          forward_date?: string | null
          forward_info?: Json | null
          glide_row_id?: string | null
          group_caption_synced?: boolean | null
          id?: string | null
          is_channel_post?: string | null
          is_edited?: boolean | null
          is_edited_channel_post?: boolean | null
          is_forwarded?: string | null
          is_original_caption?: boolean | null
          media_group_id?: string | null
          message_caption_id?: string | null
          message_url?: string | null
          mime_type?: string | null
          notes?: string | null
          old_analyzed_content?: Json[] | null
          processing_state?:
            | Database["public"]["Enums"]["processing_state_type"]
            | null
          product_code?: string | null
          product_name?: string | null
          product_quantity?: number | null
          product_sku?: string | null
          public_url?: string | null
          purchase_date?: string | null
          storage_path?: string | null
          telegram_data?: Json | null
          vendor_uid?: string | null
        }
        Update: {
          analyzed_content?: Json | null
          caption?: string | null
          correlation_id?: string | null
          edit_history?: Json | null
          edited_channel_post?: boolean | null
          error_message?: string | null
          file_unique_id?: string | null
          forward_date?: string | null
          forward_info?: Json | null
          glide_row_id?: string | null
          group_caption_synced?: boolean | null
          id?: string | null
          is_channel_post?: string | null
          is_edited?: boolean | null
          is_edited_channel_post?: boolean | null
          is_forwarded?: string | null
          is_original_caption?: boolean | null
          media_group_id?: string | null
          message_caption_id?: string | null
          message_url?: string | null
          mime_type?: string | null
          notes?: string | null
          old_analyzed_content?: Json[] | null
          processing_state?:
            | Database["public"]["Enums"]["processing_state_type"]
            | null
          product_code?: string | null
          product_name?: string | null
          product_quantity?: number | null
          product_sku?: string | null
          public_url?: string | null
          purchase_date?: string | null
          storage_path?: string | null
          telegram_data?: Json | null
          vendor_uid?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_message_caption"
            columns: ["message_caption_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_message_caption"
            columns: ["message_caption_id"]
            isOneToOne: false
            referencedRelation: "messages_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_message_caption"
            columns: ["message_caption_id"]
            isOneToOne: false
            referencedRelation: "v_messages_compatibility"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_message_caption_id_fkey"
            columns: ["message_caption_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_message_caption_id_fkey"
            columns: ["message_caption_id"]
            isOneToOne: false
            referencedRelation: "messages_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_message_caption_id_fkey"
            columns: ["message_caption_id"]
            isOneToOne: false
            referencedRelation: "v_messages_compatibility"
            referencedColumns: ["id"]
          },
        ]
      }
      pg_stat_statements: {
        Row: {
          blk_read_time: number | null
          blk_write_time: number | null
          calls: number | null
          dbid: unknown | null
          jit_emission_count: number | null
          jit_emission_time: number | null
          jit_functions: number | null
          jit_generation_time: number | null
          jit_inlining_count: number | null
          jit_inlining_time: number | null
          jit_optimization_count: number | null
          jit_optimization_time: number | null
          local_blks_dirtied: number | null
          local_blks_hit: number | null
          local_blks_read: number | null
          local_blks_written: number | null
          max_exec_time: number | null
          max_plan_time: number | null
          mean_exec_time: number | null
          mean_plan_time: number | null
          min_exec_time: number | null
          min_plan_time: number | null
          plans: number | null
          query: string | null
          queryid: number | null
          rows: number | null
          shared_blks_dirtied: number | null
          shared_blks_hit: number | null
          shared_blks_read: number | null
          shared_blks_written: number | null
          stddev_exec_time: number | null
          stddev_plan_time: number | null
          temp_blk_read_time: number | null
          temp_blk_write_time: number | null
          temp_blks_read: number | null
          temp_blks_written: number | null
          toplevel: boolean | null
          total_exec_time: number | null
          total_plan_time: number | null
          userid: unknown | null
          wal_bytes: number | null
          wal_fpi: number | null
          wal_records: number | null
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
          error_count: number | null
          error_rate_percent: number | null
          event_count: number | null
          event_type: string | null
          first_event: string | null
          last_event: string | null
          unique_correlations: number | null
          unique_entities: number | null
        }
        Relationships: []
      }
      v_function_operations: {
        Row: {
          error_count: number | null
          event_count: number | null
          event_type: string | null
          first_event: string | null
          last_event: string | null
        }
        Relationships: []
      }
      v_media_group_consistency: {
        Row: {
          caption_holders: number | null
          consistency_status: string | null
          distinct_analysis_count: number | null
          has_incomplete_analysis: boolean | null
          media_group_id: string | null
          message_count: number | null
          synced_messages: number | null
        }
        Relationships: []
      }
      v_media_group_operations: {
        Row: {
          completed_count: number | null
          error_count: number | null
          fully_synced: boolean | null
          last_update: string | null
          media_group_id: string | null
          message_count: number | null
        }
        Relationships: []
      }
      v_messages_compatibility: {
        Row: {
          analyzed_content: Json | null
          caption: string | null
          chat_id: number | null
          chat_title: string | null
          chat_type: Database["public"]["Enums"]["telegram_chat_type"] | null
          correlation_id: string | null
          created_at: string | null
          duration: number | null
          edit_date: string | null
          edit_history: Json | null
          error_message: string | null
          file_id: string | null
          file_size: number | null
          file_unique_id: string | null
          glide_row_id: string | null
          group_caption_synced: boolean | null
          group_first_message_time: string | null
          group_last_message_time: string | null
          group_message_count: number | null
          height: number | null
          id: string | null
          is_edited: boolean | null
          is_miscellaneous_item: boolean | null
          is_original_caption: boolean | null
          last_error_at: string | null
          media_group_id: string | null
          message_url: string | null
          mime_type: string | null
          processing_completed_at: string | null
          processing_started_at: string | null
          processing_state:
            | Database["public"]["Enums"]["processing_state_type"]
            | null
          product_code: string | null
          product_name: string | null
          product_quantity: number | null
          product_unit: string | null
          public_url: string | null
          purchase_date: string | null
          purchase_order_uid: string | null
          retry_count: number | null
          storage_path: string | null
          sync_attempt: number | null
          telegram_data: Json | null
          telegram_message_id: number | null
          updated_at: string | null
          vendor_uid: string | null
          width: number | null
        }
        Insert: {
          analyzed_content?: Json | null
          caption?: string | null
          chat_id?: number | null
          chat_title?: string | null
          chat_type?: Database["public"]["Enums"]["telegram_chat_type"] | null
          correlation_id?: string | null
          created_at?: string | null
          duration?: number | null
          edit_date?: string | null
          edit_history?: Json | null
          error_message?: string | null
          file_id?: string | null
          file_size?: number | null
          file_unique_id?: string | null
          glide_row_id?: string | null
          group_caption_synced?: boolean | null
          group_first_message_time?: string | null
          group_last_message_time?: string | null
          group_message_count?: never
          height?: number | null
          id?: string | null
          is_edited?: boolean | null
          is_miscellaneous_item?: boolean | null
          is_original_caption?: boolean | null
          last_error_at?: string | null
          media_group_id?: string | null
          message_url?: string | null
          mime_type?: string | null
          processing_completed_at?: string | null
          processing_started_at?: string | null
          processing_state?:
            | Database["public"]["Enums"]["processing_state_type"]
            | null
          product_code?: string | null
          product_name?: string | null
          product_quantity?: number | null
          product_unit?: never
          public_url?: string | null
          purchase_date?: string | null
          purchase_order_uid?: string | null
          retry_count?: number | null
          storage_path?: string | null
          sync_attempt?: number | null
          telegram_data?: Json | null
          telegram_message_id?: number | null
          updated_at?: string | null
          vendor_uid?: string | null
          width?: number | null
        }
        Update: {
          analyzed_content?: Json | null
          caption?: string | null
          chat_id?: number | null
          chat_title?: string | null
          chat_type?: Database["public"]["Enums"]["telegram_chat_type"] | null
          correlation_id?: string | null
          created_at?: string | null
          duration?: number | null
          edit_date?: string | null
          edit_history?: Json | null
          error_message?: string | null
          file_id?: string | null
          file_size?: number | null
          file_unique_id?: string | null
          glide_row_id?: string | null
          group_caption_synced?: boolean | null
          group_first_message_time?: string | null
          group_last_message_time?: string | null
          group_message_count?: never
          height?: number | null
          id?: string | null
          is_edited?: boolean | null
          is_miscellaneous_item?: boolean | null
          is_original_caption?: boolean | null
          last_error_at?: string | null
          media_group_id?: string | null
          message_url?: string | null
          mime_type?: string | null
          processing_completed_at?: string | null
          processing_started_at?: string | null
          processing_state?:
            | Database["public"]["Enums"]["processing_state_type"]
            | null
          product_code?: string | null
          product_name?: string | null
          product_quantity?: number | null
          product_unit?: never
          public_url?: string | null
          purchase_date?: string | null
          purchase_order_uid?: string | null
          retry_count?: number | null
          storage_path?: string | null
          sync_attempt?: number | null
          telegram_data?: Json | null
          telegram_message_id?: number | null
          updated_at?: string | null
          vendor_uid?: string | null
          width?: number | null
        }
        Relationships: []
      }
      v_product_matching_history: {
        Row: {
          event_timestamp: string | null
          event_type: string | null
          id: string | null
          message_id: string | null
          metadata: Json | null
        }
        Insert: {
          event_timestamp?: string | null
          event_type?: string | null
          id?: string | null
          message_id?: string | null
          metadata?: Json | null
        }
        Update: {
          event_timestamp?: string | null
          event_type?: string | null
          id?: string | null
          message_id?: string | null
          metadata?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_unified_audit_logs_messages"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_unified_audit_logs_messages"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_unified_audit_logs_messages"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "v_messages_compatibility"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      binary_quantize: {
        Args: { "": string } | { "": unknown }
        Returns: unknown
      }
      cleanup_orphaned_records: {
        Args: { table_name: string }
        Returns: number
      }
      compute_data_hash: {
        Args: { data: Json }
        Returns: string
      }
      construct_purchase_order: {
        Args: { analyzed_content: Json }
        Returns: string
      }
      convert_estimate_to_invoice: {
        Args: { estimate_id: string; user_email: string }
        Returns: string
      }
      dates_within_range: {
        Args: { date1: string; date2: string; days?: number }
        Returns: boolean
      }
      extract_media_dimensions: {
        Args: { telegram_data: Json }
        Returns: {
          width: number
          height: number
          duration: number
        }[]
      }
      generate_invoice_uid: {
        Args: { account_uid: string; invoice_date: string }
        Returns: string
      }
      generate_po_uid: {
        Args: { account_uid: string; po_date: string }
        Returns: string
      }
      get_table_columns: {
        Args: { table_name: string }
        Returns: {
          column_name: string
          data_type: string
        }[]
      }
      gl_admin_execute_sql: {
        Args: { sql_query: string }
        Returns: Json
      }
      gl_calculate_account_balance: {
        Args: { account_id: string }
        Returns: number
      }
      gl_calculate_product_inventory: {
        Args: { product_id: string }
        Returns: number
      }
      gl_get_account_stats: {
        Args: Record<PropertyKey, never>
        Returns: {
          customer_count: number
          vendor_count: number
        }[]
      }
      gl_get_business_stats: {
        Args: Record<PropertyKey, never>
        Returns: {
          total_invoices: number
          total_estimates: number
          total_purchase_orders: number
          total_products: number
          total_customers: number
          total_vendors: number
          total_invoice_amount: number
          total_payments_received: number
          total_outstanding_balance: number
          total_purchase_amount: number
          total_payments_made: number
          total_purchase_balance: number
        }[]
      }
      gl_get_document_status: {
        Args: Record<PropertyKey, never>
        Returns: {
          category: string
          total_count: number
          paid_count: number
          unpaid_count: number
          draft_count: number
          total_amount: number
          total_paid: number
          balance_amount: number
        }[]
      }
      gl_get_invoice_metrics: {
        Args: Record<PropertyKey, never>
        Returns: {
          invoice_count: number
          estimate_count: number
          total_invoice_amount: number
          total_payments_received: number
          total_outstanding_balance: number
        }[]
      }
      gl_get_purchase_order_metrics: {
        Args: Record<PropertyKey, never>
        Returns: {
          po_count: number
          total_purchase_amount: number
          total_payments_made: number
          total_purchase_balance: number
        }[]
      }
      gl_get_table_columns: {
        Args: { table_name: string }
        Returns: {
          column_name: string
          data_type: string
          is_nullable: boolean
          is_primary_key: boolean
        }[]
      }
      gl_record_sync_error: {
        Args: {
          p_mapping_id: string
          p_error_type: string
          p_error_message: string
          p_record_data?: Json
          p_retryable?: boolean
        }
        Returns: string
      }
      gl_resolve_sync_error: {
        Args: { p_error_id: string; p_resolution_notes?: string }
        Returns: boolean
      }
      gl_suggest_column_mappings: {
        Args: { p_supabase_table: string; p_glide_columns: Json }
        Returns: {
          glide_column_name: string
          suggested_supabase_column: string
          data_type: string
          confidence: number
        }[]
      }
      gl_update_all_account_balances: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      gl_update_product_payment_status: {
        Args: { product_id: string; new_status: string }
        Returns: boolean
      }
      gl_validate_column_mapping: {
        Args: { p_mapping_id: string }
        Returns: {
          is_valid: boolean
          validation_message: string
        }[]
      }
      gl_validate_mapping_data: {
        Args: { p_mapping: Json; p_editing?: boolean }
        Returns: {
          is_valid: boolean
          validation_message: string
        }[]
      }
      glsync_cleanup_duplicate_accounts: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      glsync_get_account_summary: {
        Args: { account_id: string }
        Returns: Json
      }
      glsync_retry_failed_sync: {
        Args: { p_mapping_id: string }
        Returns: string
      }
      halfvec_avg: {
        Args: { "": number[] }
        Returns: unknown
      }
      halfvec_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      halfvec_send: {
        Args: { "": unknown }
        Returns: string
      }
      halfvec_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
      hnsw_bit_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnsw_halfvec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnsw_sparsevec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnswhandler: {
        Args: { "": unknown }
        Returns: unknown
      }
      is_customer: {
        Args: { account_type: string }
        Returns: boolean
      }
      is_vendor: {
        Args: { account_type: string }
        Returns: boolean
      }
      ivfflat_bit_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      ivfflat_halfvec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      ivfflathandler: {
        Args: { "": unknown }
        Returns: unknown
      }
      l2_norm: {
        Args: { "": unknown } | { "": unknown }
        Returns: number
      }
      l2_normalize: {
        Args: { "": unknown } | { "": unknown } | { "": string }
        Returns: unknown
      }
      make_log_webhook_test: {
        Args: { webhook_id: string; payload: Json }
        Returns: string
      }
      make_process_telegram_message_event: {
        Args: { message_id: string; event_type: string; context?: Json }
        Returns: Json
      }
      make_test_webhook_field_mapping: {
        Args: { webhook_id: string; message_id: string; event_type: string }
        Returns: Json
      }
      match_documents: {
        Args: { query_embedding: string; match_count?: number; filter?: Json }
        Returns: {
          id: number
          content: string
          metadata: Json
          similarity: number
        }[]
      }
      media_processor: {
        Args:
          | {
              p_action: string
              p_message_ids: string[]
              p_correlation_id?: string
              p_options?: Json
            }
          | { p_message_id: string }
        Returns: Json
      }
      message_processor: {
        Args:
          | {
              p_action: string
              p_message_id: string
              p_correlation_id?: string
              p_options?: Json
            }
          | {
              p_action: string
              p_message_id: string
              p_correlation_id?: string
            }
        Returns: Json
      }
      pg_stat_statements: {
        Args: { showtext: boolean }
        Returns: Record<string, unknown>[]
      }
      pg_stat_statements_info: {
        Args: Record<PropertyKey, never>
        Returns: Record<string, unknown>
      }
      pg_stat_statements_reset: {
        Args: { userid?: unknown; dbid?: unknown; queryid?: number }
        Returns: undefined
      }
      process_webhook_event: {
        Args: { p_event_id: string }
        Returns: undefined
      }
      rebuild_calculated_fields: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      recalculate_all_totals: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      record_audit_trail: {
        Args: {
          p_table_name: string
          p_record_id: string
          p_action_type: string
          p_changed_fields?: Json
          p_user_identifier?: string
          p_notes?: string
        }
        Returns: string
      }
      refresh_all_materialized_views: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      refresh_materialized_view: {
        Args: { view_name: string }
        Returns: undefined
      }
      refresh_purchase_order_summary: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      schedule_relationship_maintenance: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      schedule_sync_check: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      search_related_records: {
        Args: { search_term: string }
        Returns: {
          record_type: string
          record_id: string
          account_name: string
          document_number: string
          amount: number
          created_date: string
        }[]
      }
      sparsevec_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      sparsevec_send: {
        Args: { "": unknown }
        Returns: string
      }
      sparsevec_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
      update_estimate_totals: {
        Args: { estimate_id: string }
        Returns: undefined
      }
      update_invoice_totals: {
        Args: { invoice_id: string }
        Returns: undefined
      }
      update_po_totals: {
        Args: { po_id: string }
        Returns: undefined
      }
      vector_avg: {
        Args: { "": number[] }
        Returns: string
      }
      vector_dims: {
        Args: { "": string } | { "": unknown }
        Returns: number
      }
      vector_norm: {
        Args: { "": string }
        Returns: number
      }
      vector_out: {
        Args: { "": string }
        Returns: unknown
      }
      vector_send: {
        Args: { "": string }
        Returns: string
      }
      vector_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
      xdelo_check_file_exists: {
        Args: { p_storage_path: string }
        Returns: boolean
      }
      xdelo_check_media_group_consistency: {
        Args: { p_media_group_id: string; p_correlation_id?: string }
        Returns: Json
      }
      xdelo_check_message_exists: {
        Args: { p_chat_id: number; p_telegram_message_id: number }
        Returns: boolean
      }
      xdelo_check_messages_needing_caption_sync: {
        Args: Record<PropertyKey, never>
        Returns: {
          media_group_id: string
          message_count: number
          sync_status: Json
        }[]
      }
      xdelo_cleanup_audit_logs: {
        Args: {
          retention_days?: number
          keep_errors?: boolean
          keep_important_events?: boolean
        }
        Returns: {
          deleted_count: number
          retained_count: number
        }[]
      }
      xdelo_cleanup_orphaned_audit_logs: {
        Args: Record<PropertyKey, never>
        Returns: {
          deleted_count: number
        }[]
      }
      xdelo_clear_all_messages: {
        Args:
          | { p_confirm: string; p_correlation_id?: string }
          | Record<PropertyKey, never>
        Returns: Json
      }
      xdelo_extract_telegram_metadata: {
        Args: { p_telegram_data: Json }
        Returns: Json
      }
      xdelo_find_broken_media_groups: {
        Args: Record<PropertyKey, never>
        Returns: {
          media_group_id: string
          source_message_id: string
          total_count: number
          pending_count: number
          analyzed_count: number
        }[]
      }
      xdelo_find_caption_message: {
        Args: { p_media_group_id: string }
        Returns: string
      }
      xdelo_find_orphaned_media_group_messages: {
        Args: Record<PropertyKey, never>
        Returns: {
          media_group_id: string
          message_count: number
          issues: Json
        }[]
      }
      xdelo_find_valid_file_id: {
        Args: { p_media_group_id: string; p_file_unique_id: string }
        Returns: string
      }
      xdelo_fix_audit_log_uuids: {
        Args: Record<PropertyKey, never>
        Returns: {
          fixed_count: number
        }[]
      }
      xdelo_fix_content_disposition: {
        Args: { p_storage_path: string; p_mime_type: string }
        Returns: boolean
      }
      xdelo_fix_public_urls: {
        Args: { p_limit?: number }
        Returns: {
          message_id: string
          old_url: string
          new_url: string
        }[]
      }
      xdelo_get_incomplete_media_groups: {
        Args: { limit_param?: number }
        Returns: {
          media_group_id: string
          total_messages: number
          processed_messages: number
          unprocessed_messages: number
          oldest_message_id: string
          oldest_message_created_at: string
        }[]
      }
      xdelo_get_logger: {
        Args: { p_correlation_id: string }
        Returns: Json
      }
      xdelo_get_media_group_stats: {
        Args: { p_media_group_id: string }
        Returns: Json
      }
      xdelo_get_message_for_processing: {
        Args: { p_message_id: string }
        Returns: {
          id: string
          telegram_message_id: number
          caption: string
          media_group_id: string
          processing_state: string
          analyzed_content: Json
          old_analyzed_content: Json[]
          is_original_caption: boolean
          correlation_id: string
        }[]
      }
      xdelo_get_message_forward_history: {
        Args: { p_message_id: string }
        Returns: {
          message_id: string
          telegram_message_id: number
          chat_id: number
          forward_date: string
          analyzed_content: Json
          forward_count: number
        }[]
      }
      xdelo_get_product_matching_config: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      xdelo_handle_message_edit: {
        Args:
          | {
              p_message_id: string
              p_new_caption?: string
              p_new_text?: string
              p_edit_date?: string
              p_correlation_id?: string
            }
          | {
              p_message_id: string
              p_caption: string
              p_is_edit?: boolean
              p_correlation_id?: string
            }
        Returns: Json
      }
      xdelo_handle_message_update: {
        Args: {
          p_message_id: string
          p_caption: string
          p_is_edit?: boolean
          p_correlation_id?: string
        }
        Returns: Json
      }
      xdelo_has_valid_caption: {
        Args: { p_caption: string }
        Returns: boolean
      }
      xdelo_kill_long_queries: {
        Args: { older_than_seconds?: number }
        Returns: {
          pid: number
          usename: string
          query_start: string
          state: string
          query: string
          killed: boolean
        }[]
      }
      xdelo_log_event: {
        Args: {
          p_event_type: string
          p_entity_id: string
          p_correlation_id?: string
          p_metadata?: Json
          p_error_message?: string
        }
        Returns: string
      }
      xdelo_log_event_flexible: {
        Args: {
          p_event_type: string
          p_entity_id: string
          p_telegram_message_id?: number
          p_chat_id?: number
          p_previous_state?: Json
          p_new_state?: Json
          p_metadata?: Json
          p_correlation_id?: string
          p_user_id?: string
          p_error_message?: string
        }
        Returns: undefined
      }
      xdelo_log_message_operation: {
        Args:
          | { p_operation: string; p_message_id: string; p_details: Json }
          | {
              p_operation_type: Database["public"]["Enums"]["message_operation_type"]
              p_source_message_id: string
              p_target_message_id?: string
              p_correlation_id?: string
              p_telegram_message_id?: number
              p_chat_id?: number
              p_metadata?: Json
              p_user_id?: string
              p_error_message?: string
            }
        Returns: undefined
      }
      xdelo_log_operation: {
        Args: {
          p_event_type: string
          p_entity_id: string
          p_metadata?: Json
          p_previous_state?: Json
          p_new_state?: Json
          p_error_message?: string
        }
        Returns: undefined
      }
      xdelo_logprocessingevent: {
        Args: {
          p_event_type: string
          p_entity_id: string
          p_correlation_id: string
          p_metadata?: Json
          p_error_message?: string
        }
        Returns: undefined
      }
      xdelo_mark_for_redownload: {
        Args: { p_message_id: string; p_reason?: string }
        Returns: boolean
      }
      xdelo_prepare_message_for_webhook: {
        Args: { message_id: string }
        Returns: Json
      }
      xdelo_repair_file: {
        Args: { p_message_id: string; p_action: string }
        Returns: Json
      }
      xdelo_repair_media_group_syncs: {
        Args: Record<PropertyKey, never>
        Returns: {
          media_group_id: string
          source_message_id: string
          updated_count: number
        }[]
      }
      xdelo_repair_metadata: {
        Args: { p_message_id: string }
        Returns: Json
      }
      xdelo_reset_stalled_messages: {
        Args: { p_older_than_minutes?: number; p_correlation_id?: string }
        Returns: Json
      }
      xdelo_set_message_processing: {
        Args: { p_message_id: string; p_correlation_id: string }
        Returns: undefined
      }
      xdelo_standardize_file_extension: {
        Args: { p_mime_type: string }
        Returns: string
      }
      xdelo_standardize_storage_path: {
        Args: { p_file_unique_id: string; p_mime_type?: string }
        Returns: string
      }
      xdelo_sync_media_group: {
        Args: {
          p_media_group_id: string
          p_source_message_id: string
          p_correlation_id: string
        }
        Returns: Json
      }
      xdelo_update_message_state: {
        Args: {
          p_message_id: string
          p_new_state: string
          p_correlation_id: string
          p_error_message?: string
        }
        Returns: Json
      }
      xdelo_update_product_matching_config: {
        Args: { p_config: Json }
        Returns: Json
      }
    }
    Enums: {
      account_type: "Customer" | "Vendor" | "Customer & Vendor"
      audit_event_type:
        | "message_created"
        | "message_updated"
        | "message_deleted"
        | "message_analyzed"
        | "webhook_received"
        | "media_group_synced"
        | "message_edited"
        | "media_group_history_synced"
        | "forward_media_synced"
        | "message_forwarded"
        | "trigger_auto_queue_activated"
        | "trigger_queue_error"
        | "media_group_content_synced"
        | "media_group_sync_error"
        | "message_queued_for_processing"
        | "direct_caption_analysis_triggered"
        | "caption_analysis_retry"
        | "direct_processing_error"
        | "analyze_message_started"
        | "analyze_message_failed"
        | "message_processing_completed"
        | "message_processing_failed"
        | "message_processing_retry"
        | "media_group_content_synced_direct"
        | "forward_status_changed"
        | "duplicate_detected"
        | "file_redownload_flagged"
        | "health_check_performed"
        | "edge_function_error"
        | "queue_processing_started"
        | "queue_processing_completed"
        | "caption_analysis_directly_triggered"
        | "caption_analysis_prepared"
        | "caption_analysis_error"
        | "edge_function_fallback"
        | "media_group_content_synced_batch"
        | "media_group_edit_synced"
        | "media_group_sync_triggered"
        | "media_group_edit_history_synced"
        | "media_group_sync_validated"
        | "media_group_sync_conflict"
        | "edit_content_propagated"
        | "media_group_version_updated"
        | "system_configuration_updated"
        | "message_processing_error"
        | "message_processing_started"
      client_type: "Vendor" | "Customer" | "Customer & Vendor"
      document_status_type: "draft" | "pending" | "paid" | "void" | "overdue"
      error_type:
        | "VALIDATION_ERROR"
        | "TRANSFORM_ERROR"
        | "API_ERROR"
        | "RATE_LIMIT"
        | "NETWORK_ERROR"
      make_event_type:
        | "message_received"
        | "channel_joined"
        | "channel_left"
        | "user_joined"
        | "user_left"
        | "media_received"
        | "command_received"
        | "message_edited"
        | "message_deleted"
        | "media_group_received"
        | "message_forwarded"
        | "caption_updated"
        | "processing_completed"
      make_log_status: "pending" | "success" | "failed"
      message_operation_type:
        | "message_create"
        | "message_update"
        | "message_delete"
        | "message_forward"
        | "message_edit"
        | "media_redownload"
        | "caption_change"
        | "media_change"
        | "group_sync"
      processing_state:
        | "initialized"
        | "pending"
        | "processing"
        | "completed"
        | "partial_success"
        | "error"
      processing_state_type:
        | "initialized"
        | "pending"
        | "processing"
        | "completed"
        | "error"
      sync_direction_type: "to_supabase" | "to_glide" | "both"
      sync_operation: "sync" | "create" | "update" | "delete"
      sync_resolution_status:
        | "pending"
        | "push_to_glide"
        | "delete_from_supabase"
        | "ignored"
        | "resolved"
      sync_status: "pending" | "synced" | "error" | "locked"
      sync_status_type: "started" | "processing" | "completed" | "failed"
      telegram_chat_type:
        | "private"
        | "group"
        | "supergroup"
        | "channel"
        | "unknown"
      telegram_other_message_type:
        | "text"
        | "callback_query"
        | "inline_query"
        | "chosen_inline_result"
        | "shipping_query"
        | "pre_checkout_query"
        | "poll"
        | "poll_answer"
        | "chat_join_request"
        | "my_chat_member"
        | "sticker"
        | "dice"
        | "location"
        | "contact"
        | "venue"
        | "game"
        | "chat_member"
        | "edited_channel_post"
        | "message_created"
        | "message_updated"
        | "message_deleted"
        | "message_analyzed"
        | "webhook_received"
        | "media_group_synced"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      account_type: ["Customer", "Vendor", "Customer & Vendor"],
      audit_event_type: [
        "message_created",
        "message_updated",
        "message_deleted",
        "message_analyzed",
        "webhook_received",
        "media_group_synced",
        "message_edited",
        "media_group_history_synced",
        "forward_media_synced",
        "message_forwarded",
        "trigger_auto_queue_activated",
        "trigger_queue_error",
        "media_group_content_synced",
        "media_group_sync_error",
        "message_queued_for_processing",
        "direct_caption_analysis_triggered",
        "caption_analysis_retry",
        "direct_processing_error",
        "analyze_message_started",
        "analyze_message_failed",
        "message_processing_completed",
        "message_processing_failed",
        "message_processing_retry",
        "media_group_content_synced_direct",
        "forward_status_changed",
        "duplicate_detected",
        "file_redownload_flagged",
        "health_check_performed",
        "edge_function_error",
        "queue_processing_started",
        "queue_processing_completed",
        "caption_analysis_directly_triggered",
        "caption_analysis_prepared",
        "caption_analysis_error",
        "edge_function_fallback",
        "media_group_content_synced_batch",
        "media_group_edit_synced",
        "media_group_sync_triggered",
        "media_group_edit_history_synced",
        "media_group_sync_validated",
        "media_group_sync_conflict",
        "edit_content_propagated",
        "media_group_version_updated",
        "system_configuration_updated",
        "message_processing_error",
        "message_processing_started",
      ],
      client_type: ["Vendor", "Customer", "Customer & Vendor"],
      document_status_type: ["draft", "pending", "paid", "void", "overdue"],
      error_type: [
        "VALIDATION_ERROR",
        "TRANSFORM_ERROR",
        "API_ERROR",
        "RATE_LIMIT",
        "NETWORK_ERROR",
      ],
      make_event_type: [
        "message_received",
        "channel_joined",
        "channel_left",
        "user_joined",
        "user_left",
        "media_received",
        "command_received",
        "message_edited",
        "message_deleted",
        "media_group_received",
        "message_forwarded",
        "caption_updated",
        "processing_completed",
      ],
      make_log_status: ["pending", "success", "failed"],
      message_operation_type: [
        "message_create",
        "message_update",
        "message_delete",
        "message_forward",
        "message_edit",
        "media_redownload",
        "caption_change",
        "media_change",
        "group_sync",
      ],
      processing_state: [
        "initialized",
        "pending",
        "processing",
        "completed",
        "partial_success",
        "error",
      ],
      processing_state_type: [
        "initialized",
        "pending",
        "processing",
        "completed",
        "error",
      ],
      sync_direction_type: ["to_supabase", "to_glide", "both"],
      sync_operation: ["sync", "create", "update", "delete"],
      sync_resolution_status: [
        "pending",
        "push_to_glide",
        "delete_from_supabase",
        "ignored",
        "resolved",
      ],
      sync_status: ["pending", "synced", "error", "locked"],
      sync_status_type: ["started", "processing", "completed", "failed"],
      telegram_chat_type: [
        "private",
        "group",
        "supergroup",
        "channel",
        "unknown",
      ],
      telegram_other_message_type: [
        "text",
        "callback_query",
        "inline_query",
        "chosen_inline_result",
        "shipping_query",
        "pre_checkout_query",
        "poll",
        "poll_answer",
        "chat_join_request",
        "my_chat_member",
        "sticker",
        "dice",
        "location",
        "contact",
        "venue",
        "game",
        "chat_member",
        "edited_channel_post",
        "message_created",
        "message_updated",
        "message_deleted",
        "message_analyzed",
        "webhook_received",
        "media_group_synced",
      ],
    },
  },
} as const
