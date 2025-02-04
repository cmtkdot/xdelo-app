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
          account_name: string | null
          account_uid: string | null
          accounts_sync_json: Json | null
          client_type: string | null
          created_at: string | null
          date_added: string | null
          glide_account_row_id: string | null
          id: string
          photo_url: string | null
          rep_email: string | null
          updated_at: string | null
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          account_name?: string | null
          account_uid?: string | null
          accounts_sync_json?: Json | null
          client_type?: string | null
          created_at?: string | null
          date_added?: string | null
          glide_account_row_id?: string | null
          id?: string
          photo_url?: string | null
          rep_email?: string | null
          updated_at?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          account_name?: string | null
          account_uid?: string | null
          accounts_sync_json?: Json | null
          client_type?: string | null
          created_at?: string | null
          date_added?: string | null
          glide_account_row_id?: string | null
          id?: string
          photo_url?: string | null
          rep_email?: string | null
          updated_at?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      glide_configuration: {
        Row: {
          api_endpoint: string | null
          appID: string | null
          Authorization: string | null
          "Content-Type": string | null
          created_at: string | null
          field_mappings: Json | null
          glide_table_name: string
          id: string
          is_active: boolean | null
          supabase_table_name: string
          supported_operations: string[] | null
          tableName: string
          updated_at: string | null
        }
        Insert: {
          api_endpoint?: string | null
          appID?: string | null
          Authorization?: string | null
          "Content-Type"?: string | null
          created_at?: string | null
          field_mappings?: Json | null
          glide_table_name: string
          id?: string
          is_active?: boolean | null
          supabase_table_name: string
          supported_operations?: string[] | null
          tableName: string
          updated_at?: string | null
        }
        Update: {
          api_endpoint?: string | null
          appID?: string | null
          Authorization?: string | null
          "Content-Type"?: string | null
          created_at?: string | null
          field_mappings?: Json | null
          glide_table_name?: string
          id?: string
          is_active?: boolean | null
          supabase_table_name?: string
          supported_operations?: string[] | null
          tableName?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      glide_messages_configuration: {
        Row: {
          api_endpoint: string | null
          auth_token: string | null
          created_at: string | null
          field_mappings: Json | null
          glide_table_name: string
          id: string
          is_active: boolean | null
          updated_at: string | null
        }
        Insert: {
          api_endpoint?: string | null
          auth_token?: string | null
          created_at?: string | null
          field_mappings?: Json | null
          glide_table_name: string
          id?: string
          is_active?: boolean | null
          updated_at?: string | null
        }
        Update: {
          api_endpoint?: string | null
          auth_token?: string | null
          created_at?: string | null
          field_mappings?: Json | null
          glide_table_name?: string
          id?: string
          is_active?: boolean | null
          updated_at?: string | null
        }
        Relationships: []
      }
      glide_messages_sync_metrics: {
        Row: {
          completed_at: string | null
          created_at: string | null
          failed_messages: number | null
          id: string
          performance_data: Json | null
          started_at: string | null
          successful_messages: number | null
          sync_batch_id: string
          total_messages: number | null
          validation_errors: Json | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          failed_messages?: number | null
          id?: string
          performance_data?: Json | null
          started_at?: string | null
          successful_messages?: number | null
          sync_batch_id: string
          total_messages?: number | null
          validation_errors?: Json | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          failed_messages?: number | null
          id?: string
          performance_data?: Json | null
          started_at?: string | null
          successful_messages?: number | null
          sync_batch_id?: string
          total_messages?: number | null
          validation_errors?: Json | null
        }
        Relationships: []
      }
      glide_messages_sync_queue: {
        Row: {
          correlation_id: string | null
          created_at: string | null
          id: string
          last_error: string | null
          message_id: string | null
          processed_at: string | null
          retry_count: number | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          correlation_id?: string | null
          created_at?: string | null
          id?: string
          last_error?: string | null
          message_id?: string | null
          processed_at?: string | null
          retry_count?: number | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          correlation_id?: string | null
          created_at?: string | null
          id?: string
          last_error?: string | null
          message_id?: string | null
          processed_at?: string | null
          retry_count?: number | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "glide_messages_sync_queue_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      glide_products: {
        Row: {
          account_row_id: string | null
          add_note: boolean | null
          category: string | null
          cost: number | null
          cost_update: number | null
          created_at: string | null
          email_user: string | null
          fronted: boolean | null
          glide_product_row_id: string | null
          id: string
          last_edited_date: string | null
          leave_no: boolean | null
          miscellaneous_items: boolean | null
          more_units_behind: boolean | null
          po_date: string | null
          po_uid: string | null
          product_image_url: string | null
          product_name: string | null
          product_purchase_date: string | null
          product_row_id: string | null
          products_sync_json: Json | null
          purchase_notes: string | null
          purchase_order_row_id: string | null
          rename: boolean | null
          rename_product: boolean | null
          samples: boolean | null
          samples_or_fronted: boolean | null
          sheet21_pics: string | null
          terms_fronted_product: string | null
          timestamp_submission: string | null
          total_qty_purchased: number | null
          total_units_behind_sample: number | null
          updated_at: string | null
          user_id: string | null
          vendor_product_name: string | null
          vendor_uid: string | null
          vpay_row_id: string | null
        }
        Insert: {
          account_row_id?: string | null
          add_note?: boolean | null
          category?: string | null
          cost?: number | null
          cost_update?: number | null
          created_at?: string | null
          email_user?: string | null
          fronted?: boolean | null
          glide_product_row_id?: string | null
          id?: string
          last_edited_date?: string | null
          leave_no?: boolean | null
          miscellaneous_items?: boolean | null
          more_units_behind?: boolean | null
          po_date?: string | null
          po_uid?: string | null
          product_image_url?: string | null
          product_name?: string | null
          product_purchase_date?: string | null
          product_row_id?: string | null
          products_sync_json?: Json | null
          purchase_notes?: string | null
          purchase_order_row_id?: string | null
          rename?: boolean | null
          rename_product?: boolean | null
          samples?: boolean | null
          samples_or_fronted?: boolean | null
          sheet21_pics?: string | null
          terms_fronted_product?: string | null
          timestamp_submission?: string | null
          total_qty_purchased?: number | null
          total_units_behind_sample?: number | null
          updated_at?: string | null
          user_id?: string | null
          vendor_product_name?: string | null
          vendor_uid?: string | null
          vpay_row_id?: string | null
        }
        Update: {
          account_row_id?: string | null
          add_note?: boolean | null
          category?: string | null
          cost?: number | null
          cost_update?: number | null
          created_at?: string | null
          email_user?: string | null
          fronted?: boolean | null
          glide_product_row_id?: string | null
          id?: string
          last_edited_date?: string | null
          leave_no?: boolean | null
          miscellaneous_items?: boolean | null
          more_units_behind?: boolean | null
          po_date?: string | null
          po_uid?: string | null
          product_image_url?: string | null
          product_name?: string | null
          product_purchase_date?: string | null
          product_row_id?: string | null
          products_sync_json?: Json | null
          purchase_notes?: string | null
          purchase_order_row_id?: string | null
          rename?: boolean | null
          rename_product?: boolean | null
          samples?: boolean | null
          samples_or_fronted?: boolean | null
          sheet21_pics?: string | null
          terms_fronted_product?: string | null
          timestamp_submission?: string | null
          total_qty_purchased?: number | null
          total_units_behind_sample?: number | null
          updated_at?: string | null
          user_id?: string | null
          vendor_product_name?: string | null
          vendor_uid?: string | null
          vpay_row_id?: string | null
        }
        Relationships: []
      }
      glide_purchase_orders: {
        Row: {
          account_row_id: string | null
          created_at: string | null
          glide_purchase_order_row_id: string | null
          id: string
          last_edited_date: string | null
          payment_date: string | null
          pdf_created_on: string | null
          pdf_link: string | null
          po_date: string | null
          purchase_order_uid: string | null
          purchase_orders_sync_json: Json | null
          shortlink: string | null
          updated_at: string | null
          user_id: string | null
          vpay_row_id: string | null
        }
        Insert: {
          account_row_id?: string | null
          created_at?: string | null
          glide_purchase_order_row_id?: string | null
          id?: string
          last_edited_date?: string | null
          payment_date?: string | null
          pdf_created_on?: string | null
          pdf_link?: string | null
          po_date?: string | null
          purchase_order_uid?: string | null
          purchase_orders_sync_json?: Json | null
          shortlink?: string | null
          updated_at?: string | null
          user_id?: string | null
          vpay_row_id?: string | null
        }
        Update: {
          account_row_id?: string | null
          created_at?: string | null
          glide_purchase_order_row_id?: string | null
          id?: string
          last_edited_date?: string | null
          payment_date?: string | null
          pdf_created_on?: string | null
          pdf_link?: string | null
          po_date?: string | null
          purchase_order_uid?: string | null
          purchase_orders_sync_json?: Json | null
          shortlink?: string | null
          updated_at?: string | null
          user_id?: string | null
          vpay_row_id?: string | null
        }
        Relationships: []
      }
      glide_sync_metrics: {
        Row: {
          completed_at: string | null
          created_at: string | null
          failed_records: number | null
          id: string
          performance_data: Json | null
          started_at: string | null
          successful_records: number | null
          sync_type: string
          table_id: string
          total_records: number | null
          validation_errors: Json | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          failed_records?: number | null
          id?: string
          performance_data?: Json | null
          started_at?: string | null
          successful_records?: number | null
          sync_type: string
          table_id: string
          total_records?: number | null
          validation_errors?: Json | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          failed_records?: number | null
          id?: string
          performance_data?: Json | null
          started_at?: string | null
          successful_records?: number | null
          sync_type?: string
          table_id?: string
          total_records?: number | null
          validation_errors?: Json | null
        }
        Relationships: []
      }
      glide_sync_queue: {
        Row: {
          api_key: string | null
          app_id: string | null
          batch_id: string | null
          batch_index: number | null
          batch_size: number | null
          correlation_id: string | null
          created_at: string | null
          id: string
          last_error: string | null
          message_id: string | null
          operation_type: string | null
          performance_metrics: Json | null
          processed_at: string | null
          rate_limit_reset: string | null
          raw_glide_data: Json | null
          record_id: string | null
          retry_count: number | null
          status: string | null
          sync_completed_at: string | null
          sync_started_at: string | null
          table_id: string | null
          updated_at: string | null
          validation_errors: Json | null
        }
        Insert: {
          api_key?: string | null
          app_id?: string | null
          batch_id?: string | null
          batch_index?: number | null
          batch_size?: number | null
          correlation_id?: string | null
          created_at?: string | null
          id?: string
          last_error?: string | null
          message_id?: string | null
          operation_type?: string | null
          performance_metrics?: Json | null
          processed_at?: string | null
          rate_limit_reset?: string | null
          raw_glide_data?: Json | null
          record_id?: string | null
          retry_count?: number | null
          status?: string | null
          sync_completed_at?: string | null
          sync_started_at?: string | null
          table_id?: string | null
          updated_at?: string | null
          validation_errors?: Json | null
        }
        Update: {
          api_key?: string | null
          app_id?: string | null
          batch_id?: string | null
          batch_index?: number | null
          batch_size?: number | null
          correlation_id?: string | null
          created_at?: string | null
          id?: string
          last_error?: string | null
          message_id?: string | null
          operation_type?: string | null
          performance_metrics?: Json | null
          processed_at?: string | null
          rate_limit_reset?: string | null
          raw_glide_data?: Json | null
          record_id?: string | null
          retry_count?: number | null
          status?: string | null
          sync_completed_at?: string | null
          sync_started_at?: string | null
          table_id?: string | null
          updated_at?: string | null
          validation_errors?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "glide_sync_queue_message_id_fkey"
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
          glide_sync_json: Json | null
          glide_sync_status: string | null
          group_caption_synced: boolean | null
          group_first_message_time: string | null
          group_last_message_time: string | null
          group_message_count: number | null
          height: number | null
          id: string
          is_original_caption: boolean | null
          last_error_at: string | null
          last_synced_at: string | null
          media_group_id: string | null
          message_caption_id: string | null
          mime_type: string | null
          processing_completed_at: string | null
          processing_started_at: string | null
          processing_state:
            | Database["public"]["Enums"]["message_processing_state"]
            | null
          public_url: string | null
          purchase_order_uid: string | null
          retry_count: number | null
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
          glide_sync_json?: Json | null
          glide_sync_status?: string | null
          group_caption_synced?: boolean | null
          group_first_message_time?: string | null
          group_last_message_time?: string | null
          group_message_count?: number | null
          height?: number | null
          id?: string
          is_original_caption?: boolean | null
          last_error_at?: string | null
          last_synced_at?: string | null
          media_group_id?: string | null
          message_caption_id?: string | null
          mime_type?: string | null
          processing_completed_at?: string | null
          processing_started_at?: string | null
          processing_state?:
            | Database["public"]["Enums"]["message_processing_state"]
            | null
          public_url?: string | null
          purchase_order_uid?: string | null
          retry_count?: number | null
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
          glide_sync_json?: Json | null
          glide_sync_status?: string | null
          group_caption_synced?: boolean | null
          group_first_message_time?: string | null
          group_last_message_time?: string | null
          group_message_count?: number | null
          height?: number | null
          id?: string
          is_original_caption?: boolean | null
          last_error_at?: string | null
          last_synced_at?: string | null
          media_group_id?: string | null
          message_caption_id?: string | null
          mime_type?: string | null
          processing_completed_at?: string | null
          processing_started_at?: string | null
          processing_state?:
            | Database["public"]["Enums"]["message_processing_state"]
            | null
          public_url?: string | null
          purchase_order_uid?: string | null
          retry_count?: number | null
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
      process_media_group_analysis:
        | {
            Args: {
              p_message_id: string
              p_media_group_id: string
              p_analyzed_content: Json
              p_processing_completed_at: string
            }
            Returns: undefined
          }
        | {
            Args: {
              p_message_id: string
              p_media_group_id: string
              p_analyzed_content: Json
              p_processing_completed_at: string
              p_correlation_id?: string
            }
            Returns: undefined
          }
      sync_media_group_content: {
        Args: {
          p_message_id: string
          p_media_group_id: string
          p_analyzed_content: Json
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
