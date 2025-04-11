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
      messages: {
        Row: {
          analyzed_content: Json | null
          caption: string | null
          caption_data: Json | null
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
          extension: string | null
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
          last_synced_at: string | null
          media_group_id: string | null
          media_group_sync: boolean | null
          media_type: string | null
          message_caption_id: string | null
          message_data: Json | null
          message_date: string | null
          message_type: string | null
          message_url: string | null
          mime_type: string | null
          mime_type_original: string | null
          needs_redownload: boolean | null
          notes: string | null
          old_analyzed_content: Json | null
          old_product_code: string | null
          old_product_name: string | null
          old_product_quantity: number | null
          old_purchase_date: string | null
          old_vendor_uid: string | null
          original_file_id: string | null
          original_message_id: string | null
          processing_attempts: number | null
          processing_completed_at: string | null
          processing_error: string | null
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
          caption_data?: Json | null
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
          extension?: string | null
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
          last_synced_at?: string | null
          media_group_id?: string | null
          media_group_sync?: boolean | null
          media_type?: string | null
          message_caption_id?: string | null
          message_data?: Json | null
          message_date?: string | null
          message_type?: string | null
          message_url?: string | null
          mime_type?: string | null
          mime_type_original?: string | null
          needs_redownload?: boolean | null
          notes?: string | null
          old_analyzed_content?: Json | null
          old_product_code?: string | null
          old_product_name?: string | null
          old_product_quantity?: number | null
          old_purchase_date?: string | null
          old_vendor_uid?: string | null
          original_file_id?: string | null
          original_message_id?: string | null
          processing_attempts?: number | null
          processing_completed_at?: string | null
          processing_error?: string | null
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
          caption_data?: Json | null
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
          extension?: string | null
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
          last_synced_at?: string | null
          media_group_id?: string | null
          media_group_sync?: boolean | null
          media_type?: string | null
          message_caption_id?: string | null
          message_data?: Json | null
          message_date?: string | null
          message_type?: string | null
          message_url?: string | null
          mime_type?: string | null
          mime_type_original?: string | null
          needs_redownload?: boolean | null
          notes?: string | null
          old_analyzed_content?: Json | null
          old_product_code?: string | null
          old_product_name?: string | null
          old_product_quantity?: number | null
          old_purchase_date?: string | null
          old_vendor_uid?: string | null
          original_file_id?: string | null
          original_message_id?: string | null
          processing_attempts?: number | null
          processing_completed_at?: string | null
          processing_error?: string | null
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
      other_messages: {
        Row: {
          analyzed_content: Json | null
          chat_id: number
          chat_title: string | null
          chat_type: Database["public"]["Enums"]["telegram_chat_type"]
          correlation_id: string | null
          created_at: string
          edit_count: number | null
          edit_date: string | null
          edit_history: Json | null
          error_message: string | null
          forward_info: Json | null
          id: string
          is_edited: boolean
          is_forward: boolean | null
          last_error_at: string | null
          message_data: Json | null
          message_date: string | null
          message_text: string | null
          message_type: string
          message_url: string | null
          notes: string | null
          old_analyzed_content: Json | null
          processing_completed_at: string | null
          processing_correlation_id: string | null
          processing_error: string | null
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
          edit_count?: number | null
          edit_date?: string | null
          edit_history?: Json | null
          error_message?: string | null
          forward_info?: Json | null
          id?: string
          is_edited?: boolean
          is_forward?: boolean | null
          last_error_at?: string | null
          message_data?: Json | null
          message_date?: string | null
          message_text?: string | null
          message_type: string
          message_url?: string | null
          notes?: string | null
          old_analyzed_content?: Json | null
          processing_completed_at?: string | null
          processing_correlation_id?: string | null
          processing_error?: string | null
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
          edit_count?: number | null
          edit_date?: string | null
          edit_history?: Json | null
          error_message?: string | null
          forward_info?: Json | null
          id?: string
          is_edited?: boolean
          is_forward?: boolean | null
          last_error_at?: string | null
          message_data?: Json | null
          message_date?: string | null
          message_text?: string | null
          message_type?: string
          message_url?: string | null
          notes?: string | null
          old_analyzed_content?: Json | null
          processing_completed_at?: string | null
          processing_correlation_id?: string | null
          processing_error?: string | null
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
          entity_id: string | null
          error_message: string | null
          event_data: string | null
          event_message: string | null
          event_timestamp: string
          event_type: string | null
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
          entity_id?: string | null
          error_message?: string | null
          event_data?: string | null
          event_message?: string | null
          event_timestamp?: string
          event_type?: string | null
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
          entity_id?: string | null
          error_message?: string | null
          event_data?: string | null
          event_message?: string | null
          event_timestamp?: string
          event_type?: string | null
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
    }
    Views: {
      gl_tables_view: {
        Row: {
          table_name: unknown | null
        }
        Relationships: []
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
      align_caption_and_analyzed_content: {
        Args: Record<PropertyKey, never>
        Returns: number
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
      find_inconsistent_media_groups: {
        Args: { p_limit?: number }
        Returns: {
          media_group_id: string
          message_count: number
          syncable_messages: number
          needs_sync_messages: number
          best_source_id: string
        }[]
      }
      insert_new_media_message: {
        Args: {
          p_telegram_message_id: number
          p_chat_id: number
          p_file_unique_id: string
          p_file_id: string
          p_storage_path: string
          p_public_url: string
          p_mime_type: string
          p_extension: string
          p_media_type: string
          p_caption: string
          p_message_data: Json
          p_correlation_id: string
          p_processing_state?: string
          p_processing_error?: string
          p_forward_info?: Json
          p_media_group_id?: string
          p_caption_data?: Json
          p_analyzed_content?: Json
        }
        Returns: string
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
      update_duplicate_media_message: {
        Args: {
          p_telegram_message_id: number
          p_chat_id: number
          p_file_unique_id: string
          p_file_id: string
          p_storage_path: string
          p_public_url: string
          p_mime_type: string
          p_extension: string
          p_media_type: string
          p_caption: string
          p_message_data: Json
          p_correlation_id: string
          p_media_group_id?: string
          p_forward_info?: Json
          p_processing_state?: string
          p_caption_data?: Json
          p_analyzed_content?: Json
        }
        Returns: string
      }
      update_edited_media_message: {
        Args: {
          p_telegram_message_id: number
          p_chat_id: number
          p_file_id: string
          p_file_unique_id: string
          p_caption: string
          p_processing_state: string
          p_message_data: Json
          p_correlation_id: string
          p_storage_path?: string
          p_public_url?: string
          p_mime_type?: string
          p_extension?: string
          p_media_type?: string
          p_caption_data?: Json
          p_analyzed_content?: Json
          p_media_group_id?: string
          p_processing_error?: string
        }
        Returns: string
      }
      upsert_media_message: {
        Args: {
          p_analyzed_content?: Json
          p_caption?: string
          p_caption_data?: Json
          p_chat_id?: number
          p_correlation_id?: string
          p_extension?: string
          p_file_id?: string
          p_file_unique_id?: string
          p_forward_info?: Json
          p_media_group_id?: string
          p_media_type?: string
          p_message_data?: Json
          p_mime_type?: string
          p_old_analyzed_content?: Json
          p_processing_error?: string
          p_processing_state?: string
          p_public_url?: string
          p_storage_path?: string
          p_telegram_message_id?: number
          p_user_id?: number
          p_is_edited?: boolean
          p_additional_updates?: Json
        }
        Returns: string
      }
      upsert_text_message: {
        Args: {
          p_telegram_message_id: number
          p_chat_id: number
          p_telegram_data: Json
          p_message_text?: string
          p_message_type?: string
          p_chat_type?: string
          p_chat_title?: string
          p_forward_info?: Json
          p_processing_state?: string
          p_correlation_id?: string
        }
        Returns: string
      }
      validate_forward_info: {
        Args: { forward_info: Json }
        Returns: boolean
      }
      x_sync_pending_media_groups: {
        Args: Record<PropertyKey, never>
        Returns: number
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
        | "processed"
      processing_state_type:
        | "initialized"
        | "pending"
        | "processing"
        | "completed"
        | "error"
        | "processed"
        | "pending_analysis"
        | "duplicate"
        | "download_failed_forwarded"
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
        "processed",
      ],
      processing_state_type: [
        "initialized",
        "pending",
        "processing",
        "completed",
        "error",
        "processed",
        "pending_analysis",
        "duplicate",
        "download_failed_forwarded",
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
