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
        Relationships: []
      }
      glide_accounts: {
        Row: {
          created_at: string | null
          glide_id: string | null
          id: string
          last_sync_time: string | null
          name: string
          sync_status: Database["public"]["Enums"]["sync_status"] | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          glide_id?: string | null
          id?: string
          last_sync_time?: string | null
          name: string
          sync_status?: Database["public"]["Enums"]["sync_status"] | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          glide_id?: string | null
          id?: string
          last_sync_time?: string | null
          name?: string
          sync_status?: Database["public"]["Enums"]["sync_status"] | null
          updated_at?: string | null
        }
        Relationships: []
      }
      glide_configuration: {
        Row: {
          api_endpoint: string
          api_key: string
          app_id: string
          created_at: string | null
          field_mappings: Json
          glide_table_name: string
          id: string
          is_active: boolean
          supabase_table_name: string
          supported_operations: string[]
          table_id: string
          updated_at: string | null
        }
        Insert: {
          api_endpoint: string
          api_key: string
          app_id: string
          created_at?: string | null
          field_mappings?: Json
          glide_table_name: string
          id?: string
          is_active?: boolean
          supabase_table_name: string
          supported_operations?: string[]
          table_id: string
          updated_at?: string | null
        }
        Update: {
          api_endpoint?: string
          api_key?: string
          app_id?: string
          created_at?: string | null
          field_mappings?: Json
          glide_table_name?: string
          id?: string
          is_active?: boolean
          supabase_table_name?: string
          supported_operations?: string[]
          table_id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      glide_customer_credits: {
        Row: {
          amount: number | null
          created_at: string | null
          credit_date: string | null
          customer_id: string | null
          glide_id: string | null
          id: string
          last_sync_time: string | null
          sync_status: Database["public"]["Enums"]["sync_status"] | null
          updated_at: string | null
        }
        Insert: {
          amount?: number | null
          created_at?: string | null
          credit_date?: string | null
          customer_id?: string | null
          glide_id?: string | null
          id?: string
          last_sync_time?: string | null
          sync_status?: Database["public"]["Enums"]["sync_status"] | null
          updated_at?: string | null
        }
        Update: {
          amount?: number | null
          created_at?: string | null
          credit_date?: string | null
          customer_id?: string | null
          glide_id?: string | null
          id?: string
          last_sync_time?: string | null
          sync_status?: Database["public"]["Enums"]["sync_status"] | null
          updated_at?: string | null
        }
        Relationships: []
      }
      glide_customer_payments: {
        Row: {
          amount: number | null
          created_at: string | null
          customer_id: string | null
          glide_id: string | null
          id: string
          last_sync_time: string | null
          payment_date: string | null
          sync_status: Database["public"]["Enums"]["sync_status"] | null
          updated_at: string | null
        }
        Insert: {
          amount?: number | null
          created_at?: string | null
          customer_id?: string | null
          glide_id?: string | null
          id?: string
          last_sync_time?: string | null
          payment_date?: string | null
          sync_status?: Database["public"]["Enums"]["sync_status"] | null
          updated_at?: string | null
        }
        Update: {
          amount?: number | null
          created_at?: string | null
          customer_id?: string | null
          glide_id?: string | null
          id?: string
          last_sync_time?: string | null
          payment_date?: string | null
          sync_status?: Database["public"]["Enums"]["sync_status"] | null
          updated_at?: string | null
        }
        Relationships: []
      }
      glide_estimate_lines: {
        Row: {
          created_at: string | null
          estimate_id: string | null
          glide_id: string | null
          id: string
          last_sync_time: string | null
          price: number | null
          product_id: string | null
          quantity: number | null
          sync_status: Database["public"]["Enums"]["sync_status"] | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          estimate_id?: string | null
          glide_id?: string | null
          id?: string
          last_sync_time?: string | null
          price?: number | null
          product_id?: string | null
          quantity?: number | null
          sync_status?: Database["public"]["Enums"]["sync_status"] | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          estimate_id?: string | null
          glide_id?: string | null
          id?: string
          last_sync_time?: string | null
          price?: number | null
          product_id?: string | null
          quantity?: number | null
          sync_status?: Database["public"]["Enums"]["sync_status"] | null
          updated_at?: string | null
        }
        Relationships: []
      }
      glide_estimates: {
        Row: {
          created_at: string | null
          customer_id: string | null
          estimate_date: string | null
          glide_id: string | null
          id: string
          last_sync_time: string | null
          sync_status: Database["public"]["Enums"]["sync_status"] | null
          total_amount: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          customer_id?: string | null
          estimate_date?: string | null
          glide_id?: string | null
          id?: string
          last_sync_time?: string | null
          sync_status?: Database["public"]["Enums"]["sync_status"] | null
          total_amount?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          customer_id?: string | null
          estimate_date?: string | null
          glide_id?: string | null
          id?: string
          last_sync_time?: string | null
          sync_status?: Database["public"]["Enums"]["sync_status"] | null
          total_amount?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      glide_expenses: {
        Row: {
          amount: number | null
          category: string | null
          created_at: string | null
          expense_date: string | null
          glide_id: string | null
          id: string
          last_sync_time: string | null
          sync_status: Database["public"]["Enums"]["sync_status"] | null
          updated_at: string | null
        }
        Insert: {
          amount?: number | null
          category?: string | null
          created_at?: string | null
          expense_date?: string | null
          glide_id?: string | null
          id?: string
          last_sync_time?: string | null
          sync_status?: Database["public"]["Enums"]["sync_status"] | null
          updated_at?: string | null
        }
        Update: {
          amount?: number | null
          category?: string | null
          created_at?: string | null
          expense_date?: string | null
          glide_id?: string | null
          id?: string
          last_sync_time?: string | null
          sync_status?: Database["public"]["Enums"]["sync_status"] | null
          updated_at?: string | null
        }
        Relationships: []
      }
      glide_invoice_lines: {
        Row: {
          created_at: string | null
          glide_id: string | null
          id: string
          invoice_id: string | null
          last_sync_time: string | null
          price: number | null
          product_id: string | null
          quantity: number | null
          sync_status: Database["public"]["Enums"]["sync_status"] | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          glide_id?: string | null
          id?: string
          invoice_id?: string | null
          last_sync_time?: string | null
          price?: number | null
          product_id?: string | null
          quantity?: number | null
          sync_status?: Database["public"]["Enums"]["sync_status"] | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          glide_id?: string | null
          id?: string
          invoice_id?: string | null
          last_sync_time?: string | null
          price?: number | null
          product_id?: string | null
          quantity?: number | null
          sync_status?: Database["public"]["Enums"]["sync_status"] | null
          updated_at?: string | null
        }
        Relationships: []
      }
      glide_invoices: {
        Row: {
          created_at: string | null
          customer_id: string | null
          glide_id: string | null
          id: string
          invoice_date: string | null
          last_sync_time: string | null
          sync_status: Database["public"]["Enums"]["sync_status"] | null
          total_amount: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          customer_id?: string | null
          glide_id?: string | null
          id?: string
          invoice_date?: string | null
          last_sync_time?: string | null
          sync_status?: Database["public"]["Enums"]["sync_status"] | null
          total_amount?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          customer_id?: string | null
          glide_id?: string | null
          id?: string
          invoice_date?: string | null
          last_sync_time?: string | null
          sync_status?: Database["public"]["Enums"]["sync_status"] | null
          total_amount?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      glide_products: {
        Row: {
          cost: number | null
          created_at: string | null
          glide_id: string | null
          id: string
          last_sync_time: string | null
          name: string
          sync_status: Database["public"]["Enums"]["sync_status"] | null
          updated_at: string | null
        }
        Insert: {
          cost?: number | null
          created_at?: string | null
          glide_id?: string | null
          id?: string
          last_sync_time?: string | null
          name: string
          sync_status?: Database["public"]["Enums"]["sync_status"] | null
          updated_at?: string | null
        }
        Update: {
          cost?: number | null
          created_at?: string | null
          glide_id?: string | null
          id?: string
          last_sync_time?: string | null
          name?: string
          sync_status?: Database["public"]["Enums"]["sync_status"] | null
          updated_at?: string | null
        }
        Relationships: []
      }
      glide_purchase_orders: {
        Row: {
          created_at: string | null
          glide_id: string | null
          id: string
          last_sync_time: string | null
          order_date: string | null
          sync_status: Database["public"]["Enums"]["sync_status"] | null
          total_amount: number | null
          updated_at: string | null
          vendor_id: string | null
        }
        Insert: {
          created_at?: string | null
          glide_id?: string | null
          id?: string
          last_sync_time?: string | null
          order_date?: string | null
          sync_status?: Database["public"]["Enums"]["sync_status"] | null
          total_amount?: number | null
          updated_at?: string | null
          vendor_id?: string | null
        }
        Update: {
          created_at?: string | null
          glide_id?: string | null
          id?: string
          last_sync_time?: string | null
          order_date?: string | null
          sync_status?: Database["public"]["Enums"]["sync_status"] | null
          total_amount?: number | null
          updated_at?: string | null
          vendor_id?: string | null
        }
        Relationships: []
      }
      glide_shipping_records: {
        Row: {
          created_at: string | null
          glide_id: string | null
          id: string
          last_sync_time: string | null
          order_id: string | null
          shipping_date: string | null
          sync_status: Database["public"]["Enums"]["sync_status"] | null
          tracking_number: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          glide_id?: string | null
          id?: string
          last_sync_time?: string | null
          order_id?: string | null
          shipping_date?: string | null
          sync_status?: Database["public"]["Enums"]["sync_status"] | null
          tracking_number?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          glide_id?: string | null
          id?: string
          last_sync_time?: string | null
          order_id?: string | null
          shipping_date?: string | null
          sync_status?: Database["public"]["Enums"]["sync_status"] | null
          tracking_number?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      glide_sync_logs: {
        Row: {
          created_at: string | null
          error_message: string | null
          glide_id: string | null
          id: string
          operation: string
          record_id: string
          status: string
          table_name: string
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          glide_id?: string | null
          id?: string
          operation: string
          record_id: string
          status: string
          table_name: string
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          glide_id?: string | null
          id?: string
          operation?: string
          record_id?: string
          status?: string
          table_name?: string
        }
        Relationships: []
      }
      glide_sync_metadata: {
        Row: {
          created_at: string | null
          error_message: string | null
          id: string
          last_sync_time: string | null
          sync_status: Database["public"]["Enums"]["sync_status"] | null
          table_name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          id?: string
          last_sync_time?: string | null
          sync_status?: Database["public"]["Enums"]["sync_status"] | null
          table_name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          id?: string
          last_sync_time?: string | null
          sync_status?: Database["public"]["Enums"]["sync_status"] | null
          table_name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      glide_sync_queue: {
        Row: {
          created_at: string | null
          error_message: string | null
          id: string
          mapped_data: Json | null
          operation_type: string
          raw_data: Json | null
          record_id: string
          retry_count: number | null
          status: Database["public"]["Enums"]["sync_status"] | null
          table_name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          id?: string
          mapped_data?: Json | null
          operation_type: string
          raw_data?: Json | null
          record_id: string
          retry_count?: number | null
          status?: Database["public"]["Enums"]["sync_status"] | null
          table_name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          id?: string
          mapped_data?: Json | null
          operation_type?: string
          raw_data?: Json | null
          record_id?: string
          retry_count?: number | null
          status?: Database["public"]["Enums"]["sync_status"] | null
          table_name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      glide_vendor_payments: {
        Row: {
          amount: number | null
          created_at: string | null
          glide_id: string | null
          id: string
          last_sync_time: string | null
          payment_date: string | null
          sync_status: Database["public"]["Enums"]["sync_status"] | null
          updated_at: string | null
          vendor_id: string | null
        }
        Insert: {
          amount?: number | null
          created_at?: string | null
          glide_id?: string | null
          id?: string
          last_sync_time?: string | null
          payment_date?: string | null
          sync_status?: Database["public"]["Enums"]["sync_status"] | null
          updated_at?: string | null
          vendor_id?: string | null
        }
        Update: {
          amount?: number | null
          created_at?: string | null
          glide_id?: string | null
          id?: string
          last_sync_time?: string | null
          payment_date?: string | null
          sync_status?: Database["public"]["Enums"]["sync_status"] | null
          updated_at?: string | null
          vendor_id?: string | null
        }
        Relationships: []
      }
      messages: {
        Row: {
          analyzed_at: string | null
          analyzed_content: Json | null
          caption: string | null
          chat_id: number | null
          chat_type: string | null
          confidence: number | null
          created_at: string | null
          deleted_at: string | null
          duration: number | null
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
          id: string
          is_deleted: boolean | null
          is_original_caption: boolean | null
          last_error_at: string | null
          media_group_id: string | null
          message_caption_id: string | null
          message_url: string | null
          mime_type: string | null
          processing_completed_at: string | null
          processing_started_at: string | null
          processing_state:
            | Database["public"]["Enums"]["message_processing_state"]
            | null
          product_name: string | null
          product_quantity: number | null
          product_unit: string | null
          public_url: string | null
          purchase_order: string | null
          retry_count: number | null
          storage_path: string | null
          supabase_sync_json: Json | null
          telegram_data: Json | null
          telegram_message_id: number | null
          updated_at: string | null
          user_id: string | null
          vendor_name: string | null
          width: number | null
        }
        Insert: {
          analyzed_at?: string | null
          analyzed_content?: Json | null
          caption?: string | null
          chat_id?: number | null
          chat_type?: string | null
          confidence?: number | null
          created_at?: string | null
          deleted_at?: string | null
          duration?: number | null
          error_message?: string | null
          file_id?: string | null
          file_size?: number | null
          file_unique_id?: string | null
          glide_row_id?: string | null
          group_caption_synced?: boolean | null
          group_first_message_time?: string | null
          group_last_message_time?: string | null
          group_message_count?: number | null
          height?: number | null
          id?: string
          is_deleted?: boolean | null
          is_original_caption?: boolean | null
          last_error_at?: string | null
          media_group_id?: string | null
          message_caption_id?: string | null
          message_url?: string | null
          mime_type?: string | null
          processing_completed_at?: string | null
          processing_started_at?: string | null
          processing_state?:
            | Database["public"]["Enums"]["message_processing_state"]
            | null
          product_name?: string | null
          product_quantity?: number | null
          product_unit?: string | null
          public_url?: string | null
          purchase_order?: string | null
          retry_count?: number | null
          storage_path?: string | null
          supabase_sync_json?: Json | null
          telegram_data?: Json | null
          telegram_message_id?: number | null
          updated_at?: string | null
          user_id?: string | null
          vendor_name?: string | null
          width?: number | null
        }
        Update: {
          analyzed_at?: string | null
          analyzed_content?: Json | null
          caption?: string | null
          chat_id?: number | null
          chat_type?: string | null
          confidence?: number | null
          created_at?: string | null
          deleted_at?: string | null
          duration?: number | null
          error_message?: string | null
          file_id?: string | null
          file_size?: number | null
          file_unique_id?: string | null
          glide_row_id?: string | null
          group_caption_synced?: boolean | null
          group_first_message_time?: string | null
          group_last_message_time?: string | null
          group_message_count?: number | null
          height?: number | null
          id?: string
          is_deleted?: boolean | null
          is_original_caption?: boolean | null
          last_error_at?: string | null
          media_group_id?: string | null
          message_caption_id?: string | null
          message_url?: string | null
          mime_type?: string | null
          processing_completed_at?: string | null
          processing_started_at?: string | null
          processing_state?:
            | Database["public"]["Enums"]["message_processing_state"]
            | null
          product_name?: string | null
          product_quantity?: number | null
          product_unit?: string | null
          public_url?: string | null
          purchase_order?: string | null
          retry_count?: number | null
          storage_path?: string | null
          supabase_sync_json?: Json | null
          telegram_data?: Json | null
          telegram_message_id?: number | null
          updated_at?: string | null
          user_id?: string | null
          vendor_name?: string | null
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
          message_url: string | null
          processing_completed_at: string | null
          processing_state: string | null
          telegram_data: Json | null
          telegram_message_id: number | null
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
          message_url?: string | null
          processing_completed_at?: string | null
          processing_state?: string | null
          telegram_data?: Json | null
          telegram_message_id?: number | null
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
          message_url?: string | null
          processing_completed_at?: string | null
          processing_state?: string | null
          telegram_data?: Json | null
          telegram_message_id?: number | null
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
      a_delete_analysis_audit_log_limit_500: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      bytea_to_text: {
        Args: {
          data: string
        }
        Returns: string
      }
      compute_data_hash: {
        Args: {
          data: Json
        }
        Returns: string
      }
      construct_telegram_message_url: {
        Args: {
          chat_type: string
          chat_id: number
          message_id: number
        }
        Returns: string
      }
      delete_media_group: {
        Args: {
          p_media_group_id: string
        }
        Returns: undefined
      }
      extract_analyzed_at: {
        Args: {
          analyzed_content: Json
        }
        Returns: string
      }
      extract_confidence_score: {
        Args: {
          analyzed_content: Json
        }
        Returns: number
      }
      extract_product_code: {
        Args: {
          analyzed_content: Json
        }
        Returns: string
      }
      extract_product_name: {
        Args: {
          analyzed_content: Json
        }
        Returns: string
      }
      extract_product_quantity: {
        Args: {
          analyzed_content: Json
        }
        Returns: number
      }
      extract_vendor_name: {
        Args: {
          analyzed_content: Json
        }
        Returns: string
      }
      fix_media_groups: {
        Args: Record<PropertyKey, never>
        Returns: undefined
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
      manual_sync_media_group: {
        Args: {
          p_media_group_id: string
        }
        Returns: undefined
      }
      parse_analyzed_content: {
        Args: {
          content: Json
        }
        Returns: {
          product_name: string
          product_code: string
          vendor_uid: string
          purchase_date: string
          quantity: number
          notes: string
          parsing_method: string
          confidence: number
          fallbacks_used: string[]
          reanalysis_attempted: boolean
        }[]
      }
      process_media_group_analysis: {
        Args: {
          p_message_id: string
          p_media_group_id: string
          p_analyzed_content: Json
          p_processing_completed_at?: string
        }
        Returns: undefined
      }
      process_media_group_content: {
        Args: {
          p_message_id: string
          p_media_group_id: string
          p_analyzed_content: Json
          p_processing_completed_at?: string
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
      update_purchase_order: {
        Args: Record<PropertyKey, never>
        Returns: undefined
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
      sync_status: "pending" | "synced" | "error" | "locked"
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
