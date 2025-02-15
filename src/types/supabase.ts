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
      sync_matches: {
        Row: {
          id: string
          message_id: string
          product_id: string
          match_priority: number
          confidence_score: number
          match_details: {
            criteria: string[]
            matched_fields: Record<string, string | number | null>
          }
          status: string
          applied: boolean
          created_at: string
          updated_at: string
          created_by: string | null
          updated_by: string | null
        }
        Insert: {
          id?: string
          message_id: string
          product_id: string
          match_priority: number
          confidence_score: number
          match_details: {
            criteria: string[]
            matched_fields: Record<string, string | number | null>
          }
          status?: string
          applied?: boolean
          created_at?: string
          updated_at?: string
          created_by?: string | null
          updated_by?: string | null
        }
        Update: {
          id?: string
          message_id?: string
          product_id?: string
          match_priority?: number
          confidence_score?: number
          match_details?: {
            criteria: string[]
            matched_fields: Record<string, string | number | null>
          }
          status?: string
          applied?: boolean
          created_at?: string
          updated_at?: string
          created_by?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sync_matches_message_id_fkey"
            columns: ["message_id"]
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sync_matches_product_id_fkey"
            columns: ["product_id"]
            referencedRelation: "gl_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sync_matches_created_by_fkey"
            columns: ["created_by"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sync_matches_updated_by_fkey"
            columns: ["updated_by"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      sync_logs: {
        Row: {
          id: string
          operation_type: string
          status: string
          entity_id: string | null
          details: Json | null
          error_message: string | null
          created_at: string
          metadata: Json | null
        }
        Insert: {
          id?: string
          operation_type: string
          status: string
          entity_id?: string | null
          details?: Json | null
          error_message?: string | null
          created_at?: string
          metadata?: Json | null
        }
        Update: {
          id?: string
          operation_type?: string
          status?: string
          entity_id?: string | null
          details?: Json | null
          error_message?: string | null
          created_at?: string
          metadata?: Json | null
        }
        Relationships: []
      }
      messages: {
        Row: {
          id: string
          telegram_message_id: number | null
          caption: string | null
          file_id: string | null
          file_unique_id: string | null
          mime_type: string | null
          public_url: string | null
          media_group_id: string | null
          message_caption_id: string | null
          analyzed_content: Json | null
          telegram_data: Json | null
          user_id: string | null
          created_at: string | null
          updated_at: string | null
          glide_row_id: string | null
          product_to_messages_low_confidence: boolean
          last_match_attempt_at: string | null
          match_attempt_count: number
          product_name: string | null
          vendor_name: string | null
          purchase_order: string | null
          purchase_date: string | null
        }
        Insert: {
          id?: string
          telegram_message_id?: number | null
          caption?: string | null
          file_id?: string | null
          file_unique_id?: string | null
          mime_type?: string | null
          public_url?: string | null
          media_group_id?: string | null
          message_caption_id?: string | null
          analyzed_content?: Json | null
          telegram_data?: Json | null
          user_id?: string | null
          created_at?: string | null
          updated_at?: string | null
          glide_row_id?: string | null
          product_to_messages_low_confidence?: boolean
          last_match_attempt_at?: string | null
          match_attempt_count?: number
          product_name?: string | null
          vendor_name?: string | null
          purchase_order?: string | null
          purchase_date?: string | null
        }
        Update: {
          id?: string
          telegram_message_id?: number | null
          caption?: string | null
          file_id?: string | null
          file_unique_id?: string | null
          mime_type?: string | null
          public_url?: string | null
          media_group_id?: string | null
          message_caption_id?: string | null
          analyzed_content?: Json | null
          telegram_data?: Json | null
          user_id?: string | null
          created_at?: string | null
          updated_at?: string | null
          glide_row_id?: string | null
          product_to_messages_low_confidence?: boolean
          last_match_attempt_at?: string | null
          match_attempt_count?: number
          product_name?: string | null
          vendor_name?: string | null
          purchase_order?: string | null
          purchase_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      gl_products: {
        Row: {
          id: string
          glide_id: string | null
          sync_status: 'pending' | 'synced' | 'error' | null
          last_sync_time: string | null
          created_at: string | null
          updated_at: string | null
          main_product_name: string | null
          main_vendor_uid: string | null
          main_vendor_product_name: string | null
          main_product_purchase_date: string | null
          main_total_qty_purchased: number | null
          main_cost: number | null
          main_cost_update: number | null
          main_samples_or_fronted: boolean | null
          main_more_units_behind: boolean | null
          main_fronted: boolean | null
          main_terms_for_fronted_product: string | null
          main_samples: boolean | null
          main_purchase_notes: string | null
          main_miscellaneous_items: boolean | null
          main_category: string | null
          main_product_image1: string | null
          email_email_of_user_who_added_product: string | null
          date_timestamp_subm: string | null
          cart_add_note: boolean | null
          cart_rename: boolean | null
          main_new_product_name: string | null
          po_converted_po: boolean | null
          po_old_po_rowid: boolean | null
          po_old_po_uid: boolean | null
          main_rename_product: boolean | null
          main_leave_no: boolean | null
          main_total_units_behind_sample: number | null
          last_edited_date: string | null
          rowid_purchase_order_row_id: string | null
          rowid_vpay_row_id: string | null
          rowid_sheet21_pics: string | null
          rowid_product_row_id_for_choice_add_item: string | null
          po_po_date: string | null
          po_pouid_from_add_prod: string | null
          rowid_account_rowid: string | null
          po_added_to_old_po: boolean | null
          last_modified_at: string | null
          product_name_display: string | null
        }
        Insert: {
          id?: string
          glide_id?: string | null
          sync_status?: 'pending' | 'synced' | 'error' | null
          last_sync_time?: string | null
          created_at?: string | null
          updated_at?: string | null
          main_product_name?: string | null
          main_vendor_uid?: string | null
          main_vendor_product_name?: string | null
          main_product_purchase_date?: string | null
          main_total_qty_purchased?: number | null
          main_cost?: number | null
          main_cost_update?: number | null
          main_samples_or_fronted?: boolean | null
          main_more_units_behind?: boolean | null
          main_fronted?: boolean | null
          main_terms_for_fronted_product?: string | null
          main_samples?: boolean | null
          main_purchase_notes?: string | null
          main_miscellaneous_items?: boolean | null
          main_category?: string | null
          main_product_image1?: string | null
          email_email_of_user_who_added_product?: string | null
          date_timestamp_subm?: string | null
          cart_add_note?: boolean | null
          cart_rename?: boolean | null
          main_new_product_name?: string | null
          po_converted_po?: boolean | null
          po_old_po_rowid?: boolean | null
          po_old_po_uid?: boolean | null
          main_rename_product?: boolean | null
          main_leave_no?: boolean | null
          main_total_units_behind_sample?: number | null
          last_edited_date?: string | null
          rowid_purchase_order_row_id?: string | null
          rowid_vpay_row_id?: string | null
          rowid_sheet21_pics?: string | null
          rowid_product_row_id_for_choice_add_item?: string | null
          po_po_date?: string | null
          po_pouid_from_add_prod?: string | null
          rowid_account_rowid?: string | null
          po_added_to_old_po?: boolean | null
          last_modified_at?: string | null
          product_name_display?: string | null
        }
        Update: {
          id?: string
          glide_id?: string | null
          sync_status?: 'pending' | 'synced' | 'error' | null
          last_sync_time?: string | null
          created_at?: string | null
          updated_at?: string | null
          main_product_name?: string | null
          main_vendor_uid?: string | null
          main_vendor_product_name?: string | null
          main_product_purchase_date?: string | null
          main_total_qty_purchased?: number | null
          main_cost?: number | null
          main_cost_update?: number | null
          main_samples_or_fronted?: boolean | null
          main_more_units_behind?: boolean | null
          main_fronted?: boolean | null
          main_terms_for_fronted_product?: string | null
          main_samples?: boolean | null
          main_purchase_notes?: string | null
          main_miscellaneous_items?: boolean | null
          main_category?: string | null
          main_product_image1?: string | null
          email_email_of_user_who_added_product?: string | null
          date_timestamp_subm?: string | null
          cart_add_note?: boolean | null
          cart_rename?: boolean | null
          main_new_product_name?: string | null
          po_converted_po?: boolean | null
          po_old_po_rowid?: boolean | null
          po_old_po_uid?: boolean | null
          main_rename_product?: boolean | null
          main_leave_no?: boolean | null
          main_total_units_behind_sample?: number | null
          last_edited_date?: string | null
          rowid_purchase_order_row_id?: string | null
          rowid_vpay_row_id?: string | null
          rowid_sheet21_pics?: string | null
          rowid_product_row_id_for_choice_add_item?: string | null
          po_po_date?: string | null
          po_pouid_from_add_prod?: string | null
          rowid_account_rowid?: string | null
          po_added_to_old_po?: boolean | null
          last_modified_at?: string | null
          product_name_display?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      process_media_group_content: {
        Args: {
          p_message_id: string
          p_media_group_id: string
          p_analyzed_content: Json
          p_processing_completed_at?: string
          p_correlation_id?: string
        }
        Returns: Json
      }
      handle_sync_retry: {
        Args: Record<PropertyKey, never>
        Returns: unknown
      }
    }
    Enums: {
      sync_status: 'pending' | 'synced' | 'error'
    }
  }
}

export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
export type Enums<T extends keyof Database['public']['Enums']> = Database['public']['Enums'][T]
export type Functions<T extends keyof Database['public']['Functions']> = Database['public']['Functions'][T]

// Helper type for inserting records
export type TablesInsert<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert']

// Helper type for updating records
export type TablesUpdate<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update']

// Helper type for database functions
export type DatabaseFunction<T extends keyof Database['public']['Functions']> = Database['public']['Functions'][T]
