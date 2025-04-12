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
          glide_row_id: string | null
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
          glide_row_id?: string | null
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
          glide_row_id?: string | null
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
          rowid_accounts: string | null
          rowid_invoices: string | null
          type_of_payment: string | null
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
          rowid_accounts?: string | null
          rowid_invoices?: string | null
          type_of_payment?: string | null
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
          glide_row_id: string
          id: string
          line_total: number | null
          product_name_display: string | null
          product_sale_note: string | null
          qty_sold: number | null
          rowid_estimates: string | null
          rowid_products: string | null
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
          product_sale_note?: string | null
          qty_sold?: number | null
          rowid_estimates?: string | null
          rowid_products?: string | null
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
          product_sale_note?: string | null
          qty_sold?: number | null
          rowid_estimates?: string | null
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
          estimate_uid: string | null
          glide_pdf_url: string | null
          glide_pdf_url2: string | null
          glide_row_id: string
          id: string
          is_a_sample: boolean | null
          notes: string | null
          rowid_accounts: string | null
          rowid_invoices: string | null
          status: string | null
          supabase_pdf_url: string | null
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
          estimate_uid?: string | null
          glide_pdf_url?: string | null
          glide_pdf_url2?: string | null
          glide_row_id: string
          id?: string
          is_a_sample?: boolean | null
          notes?: string | null
          rowid_accounts?: string | null
          rowid_invoices?: string | null
          status?: string | null
          supabase_pdf_url?: string | null
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
          estimate_uid?: string | null
          glide_pdf_url?: string | null
          glide_pdf_url2?: string | null
          glide_row_id?: string
          id?: string
          is_a_sample?: boolean | null
          notes?: string | null
          rowid_accounts?: string | null
          rowid_invoices?: string | null
          status?: string | null
          supabase_pdf_url?: string | null
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
          glide_row_id: string
          id?: string
          line_total?: number | null
          product_name_display?: string | null
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
          glide_row_id?: string
          id?: string
          line_total?: number | null
          product_name_display?: string | null
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
          glide_row_id: string
          id: string
          invoice_order_date: string | null
          invoice_uid: string | null
          notes: string | null
          payment_status: string | null
          processed: string | null
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
          doc_glideforeverlink?: string | null
          glide_row_id: string
          id?: string
          invoice_order_date?: string | null
          invoice_uid?: string | null
          notes?: string | null
          payment_status?: string | null
          processed?: string | null
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
          doc_glideforeverlink?: string | null
          glide_row_id?: string
          id?: string
          invoice_order_date?: string | null
          invoice_uid?: string | null
          notes?: string | null
          payment_status?: string | null
          processed?: string | null
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
      gl_products: {
        Row: {
          category: string | null
          cost: number | null
          created_at: string | null
          date_timestamp_subm: string | null
          display_name: string | null
          email_email_of_user_who_added_product: string | null
          fronted: boolean | null
          glide_row_id: string
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
          date_timestamp_subm?: string | null
          display_name?: string | null
          email_email_of_user_who_added_product?: string | null
          fronted?: boolean | null
          glide_row_id: string
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
          date_timestamp_subm?: string | null
          display_name?: string | null
          email_email_of_user_who_added_product?: string | null
          fronted?: boolean | null
          glide_row_id?: string
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
          docs_shortlink: string | null
          glide_row_id: string
          id: string
          payment_status: string | null
          pdf_link: string | null
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
          docs_shortlink?: string | null
          glide_row_id: string
          id?: string
          payment_status?: string | null
          pdf_link?: string | null
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
          docs_shortlink?: string | null
          glide_row_id?: string
          id?: string
          payment_status?: string | null
          pdf_link?: string | null
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
          glide_row_id: string
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
        Update: {
          box_sizes?: string | null
          box_weight?: number | null
          created_at?: string | null
          drop_off_location_uid?: string | null
          glide_row_id?: string
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
          vendor_purchase_note: string | null
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
          vendor_purchase_note?: string | null
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
          vendor_purchase_note?: string | null
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
            isOneToOne: false
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
          {
            foreignKeyName: "product_matches_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "gl_unpaid_inventory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_matches_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "mv_product_vendor_details"
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
          timeout_seconds?: number | null
          updated_at?: string | null
        }
        Relationships: []
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
    }
    Views: {
      balance_sheet_view: {
        Row: {
          accounts_payable: number | null
          accounts_receivable: number | null
          balance_sheet_date: string | null
          current_ratio: number | null
          customer_payments_in_transit: number | null
          debt_ratio: number | null
          debt_to_equity_ratio: number | null
          intangible_assets: number | null
          inventory_value: number | null
          long_term_debt: number | null
          owner_contributions: number | null
          owner_withdrawals: number | null
          property_and_equipment: number | null
          retained_earnings: number | null
          total_assets: number | null
          total_current_assets: number | null
          total_current_liabilities: number | null
          total_equity: number | null
          total_liabilities: number | null
          total_liabilities_and_equity: number | null
          total_non_current_assets: number | null
          total_non_current_liabilities: number | null
          unpaid_purchase_orders: number | null
          working_capital: number | null
        }
        Relationships: []
      }
      budget_variance_analysis_view: {
        Row: {
          budget_amount: number | null
          comparison_period_end: string | null
          comparison_period_start: string | null
          current_amount: number | null
          current_period_end: string | null
          current_period_start: string | null
          metric: string | null
          performance: string | null
          variance_amount: number | null
          variance_percent: number | null
        }
        Relationships: []
      }
      cash_flow_statement_view: {
        Row: {
          beginning_cash_balance: number | null
          change_in_accounts_payable: number | null
          change_in_accounts_receivable: number | null
          change_in_inventory: number | null
          customer_payments_received: number | null
          end_date: string | null
          ending_cash_balance: number | null
          expenses_paid: number | null
          loan_proceeds: number | null
          loan_repayments: number | null
          net_cash_from_financing_activities: number | null
          net_cash_from_investing_activities: number | null
          net_cash_from_operating_activities: number | null
          net_change_in_cash: number | null
          owner_contributions: number | null
          owner_withdrawals: number | null
          purchase_of_equipment: number | null
          sale_of_investments: number | null
          start_date: string | null
          vendor_payments_made: number | null
        }
        Relationships: []
      }
      financial_ratios_view: {
        Row: {
          accounts_receivable_turnover: number | null
          current_accounts_payable: number | null
          current_accounts_receivable: number | null
          current_assets: number | null
          current_inventory: number | null
          current_liabilities: number | null
          current_period_cogs: number | null
          current_period_expenses: number | null
          current_period_gross_profit: number | null
          current_period_net_profit: number | null
          current_period_revenue: number | null
          current_ratio: number | null
          gross_profit_growth_pct: number | null
          gross_profit_margin_pct: number | null
          inventory_turnover: number | null
          net_profit_growth_pct: number | null
          net_profit_margin_pct: number | null
          period_end_date: string | null
          period_start_date: string | null
          previous_period_cogs: number | null
          previous_period_expenses: number | null
          previous_period_gross_profit: number | null
          previous_period_net_profit: number | null
          previous_period_revenue: number | null
          quick_ratio: number | null
          revenue_growth_pct: number | null
        }
        Relationships: []
      }
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
      mv_invoice_customer_details: {
        Row: {
          balance: number | null
          created_at: string | null
          created_timestamp: string | null
          customer: Json | null
          customer_id: string | null
          customer_name: string | null
          customer_uid: string | null
          doc_glideforeverlink: string | null
          glide_row_id: string | null
          id: string | null
          invoice_order_date: string | null
          line_item_count: number | null
          line_items_total: number | null
          notes: string | null
          payment_status: string | null
          payments_total: number | null
          rowid_accounts: string | null
          submitted_timestamp: string | null
          total_amount: number | null
          total_paid: number | null
          updated_at: string | null
          user_email: string | null
        }
        Relationships: []
      }
      mv_product_vendor_details: {
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
          po_date: string | null
          po_number: string | null
          po_po_date: string | null
          po_poui_dfrom_add_prod: string | null
          po_status: string | null
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
          vendor: Json | null
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
          date_payment_date_mddyyyy: string | null
          docs_shortlink: string | null
          glide_row_id: string | null
          id: string | null
          payment_status: string | null
          payments_total: number | null
          pdf_link: string | null
          po_date: string | null
          product_count: number | null
          product_count_calc: number | null
          products_total: number | null
          purchase_order_uid: string | null
          rowid_accounts: string | null
          total_amount: number | null
          total_paid: number | null
          updated_at: string | null
          vendor: Json | null
          vendor_id: string | null
          vendor_name: string | null
          vendor_uid: string | null
        }
        Relationships: []
      }
      profitability_analysis_view: {
        Row: {
          analysis_type: string | null
          current_receivable_balance: number | null
          entity_category: string | null
          entity_id: string | null
          entity_name: string | null
          gross_profit: number | null
          gross_profit_margin_pct: number | null
          invoice_count: string | null
          product_count: string | null
          total_cost: number | null
          total_quantity_sold: number | null
          total_revenue: number | null
        }
        Relationships: []
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
      approve_product_from_queue: {
        Args: { p_queue_id: string; p_product_id: string; p_user_id?: string }
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
      calculate_customer_balance_for_account: {
        Args: { p_glide_row_id: string }
        Returns: number
      }
      calculate_vendor_balance_for_account: {
        Args: { p_glide_row_id: string }
        Returns: number
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
      get_potential_product_matches: {
        Args: { p_message_id: string; p_limit?: number; p_min_score?: number }
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
      get_supabase_function_url: {
        Args: Record<PropertyKey, never>
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
          total_purchase_balance: number
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
      log_pdf_generation_failure: {
        Args: {
          p_document_type: string
          p_document_id: string
          p_error_message: string
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
      send_product_matching_webhook: {
        Args: {
          p_message_id: string
          p_match_data: Json
          p_confidence_level: Database["public"]["Enums"]["confidence_level"]
        }
        Returns: Json
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
