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
      account_balance_update_queue: {
        Row: {
          created_at: string
          id: number
          rowid_accounts: string
        }
        Insert: {
          created_at?: string
          id?: number
          rowid_accounts: string
        }
        Update: {
          created_at?: string
          id?: number
          rowid_accounts?: string
        }
        Relationships: []
      }
      auto_match_logs: {
        Row: {
          batch_id: string | null
          details: Json | null
          errors: Json | null
          exact_matches: number | null
          high_confidence_matches: number | null
          id: string
          matches_found: number | null
          messages_processed: number | null
          run_timestamp: string
        }
        Insert: {
          batch_id?: string | null
          details?: Json | null
          errors?: Json | null
          exact_matches?: number | null
          high_confidence_matches?: number | null
          id?: string
          matches_found?: number | null
          messages_processed?: number | null
          run_timestamp?: string
        }
        Update: {
          batch_id?: string | null
          details?: Json | null
          errors?: Json | null
          exact_matches?: number | null
          high_confidence_matches?: number | null
          id?: string
          matches_found?: number | null
          messages_processed?: number | null
          run_timestamp?: string
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
      gl_accounts: {
        Row: {
          account_name: string | null
          accounts_uid: string
          balance: number | null
          client_type: string | null
          created_at: string | null
          customer_balance: number | null
          date_added_client: string | null
          email_of_who_added: string | null
          glide_row_id: string
          id: string
          photo: string | null
          updated_at: string | null
          vendor_balance: number | null
        }
        Insert: {
          account_name?: string | null
          accounts_uid?: string
          balance?: number | null
          client_type?: string | null
          created_at?: string | null
          customer_balance?: number | null
          date_added_client?: string | null
          email_of_who_added?: string | null
          glide_row_id: string
          id?: string
          photo?: string | null
          updated_at?: string | null
          vendor_balance?: number | null
        }
        Update: {
          account_name?: string | null
          accounts_uid?: string
          balance?: number | null
          client_type?: string | null
          created_at?: string | null
          customer_balance?: number | null
          date_added_client?: string | null
          email_of_who_added?: string | null
          glide_row_id?: string
          id?: string
          photo?: string | null
          updated_at?: string | null
          vendor_balance?: number | null
        }
        Relationships: []
      }
      gl_connections: {
        Row: {
          api_key: string
          app_id: string
          app_name: string | null
          created_at: string | null
          id: string
          last_sync: string | null
          settings: Json | null
          status: string | null
        }
        Insert: {
          api_key: string
          app_id: string
          app_name?: string | null
          created_at?: string | null
          id?: string
          last_sync?: string | null
          settings?: Json | null
          status?: string | null
        }
        Update: {
          api_key?: string
          app_id?: string
          app_name?: string | null
          created_at?: string | null
          id?: string
          last_sync?: string | null
          settings?: Json | null
          status?: string | null
        }
        Relationships: []
      }
      gl_customer_credits: {
        Row: {
          created_at: string | null
          date_of_payment: string | null
          glide_row_id: string
          id: string
          payment_amount: number | null
          payment_note: string | null
          payment_type: string | null
          rowid_accounts: string | null
          rowid_estimates: string | null
          rowid_invoices: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          date_of_payment?: string | null
          glide_row_id: string
          id?: string
          payment_amount?: number | null
          payment_note?: string | null
          payment_type?: string | null
          rowid_accounts?: string | null
          rowid_estimates?: string | null
          rowid_invoices?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          date_of_payment?: string | null
          glide_row_id?: string
          id?: string
          payment_amount?: number | null
          payment_note?: string | null
          payment_type?: string | null
          rowid_accounts?: string | null
          rowid_estimates?: string | null
          rowid_invoices?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      gl_customer_payments: {
        Row: {
          created_at: string | null
          date_of_payment: string | null
          email_of_user: string | null
          glide_row_id: string
          id: string
          payment_amount: number | null
          payment_note: string | null
          payment_type: string | null
          rowid_accounts: string | null
          rowid_invoices: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          date_of_payment?: string | null
          email_of_user?: string | null
          glide_row_id: string
          id?: string
          payment_amount?: number | null
          payment_note?: string | null
          payment_type?: string | null
          rowid_accounts?: string | null
          rowid_invoices?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          date_of_payment?: string | null
          email_of_user?: string | null
          glide_row_id?: string
          id?: string
          payment_amount?: number | null
          payment_note?: string | null
          payment_type?: string | null
          rowid_accounts?: string | null
          rowid_invoices?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      gl_estimate_lines: {
        Row: {
          created_at: string | null
          date_of_sale: string | null
          glide_row_id: string
          id: string
          line_total: number | null
          product_name_display: string | null
          qty_sold: number | null
          rowid_estimates: string | null
          rowid_products: string | null
          sale_note: string | null
          sale_product_name: string | null
          selling_price: number | null
          total_stock_after_sell: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          date_of_sale?: string | null
          glide_row_id: string
          id?: string
          line_total?: number | null
          product_name_display?: string | null
          qty_sold?: number | null
          rowid_estimates?: string | null
          rowid_products?: string | null
          sale_note?: string | null
          sale_product_name?: string | null
          selling_price?: number | null
          total_stock_after_sell?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          date_of_sale?: string | null
          glide_row_id?: string
          id?: string
          line_total?: number | null
          product_name_display?: string | null
          qty_sold?: number | null
          rowid_estimates?: string | null
          rowid_products?: string | null
          sale_note?: string | null
          sale_product_name?: string | null
          selling_price?: number | null
          total_stock_after_sell?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      gl_estimates: {
        Row: {
          balance: number | null
          created_at: string | null
          date_invoice_created: string | null
          estimate_date: string | null
          estimate_uid: string | null
          glide_pdf_url: string | null
          glide_pdf_url_secondary: string | null
          glide_row_id: string
          id: string
          is_invoice_created: boolean | null
          is_note_added: boolean | null
          is_sample: boolean | null
          notes: string | null
          rowid_accounts: string | null
          rowid_invoices: string | null
          status: string | null
          supabase_pdf_url: string | null
          total_amount: number | null
          total_credits: number | null
          updated_at: string | null
        }
        Insert: {
          balance?: number | null
          created_at?: string | null
          date_invoice_created?: string | null
          estimate_date?: string | null
          estimate_uid?: string | null
          glide_pdf_url?: string | null
          glide_pdf_url_secondary?: string | null
          glide_row_id: string
          id?: string
          is_invoice_created?: boolean | null
          is_note_added?: boolean | null
          is_sample?: boolean | null
          notes?: string | null
          rowid_accounts?: string | null
          rowid_invoices?: string | null
          status?: string | null
          supabase_pdf_url?: string | null
          total_amount?: number | null
          total_credits?: number | null
          updated_at?: string | null
        }
        Update: {
          balance?: number | null
          created_at?: string | null
          date_invoice_created?: string | null
          estimate_date?: string | null
          estimate_uid?: string | null
          glide_pdf_url?: string | null
          glide_pdf_url_secondary?: string | null
          glide_row_id?: string
          id?: string
          is_invoice_created?: boolean | null
          is_note_added?: boolean | null
          is_sample?: boolean | null
          notes?: string | null
          rowid_accounts?: string | null
          rowid_invoices?: string | null
          status?: string | null
          supabase_pdf_url?: string | null
          total_amount?: number | null
          total_credits?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      gl_expenses: {
        Row: {
          amount: number | null
          category: string | null
          created_at: string | null
          date: string | null
          expense_address: string | null
          expense_cash: string | null
          expense_change: string | null
          expense_list_of_items: string | null
          expense_receipt_image: string | null
          expense_supplier_name: string | null
          expense_tax: string | null
          expense_text_to_json: string | null
          expense_total: string | null
          glide_row_id: string
          id: string
          notes: string | null
          processing: boolean | null
          submitted_by: string | null
          updated_at: string | null
        }
        Insert: {
          amount?: number | null
          category?: string | null
          created_at?: string | null
          date?: string | null
          expense_address?: string | null
          expense_cash?: string | null
          expense_change?: string | null
          expense_list_of_items?: string | null
          expense_receipt_image?: string | null
          expense_supplier_name?: string | null
          expense_tax?: string | null
          expense_text_to_json?: string | null
          expense_total?: string | null
          glide_row_id: string
          id?: string
          notes?: string | null
          processing?: boolean | null
          submitted_by?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number | null
          category?: string | null
          created_at?: string | null
          date?: string | null
          expense_address?: string | null
          expense_cash?: string | null
          expense_change?: string | null
          expense_list_of_items?: string | null
          expense_receipt_image?: string | null
          expense_supplier_name?: string | null
          expense_tax?: string | null
          expense_text_to_json?: string | null
          expense_total?: string | null
          glide_row_id?: string
          id?: string
          notes?: string | null
          processing?: boolean | null
          submitted_by?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      gl_invoice_lines: {
        Row: {
          created_at: string | null
          date_of_sale: string | null
          glide_row_id: string
          id: string
          line_total: number | null
          product_name_display: string | null
          qty_sold: number | null
          renamed_product_name: string | null
          rowid_invoices: string | null
          rowid_products: string | null
          sale_note: string | null
          selling_price: number | null
          updated_at: string | null
          user_email_of_added: string | null
        }
        Insert: {
          created_at?: string | null
          date_of_sale?: string | null
          glide_row_id: string
          id?: string
          line_total?: number | null
          product_name_display?: string | null
          qty_sold?: number | null
          renamed_product_name?: string | null
          rowid_invoices?: string | null
          rowid_products?: string | null
          sale_note?: string | null
          selling_price?: number | null
          updated_at?: string | null
          user_email_of_added?: string | null
        }
        Update: {
          created_at?: string | null
          date_of_sale?: string | null
          glide_row_id?: string
          id?: string
          line_total?: number | null
          product_name_display?: string | null
          qty_sold?: number | null
          renamed_product_name?: string | null
          rowid_invoices?: string | null
          rowid_products?: string | null
          sale_note?: string | null
          selling_price?: number | null
          updated_at?: string | null
          user_email_of_added?: string | null
        }
        Relationships: []
      }
      gl_invoices: {
        Row: {
          balance: number | null
          created_at: string | null
          created_timestamp: string | null
          date_of_invoice: string | null
          glide_pdf_url: string | null
          glide_row_id: string
          id: string
          invoice_uid: string | null
          is_processed: boolean | null
          notes: string | null
          payment_status: string | null
          rowid_accounts: string | null
          submitted_timestamp: string | null
          supabase_pdf_url: string | null
          total_amount: number | null
          total_paid: number | null
          updated_at: string | null
          user_email: string | null
        }
        Insert: {
          balance?: number | null
          created_at?: string | null
          created_timestamp?: string | null
          date_of_invoice?: string | null
          glide_pdf_url?: string | null
          glide_row_id: string
          id?: string
          invoice_uid?: string | null
          is_processed?: boolean | null
          notes?: string | null
          payment_status?: string | null
          rowid_accounts?: string | null
          submitted_timestamp?: string | null
          supabase_pdf_url?: string | null
          total_amount?: number | null
          total_paid?: number | null
          updated_at?: string | null
          user_email?: string | null
        }
        Update: {
          balance?: number | null
          created_at?: string | null
          created_timestamp?: string | null
          date_of_invoice?: string | null
          glide_pdf_url?: string | null
          glide_row_id?: string
          id?: string
          invoice_uid?: string | null
          is_processed?: boolean | null
          notes?: string | null
          payment_status?: string | null
          rowid_accounts?: string | null
          submitted_timestamp?: string | null
          supabase_pdf_url?: string | null
          total_amount?: number | null
          total_paid?: number | null
          updated_at?: string | null
          user_email?: string | null
        }
        Relationships: []
      }
      gl_mappings: {
        Row: {
          column_mappings: Json
          connection_id: string
          created_at: string | null
          enabled: boolean
          glide_table: string
          glide_table_display_name: string
          id: string
          supabase_table: string
          sync_direction: string
          updated_at: string | null
        }
        Insert: {
          column_mappings?: Json
          connection_id: string
          created_at?: string | null
          enabled?: boolean
          glide_table: string
          glide_table_display_name: string
          id?: string
          supabase_table: string
          sync_direction?: string
          updated_at?: string | null
        }
        Update: {
          column_mappings?: Json
          connection_id?: string
          created_at?: string | null
          enabled?: boolean
          glide_table?: string
          glide_table_display_name?: string
          id?: string
          supabase_table?: string
          sync_direction?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gl_mappings_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "gl_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      gl_pdf_generation_queue: {
        Row: {
          attempts: number | null
          created_at: string | null
          document_id: string
          document_type: string
          error_message: string | null
          id: string
          priority: boolean | null
          processed_at: string | null
          success: boolean | null
        }
        Insert: {
          attempts?: number | null
          created_at?: string | null
          document_id: string
          document_type: string
          error_message?: string | null
          id?: string
          priority?: boolean | null
          processed_at?: string | null
          success?: boolean | null
        }
        Update: {
          attempts?: number | null
          created_at?: string | null
          document_id?: string
          document_type?: string
          error_message?: string | null
          id?: string
          priority?: boolean | null
          processed_at?: string | null
          success?: boolean | null
        }
        Relationships: []
      }
      gl_products: {
        Row: {
          category: string | null
          cost: number | null
          created_at: string | null
          date_of_purchase: string | null
          date_timestamp_subm: string | null
          display_name: string | null
          email_email_of_user_who_added_product: string | null
          glide_row_id: string
          id: string
          is_fronted: boolean | null
          is_miscellaneous: boolean | null
          is_sample: boolean | null
          is_sample_or_fronted: boolean | null
          new_product_name: string | null
          po_date: string | null
          product_image1: string | null
          public_url_image: string | null
          public_url_video: string | null
          purchase_note: string | null
          purchase_order_uid: string | null
          rowid_accounts: string | null
          rowid_purchase_orders: string | null
          rowid_vendor_payments: string | null
          terms_for_fronted_product: string | null
          total_cost: number | null
          total_qty_purchased: number | null
          total_units_behind_sample: number | null
          updated_at: string | null
          vendor_product_name: string | null
        }
        Insert: {
          category?: string | null
          cost?: number | null
          created_at?: string | null
          date_of_purchase?: string | null
          date_timestamp_subm?: string | null
          display_name?: string | null
          email_email_of_user_who_added_product?: string | null
          glide_row_id: string
          id?: string
          is_fronted?: boolean | null
          is_miscellaneous?: boolean | null
          is_sample?: boolean | null
          is_sample_or_fronted?: boolean | null
          new_product_name?: string | null
          po_date?: string | null
          product_image1?: string | null
          public_url_image?: string | null
          public_url_video?: string | null
          purchase_note?: string | null
          purchase_order_uid?: string | null
          rowid_accounts?: string | null
          rowid_purchase_orders?: string | null
          rowid_vendor_payments?: string | null
          terms_for_fronted_product?: string | null
          total_cost?: number | null
          total_qty_purchased?: number | null
          total_units_behind_sample?: number | null
          updated_at?: string | null
          vendor_product_name?: string | null
        }
        Update: {
          category?: string | null
          cost?: number | null
          created_at?: string | null
          date_of_purchase?: string | null
          date_timestamp_subm?: string | null
          display_name?: string | null
          email_email_of_user_who_added_product?: string | null
          glide_row_id?: string
          id?: string
          is_fronted?: boolean | null
          is_miscellaneous?: boolean | null
          is_sample?: boolean | null
          is_sample_or_fronted?: boolean | null
          new_product_name?: string | null
          po_date?: string | null
          product_image1?: string | null
          public_url_image?: string | null
          public_url_video?: string | null
          purchase_note?: string | null
          purchase_order_uid?: string | null
          rowid_accounts?: string | null
          rowid_purchase_orders?: string | null
          rowid_vendor_payments?: string | null
          terms_for_fronted_product?: string | null
          total_cost?: number | null
          total_qty_purchased?: number | null
          total_units_behind_sample?: number | null
          updated_at?: string | null
          vendor_product_name?: string | null
        }
        Relationships: []
      }
      gl_purchase_orders: {
        Row: {
          balance: number | null
          created_at: string | null
          date_payment_date_mddyyyy: string | null
          glide_pdf_url: string | null
          glide_pdf_url_secondary: string | null
          glide_row_id: string
          id: string
          payment_status: string | null
          po_date: string | null
          product_count: number | null
          purchase_order_uid: string | null
          rowid_accounts: string | null
          supabase_pdf_url: string | null
          total_amount: number | null
          total_paid: number | null
          updated_at: string | null
        }
        Insert: {
          balance?: number | null
          created_at?: string | null
          date_payment_date_mddyyyy?: string | null
          glide_pdf_url?: string | null
          glide_pdf_url_secondary?: string | null
          glide_row_id: string
          id?: string
          payment_status?: string | null
          po_date?: string | null
          product_count?: number | null
          purchase_order_uid?: string | null
          rowid_accounts?: string | null
          supabase_pdf_url?: string | null
          total_amount?: number | null
          total_paid?: number | null
          updated_at?: string | null
        }
        Update: {
          balance?: number | null
          created_at?: string | null
          date_payment_date_mddyyyy?: string | null
          glide_pdf_url?: string | null
          glide_pdf_url_secondary?: string | null
          glide_row_id?: string
          id?: string
          payment_status?: string | null
          po_date?: string | null
          product_count?: number | null
          purchase_order_uid?: string | null
          rowid_accounts?: string | null
          supabase_pdf_url?: string | null
          total_amount?: number | null
          total_paid?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      gl_shipping_records: {
        Row: {
          box_sizes: string | null
          box_weight: number | null
          created_at: string | null
          drop_off_location_uid: string | null
          glide_row_id: string
          id: string
          receiver_address: string | null
          receiver_name: string | null
          receiver_state: string | null
          rowid_accounts: string | null
          rowid_invoices: string | null
          sender_address: string | null
          sender_name_company: string | null
          sender_phone: string | null
          ship_date: string | null
          tp_id: string | null
          tracking_number: string | null
          updated_at: string | null
        }
        Insert: {
          box_sizes?: string | null
          box_weight?: number | null
          created_at?: string | null
          drop_off_location_uid?: string | null
          glide_row_id: string
          id?: string
          receiver_address?: string | null
          receiver_name?: string | null
          receiver_state?: string | null
          rowid_accounts?: string | null
          rowid_invoices?: string | null
          sender_address?: string | null
          sender_name_company?: string | null
          sender_phone?: string | null
          ship_date?: string | null
          tp_id?: string | null
          tracking_number?: string | null
          updated_at?: string | null
        }
        Update: {
          box_sizes?: string | null
          box_weight?: number | null
          created_at?: string | null
          drop_off_location_uid?: string | null
          glide_row_id?: string
          id?: string
          receiver_address?: string | null
          receiver_name?: string | null
          receiver_state?: string | null
          rowid_accounts?: string | null
          rowid_invoices?: string | null
          sender_address?: string | null
          sender_name_company?: string | null
          sender_phone?: string | null
          ship_date?: string | null
          tp_id?: string | null
          tracking_number?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      gl_sync_errors: {
        Row: {
          created_at: string | null
          error_message: string
          error_type: string
          id: string
          mapping_id: string | null
          record_data: Json | null
          resolution_notes: string | null
          resolved_at: string | null
          retryable: boolean | null
        }
        Insert: {
          created_at?: string | null
          error_message: string
          error_type: string
          id?: string
          mapping_id?: string | null
          record_data?: Json | null
          resolution_notes?: string | null
          resolved_at?: string | null
          retryable?: boolean | null
        }
        Update: {
          created_at?: string | null
          error_message?: string
          error_type?: string
          id?: string
          mapping_id?: string | null
          record_data?: Json | null
          resolution_notes?: string | null
          resolved_at?: string | null
          retryable?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "gl_sync_errors_mapping_id_fkey"
            columns: ["mapping_id"]
            isOneToOne: false
            referencedRelation: "gl_mapping_status"
            referencedColumns: ["mapping_id"]
          },
          {
            foreignKeyName: "gl_sync_errors_mapping_id_fkey"
            columns: ["mapping_id"]
            isOneToOne: false
            referencedRelation: "gl_mappings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gl_sync_errors_mapping_id_fkey"
            columns: ["mapping_id"]
            isOneToOne: false
            referencedRelation: "gl_product_sync_stats"
            referencedColumns: ["mapping_id"]
          },
        ]
      }
      gl_sync_logs: {
        Row: {
          completed_at: string | null
          id: string
          mapping_id: string | null
          message: string | null
          records_processed: number | null
          started_at: string | null
          status: string
        }
        Insert: {
          completed_at?: string | null
          id?: string
          mapping_id?: string | null
          message?: string | null
          records_processed?: number | null
          started_at?: string | null
          status: string
        }
        Update: {
          completed_at?: string | null
          id?: string
          mapping_id?: string | null
          message?: string | null
          records_processed?: number | null
          started_at?: string | null
          status?: string
        }
        Relationships: []
      }
      gl_vendor_payments: {
        Row: {
          created_at: string | null
          date_of_payment: string | null
          date_of_purchase_order: string | null
          glide_row_id: string
          id: string
          payment_amount: number | null
          rowid_accounts: string | null
          rowid_products: string | null
          rowid_purchase_orders: string | null
          updated_at: string | null
          vendor_note: string | null
        }
        Insert: {
          created_at?: string | null
          date_of_payment?: string | null
          date_of_purchase_order?: string | null
          glide_row_id: string
          id?: string
          payment_amount?: number | null
          rowid_accounts?: string | null
          rowid_products?: string | null
          rowid_purchase_orders?: string | null
          updated_at?: string | null
          vendor_note?: string | null
        }
        Update: {
          created_at?: string | null
          date_of_payment?: string | null
          date_of_purchase_order?: string | null
          glide_row_id?: string
          id?: string
          payment_amount?: number | null
          rowid_accounts?: string | null
          rowid_products?: string | null
          rowid_purchase_orders?: string | null
          updated_at?: string | null
          vendor_note?: string | null
        }
        Relationships: []
      }
      match_logs: {
        Row: {
          confidence: number
          created_at: string | null
          id: string
          match_criteria: Json | null
          match_date: string | null
          message_id: string
          product_id: string
        }
        Insert: {
          confidence: number
          created_at?: string | null
          id?: string
          match_criteria?: Json | null
          match_date?: string | null
          message_id: string
          product_id: string
        }
        Update: {
          confidence?: number
          created_at?: string | null
          id?: string
          match_criteria?: Json | null
          match_date?: string | null
          message_id?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_logs_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_logs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "gl_products"
            referencedColumns: ["id"]
          },
        ]
      }
      media_sync_metrics: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          media_group_id: string
          messages_updated: number
          processing_time_ms: number | null
          source_message_id: string | null
          sync_success: boolean
          sync_type: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          media_group_id: string
          messages_updated?: number
          processing_time_ms?: number | null
          source_message_id?: string | null
          sync_success: boolean
          sync_type: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          media_group_id?: string
          messages_updated?: number
          processing_time_ms?: number | null
          source_message_id?: string | null
          sync_success?: boolean
          sync_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_media_sync_metrics_source_message"
            columns: ["source_message_id"]
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
          match_type: Database["public"]["Enums"]["match_type"] | null
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
          old_notes: string | null
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
          product_match_confidence: number | null
          product_match_date: string | null
          product_match_status: string | null
          product_name: string | null
          product_quantity: number | null
          product_sku: string | null
          public_url: string | null
          purchase_date: string | null
          purchase_order_uid: string | null
          raw_content: string | null
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
          sync_source: string | null
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
          match_type?: Database["public"]["Enums"]["match_type"] | null
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
          old_notes?: string | null
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
          product_match_confidence?: number | null
          product_match_date?: string | null
          product_match_status?: string | null
          product_name?: string | null
          product_quantity?: number | null
          product_sku?: string | null
          public_url?: string | null
          purchase_date?: string | null
          purchase_order_uid?: string | null
          raw_content?: string | null
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
          sync_source?: string | null
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
          match_type?: Database["public"]["Enums"]["match_type"] | null
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
          old_notes?: string | null
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
          product_match_confidence?: number | null
          product_match_date?: string | null
          product_match_status?: string | null
          product_name?: string | null
          product_quantity?: number | null
          product_sku?: string | null
          public_url?: string | null
          purchase_date?: string | null
          purchase_order_uid?: string | null
          raw_content?: string | null
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
          sync_source?: string | null
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
            foreignKeyName: "messages_message_caption_id_fkey"
            columns: ["message_caption_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      "null.gl_relationship_mapping": {
        Row: {
          created_at: string | null
          id: string
          relationship_type: string
          source_column: string
          source_table: string
          target_column: string
          target_table: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          relationship_type: string
          source_column: string
          source_table: string
          target_column: string
          target_table: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          relationship_type?: string
          source_column?: string
          source_table?: string
          target_column?: string
          target_table?: string
          updated_at?: string | null
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
          processing_state: string
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
          processing_state: string
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
          processing_state?: string
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
      pdf_generation_failures: {
        Row: {
          created_at: string
          document_id: string
          document_type: string
          error_message: string | null
          first_attempt: string
          id: number
          last_attempt: string
          next_attempt: string
          requires_manual_intervention: boolean
          resolved: boolean
          retry_count: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          document_id: string
          document_type: string
          error_message?: string | null
          first_attempt?: string
          id?: number
          last_attempt?: string
          next_attempt?: string
          requires_manual_intervention?: boolean
          resolved?: boolean
          retry_count?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          document_id?: string
          document_type?: string
          error_message?: string | null
          first_attempt?: string
          id?: number
          last_attempt?: string
          next_attempt?: string
          requires_manual_intervention?: boolean
          resolved?: boolean
          retry_count?: number
          updated_at?: string
        }
        Relationships: []
      }
      pdf_generation_logs: {
        Row: {
          created_at: string
          document_id: string
          document_type: string
          error_message: string | null
          id: number
          success: boolean | null
          trigger_source: string
          trigger_type: string
        }
        Insert: {
          created_at?: string
          document_id: string
          document_type: string
          error_message?: string | null
          id?: number
          success?: boolean | null
          trigger_source: string
          trigger_type: string
        }
        Update: {
          created_at?: string
          document_id?: string
          document_type?: string
          error_message?: string | null
          id?: number
          success?: boolean | null
          trigger_source?: string
          trigger_type?: string
        }
        Relationships: []
      }
      pdf_url_backup: {
        Row: {
          document_uid: string | null
          id: string | null
          supabase_pdf_url: string | null
          table_name: string | null
        }
        Insert: {
          document_uid?: string | null
          id?: string | null
          supabase_pdf_url?: string | null
          table_name?: string | null
        }
        Update: {
          document_uid?: string | null
          id?: string | null
          supabase_pdf_url?: string | null
          table_name?: string | null
        }
        Relationships: []
      }
      product_approval_queue: {
        Row: {
          analyzed_content: Json | null
          best_match_product_id: string | null
          best_match_reasons: Json | null
          best_match_score: number | null
          caption_data: Json | null
          created_at: string | null
          id: string
          message_id: string | null
          notes: string | null
          processed_at: string | null
          processed_by: string | null
          status: Database["public"]["Enums"]["approval_status"]
          suggested_product_name: string | null
          suggested_purchase_date: string | null
          suggested_purchase_order_uid: string | null
          suggested_vendor_uid: string | null
        }
        Insert: {
          analyzed_content?: Json | null
          best_match_product_id?: string | null
          best_match_reasons?: Json | null
          best_match_score?: number | null
          caption_data?: Json | null
          created_at?: string | null
          id?: string
          message_id?: string | null
          notes?: string | null
          processed_at?: string | null
          processed_by?: string | null
          status?: Database["public"]["Enums"]["approval_status"]
          suggested_product_name?: string | null
          suggested_purchase_date?: string | null
          suggested_purchase_order_uid?: string | null
          suggested_vendor_uid?: string | null
        }
        Update: {
          analyzed_content?: Json | null
          best_match_product_id?: string | null
          best_match_reasons?: Json | null
          best_match_score?: number | null
          caption_data?: Json | null
          created_at?: string | null
          id?: string
          message_id?: string | null
          notes?: string | null
          processed_at?: string | null
          processed_by?: string | null
          status?: Database["public"]["Enums"]["approval_status"]
          suggested_product_name?: string | null
          suggested_purchase_date?: string | null
          suggested_purchase_order_uid?: string | null
          suggested_vendor_uid?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_approval_queue_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: true
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      product_approval_queue_archive: {
        Row: {
          analyzed_content: Json | null
          archived_at: string | null
          best_match_product_id: string | null
          best_match_reasons: Json | null
          best_match_score: number | null
          caption_data: Json | null
          created_at: string | null
          id: string
          message_id: string | null
          notes: string | null
          processed_at: string | null
          processed_by: string | null
          status: Database["public"]["Enums"]["approval_status"]
          suggested_product_name: string | null
          suggested_purchase_date: string | null
          suggested_purchase_order_uid: string | null
          suggested_vendor_uid: string | null
        }
        Insert: {
          analyzed_content?: Json | null
          archived_at?: string | null
          best_match_product_id?: string | null
          best_match_reasons?: Json | null
          best_match_score?: number | null
          caption_data?: Json | null
          created_at?: string | null
          id?: string
          message_id?: string | null
          notes?: string | null
          processed_at?: string | null
          processed_by?: string | null
          status?: Database["public"]["Enums"]["approval_status"]
          suggested_product_name?: string | null
          suggested_purchase_date?: string | null
          suggested_purchase_order_uid?: string | null
          suggested_vendor_uid?: string | null
        }
        Update: {
          analyzed_content?: Json | null
          archived_at?: string | null
          best_match_product_id?: string | null
          best_match_reasons?: Json | null
          best_match_score?: number | null
          caption_data?: Json | null
          created_at?: string | null
          id?: string
          message_id?: string | null
          notes?: string | null
          processed_at?: string | null
          processed_by?: string | null
          status?: Database["public"]["Enums"]["approval_status"]
          suggested_product_name?: string | null
          suggested_purchase_date?: string | null
          suggested_purchase_order_uid?: string | null
          suggested_vendor_uid?: string | null
        }
        Relationships: []
      }
      product_matches: {
        Row: {
          confidence: number
          created_at: string | null
          id: string
          match_date: string | null
          match_details: Json | null
          match_type: string
          message_id: string
          product_id: string
          updated_at: string | null
        }
        Insert: {
          confidence?: number
          created_at?: string | null
          id?: string
          match_date?: string | null
          match_details?: Json | null
          match_type?: string
          message_id: string
          product_id: string
          updated_at?: string | null
        }
        Update: {
          confidence?: number
          created_at?: string | null
          id?: string
          match_date?: string | null
          match_details?: Json | null
          match_type?: string
          message_id?: string
          product_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_matches_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_matches_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "gl_products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_matching_config: {
        Row: {
          config: Json
          created_at: string | null
          high_confidence_threshold: number | null
          id: string
          medium_confidence_threshold: number | null
          updated_at: string | null
          use_ai_assistance: boolean | null
          webhook_id: string | null
        }
        Insert: {
          config?: Json
          created_at?: string | null
          high_confidence_threshold?: number | null
          id?: string
          medium_confidence_threshold?: number | null
          updated_at?: string | null
          use_ai_assistance?: boolean | null
          webhook_id?: string | null
        }
        Update: {
          config?: Json
          created_at?: string | null
          high_confidence_threshold?: number | null
          id?: string
          medium_confidence_threshold?: number | null
          updated_at?: string | null
          use_ai_assistance?: boolean | null
          webhook_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_matching_config_webhook_id_fkey"
            columns: ["webhook_id"]
            isOneToOne: false
            referencedRelation: "webhook_config"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          id: string
          updated_at: string | null
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          id: string
          updated_at?: string | null
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          id?: string
          updated_at?: string | null
          username?: string | null
        }
        Relationships: []
      }
      settings: {
        Row: {
          bot_token: string | null
          id: string
          product_matching_config: Json | null
          updated_at: string | null
          webhook_url: string | null
        }
        Insert: {
          bot_token?: string | null
          id: string
          product_matching_config?: Json | null
          updated_at?: string | null
          webhook_url?: string | null
        }
        Update: {
          bot_token?: string | null
          id?: string
          product_matching_config?: Json | null
          updated_at?: string | null
          webhook_url?: string | null
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
      webhook_config: {
        Row: {
          auth_token: string | null
          created_at: string | null
          description: string | null
          enabled: boolean | null
          endpoint_url: string
          event_types: string[] | null
          headers: Json | null
          id: string
          name: string
          retry_count: number | null
          supabase_table: string | null
          timeout_seconds: number | null
          updated_at: string | null
        }
        Insert: {
          auth_token?: string | null
          created_at?: string | null
          description?: string | null
          enabled?: boolean | null
          endpoint_url: string
          event_types?: string[] | null
          headers?: Json | null
          id?: string
          name: string
          retry_count?: number | null
          supabase_table?: string | null
          timeout_seconds?: number | null
          updated_at?: string | null
        }
        Update: {
          auth_token?: string | null
          created_at?: string | null
          description?: string | null
          enabled?: boolean | null
          endpoint_url?: string
          event_types?: string[] | null
          headers?: Json | null
          id?: string
          name?: string
          retry_count?: number | null
          supabase_table?: string | null
          timeout_seconds?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "webhook_config_supabase_table_fkey"
            columns: ["supabase_table"]
            isOneToOne: true
            referencedRelation: "gl_mapping_status"
            referencedColumns: ["supabase_table"]
          },
          {
            foreignKeyName: "webhook_config_supabase_table_fkey"
            columns: ["supabase_table"]
            isOneToOne: true
            referencedRelation: "gl_mappings"
            referencedColumns: ["supabase_table"]
          },
          {
            foreignKeyName: "webhook_config_supabase_table_fkey"
            columns: ["supabase_table"]
            isOneToOne: true
            referencedRelation: "gl_product_sync_stats"
            referencedColumns: ["supabase_table"]
          },
          {
            foreignKeyName: "webhook_config_supabase_table_fkey"
            columns: ["supabase_table"]
            isOneToOne: true
            referencedRelation: "gl_recent_logs"
            referencedColumns: ["supabase_table"]
          },
        ]
      }
      webhook_implementation_details: {
        Row: {
          callback_function: string | null
          created_at: string | null
          data_schema: Json | null
          entity_table: string | null
          id: string
          implementation_priority: number | null
          implementation_status: string | null
          notes: string | null
          trigger_function: string | null
          updated_at: string | null
          webhook_id: string | null
        }
        Insert: {
          callback_function?: string | null
          created_at?: string | null
          data_schema?: Json | null
          entity_table?: string | null
          id?: string
          implementation_priority?: number | null
          implementation_status?: string | null
          notes?: string | null
          trigger_function?: string | null
          updated_at?: string | null
          webhook_id?: string | null
        }
        Update: {
          callback_function?: string | null
          created_at?: string | null
          data_schema?: Json | null
          entity_table?: string | null
          id?: string
          implementation_priority?: number | null
          implementation_status?: string | null
          notes?: string | null
          trigger_function?: string | null
          updated_at?: string | null
          webhook_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "webhook_implementation_details_webhook_id_fkey"
            columns: ["webhook_id"]
            isOneToOne: false
            referencedRelation: "webhook_config"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_log: {
        Row: {
          attempt_count: number | null
          completed_at: string | null
          created_at: string | null
          error_message: string | null
          event_type: string
          id: string
          next_retry_at: string | null
          payload: Json | null
          response_body: string | null
          response_status: number | null
          success: boolean | null
          webhook_id: string | null
        }
        Insert: {
          attempt_count?: number | null
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          event_type: string
          id?: string
          next_retry_at?: string | null
          payload?: Json | null
          response_body?: string | null
          response_status?: number | null
          success?: boolean | null
          webhook_id?: string | null
        }
        Update: {
          attempt_count?: number | null
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          event_type?: string
          id?: string
          next_retry_at?: string | null
          payload?: Json | null
          response_body?: string | null
          response_status?: number | null
          success?: boolean | null
          webhook_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "webhook_log_webhook_id_fkey"
            columns: ["webhook_id"]
            isOneToOne: false
            referencedRelation: "webhook_config"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_logs: {
        Row: {
          created_at: string | null
          entity_id: string | null
          entity_type: string
          error_message: string | null
          event_type: string
          feature: string
          id: string
          request_payload: Json | null
          response_payload: Json | null
          status_code: number | null
          success: boolean | null
        }
        Insert: {
          created_at?: string | null
          entity_id?: string | null
          entity_type: string
          error_message?: string | null
          event_type: string
          feature: string
          id?: string
          request_payload?: Json | null
          response_payload?: Json | null
          status_code?: number | null
          success?: boolean | null
        }
        Update: {
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string
          error_message?: string | null
          event_type?: string
          feature?: string
          id?: string
          request_payload?: Json | null
          response_payload?: Json | null
          status_code?: number | null
          success?: boolean | null
        }
        Relationships: []
      }
      workflow_memory: {
        Row: {
          created_at: string | null
          entity_id: string
          entity_type: string
          feature: string
          id: string
          memory_data: Json
          updated_at: string | null
          workflow_id: string
        }
        Insert: {
          created_at?: string | null
          entity_id: string
          entity_type: string
          feature: string
          id?: string
          memory_data?: Json
          updated_at?: string | null
          workflow_id: string
        }
        Update: {
          created_at?: string | null
          entity_id?: string
          entity_type?: string
          feature?: string
          id?: string
          memory_data?: Json
          updated_at?: string | null
          workflow_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      gl_mapping_status: {
        Row: {
          app_name: string | null
          connection_id: string | null
          current_status: string | null
          enabled: boolean | null
          error_count: number | null
          glide_table: string | null
          glide_table_display_name: string | null
          last_sync_completed_at: string | null
          last_sync_started_at: string | null
          mapping_id: string | null
          records_processed: number | null
          supabase_table: string | null
          sync_direction: string | null
          total_syncs: number | null
        }
        Relationships: [
          {
            foreignKeyName: "gl_mappings_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "gl_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      gl_product_sync_stats: {
        Row: {
          app_name: string | null
          connection_id: string | null
          error_count: number | null
          glide_table: string | null
          glide_table_display_name: string | null
          last_sync_time: string | null
          mapping_id: string | null
          supabase_table: string | null
          sync_direction: string | null
          total_products: number | null
        }
        Relationships: [
          {
            foreignKeyName: "gl_mappings_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "gl_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      gl_recent_logs: {
        Row: {
          app_name: string | null
          glide_table: string | null
          glide_table_display_name: string | null
          id: string | null
          mapping_id: string | null
          message: string | null
          records_processed: number | null
          started_at: string | null
          status: string | null
          supabase_table: string | null
          sync_direction: string | null
        }
        Relationships: []
      }
      gl_sync_stats: {
        Row: {
          failed_syncs: number | null
          successful_syncs: number | null
          sync_date: string | null
          syncs: number | null
          total_records_processed: number | null
        }
        Relationships: []
      }
      gl_tables_view: {
        Row: {
          table_name: unknown | null
        }
        Relationships: []
      }
      media_sync_operations_view: {
        Row: {
          created_at: string | null
          error_message: string | null
          media_group_id: string | null
          messages_updated: number | null
          metric_id: string | null
          processing_time_ms: number | null
          source_caption: string | null
          source_chat_id: number | null
          source_message_id: string | null
          source_telegram_message_id: number | null
          sync_success: boolean | null
          sync_type: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_media_sync_metrics_source_message"
            columns: ["source_message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_integration_checklist: {
        Row: {
          callback_function: string | null
          description: string | null
          enabled: boolean | null
          entity_table: string | null
          event_types: string[] | null
          implementation_priority: number | null
          implementation_status: string | null
          notes: string | null
          trigger_function: string | null
          webhook_name: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      admin_fix_missing_media_sync_relations: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      admin_get_media_sync_cron_status: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      admin_restart_media_sync_cron: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      analyze_messages: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      approve_product_from_queue: {
        Args: { p_queue_id: string; p_product_id: string; p_user_id?: string }
        Returns: Json
      }
      associate_messages_with_products: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      backfill_all_vendor_balances: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      backfill_main_account_balances: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      batch_link_messages_to_product: {
        Args: {
          p_message_ids: string[]
          p_product_id: string
          p_confidence?: number
        }
        Returns: Json
      }
      batch_update_product_media_urls: {
        Args: { p_product_ids?: string[]; p_limit?: number }
        Returns: Json
      }
      calculate_customer_balance_for_account: {
        Args: { p_glide_row_id: string }
        Returns: number
      }
      calculate_vendor_balance_for_account: {
        Args: { p_glide_row_id: string }
        Returns: number
      }
      call_pdf_edge_function: {
        Args: {
          p_document_type: string
          p_document_id: string
          p_force_regenerate?: boolean
        }
        Returns: Json
      }
      debug_media_message_errors: {
        Args: { p_correlation_id?: string }
        Returns: {
          error_message: string
          event_timestamp: string
          metadata: Json
          telegram_message_id: number
          chat_id: number
          correlation_id: string
        }[]
      }
      extract_forward_info: {
        Args: { message: Json }
        Returns: Json
      }
      force_resync_media_group: {
        Args: { p_media_group_id: string }
        Returns: Json
      }
      generate_invoice_uid: {
        Args: { account_uid: string; invoice_date: string }
        Returns: string
      }
      generate_po_uid: {
        Args: { account_uid: string; po_date: string }
        Returns: string
      }
      get_manual_intervention_failures: {
        Args: Record<PropertyKey, never>
        Returns: {
          created_at: string
          document_id: string
          document_type: string
          error_message: string | null
          first_attempt: string
          id: number
          last_attempt: string
          next_attempt: string
          requires_manual_intervention: boolean
          resolved: boolean
          retry_count: number
          updated_at: string
        }[]
      }
      get_pdf_coverage_stats: {
        Args: { p_table_name: string; p_document_type: string }
        Returns: Json
      }
      get_pending_pdf_generation_items: {
        Args: { p_limit?: number }
        Returns: {
          id: string
          document_type: string
          document_id: string
        }[]
      }
      get_potential_product_matches: {
        Args:
          | { p_message_id: string; p_limit?: number; p_min_score?: number }
          | { p_message_id: string; p_min_score?: number; p_limit?: number }
        Returns: Json
      }
      get_product_approval_queue: {
        Args: {
          p_status?: Database["public"]["Enums"]["approval_status"]
          p_limit?: number
          p_offset?: number
        }
        Returns: Json
      }
      get_public_tables: {
        Args: Record<PropertyKey, never>
        Returns: {
          table_name: string
        }[]
      }
      get_standardized_pdf_path: {
        Args:
          | { p_document_type: string; p_document_id: string }
          | { document_type: string; document_id: string }
        Returns: string
      }
      get_supabase_function_url: {
        Args: Record<PropertyKey, never> | { p_function_name?: string }
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
      gl_get_monthly_revenue: {
        Args: { months_back: number }
        Returns: {
          month: string
          revenue: number
          expenses: number
        }[]
      }
      gl_get_purchase_metrics: {
        Args: Record<PropertyKey, never>
        Returns: {
          total_po_count: number
          open_po_count: number
          total_po_amount: number
          open_po_amount: number
        }[]
      }
      gl_get_purchase_order_metrics: {
        Args: Record<PropertyKey, never>
        Returns: {
          po_count: number
          total_purchase_amount: number
          total_payments_made: number
          pending_purchase_amount: number
        }[]
      }
      gl_get_recent_transactions: {
        Args: { days_back: number; limit_count: number }
        Returns: {
          id: string
          transaction_date: string
          description: string
          amount: number
          transaction_type: string
          entity_type: string
          entity_id: string
          account_name: string
        }[]
      }
      gl_get_sync_errors: {
        Args: {
          p_mapping_id: string
          p_limit?: number
          p_include_resolved?: boolean
        }
        Returns: {
          created_at: string | null
          error_message: string
          error_type: string
          id: string
          mapping_id: string | null
          record_data: Json | null
          resolution_notes: string | null
          resolved_at: string | null
          retryable: boolean | null
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
      glsync_retry_failed_sync: {
        Args: { p_mapping_id: string }
        Returns: string
      }
      gtrgm_compress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gtrgm_decompress: {
        Args: { "": unknown }
        Returns: unknown
      }
      gtrgm_in: {
        Args: { "": unknown }
        Returns: unknown
      }
      gtrgm_options: {
        Args: { "": unknown }
        Returns: undefined
      }
      gtrgm_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      handle_media_message: {
        Args: {
          p_telegram_message_id: number
          p_chat_id: number
          p_file_unique_id: string
          p_media_data: Json
        }
        Returns: string
      }
      handle_telegram_webhook_standalone: {
        Args: {
          p_message: Json
          p_correlation_id: string
          p_is_edit?: boolean
          p_is_channel_post?: boolean
          p_is_forwarded?: boolean
        }
        Returns: Json
      }
      is_customer: {
        Args: { account_type: string }
        Returns: boolean
      }
      is_vendor: {
        Args: { account_type: string }
        Returns: boolean
      }
      link_message_to_product: {
        Args: {
          p_message_id: string
          p_product_id: string
          p_confidence?: number
        }
        Returns: Json
      }
      log_auto_match_results: {
        Args: {
          p_messages_processed: number
          p_matches_found: number
          p_exact_matches: number
          p_high_confidence_matches: number
          p_errors?: Json
          p_details?: Json
        }
        Returns: string
      }
      log_media_sync_metrics: {
        Args: {
          p_sync_type: string
          p_media_group_id: string
          p_source_message_id: string
          p_messages_updated: number
          p_sync_success: boolean
          p_error_message?: string
          p_processing_time_ms?: number
        }
        Returns: string
      }
      log_pdf_generation_failure: {
        Args: {
          p_document_type: string
          p_document_id: string
          p_error_message: string
        }
        Returns: undefined
      }
      mark_pdf_queue_item_processed: {
        Args: {
          p_queue_id: string
          p_success: boolean
          p_error_message?: string
        }
        Returns: undefined
      }
      match_message_to_products: {
        Args: { p_message_id: string; p_confidence_override?: Json }
        Returns: Json
      }
      process_ai_matching_result: {
        Args: {
          p_queue_id: string
          p_action: string
          p_product_id?: string
          p_confidence_score?: number
          p_ai_reasoning?: string
        }
        Returns: Json
      }
      process_pdf_generation_queue: {
        Args:
          | { p_batch_size?: number; p_process_priority_only?: boolean }
          | Record<PropertyKey, never>
        Returns: number
      }
      process_pdf_queue: {
        Args: { p_limit?: number }
        Returns: number
      }
      refresh_all_materialized_views: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      refresh_materialized_view: {
        Args: { view_name: string }
        Returns: undefined
      }
      refresh_materialized_view_secure: {
        Args: { view_name: string }
        Returns: undefined
      }
      reject_product_from_queue: {
        Args: { p_queue_id: string; p_reason?: string; p_user_id?: string }
        Returns: Json
      }
      reset_pdf_generation_failure: {
        Args: { p_document_type: string; p_document_id: string }
        Returns: undefined
      }
      retry_auto_match_processor: {
        Args:
          | Record<PropertyKey, never>
          | {
              p_force_recheck?: boolean
              p_batch_size?: number
              p_debug?: boolean
            }
        Returns: Json
      }
      scheduled_process_pdf_queue: {
        Args: { p_limit?: number }
        Returns: number
      }
      send_product_matching_webhook: {
        Args: {
          p_message_id: string
          p_match_data: Json
          p_confidence_level: Database["public"]["Enums"]["confidence_level"]
        }
        Returns: Json
      }
      set_limit: {
        Args: { "": number }
        Returns: number
      }
      set_service_role_key: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      show_limit: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      show_trgm: {
        Args: { "": string }
        Returns: string[]
      }
      standardize_existing_pdf_urls: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      sync_media_group_captions: {
        Args: {
          p_media_group_id: string
          p_exclude_message_id: string
          p_caption: string
          p_caption_data: Json
          p_processing_state?: string
        }
        Returns: string[]
      }
      trigger_auto_match_processor: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      trigger_missing_pdf_generation: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      trigger_pdf_scan: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      update_account_customer_balance: {
        Args: { p_glide_row_id: string }
        Returns: undefined
      }
      update_account_vendor_balance: {
        Args: { p_glide_row_id: string }
        Returns: undefined
      }
      update_estimate_totals: {
        Args: { estimate_id: string }
        Returns: undefined
      }
      update_invoice_totals: {
        Args: { invoice_id: string }
        Returns: undefined
      }
      update_message_download_status: {
        Args: {
          p_message_id: string
          p_status: string
          p_needs_redownload?: boolean
          p_error_message?: string
          p_storage_path?: string
          p_public_url?: string
          p_storage_exists?: boolean
          p_mime_type_verified?: boolean
        }
        Returns: boolean
      }
      update_po_totals: {
        Args: { po_id: string }
        Returns: undefined
      }
      update_product_media_urls: {
        Args: { p_product_id: string }
        Returns: Json
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
      x_sync_media_group_analyzed_content: {
        Args: {
          p_media_group_id: string
          p_source_message_id: string
          p_analyzed_content: Json
        }
        Returns: number
      }
      x_sync_media_q5_cron_wrapper: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      x_sync_pending_media_groups: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      xdelo_get_product_matching_config: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      xdelo_process_caption_workflow: {
        Args: {
          p_message_id: string
          p_correlation_id: string
          p_force?: boolean
        }
        Returns: Json
      }
      xdelo_sync_media_group_content: {
        Args: {
          p_source_message_id: string
          p_media_group_id: string
          p_correlation_id?: string
          p_force_sync?: boolean
          p_sync_edit_history?: boolean
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
      approval_status: "pending" | "approved" | "rejected" | "auto_matched"
      confidence_level: "high" | "medium" | "low"
      match_type: "exact" | "fuzzy" | "manual" | "auto"
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
      message_processing_state:
        | "pending"
        | "extracting"
        | "parsing"
        | "syncing"
        | "completed"
        | "error"
      processing_state_type:
        | "initialized"
        | "pending"
        | "processing"
        | "completed"
        | "error"
        | "no_caption"
        | "pending_analysis"
      task_priority: "low" | "medium" | "high" | "urgent"
      task_status:
        | "not_started"
        | "in_progress"
        | "blocked"
        | "completed"
        | "cancelled"
      telegram_chat_type:
        | "private"
        | "group"
        | "supergroup"
        | "channel"
        | "unknown"
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
      approval_status: ["pending", "approved", "rejected", "auto_matched"],
      confidence_level: ["high", "medium", "low"],
      match_type: ["exact", "fuzzy", "manual", "auto"],
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
      message_processing_state: [
        "pending",
        "extracting",
        "parsing",
        "syncing",
        "completed",
        "error",
      ],
      processing_state_type: [
        "initialized",
        "pending",
        "processing",
        "completed",
        "error",
        "no_caption",
        "pending_analysis",
      ],
      task_priority: ["low", "medium", "high", "urgent"],
      task_status: [
        "not_started",
        "in_progress",
        "blocked",
        "completed",
        "cancelled",
      ],
      telegram_chat_type: [
        "private",
        "group",
        "supergroup",
        "channel",
        "unknown",
      ],
    },
  },
} as const
