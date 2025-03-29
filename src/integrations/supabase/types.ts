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
      analysis_queue: {
        Row: {
          attempts: number | null
          created_at: string | null
          error_message: string | null
          id: string
          last_attempt_at: string | null
          message_id: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          attempts?: number | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          last_attempt_at?: string | null
          message_id: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          attempts?: number | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          last_attempt_at?: string | null
          message_id?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
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
      materialized_view_refresh_log: {
        Row: {
          last_refresh: string | null
          next_refresh: string | null
          refresh_interval: unknown | null
          view_name: string
        }
        Insert: {
          last_refresh?: string | null
          next_refresh?: string | null
          refresh_interval?: unknown | null
          view_name: string
        }
        Update: {
          last_refresh?: string | null
          next_refresh?: string | null
          refresh_interval?: unknown | null
          view_name?: string
        }
        Relationships: []
      }
      message_edit_history: {
        Row: {
          edit_reason: string | null
          edit_source: string | null
          edited_at: string
          editor_user_id: number | null
          id: string
          is_channel_post: boolean | null
          message_id: string
          new_caption: string | null
          new_telegram_data: Json | null
          new_text: string | null
          previous_caption: string | null
          previous_telegram_data: Json | null
          previous_text: string | null
        }
        Insert: {
          edit_reason?: string | null
          edit_source?: string | null
          edited_at?: string
          editor_user_id?: number | null
          id?: string
          is_channel_post?: boolean | null
          message_id: string
          new_caption?: string | null
          new_telegram_data?: Json | null
          new_text?: string | null
          previous_caption?: string | null
          previous_telegram_data?: Json | null
          previous_text?: string | null
        }
        Update: {
          edit_reason?: string | null
          edit_source?: string | null
          edited_at?: string
          editor_user_id?: number | null
          id?: string
          is_channel_post?: boolean | null
          message_id?: string
          new_caption?: string | null
          new_telegram_data?: Json | null
          new_text?: string | null
          previous_caption?: string | null
          previous_telegram_data?: Json | null
          previous_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "message_edit_history_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_edit_history_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_edit_history_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "v_message_forwards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_edit_history_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "v_messages_compatibility"
            referencedColumns: ["id"]
          },
        ]
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
          edit_source: string | null
          edited: string | null
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
          is_edited: boolean | null
          is_edited_channel_post: boolean | null
          is_forward: boolean | null
          is_forward_from: string | null
          is_forwarded: string | null
          is_forwarded_from: string | null
          is_miscellaneous_item: boolean | null
          is_original_caption: boolean | null
          last_edit_at: string | null
          last_edit_user_id: number | null
          last_error_at: string | null
          last_processing_attempt: string | null
          max_processing_attempts: number | null
          media_group_id: string | null
          media_group_sync: string | null
          message_caption_id: string | null
          message_url: string | null
          mime_type: string | null
          mime_type_original: string | null
          needs_redownload: boolean | null
          next_retry_at: string | null
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
          quantity: string | null
          redownload_attempts: number | null
          redownload_completed_at: string | null
          redownload_flagged_at: string | null
          redownload_reason: string | null
          redownload_strategy: string | null
          retry_count: number | null
          storage_exists: string | null
          storage_path: string | null
          storage_path_standardized: string | null
          sync_attempt: number | null
          telegram_data: Json | null
          telegram_message_id: number | null
          telegram_metadata: Json | null
          text: string | null
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
          edit_source?: string | null
          edited?: string | null
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
          is_edited?: boolean | null
          is_edited_channel_post?: boolean | null
          is_forward?: boolean | null
          is_forward_from?: string | null
          is_forwarded?: string | null
          is_forwarded_from?: string | null
          is_miscellaneous_item?: boolean | null
          is_original_caption?: boolean | null
          last_edit_at?: string | null
          last_edit_user_id?: number | null
          last_error_at?: string | null
          last_processing_attempt?: string | null
          max_processing_attempts?: number | null
          media_group_id?: string | null
          media_group_sync?: string | null
          message_caption_id?: string | null
          message_url?: string | null
          mime_type?: string | null
          mime_type_original?: string | null
          needs_redownload?: boolean | null
          next_retry_at?: string | null
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
          quantity?: string | null
          redownload_attempts?: number | null
          redownload_completed_at?: string | null
          redownload_flagged_at?: string | null
          redownload_reason?: string | null
          redownload_strategy?: string | null
          retry_count?: number | null
          storage_exists?: string | null
          storage_path?: string | null
          storage_path_standardized?: string | null
          sync_attempt?: number | null
          telegram_data?: Json | null
          telegram_message_id?: number | null
          telegram_metadata?: Json | null
          text?: string | null
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
          edit_source?: string | null
          edited?: string | null
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
          is_edited?: boolean | null
          is_edited_channel_post?: boolean | null
          is_forward?: boolean | null
          is_forward_from?: string | null
          is_forwarded?: string | null
          is_forwarded_from?: string | null
          is_miscellaneous_item?: boolean | null
          is_original_caption?: boolean | null
          last_edit_at?: string | null
          last_edit_user_id?: number | null
          last_error_at?: string | null
          last_processing_attempt?: string | null
          max_processing_attempts?: number | null
          media_group_id?: string | null
          media_group_sync?: string | null
          message_caption_id?: string | null
          message_url?: string | null
          mime_type?: string | null
          mime_type_original?: string | null
          needs_redownload?: boolean | null
          next_retry_at?: string | null
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
          quantity?: string | null
          redownload_attempts?: number | null
          redownload_completed_at?: string | null
          redownload_flagged_at?: string | null
          redownload_reason?: string | null
          redownload_strategy?: string | null
          retry_count?: number | null
          storage_exists?: string | null
          storage_path?: string | null
          storage_path_standardized?: string | null
          sync_attempt?: number | null
          telegram_data?: Json | null
          telegram_message_id?: number | null
          telegram_metadata?: Json | null
          text?: string | null
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
            referencedRelation: "v_message_forwards"
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
            referencedRelation: "v_message_forwards"
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
        Relationships: []
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
      workflow_entity: {
        Row: {
          active: boolean
          connections: Json
          createdAt: string
          id: number
          name: string
          nodes: Json
          settings: Json | null
          staticData: Json | null
          updatedAt: string
        }
        Insert: {
          active: boolean
          connections: Json
          createdAt?: string
          id?: number
          name: string
          nodes: Json
          settings?: Json | null
          staticData?: Json | null
          updatedAt?: string
        }
        Update: {
          active?: boolean
          connections?: Json
          createdAt?: string
          id?: number
          name?: string
          nodes?: Json
          settings?: Json | null
          staticData?: Json | null
          updatedAt?: string
        }
        Relationships: []
      }
      workflows_tags: {
        Row: {
          tagId: number
          workflowId: number
        }
        Insert: {
          tagId: number
          workflowId: number
        }
        Update: {
          tagId?: number
          workflowId?: number
        }
        Relationships: [
          {
            foreignKeyName: "FK_31140eb41f019805b40d0087449"
            columns: ["workflowId"]
            isOneToOne: false
            referencedRelation: "workflow_entity"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
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
            referencedRelation: "v_message_forwards"
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
            referencedRelation: "v_message_forwards"
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
      v_media_group_consistency: {
        Row: {
          media_group_id: string | null
          newest_message: string | null
          oldest_message: string | null
          status: string | null
          total_messages: number | null
          with_content: number | null
          without_content: number | null
        }
        Relationships: []
      }
      v_message_forwards: {
        Row: {
          analyzed_content: Json | null
          chat_id: number | null
          created_at: string | null
          file_unique_id: string | null
          forward_chain: Json[] | null
          forward_count: number | null
          id: string | null
          old_analyzed_content: Json[] | null
          original_analyzed_content: Json | null
          original_chat_id: number | null
          original_message_id: string | null
          original_telegram_message_id: number | null
          processing_state:
            | Database["public"]["Enums"]["processing_state_type"]
            | null
          telegram_message_id: number | null
        }
        Relationships: []
      }
      v_message_processing_stats: {
        Row: {
          in_media_group: number | null
          message_count: number | null
          newest_started: string | null
          oldest_started: string | null
          processing_state:
            | Database["public"]["Enums"]["processing_state_type"]
            | null
          with_analyzed_content: number | null
          with_caption: number | null
          with_errors: number | null
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
        Relationships: []
      }
    }
    Functions: {
      binary_quantize:
        | {
            Args: {
              "": string
            }
            Returns: unknown
          }
        | {
            Args: {
              "": unknown
            }
            Returns: unknown
          }
      compute_data_hash: {
        Args: {
          data: Json
        }
        Returns: string
      }
      dates_within_range: {
        Args: {
          date1: string
          date2: string
          days?: number
        }
        Returns: boolean
      }
      extract_media_dimensions: {
        Args: {
          telegram_data: Json
        }
        Returns: {
          width: number
          height: number
          duration: number
        }[]
      }
      halfvec_avg: {
        Args: {
          "": number[]
        }
        Returns: unknown
      }
      halfvec_out: {
        Args: {
          "": unknown
        }
        Returns: unknown
      }
      halfvec_send: {
        Args: {
          "": unknown
        }
        Returns: string
      }
      halfvec_typmod_in: {
        Args: {
          "": unknown[]
        }
        Returns: number
      }
      handle_media_message: {
        Args: {
          p_telegram_message_id: number
          p_chat_id: number
          p_file_unique_id: string
          p_media_data: Json
        }
        Returns: Json
      }
      handle_message_edit: {
        Args: {
          p_message_id: string
          p_telegram_message_id: number
          p_chat_id: number
          p_new_text: string
          p_new_caption: string
          p_telegram_data: Json
          p_is_channel_post?: boolean
          p_edit_source?: string
        }
        Returns: Json
      }
      hnsw_bit_support: {
        Args: {
          "": unknown
        }
        Returns: unknown
      }
      hnsw_halfvec_support: {
        Args: {
          "": unknown
        }
        Returns: unknown
      }
      hnsw_sparsevec_support: {
        Args: {
          "": unknown
        }
        Returns: unknown
      }
      hnswhandler: {
        Args: {
          "": unknown
        }
        Returns: unknown
      }
      ivfflat_bit_support: {
        Args: {
          "": unknown
        }
        Returns: unknown
      }
      ivfflat_halfvec_support: {
        Args: {
          "": unknown
        }
        Returns: unknown
      }
      ivfflathandler: {
        Args: {
          "": unknown
        }
        Returns: unknown
      }
      l2_norm:
        | {
            Args: {
              "": unknown
            }
            Returns: number
          }
        | {
            Args: {
              "": unknown
            }
            Returns: number
          }
      l2_normalize:
        | {
            Args: {
              "": string
            }
            Returns: string
          }
        | {
            Args: {
              "": unknown
            }
            Returns: unknown
          }
        | {
            Args: {
              "": unknown
            }
            Returns: unknown
          }
      match_documents: {
        Args: {
          query_embedding: string
          match_count?: number
          filter?: Json
        }
        Returns: {
          id: number
          content: string
          metadata: Json
          similarity: number
        }[]
      }
      md_handle_duplicate_media_message: {
        Args: {
          p_file_unique_id: string
          p_chat_id: number
          p_telegram_message_id: number
          p_media_data: Json
        }
        Returns: Json
      }
      pg_stat_statements: {
        Args: {
          showtext: boolean
        }
        Returns: Record<string, unknown>[]
      }
      pg_stat_statements_info: {
        Args: Record<PropertyKey, never>
        Returns: Record<string, unknown>
      }
      pg_stat_statements_reset: {
        Args: {
          userid?: unknown
          dbid?: unknown
          queryid?: number
        }
        Returns: undefined
      }
      process_message_caption: {
        Args: {
          p_message_id: string
          p_caption: string
          p_correlation_id: string
        }
        Returns: Json
      }
      process_pending_messages: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      process_telegram_message: {
        Args: {
          p_message_id: string
          p_correlation_id?: string
          p_force?: boolean
        }
        Returns: Json
      }
      process_webhook_event: {
        Args: {
          p_event_id: string
        }
        Returns: undefined
      }
      recheck_media_groups: {
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
      reset_stalled_messages: {
        Args: {
          p_timeout_minutes?: number
        }
        Returns: Json
      }
      sparsevec_out: {
        Args: {
          "": unknown
        }
        Returns: unknown
      }
      sparsevec_send: {
        Args: {
          "": unknown
        }
        Returns: string
      }
      sparsevec_typmod_in: {
        Args: {
          "": unknown[]
        }
        Returns: number
      }
      sync_media_group: {
        Args: {
          p_message_id: string
          p_correlation_id: string
        }
        Returns: Json
      }
      vector_avg: {
        Args: {
          "": number[]
        }
        Returns: string
      }
      vector_dims:
        | {
            Args: {
              "": string
            }
            Returns: number
          }
        | {
            Args: {
              "": unknown
            }
            Returns: number
          }
      vector_norm: {
        Args: {
          "": string
        }
        Returns: number
      }
      vector_out: {
        Args: {
          "": string
        }
        Returns: unknown
      }
      vector_send: {
        Args: {
          "": string
        }
        Returns: string
      }
      vector_typmod_in: {
        Args: {
          "": unknown[]
        }
        Returns: number
      }
      xdelo_cleanup_stalled_processing: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      xdelo_reset_stalled_messages: {
        Args: {
          minutes_threshold?: number
        }
        Returns: {
          message_id: string
          old_state: string
          new_state: string
        }[]
      }
      xdelo_sync_incomplete_media_group: {
        Args: {
          p_media_group_id: string
          p_source_message_id: string
          p_analyzed_content: Json
        }
        Returns: undefined
      }
      xdelo_sync_media_group_content: {
        Args: {
          p_message_id: string
          p_analyzed_content: Json
          p_force_sync?: boolean
          p_sync_edit_history?: boolean
        }
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
        | "pending_reprocess"
        | "failed"
      processing_state_type:
        | "initialized"
        | "pending"
        | "processing"
        | "completed"
        | "error"
        | "pending_reprocess"
        | "partial_success"
        | "failed"
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
