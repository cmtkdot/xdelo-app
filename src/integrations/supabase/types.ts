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
      gl_accounts: {
        Row: {
          account_name: string | null
          accounts_uid: string | null
          balance: number | null
          client_type: string | null
          created_at: string | null
          date_added_client: string | null
          email_of_who_added: string | null
          glide_row_id: string | null
          id: string
          photo: string | null
          updated_at: string | null
        }
        Insert: {
          account_name?: string | null
          accounts_uid?: string | null
          balance?: number | null
          client_type?: string | null
          created_at?: string | null
          date_added_client?: string | null
          email_of_who_added?: string | null
          glide_row_id?: string | null
          id: string
          photo?: string | null
          updated_at?: string | null
        }
        Update: {
          account_name?: string | null
          accounts_uid?: string | null
          balance?: number | null
          client_type?: string | null
          created_at?: string | null
          date_added_client?: string | null
          email_of_who_added?: string | null
          glide_row_id?: string | null
          id?: string
          photo?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      gl_connections: {
        Row: {
          api_key: string | null
          app_id: string | null
          app_name: string | null
          created_at: string | null
          id: string
          last_sync: string | null
          settings: Json | null
          status: string | null
        }
        Insert: {
          api_key?: string | null
          app_id?: string | null
          app_name?: string | null
          created_at?: string | null
          id: string
          last_sync?: string | null
          settings?: Json | null
          status?: string | null
        }
        Update: {
          api_key?: string | null
          app_id?: string | null
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
          glide_row_id: string | null
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
          glide_row_id?: string | null
          id: string
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
          glide_row_id?: string | null
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
          glide_row_id: string | null
          id: string
          payment_amount: number | null
          payment_note: string | null
          rowid_accounts: string | null
          rowid_invoices: string | null
          type_of_payment: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          date_of_payment?: string | null
          email_of_user?: string | null
          glide_row_id?: string | null
          id: string
          payment_amount?: number | null
          payment_note?: string | null
          rowid_accounts?: string | null
          rowid_invoices?: string | null
          type_of_payment?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          date_of_payment?: string | null
          email_of_user?: string | null
          glide_row_id?: string | null
          id?: string
          payment_amount?: number | null
          payment_note?: string | null
          rowid_accounts?: string | null
          rowid_invoices?: string | null
          type_of_payment?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      gl_estimate_lines: {
        Row: {
          created_at: string | null
          date_of_sale: string | null
          glide_row_id: string | null
          id: string
          line_total: number | null
          product_sale_note: string | null
          qty_sold: number | null
          rowid_estimate_lines: string | null
          rowid_products: string | null
          sale_product_name: string | null
          selling_price: number | null
          total_stock_after_sell: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          date_of_sale?: string | null
          glide_row_id?: string | null
          id: string
          line_total?: number | null
          product_sale_note?: string | null
          qty_sold?: number | null
          rowid_estimate_lines?: string | null
          rowid_products?: string | null
          sale_product_name?: string | null
          selling_price?: number | null
          total_stock_after_sell?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          date_of_sale?: string | null
          glide_row_id?: string | null
          id?: string
          line_total?: number | null
          product_sale_note?: string | null
          qty_sold?: number | null
          rowid_estimate_lines?: string | null
          rowid_products?: string | null
          sale_product_name?: string | null
          selling_price?: number | null
          total_stock_after_sell?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      gl_estimates: {
        Row: {
          add_note: boolean | null
          balance: number | null
          created_at: string | null
          date_invoice_created_date: string | null
          estimate_date: string | null
          glide_pdf_url: string | null
          glide_pdf_url2: string | null
          glide_row_id: string | null
          id: string
          is_a_sample: boolean | null
          rowid_accounts: string | null
          rowid_invoices: string | null
          status: string | null
          total_amount: number | null
          total_credits: number | null
          updated_at: string | null
          valid_final_create_invoice_clicked: boolean | null
        }
        Insert: {
          add_note?: boolean | null
          balance?: number | null
          created_at?: string | null
          date_invoice_created_date?: string | null
          estimate_date?: string | null
          glide_pdf_url?: string | null
          glide_pdf_url2?: string | null
          glide_row_id?: string | null
          id: string
          is_a_sample?: boolean | null
          rowid_accounts?: string | null
          rowid_invoices?: string | null
          status?: string | null
          total_amount?: number | null
          total_credits?: number | null
          updated_at?: string | null
          valid_final_create_invoice_clicked?: boolean | null
        }
        Update: {
          add_note?: boolean | null
          balance?: number | null
          created_at?: string | null
          date_invoice_created_date?: string | null
          estimate_date?: string | null
          glide_pdf_url?: string | null
          glide_pdf_url2?: string | null
          glide_row_id?: string | null
          id?: string
          is_a_sample?: boolean | null
          rowid_accounts?: string | null
          rowid_invoices?: string | null
          status?: string | null
          total_amount?: number | null
          total_credits?: number | null
          updated_at?: string | null
          valid_final_create_invoice_clicked?: boolean | null
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
          glide_row_id: string | null
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
          glide_row_id?: string | null
          id: string
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
          glide_row_id?: string | null
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
          glide_row_id: string | null
          id: string
          line_total: number | null
          product_sale_note: string | null
          qty_sold: number | null
          renamed_product_name: string | null
          rowid_invoices: string | null
          rowid_products: string | null
          selling_price: number | null
          updated_at: string | null
          user_email_of_added: string | null
        }
        Insert: {
          created_at?: string | null
          date_of_sale?: string | null
          glide_row_id?: string | null
          id: string
          line_total?: number | null
          product_sale_note?: string | null
          qty_sold?: number | null
          renamed_product_name?: string | null
          rowid_invoices?: string | null
          rowid_products?: string | null
          selling_price?: number | null
          updated_at?: string | null
          user_email_of_added?: string | null
        }
        Update: {
          created_at?: string | null
          date_of_sale?: string | null
          glide_row_id?: string | null
          id?: string
          line_total?: number | null
          product_sale_note?: string | null
          qty_sold?: number | null
          renamed_product_name?: string | null
          rowid_invoices?: string | null
          rowid_products?: string | null
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
          doc_glideforeverlink: string | null
          glide_row_id: string | null
          id: string
          invoice_order_date: string | null
          notes: string | null
          payment_status: string | null
          processed: boolean | null
          rowid_accounts: string | null
          submitted_timestamp: string | null
          total_amount: number | null
          total_paid: number | null
          updated_at: string | null
          user_email: string | null
        }
        Insert: {
          balance?: number | null
          created_at?: string | null
          created_timestamp?: string | null
          doc_glideforeverlink?: string | null
          glide_row_id?: string | null
          id: string
          invoice_order_date?: string | null
          notes?: string | null
          payment_status?: string | null
          processed?: boolean | null
          rowid_accounts?: string | null
          submitted_timestamp?: string | null
          total_amount?: number | null
          total_paid?: number | null
          updated_at?: string | null
          user_email?: string | null
        }
        Update: {
          balance?: number | null
          created_at?: string | null
          created_timestamp?: string | null
          doc_glideforeverlink?: string | null
          glide_row_id?: string | null
          id?: string
          invoice_order_date?: string | null
          notes?: string | null
          payment_status?: string | null
          processed?: boolean | null
          rowid_accounts?: string | null
          submitted_timestamp?: string | null
          total_amount?: number | null
          total_paid?: number | null
          updated_at?: string | null
          user_email?: string | null
        }
        Relationships: []
      }
      gl_mappings: {
        Row: {
          column_mappings: Json | null
          connection_id: string | null
          created_at: string | null
          enabled: boolean | null
          glide_table: string | null
          glide_table_display_name: string | null
          id: string
          supabase_table: string | null
          sync_direction: string | null
          updated_at: string | null
        }
        Insert: {
          column_mappings?: Json | null
          connection_id?: string | null
          created_at?: string | null
          enabled?: boolean | null
          glide_table?: string | null
          glide_table_display_name?: string | null
          id: string
          supabase_table?: string | null
          sync_direction?: string | null
          updated_at?: string | null
        }
        Update: {
          column_mappings?: Json | null
          connection_id?: string | null
          created_at?: string | null
          enabled?: boolean | null
          glide_table?: string | null
          glide_table_display_name?: string | null
          id?: string
          supabase_table?: string | null
          sync_direction?: string | null
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
      gl_products: {
        Row: {
          category: string | null
          cost: number | null
          created_at: string | null
          date_timestamp_subm: string | null
          display_name: string | null
          email_email_of_user_who_added_product: string | null
          fronted: boolean | null
          glide_row_id: string | null
          id: string
          miscellaneous_items: boolean | null
          new_product_name: string | null
          po_po_date: string | null
          po_poui_dfrom_add_prod: string | null
          product_image1: string | null
          product_purchase_date: string | null
          purchase_notes: string | null
          rowid_accounts: string | null
          rowid_purchase_orders: string | null
          rowid_vendor_payments: string | null
          samples: boolean | null
          samples_or_fronted: boolean | null
          terms_for_fronted_product: string | null
          total_qty_purchased: number | null
          total_units_behind_sample: number | null
          updated_at: string | null
          vendor_product_name: string | null
        }
        Insert: {
          category?: string | null
          cost?: number | null
          created_at?: string | null
          date_timestamp_subm?: string | null
          display_name?: string | null
          email_email_of_user_who_added_product?: string | null
          fronted?: boolean | null
          glide_row_id?: string | null
          id: string
          miscellaneous_items?: boolean | null
          new_product_name?: string | null
          po_po_date?: string | null
          po_poui_dfrom_add_prod?: string | null
          product_image1?: string | null
          product_purchase_date?: string | null
          purchase_notes?: string | null
          rowid_accounts?: string | null
          rowid_purchase_orders?: string | null
          rowid_vendor_payments?: string | null
          samples?: boolean | null
          samples_or_fronted?: boolean | null
          terms_for_fronted_product?: string | null
          total_qty_purchased?: number | null
          total_units_behind_sample?: number | null
          updated_at?: string | null
          vendor_product_name?: string | null
        }
        Update: {
          category?: string | null
          cost?: number | null
          created_at?: string | null
          date_timestamp_subm?: string | null
          display_name?: string | null
          email_email_of_user_who_added_product?: string | null
          fronted?: boolean | null
          glide_row_id?: string | null
          id?: string
          miscellaneous_items?: boolean | null
          new_product_name?: string | null
          po_po_date?: string | null
          po_poui_dfrom_add_prod?: string | null
          product_image1?: string | null
          product_purchase_date?: string | null
          purchase_notes?: string | null
          rowid_accounts?: string | null
          rowid_purchase_orders?: string | null
          rowid_vendor_payments?: string | null
          samples?: boolean | null
          samples_or_fronted?: boolean | null
          terms_for_fronted_product?: string | null
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
          docs_shortlink: string | null
          glide_row_id: string | null
          id: string
          payment_status: string | null
          pdf_link: string | null
          po_date: string | null
          product_count: number | null
          purchase_order_uid: string | null
          rowid_accounts: string | null
          total_amount: number | null
          total_paid: number | null
          updated_at: string | null
        }
        Insert: {
          balance?: number | null
          created_at?: string | null
          date_payment_date_mddyyyy?: string | null
          docs_shortlink?: string | null
          glide_row_id?: string | null
          id: string
          payment_status?: string | null
          pdf_link?: string | null
          po_date?: string | null
          product_count?: number | null
          purchase_order_uid?: string | null
          rowid_accounts?: string | null
          total_amount?: number | null
          total_paid?: number | null
          updated_at?: string | null
        }
        Update: {
          balance?: number | null
          created_at?: string | null
          date_payment_date_mddyyyy?: string | null
          docs_shortlink?: string | null
          glide_row_id?: string | null
          id?: string
          payment_status?: string | null
          pdf_link?: string | null
          po_date?: string | null
          product_count?: number | null
          purchase_order_uid?: string | null
          rowid_accounts?: string | null
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
          glide_row_id: string | null
          id: string
          receiver_receiver_address: string | null
          receiver_receiver_name: string | null
          receiver_state: string | null
          rowid_accounts: string | null
          rowid_invoices: string | null
          sender_sender_address: string | null
          sender_sender_name_company: string | null
          sender_sender_phone: string | null
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
          glide_row_id?: string | null
          id: string
          receiver_receiver_address?: string | null
          receiver_receiver_name?: string | null
          receiver_state?: string | null
          rowid_accounts?: string | null
          rowid_invoices?: string | null
          sender_sender_address?: string | null
          sender_sender_name_company?: string | null
          sender_sender_phone?: string | null
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
          glide_row_id?: string | null
          id?: string
          receiver_receiver_address?: string | null
          receiver_receiver_name?: string | null
          receiver_state?: string | null
          rowid_accounts?: string | null
          rowid_invoices?: string | null
          sender_sender_address?: string | null
          sender_sender_name_company?: string | null
          sender_sender_phone?: string | null
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
          error_message: string | null
          error_type: string | null
          id: string
          mapping_id: string | null
          record_data: Json | null
          resolution_notes: string | null
          resolved_at: string | null
          retryable: boolean | null
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          error_type?: string | null
          id: string
          mapping_id?: string | null
          record_data?: Json | null
          resolution_notes?: string | null
          resolved_at?: string | null
          retryable?: boolean | null
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          error_type?: string | null
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
          status: string | null
        }
        Insert: {
          completed_at?: string | null
          id: string
          mapping_id?: string | null
          message?: string | null
          records_processed?: number | null
          started_at?: string | null
          status?: string | null
        }
        Update: {
          completed_at?: string | null
          id?: string
          mapping_id?: string | null
          message?: string | null
          records_processed?: number | null
          started_at?: string | null
          status?: string | null
        }
        Relationships: []
      }
      gl_vendor_payments: {
        Row: {
          created_at: string | null
          date_of_payment: string | null
          date_of_purchase_order: string | null
          glide_row_id: string | null
          id: string
          payment_amount: number | null
          rowid_accounts: string | null
          rowid_products: string | null
          rowid_purchase_orders: string | null
          updated_at: string | null
          vendor_purchase_note: string | null
        }
        Insert: {
          created_at?: string | null
          date_of_payment?: string | null
          date_of_purchase_order?: string | null
          glide_row_id?: string | null
          id: string
          payment_amount?: number | null
          rowid_accounts?: string | null
          rowid_products?: string | null
          rowid_purchase_orders?: string | null
          updated_at?: string | null
          vendor_purchase_note?: string | null
        }
        Update: {
          created_at?: string | null
          date_of_payment?: string | null
          date_of_purchase_order?: string | null
          glide_row_id?: string | null
          id?: string
          payment_amount?: number | null
          rowid_accounts?: string | null
          rowid_products?: string | null
          rowid_purchase_orders?: string | null
          updated_at?: string | null
          vendor_purchase_note?: string | null
        }
        Relationships: []
      }
      make_automation_rules: {
        Row: {
          actions: Json
          conditions: Json
          created_at: string | null
          description: string | null
          event_type: Database["public"]["Enums"]["make_event_type"]
          id: string
          is_active: boolean | null
          name: string
          priority: number | null
          updated_at: string | null
        }
        Insert: {
          actions?: Json
          conditions?: Json
          created_at?: string | null
          description?: string | null
          event_type: Database["public"]["Enums"]["make_event_type"]
          id?: string
          is_active?: boolean | null
          name: string
          priority?: number | null
          updated_at?: string | null
        }
        Update: {
          actions?: Json
          conditions?: Json
          created_at?: string | null
          description?: string | null
          event_type?: Database["public"]["Enums"]["make_event_type"]
          id?: string
          is_active?: boolean | null
          name?: string
          priority?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      make_debug_events: {
        Row: {
          data: Json | null
          event_type: string
          id: string
          level: string | null
          session_id: string | null
          timestamp: string | null
        }
        Insert: {
          data?: Json | null
          event_type: string
          id?: string
          level?: string | null
          session_id?: string | null
          timestamp?: string | null
        }
        Update: {
          data?: Json | null
          event_type?: string
          id?: string
          level?: string | null
          session_id?: string | null
          timestamp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "make_debug_events_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "make_debug_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      make_debug_sessions: {
        Row: {
          config: Json | null
          end_time: string | null
          id: string
          name: string
          notes: string | null
          start_time: string | null
          status: string | null
          webhook_id: string | null
        }
        Insert: {
          config?: Json | null
          end_time?: string | null
          id?: string
          name: string
          notes?: string | null
          start_time?: string | null
          status?: string | null
          webhook_id?: string | null
        }
        Update: {
          config?: Json | null
          end_time?: string | null
          id?: string
          name?: string
          notes?: string | null
          start_time?: string | null
          status?: string | null
          webhook_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "make_debug_sessions_webhook_id_fkey"
            columns: ["webhook_id"]
            isOneToOne: false
            referencedRelation: "make_webhook_configs"
            referencedColumns: ["id"]
          },
        ]
      }
      make_event_logs: {
        Row: {
          completed_at: string | null
          context: Json | null
          created_at: string | null
          duration_ms: number | null
          error_message: string | null
          event_type: string
          id: string
          message_id: string | null
          next_retry_at: string | null
          payload: Json | null
          request_headers: Json | null
          response_body: string | null
          response_code: number | null
          response_headers: Json | null
          retry_count: number | null
          severity: string | null
          status: Database["public"]["Enums"]["make_log_status"]
          tags: string[] | null
          webhook_id: string | null
        }
        Insert: {
          completed_at?: string | null
          context?: Json | null
          created_at?: string | null
          duration_ms?: number | null
          error_message?: string | null
          event_type: string
          id?: string
          message_id?: string | null
          next_retry_at?: string | null
          payload?: Json | null
          request_headers?: Json | null
          response_body?: string | null
          response_code?: number | null
          response_headers?: Json | null
          retry_count?: number | null
          severity?: string | null
          status?: Database["public"]["Enums"]["make_log_status"]
          tags?: string[] | null
          webhook_id?: string | null
        }
        Update: {
          completed_at?: string | null
          context?: Json | null
          created_at?: string | null
          duration_ms?: number | null
          error_message?: string | null
          event_type?: string
          id?: string
          message_id?: string | null
          next_retry_at?: string | null
          payload?: Json | null
          request_headers?: Json | null
          response_body?: string | null
          response_code?: number | null
          response_headers?: Json | null
          retry_count?: number | null
          severity?: string | null
          status?: Database["public"]["Enums"]["make_log_status"]
          tags?: string[] | null
          webhook_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "make_event_logs_webhook_id_fkey"
            columns: ["webhook_id"]
            isOneToOne: false
            referencedRelation: "make_webhook_configs"
            referencedColumns: ["id"]
          },
        ]
      }
      make_telegram_events: {
        Row: {
          context: Json | null
          created_at: string | null
          event_type: string
          id: string
          message_id: string
          payload: Json
          webhook_results: Json | null
        }
        Insert: {
          context?: Json | null
          created_at?: string | null
          event_type: string
          id?: string
          message_id: string
          payload: Json
          webhook_results?: Json | null
        }
        Update: {
          context?: Json | null
          created_at?: string | null
          event_type?: string
          id?: string
          message_id?: string
          payload?: Json
          webhook_results?: Json | null
        }
        Relationships: []
      }
      make_test_payloads: {
        Row: {
          created_at: string | null
          description: string | null
          event_type: string
          id: string
          is_template: boolean | null
          name: string
          payload: Json
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          event_type: string
          id?: string
          is_template?: boolean | null
          name: string
          payload: Json
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          event_type?: string
          id?: string
          is_template?: boolean | null
          name?: string
          payload?: Json
          updated_at?: string | null
        }
        Relationships: []
      }
      make_webhook_configs: {
        Row: {
          created_at: string | null
          description: string | null
          event_types: string[]
          field_selection: Json | null
          headers: Json | null
          id: string
          is_active: boolean | null
          name: string
          payload_template: Json | null
          retry_config: Json | null
          transformation_code: string | null
          updated_at: string | null
          url: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          event_types: string[]
          field_selection?: Json | null
          headers?: Json | null
          id?: string
          is_active?: boolean | null
          name: string
          payload_template?: Json | null
          retry_config?: Json | null
          transformation_code?: string | null
          updated_at?: string | null
          url: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          event_types?: string[]
          field_selection?: Json | null
          headers?: Json | null
          id?: string
          is_active?: boolean | null
          name?: string
          payload_template?: Json | null
          retry_config?: Json | null
          transformation_code?: string | null
          updated_at?: string | null
          url?: string
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
          duplicate_of_message_id: string | null
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
          is_duplicate_content: boolean | null
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
          media_group_sync: string | null
          message_caption_id: string | null
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
          storage_exists: string | null
          storage_path: string | null
          storage_path_standardized: string | null
          sync_attempt: number | null
          telegram_data: Json | null
          telegram_message_id: number | null
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
          duplicate_of_message_id?: string | null
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
          is_duplicate_content?: boolean | null
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
          media_group_sync?: string | null
          message_caption_id?: string | null
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
          storage_exists?: string | null
          storage_path?: string | null
          storage_path_standardized?: string | null
          sync_attempt?: number | null
          telegram_data?: Json | null
          telegram_message_id?: number | null
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
          duplicate_of_message_id?: string | null
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
          is_duplicate_content?: boolean | null
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
          media_group_sync?: string | null
          message_caption_id?: string | null
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
          storage_exists?: string | null
          storage_path?: string | null
          storage_path_standardized?: string | null
          sync_attempt?: number | null
          telegram_data?: Json | null
          telegram_message_id?: number | null
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
            foreignKeyName: "messages_duplicate_of_message_id_fkey"
            columns: ["duplicate_of_message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_duplicate_of_message_id_fkey"
            columns: ["duplicate_of_message_id"]
            isOneToOne: false
            referencedRelation: "messages_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_duplicate_of_message_id_fkey"
            columns: ["duplicate_of_message_id"]
            isOneToOne: false
            referencedRelation: "v_message_forwards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_duplicate_of_message_id_fkey"
            columns: ["duplicate_of_message_id"]
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
      processing_locks: {
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
      gl_business_metrics: {
        Row: {
          total_customers: number | null
          total_estimates: number | null
          total_invoice_amount: number | null
          total_invoices: number | null
          total_outstanding_balance: number | null
          total_payments_made: number | null
          total_payments_received: number | null
          total_products: number | null
          total_purchase_amount: number | null
          total_purchase_balance: number | null
          total_purchase_orders: number | null
          total_vendors: number | null
        }
        Relationships: []
      }
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
      gl_estimate_totals: {
        Row: {
          balance: number | null
          glide_row_id: string | null
          id: string | null
          line_items_count: number | null
          status: string | null
          total_amount: number | null
          total_credits: number | null
        }
        Relationships: []
      }
      gl_mapping_status: {
        Row: {
          app_name: string | null
          column_mappings: Json | null
          connection_id: string | null
          created_at: string | null
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
          total_records: number | null
          updated_at: string | null
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
      gl_order_fulfillment: {
        Row: {
          customer_name: string | null
          has_shipping: boolean | null
          invoice_amount: number | null
          invoice_id: string | null
          invoice_rowid: string | null
          payment_status: string | null
          products: string | null
          ship_date: string | null
          total_items: number | null
          tracking_number: string | null
        }
        Relationships: []
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
      gl_unpaid_inventory: {
        Row: {
          category: string | null
          cost: number | null
          created_at: string | null
          date_timestamp_subm: string | null
          display_name: string | null
          email_email_of_user_who_added_product: string | null
          fronted: boolean | null
          glide_row_id: string | null
          id: string | null
          miscellaneous_items: boolean | null
          new_product_name: string | null
          po_po_date: string | null
          po_poui_dfrom_add_prod: string | null
          product_image1: string | null
          product_purchase_date: string | null
          purchase_notes: string | null
          rowid_accounts: string | null
          rowid_purchase_orders: string | null
          rowid_vendor_payments: string | null
          samples: boolean | null
          samples_or_fronted: boolean | null
          terms_for_fronted_product: string | null
          total_qty_purchased: number | null
          total_units_behind_sample: number | null
          unpaid_type: string | null
          unpaid_value: number | null
          updated_at: string | null
          vendor_name: string | null
          vendor_product_name: string | null
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
      mv_account_details: {
        Row: {
          account_id: string | null
          account_name: string | null
          accounts_uid: string | null
          balance: number | null
          client_type: string | null
          created_at: string | null
          glide_row_id: string | null
          invoice_count: number | null
          is_customer: boolean | null
          is_vendor: boolean | null
          last_invoice_date: string | null
          last_payment_date: string | null
          photo: string | null
          total_invoiced: number | null
          total_paid: number | null
          updated_at: string | null
        }
        Relationships: []
      }
      mv_estimate_customer_details: {
        Row: {
          balance: number | null
          created_at: string | null
          credit_count: number | null
          customer_glide_id: string | null
          customer_id: string | null
          customer_name: string | null
          customer_uid: string | null
          estimate_date: string | null
          estimate_id: string | null
          glide_row_id: string | null
          is_a_sample: boolean | null
          line_count: number | null
          related_invoice_glide_id: string | null
          status: string | null
          total_amount: number | null
          total_credits: number | null
          total_qty: number | null
          updated_at: string | null
          valid_final_create_invoice_clicked: boolean | null
        }
        Relationships: []
      }
      mv_invoice_customer_details: {
        Row: {
          balance: number | null
          created_at: string | null
          customer_glide_id: string | null
          customer_id: string | null
          customer_name: string | null
          customer_uid: string | null
          doc_glideforeverlink: string | null
          glide_row_id: string | null
          invoice_id: string | null
          invoice_order_date: string | null
          last_payment_date: string | null
          line_count: number | null
          notes: string | null
          payment_count: number | null
          payment_status: string | null
          total_amount: number | null
          total_paid: number | null
          total_qty: number | null
          updated_at: string | null
        }
        Relationships: []
      }
      mv_product_vendor_details: {
        Row: {
          category: string | null
          cost: number | null
          current_inventory: number | null
          display_name: string | null
          fronted: boolean | null
          fronted_value: number | null
          inventory_value: number | null
          miscellaneous_items: boolean | null
          new_product_name: string | null
          payment_status: string | null
          po_date: string | null
          po_number: string | null
          product_glide_id: string | null
          product_id: string | null
          product_image1: string | null
          product_purchase_date: string | null
          sample_value: number | null
          samples: boolean | null
          samples_or_fronted: boolean | null
          terms_for_fronted_product: string | null
          total_qty_purchased: number | null
          total_sampled: number | null
          total_sold: number | null
          total_units_behind_sample: number | null
          vendor_glide_id: string | null
          vendor_id: string | null
          vendor_name: string | null
          vendor_product_name: string | null
          vendor_uid: string | null
        }
        Relationships: []
      }
      mv_purchase_order_vendor_details: {
        Row: {
          balance: number | null
          created_at: string | null
          docs_shortlink: string | null
          glide_row_id: string | null
          last_payment_date: string | null
          payment_count: number | null
          payment_status: string | null
          pdf_link: string | null
          po_date: string | null
          product_categories: string[] | null
          product_count: number | null
          purchase_order_id: string | null
          purchase_order_uid: string | null
          total_amount: number | null
          total_items: number | null
          total_paid: number | null
          updated_at: string | null
          vendor_glide_id: string | null
          vendor_id: string | null
          vendor_name: string | null
          vendor_uid: string | null
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
      cleanup_orphaned_records: {
        Args: {
          table_name: string
        }
        Returns: number
      }
      compute_data_hash: {
        Args: {
          data: Json
        }
        Returns: string
      }
      construct_purchase_order: {
        Args: {
          analyzed_content: Json
        }
        Returns: string
      }
      convert_estimate_to_invoice: {
        Args: {
          estimate_id: string
          user_email: string
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
      generate_invoice_uid: {
        Args: {
          account_uid: string
          invoice_date: string
        }
        Returns: string
      }
      generate_po_uid: {
        Args: {
          account_uid: string
          po_date: string
        }
        Returns: string
      }
      get_make_event_status_summary: {
        Args: Record<PropertyKey, never>
        Returns: {
          status: string
          count: number
        }[]
      }
      get_table_columns: {
        Args: {
          table_name: string
        }
        Returns: {
          column_name: string
          data_type: string
        }[]
      }
      gl_admin_execute_sql: {
        Args: {
          sql_query: string
        }
        Returns: Json
      }
      gl_calculate_account_balance: {
        Args: {
          account_id: string
        }
        Returns: number
      }
      gl_calculate_product_inventory: {
        Args: {
          product_id: string
        }
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
      gl_get_sync_errors: {
        Args: {
          p_mapping_id: string
          p_limit?: number
          p_include_resolved?: boolean
        }
        Returns: {
          created_at: string | null
          error_message: string | null
          error_type: string | null
          id: string
          mapping_id: string | null
          record_data: Json | null
          resolution_notes: string | null
          resolved_at: string | null
          retryable: boolean | null
        }[]
      }
      gl_get_sync_status: {
        Args: Record<PropertyKey, never>
        Returns: {
          app_name: string | null
          column_mappings: Json | null
          connection_id: string | null
          created_at: string | null
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
          total_records: number | null
          updated_at: string | null
        }[]
      }
      gl_get_table_columns: {
        Args: {
          table_name: string
        }
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
        Args: {
          p_error_id: string
          p_resolution_notes?: string
        }
        Returns: boolean
      }
      gl_suggest_column_mappings: {
        Args: {
          p_supabase_table: string
          p_glide_columns: Json
        }
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
        Args: {
          product_id: string
          new_status: string
        }
        Returns: boolean
      }
      gl_validate_column_mapping: {
        Args: {
          p_mapping_id: string
        }
        Returns: {
          is_valid: boolean
          validation_message: string
        }[]
      }
      gl_validate_mapping_data: {
        Args: {
          p_mapping: Json
          p_editing?: boolean
        }
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
        Args: {
          account_id: string
        }
        Returns: Json
      }
      glsync_retry_failed_sync: {
        Args: {
          p_mapping_id: string
        }
        Returns: string
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
      is_customer: {
        Args: {
          account_type: string
        }
        Returns: boolean
      }
      is_vendor: {
        Args: {
          account_type: string
        }
        Returns: boolean
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
      make_clean_event_logs: {
        Args: {
          older_than: string
          webhook_id?: string
          status?: string
        }
        Returns: number
      }
      make_log_webhook_test: {
        Args: {
          webhook_id: string
          payload: Json
        }
        Returns: string
      }
      make_process_telegram_message_event: {
        Args: {
          message_id: string
          event_type: string
          context?: Json
        }
        Returns: Json
      }
      make_test_webhook_field_mapping: {
        Args: {
          webhook_id: string
          message_id: string
          event_type: string
        }
        Returns: Json
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
      process_webhook_event: {
        Args: {
          p_event_id: string
        }
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
        Args: {
          view_name: string
        }
        Returns: undefined
      }
      refresh_purchase_order_summary: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      reorder_make_automation_rules: {
        Args: {
          rule_ids: string[]
        }
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
        Args: {
          search_term: string
        }
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
      update_estimate_totals: {
        Args: {
          estimate_id: string
        }
        Returns: undefined
      }
      update_invoice_totals: {
        Args: {
          invoice_id: string
        }
        Returns: undefined
      }
      update_po_totals: {
        Args: {
          po_id: string
        }
        Returns: undefined
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
      xdelo_add_missing_columns_to_other_messages: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      xdelo_check_media_group_content: {
        Args: {
          p_media_group_id: string
          p_message_id: string
          p_correlation_id?: string
        }
        Returns: Json
      }
      xdelo_cleanup_duplicate_functions: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      xdelo_cleanup_orphaned_audit_logs: {
        Args: Record<PropertyKey, never>
        Returns: {
          deleted_count: number
        }[]
      }
      xdelo_clear_all_messages: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      xdelo_complete_message_processing: {
        Args: {
          p_message_id: string
          p_analyzed_content: Json
        }
        Returns: Json
      }
      xdelo_construct_message_url_from_data: {
        Args: {
          telegram_data: Json
        }
        Returns: string
      }
      xdelo_construct_telegram_message_url:
        | {
            Args: {
              chat_type: Database["public"]["Enums"]["telegram_chat_type"]
              chat_id: number
              id: number
            }
            Returns: string
          }
        | {
            Args: {
              chat_type: Database["public"]["Enums"]["telegram_chat_type"]
              chat_id: number
              id: string
            }
            Returns: string
          }
      xdelo_fail_message_processing: {
        Args: {
          p_message_id: string
          p_error_message: string
        }
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
        Args: {
          p_media_group_id: string
        }
        Returns: string
      }
      xdelo_find_valid_file_id: {
        Args: {
          p_media_group_id: string
          p_file_unique_id: string
        }
        Returns: string
      }
      xdelo_fix_public_urls: {
        Args: {
          p_limit?: number
        }
        Returns: {
          message_id: string
          old_url: string
          new_url: string
        }[]
      }
      xdelo_flag_file_for_redownload: {
        Args: {
          p_message_id: string
          p_reason?: string
        }
        Returns: boolean
      }
      xdelo_get_incomplete_media_groups: {
        Args: {
          limit_param?: number
        }
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
        Args: {
          p_correlation_id: string
        }
        Returns: Json
      }
      xdelo_get_message_for_processing: {
        Args: {
          p_message_id: string
        }
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
        Args: {
          p_message_id: string
        }
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
      xdelo_handle_duplicate_detection: {
        Args: {
          p_file_unique_id: string
          p_telegram_message_id: number
          p_chat_id: number
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
        Args: {
          p_caption: string
        }
        Returns: boolean
      }
      xdelo_log_event: {
        Args: {
          p_event_type: Database["public"]["Enums"]["audit_event_type"]
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
      xdelo_log_message_operation:
        | {
            Args: {
              p_operation: string
              p_message_id: string
              p_details: Json
            }
            Returns: undefined
          }
        | {
            Args: {
              p_operation: string
              p_message_id: string
              p_metadata?: Json
              p_error_message?: string
            }
            Returns: string
          }
        | {
            Args: {
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
            Returns: string
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
      xdelo_log_webhook_event: {
        Args: {
          p_event_type: string
          p_chat_id: number
          p_message_id: string
          p_media_type?: string
          p_error_message?: string
          p_raw_data?: Json
        }
        Returns: undefined
      }
      xdelo_mark_for_redownload: {
        Args: {
          p_message_id: string
          p_reason?: string
        }
        Returns: boolean
      }
      xdelo_parse_caption: {
        Args: {
          p_caption: string
        }
        Returns: Json
      }
      xdelo_process_caption_workflow: {
        Args: {
          p_message_id: string
          p_correlation_id?: string
          p_force?: boolean
        }
        Returns: Json
      }
      xdelo_repair_file: {
        Args: {
          p_message_id: string
          p_action: string
        }
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
      xdelo_repair_message_relationships: {
        Args: Record<PropertyKey, never>
        Returns: {
          media_group_id: string
          caption_message_id: string
          updated_count: number
        }[]
      }
      xdelo_reprocess_messages: {
        Args: {
          p_limit?: number
        }
        Returns: {
          message_id: string
          media_group_id: string
          success: boolean
          error: string
        }[]
      }
      xdelo_set_message_processing: {
        Args: {
          p_message_id: string
          p_correlation_id: string
        }
        Returns: undefined
      }
      xdelo_standardize_file_extension: {
        Args: {
          p_mime_type: string
        }
        Returns: string
      }
      xdelo_standardize_storage_path: {
        Args: {
          p_file_unique_id: string
          p_mime_type?: string
        }
        Returns: string
      }
      xdelo_sync_forward_media: {
        Args: {
          p_original_message_id: string
          p_forward_message_id: string
        }
        Returns: undefined
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
      xdelo_update_message_processing_state: {
        Args: {
          p_message_id: string
          p_state: string
          p_error?: string
        }
        Returns: undefined
      }
      xdelo_update_message_with_analyzed_content: {
        Args: {
          p_message_id: string
          p_analyzed_content: Json
          p_processing_state?: string
          p_is_edit?: boolean
        }
        Returns: Json
      }
      xdelo_update_product_matching_config: {
        Args: {
          p_config: Json
        }
        Returns: Json
      }
      xdelo_validate_message_ids: {
        Args: {
          p_message_id: string
        }
        Returns: boolean
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
