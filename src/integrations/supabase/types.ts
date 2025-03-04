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
      credentials_entity: {
        Row: {
          createdAt: string
          data: string
          id: number
          name: string
          nodesAccess: Json
          type: string
          updatedAt: string
        }
        Insert: {
          createdAt?: string
          data: string
          id?: number
          name: string
          nodesAccess: Json
          type: string
          updatedAt?: string
        }
        Update: {
          createdAt?: string
          data?: string
          id?: number
          name?: string
          nodesAccess?: Json
          type?: string
          updatedAt?: string
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
      documents: {
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
      execution_entity: {
        Row: {
          data: string
          finished: boolean
          id: number
          mode: string
          retryOf: string | null
          retrySuccessId: string | null
          startedAt: string
          stoppedAt: string | null
          waitTill: string | null
          workflowData: Json
          workflowId: string | null
        }
        Insert: {
          data: string
          finished: boolean
          id?: number
          mode: string
          retryOf?: string | null
          retrySuccessId?: string | null
          startedAt: string
          stoppedAt?: string | null
          waitTill?: string | null
          workflowData: Json
          workflowId?: string | null
        }
        Update: {
          data?: string
          finished?: boolean
          id?: number
          mode?: string
          retryOf?: string | null
          retrySuccessId?: string | null
          startedAt?: string
          stoppedAt?: string | null
          waitTill?: string | null
          workflowData?: Json
          workflowId?: string | null
        }
        Relationships: []
      }
      gl_accounts: {
        Row: {
          created_at: string | null
          glide_id: string | null
          id: string
          last_modified_at: string | null
          last_sync_time: string | null
          main_account_name: string | null
          main_accounts_uid: string | null
          main_client_type: Database["public"]["Enums"]["client_type"] | null
          main_date_added_client: string | null
          main_email_of_who_added: string | null
          main_photo: string | null
          sync_status: Database["public"]["Enums"]["sync_status"] | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          glide_id?: string | null
          id?: string
          last_modified_at?: string | null
          last_sync_time?: string | null
          main_account_name?: string | null
          main_accounts_uid?: string | null
          main_client_type?: Database["public"]["Enums"]["client_type"] | null
          main_date_added_client?: string | null
          main_email_of_who_added?: string | null
          main_photo?: string | null
          sync_status?: Database["public"]["Enums"]["sync_status"] | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          glide_id?: string | null
          id?: string
          last_modified_at?: string | null
          last_sync_time?: string | null
          main_account_name?: string | null
          main_accounts_uid?: string | null
          main_client_type?: Database["public"]["Enums"]["client_type"] | null
          main_date_added_client?: string | null
          main_email_of_who_added?: string | null
          main_photo?: string | null
          sync_status?: Database["public"]["Enums"]["sync_status"] | null
          updated_at?: string | null
        }
        Relationships: []
      }
      gl_audit_trail: {
        Row: {
          action_timestamp: string | null
          action_type: string
          changed_fields: Json | null
          id: string
          notes: string | null
          record_id: string
          table_name: string
          user_identifier: string | null
        }
        Insert: {
          action_timestamp?: string | null
          action_type: string
          changed_fields?: Json | null
          id?: string
          notes?: string | null
          record_id: string
          table_name: string
          user_identifier?: string | null
        }
        Update: {
          action_timestamp?: string | null
          action_type?: string
          changed_fields?: Json | null
          id?: string
          notes?: string | null
          record_id?: string
          table_name?: string
          user_identifier?: string | null
        }
        Relationships: []
      }
      gl_column_mappings: {
        Row: {
          data_type: string
          glide_column_id: string
          glide_column_name: string
          id: number
          supabase_column_name: string
          table_name: string
        }
        Insert: {
          data_type: string
          glide_column_id: string
          glide_column_name: string
          id?: never
          supabase_column_name: string
          table_name: string
        }
        Update: {
          data_type?: string
          glide_column_id?: string
          glide_column_name?: string
          id?: never
          supabase_column_name?: string
          table_name?: string
        }
        Relationships: []
      }
      gl_configuration: {
        Row: {
          api_key: string
          app_id: string
          created_at: string | null
          glide_json: Json | null
          glide_table_name: string
          id: string
          is_active: boolean
          max_retries: number | null
          mutation_api_endpoint: string | null
          retry_interval: unknown | null
          supabase_table_name: string
          supported_operations: string[]
          sync_api_endpoint: string | null
          table_config: Json | null
          table_id: string
          updated_at: string | null
        }
        Insert: {
          api_key: string
          app_id: string
          created_at?: string | null
          glide_json?: Json | null
          glide_table_name: string
          id?: string
          is_active?: boolean
          max_retries?: number | null
          mutation_api_endpoint?: string | null
          retry_interval?: unknown | null
          supabase_table_name: string
          supported_operations?: string[]
          sync_api_endpoint?: string | null
          table_config?: Json | null
          table_id: string
          updated_at?: string | null
        }
        Update: {
          api_key?: string
          app_id?: string
          created_at?: string | null
          glide_json?: Json | null
          glide_table_name?: string
          id?: string
          is_active?: boolean
          max_retries?: number | null
          mutation_api_endpoint?: string | null
          retry_interval?: unknown | null
          supabase_table_name?: string
          supported_operations?: string[]
          sync_api_endpoint?: string | null
          table_config?: Json | null
          table_id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      gl_customer_credits: {
        Row: {
          created_at: string | null
          glide_id: string | null
          id: string
          last_modified_at: string | null
          last_sync_time: string | null
          main_date_of_payment: string | null
          main_payment_amount: number | null
          main_payment_note: string | null
          main_payment_typ: string | null
          rowid_account_row_id: string | null
          rowid_estimate_row_id: string | null
          rowid_invoice_row_id: string | null
          sb_accounts_id: string | null
          sb_estimates_id: string | null
          sb_invoices_id: string | null
          sync_status: Database["public"]["Enums"]["sync_status"] | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          glide_id?: string | null
          id?: string
          last_modified_at?: string | null
          last_sync_time?: string | null
          main_date_of_payment?: string | null
          main_payment_amount?: number | null
          main_payment_note?: string | null
          main_payment_typ?: string | null
          rowid_account_row_id?: string | null
          rowid_estimate_row_id?: string | null
          rowid_invoice_row_id?: string | null
          sb_accounts_id?: string | null
          sb_estimates_id?: string | null
          sb_invoices_id?: string | null
          sync_status?: Database["public"]["Enums"]["sync_status"] | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          glide_id?: string | null
          id?: string
          last_modified_at?: string | null
          last_sync_time?: string | null
          main_date_of_payment?: string | null
          main_payment_amount?: number | null
          main_payment_note?: string | null
          main_payment_typ?: string | null
          rowid_account_row_id?: string | null
          rowid_estimate_row_id?: string | null
          rowid_invoice_row_id?: string | null
          sb_accounts_id?: string | null
          sb_estimates_id?: string | null
          sb_invoices_id?: string | null
          sync_status?: Database["public"]["Enums"]["sync_status"] | null
          updated_at?: string | null
        }
        Relationships: []
      }
      gl_customer_payments: {
        Row: {
          created_at: string | null
          email_of_user: string | null
          glide_id: string | null
          id: string
          last_modified_at: string | null
          last_sync_time: string | null
          main_date_of_payment: string | null
          main_payment_amount: number | null
          main_payment_note: string | null
          main_type_of_payment: string | null
          rowid_account_row_id: string | null
          rowid_invoice_row_id: string | null
          sb_accounts_id: string | null
          sb_invoices_id: string | null
          sync_status: Database["public"]["Enums"]["sync_status"] | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email_of_user?: string | null
          glide_id?: string | null
          id?: string
          last_modified_at?: string | null
          last_sync_time?: string | null
          main_date_of_payment?: string | null
          main_payment_amount?: number | null
          main_payment_note?: string | null
          main_type_of_payment?: string | null
          rowid_account_row_id?: string | null
          rowid_invoice_row_id?: string | null
          sb_accounts_id?: string | null
          sb_invoices_id?: string | null
          sync_status?: Database["public"]["Enums"]["sync_status"] | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email_of_user?: string | null
          glide_id?: string | null
          id?: string
          last_modified_at?: string | null
          last_sync_time?: string | null
          main_date_of_payment?: string | null
          main_payment_amount?: number | null
          main_payment_note?: string | null
          main_type_of_payment?: string | null
          rowid_account_row_id?: string | null
          rowid_invoice_row_id?: string | null
          sb_accounts_id?: string | null
          sb_invoices_id?: string | null
          sync_status?: Database["public"]["Enums"]["sync_status"] | null
          updated_at?: string | null
        }
        Relationships: []
      }
      gl_estimate_lines: {
        Row: {
          created_at: string | null
          glide_id: string | null
          id: string
          last_modified_at: string | null
          last_sync_time: string | null
          main_date_of_sale: string | null
          main_line_total: number | null
          main_product_sale_note: string | null
          main_qty_sold: number | null
          main_sale_product_name: string | null
          main_selling_price: number | null
          main_total_stock_after_sell: number | null
          product_sale_name_display: string | null
          rowid_estimate_row_id_fromline: string | null
          rowid_product_id_estline_items: string | null
          sb_estimates_id: string | null
          sb_invoice_lines_id: string | null
          sb_products_id: string | null
          sync_status: Database["public"]["Enums"]["sync_status"] | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          glide_id?: string | null
          id?: string
          last_modified_at?: string | null
          last_sync_time?: string | null
          main_date_of_sale?: string | null
          main_line_total?: number | null
          main_product_sale_note?: string | null
          main_qty_sold?: number | null
          main_sale_product_name?: string | null
          main_selling_price?: number | null
          main_total_stock_after_sell?: number | null
          product_sale_name_display?: string | null
          rowid_estimate_row_id_fromline?: string | null
          rowid_product_id_estline_items?: string | null
          sb_estimates_id?: string | null
          sb_invoice_lines_id?: string | null
          sb_products_id?: string | null
          sync_status?: Database["public"]["Enums"]["sync_status"] | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          glide_id?: string | null
          id?: string
          last_modified_at?: string | null
          last_sync_time?: string | null
          main_date_of_sale?: string | null
          main_line_total?: number | null
          main_product_sale_note?: string | null
          main_qty_sold?: number | null
          main_sale_product_name?: string | null
          main_selling_price?: number | null
          main_total_stock_after_sell?: number | null
          product_sale_name_display?: string | null
          rowid_estimate_row_id_fromline?: string | null
          rowid_product_id_estline_items?: string | null
          sb_estimates_id?: string | null
          sb_invoice_lines_id?: string | null
          sb_products_id?: string | null
          sync_status?: Database["public"]["Enums"]["sync_status"] | null
          updated_at?: string | null
        }
        Relationships: []
      }
      gl_estimates: {
        Row: {
          add_note: boolean | null
          created_at: string | null
          date_invoice_created_date: string | null
          glide_id: string | null
          id: string
          last_modified_at: string | null
          last_sync_time: string | null
          main_estimate_balance: number | null
          main_estimate_date: string | null
          main_estimate_total: number | null
          main_is_a_sample: boolean | null
          main_total_payments: number | null
          rowids_account_row_id_estimates: string | null
          rowids_invoice_created: string | null
          sb_accounts_id: string | null
          sb_invoices_id: string | null
          short_link_pdf: string | null
          shortlink_pdf2: string | null
          sync_status: Database["public"]["Enums"]["sync_status"] | null
          updated_at: string | null
          valid_final_create_invoice_clicked: boolean | null
        }
        Insert: {
          add_note?: boolean | null
          created_at?: string | null
          date_invoice_created_date?: string | null
          glide_id?: string | null
          id?: string
          last_modified_at?: string | null
          last_sync_time?: string | null
          main_estimate_balance?: number | null
          main_estimate_date?: string | null
          main_estimate_total?: number | null
          main_is_a_sample?: boolean | null
          main_total_payments?: number | null
          rowids_account_row_id_estimates?: string | null
          rowids_invoice_created?: string | null
          sb_accounts_id?: string | null
          sb_invoices_id?: string | null
          short_link_pdf?: string | null
          shortlink_pdf2?: string | null
          sync_status?: Database["public"]["Enums"]["sync_status"] | null
          updated_at?: string | null
          valid_final_create_invoice_clicked?: boolean | null
        }
        Update: {
          add_note?: boolean | null
          created_at?: string | null
          date_invoice_created_date?: string | null
          glide_id?: string | null
          id?: string
          last_modified_at?: string | null
          last_sync_time?: string | null
          main_estimate_balance?: number | null
          main_estimate_date?: string | null
          main_estimate_total?: number | null
          main_is_a_sample?: boolean | null
          main_total_payments?: number | null
          rowids_account_row_id_estimates?: string | null
          rowids_invoice_created?: string | null
          sb_accounts_id?: string | null
          sb_invoices_id?: string | null
          short_link_pdf?: string | null
          shortlink_pdf2?: string | null
          sync_status?: Database["public"]["Enums"]["sync_status"] | null
          updated_at?: string | null
          valid_final_create_invoice_clicked?: boolean | null
        }
        Relationships: []
      }
      gl_expenses: {
        Row: {
          amount: number | null
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
          glide_id: string | null
          id: string
          last_modified_at: string | null
          last_sync_time: string | null
          main_category: string | null
          main_notes_of_expense: string | null
          main_submitted_by: string | null
          processing: boolean | null
          sync_status: Database["public"]["Enums"]["sync_status"] | null
          updated_at: string | null
        }
        Insert: {
          amount?: number | null
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
          glide_id?: string | null
          id?: string
          last_modified_at?: string | null
          last_sync_time?: string | null
          main_category?: string | null
          main_notes_of_expense?: string | null
          main_submitted_by?: string | null
          processing?: boolean | null
          sync_status?: Database["public"]["Enums"]["sync_status"] | null
          updated_at?: string | null
        }
        Update: {
          amount?: number | null
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
          glide_id?: string | null
          id?: string
          last_modified_at?: string | null
          last_sync_time?: string | null
          main_category?: string | null
          main_notes_of_expense?: string | null
          main_submitted_by?: string | null
          processing?: boolean | null
          sync_status?: Database["public"]["Enums"]["sync_status"] | null
          updated_at?: string | null
        }
        Relationships: []
      }
      gl_invoice_lines: {
        Row: {
          created_at: string | null
          glide_id: string | null
          id: string
          last_modified_at: string | null
          last_sync_time: string | null
          main_date_of_sale: string | null
          main_line_total: number | null
          main_product_sale_note: string | null
          main_qty_sold: number | null
          main_renamed_product_name: string | null
          main_selling_price: number | null
          main_user_email_of_added: string | null
          product_sale_name_display: string | null
          rowid_invoice_rowid: string | null
          rowid_productid: string | null
          sb_estimate_lines_id: string | null
          sb_invoices_id: string | null
          sb_products_id: string | null
          sync_status: Database["public"]["Enums"]["sync_status"] | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          glide_id?: string | null
          id?: string
          last_modified_at?: string | null
          last_sync_time?: string | null
          main_date_of_sale?: string | null
          main_line_total?: number | null
          main_product_sale_note?: string | null
          main_qty_sold?: number | null
          main_renamed_product_name?: string | null
          main_selling_price?: number | null
          main_user_email_of_added?: string | null
          product_sale_name_display?: string | null
          rowid_invoice_rowid?: string | null
          rowid_productid?: string | null
          sb_estimate_lines_id?: string | null
          sb_invoices_id?: string | null
          sb_products_id?: string | null
          sync_status?: Database["public"]["Enums"]["sync_status"] | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          glide_id?: string | null
          id?: string
          last_modified_at?: string | null
          last_sync_time?: string | null
          main_date_of_sale?: string | null
          main_line_total?: number | null
          main_product_sale_note?: string | null
          main_qty_sold?: number | null
          main_renamed_product_name?: string | null
          main_selling_price?: number | null
          main_user_email_of_added?: string | null
          product_sale_name_display?: string | null
          rowid_invoice_rowid?: string | null
          rowid_productid?: string | null
          sb_estimate_lines_id?: string | null
          sb_invoices_id?: string | null
          sb_products_id?: string | null
          sync_status?: Database["public"]["Enums"]["sync_status"] | null
          updated_at?: string | null
        }
        Relationships: []
      }
      gl_invoices: {
        Row: {
          created_at: string | null
          doc_glideforeverlink: string | null
          glide_id: string | null
          id: string
          last_modified_at: string | null
          last_sync_time: string | null
          main_balance_due: number | null
          main_created_timestamp: string | null
          main_invoice_order_date: string | null
          main_invoice_total: number | null
          main_invoice_uid: string | null
          main_notes: string | null
          main_processed: boolean | null
          main_submitted_timestamp: string | null
          main_user_email: string | null
          rowids_accountsid_new: string | null
          sb_accounts_id: string | null
          sb_estimates_id: string | null
          sync_status: Database["public"]["Enums"]["sync_status"] | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          doc_glideforeverlink?: string | null
          glide_id?: string | null
          id?: string
          last_modified_at?: string | null
          last_sync_time?: string | null
          main_balance_due?: number | null
          main_created_timestamp?: string | null
          main_invoice_order_date?: string | null
          main_invoice_total?: number | null
          main_invoice_uid?: string | null
          main_notes?: string | null
          main_processed?: boolean | null
          main_submitted_timestamp?: string | null
          main_user_email?: string | null
          rowids_accountsid_new?: string | null
          sb_accounts_id?: string | null
          sb_estimates_id?: string | null
          sync_status?: Database["public"]["Enums"]["sync_status"] | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          doc_glideforeverlink?: string | null
          glide_id?: string | null
          id?: string
          last_modified_at?: string | null
          last_sync_time?: string | null
          main_balance_due?: number | null
          main_created_timestamp?: string | null
          main_invoice_order_date?: string | null
          main_invoice_total?: number | null
          main_invoice_uid?: string | null
          main_notes?: string | null
          main_processed?: boolean | null
          main_submitted_timestamp?: string | null
          main_user_email?: string | null
          rowids_accountsid_new?: string | null
          sb_accounts_id?: string | null
          sb_estimates_id?: string | null
          sync_status?: Database["public"]["Enums"]["sync_status"] | null
          updated_at?: string | null
        }
        Relationships: []
      }
      gl_products: {
        Row: {
          created_at: string | null
          date_timestamp_subm: string | null
          email_email_of_user_who_added_product: string | null
          glide_id: string | null
          id: string
          last_modified_at: string | null
          last_sync_time: string | null
          main_category: string | null
          main_cost: number | null
          main_fronted: boolean | null
          main_miscellaneous_items: boolean | null
          main_new_product_name: string | null
          main_product_image1: string | null
          main_product_purchase_date: string | null
          main_purchase_notes: string | null
          main_samples: boolean | null
          main_samples_or_fronted: boolean | null
          main_terms_for_fronted_product: string | null
          main_total_qty_purchased: number | null
          main_total_units_behind_sample: number | null
          main_vendor_product_name: string | null
          po_po_date: string | null
          po_poui_dfrom_add_prod: string | null
          product_name_display: string | null
          rowid_accountrow_id: string | null
          rowid_purchase_order_row_id: string | null
          rowid_vpay_row_id: string | null
          sb_accounts_id: string | null
          sb_purchase_orders_id: string | null
          sync_status: Database["public"]["Enums"]["sync_status"] | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          date_timestamp_subm?: string | null
          email_email_of_user_who_added_product?: string | null
          glide_id?: string | null
          id?: string
          last_modified_at?: string | null
          last_sync_time?: string | null
          main_category?: string | null
          main_cost?: number | null
          main_fronted?: boolean | null
          main_miscellaneous_items?: boolean | null
          main_new_product_name?: string | null
          main_product_image1?: string | null
          main_product_purchase_date?: string | null
          main_purchase_notes?: string | null
          main_samples?: boolean | null
          main_samples_or_fronted?: boolean | null
          main_terms_for_fronted_product?: string | null
          main_total_qty_purchased?: number | null
          main_total_units_behind_sample?: number | null
          main_vendor_product_name?: string | null
          po_po_date?: string | null
          po_poui_dfrom_add_prod?: string | null
          product_name_display?: string | null
          rowid_accountrow_id?: string | null
          rowid_purchase_order_row_id?: string | null
          rowid_vpay_row_id?: string | null
          sb_accounts_id?: string | null
          sb_purchase_orders_id?: string | null
          sync_status?: Database["public"]["Enums"]["sync_status"] | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          date_timestamp_subm?: string | null
          email_email_of_user_who_added_product?: string | null
          glide_id?: string | null
          id?: string
          last_modified_at?: string | null
          last_sync_time?: string | null
          main_category?: string | null
          main_cost?: number | null
          main_fronted?: boolean | null
          main_miscellaneous_items?: boolean | null
          main_new_product_name?: string | null
          main_product_image1?: string | null
          main_product_purchase_date?: string | null
          main_purchase_notes?: string | null
          main_samples?: boolean | null
          main_samples_or_fronted?: boolean | null
          main_terms_for_fronted_product?: string | null
          main_total_qty_purchased?: number | null
          main_total_units_behind_sample?: number | null
          main_vendor_product_name?: string | null
          po_po_date?: string | null
          po_poui_dfrom_add_prod?: string | null
          product_name_display?: string | null
          rowid_accountrow_id?: string | null
          rowid_purchase_order_row_id?: string | null
          rowid_vpay_row_id?: string | null
          sb_accounts_id?: string | null
          sb_purchase_orders_id?: string | null
          sync_status?: Database["public"]["Enums"]["sync_status"] | null
          updated_at?: string | null
        }
        Relationships: []
      }
      gl_purchase_orders: {
        Row: {
          created_at: string | null
          date_payment_date_mddyyyy: string | null
          docs_shortlink: string | null
          glide_id: string | null
          id: string
          last_modified_at: string | null
          last_sync_time: string | null
          main_balance_due: number | null
          main_po_date: string | null
          main_po_total: number | null
          main_purchase_order_uid: string | null
          rowid_accntrowid: string | null
          sb_accounts_id: string | null
          share_url: string | null
          sync_status: Database["public"]["Enums"]["sync_status"] | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          date_payment_date_mddyyyy?: string | null
          docs_shortlink?: string | null
          glide_id?: string | null
          id?: string
          last_modified_at?: string | null
          last_sync_time?: string | null
          main_balance_due?: number | null
          main_po_date?: string | null
          main_po_total?: number | null
          main_purchase_order_uid?: string | null
          rowid_accntrowid?: string | null
          sb_accounts_id?: string | null
          share_url?: string | null
          sync_status?: Database["public"]["Enums"]["sync_status"] | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          date_payment_date_mddyyyy?: string | null
          docs_shortlink?: string | null
          glide_id?: string | null
          id?: string
          last_modified_at?: string | null
          last_sync_time?: string | null
          main_balance_due?: number | null
          main_po_date?: string | null
          main_po_total?: number | null
          main_purchase_order_uid?: string | null
          rowid_accntrowid?: string | null
          sb_accounts_id?: string | null
          share_url?: string | null
          sync_status?: Database["public"]["Enums"]["sync_status"] | null
          updated_at?: string | null
        }
        Relationships: []
      }
      gl_secure_links: {
        Row: {
          actual_path: string
          created_at: string | null
          expires_at: string | null
          id: string
          is_active: boolean | null
          last_viewed_at: string | null
          pin_code: string | null
          resource_id: string
          resource_type: string
          secure_id: string
          view_count: number | null
        }
        Insert: {
          actual_path: string
          created_at?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          last_viewed_at?: string | null
          pin_code?: string | null
          resource_id: string
          resource_type: string
          secure_id: string
          view_count?: number | null
        }
        Update: {
          actual_path?: string
          created_at?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          last_viewed_at?: string | null
          pin_code?: string | null
          resource_id?: string
          resource_type?: string
          secure_id?: string
          view_count?: number | null
        }
        Relationships: []
      }
      gl_shipping_records: {
        Row: {
          ai_ai_extracted_text: string | null
          ai_tracking_json_extracted: string | null
          created_at: string | null
          glide_id: string | null
          id: string
          last_modified_at: string | null
          last_sync_time: string | null
          main_account_row_id: string | null
          main_account_row_id1: string | null
          main_account_uid: string | null
          main_account_uid2: string | null
          main_account_uid3: string | null
          main_accounuid_list: string | null
          main_box_sizes: string | null
          main_box_weight: number | null
          main_delivery_time_end: string | null
          main_delveriy_time_start: string | null
          main_delviery_time_range: string | null
          main_drop_off_address: string | null
          main_drop_off_city: string | null
          main_drop_off_location_uid: string | null
          main_email_of_user_sub: string | null
          main_invoices_row_id: string | null
          main_notes_for_tp_split_orders: string | null
          main_service_used: string | null
          main_ship_date: string | null
          main_ship_date_ical: string | null
          main_timestamp_submit: string | null
          main_total_of_units_for_1st_account: number | null
          main_total_of_units_for_2nd_account: number | null
          main_total_of_units_for_3rd_account_copy: number | null
          main_total_of_units_inside: number | null
          main_tp_id: string | null
          main_tracking_link: string | null
          main_tracking_number: string | null
          multiple_accounts: boolean | null
          receiver_receiver_address: string | null
          receiver_receiver_name: string | null
          receiver_state: string | null
          rowid_invoicerelated: string | null
          sb_account1_id: string | null
          sb_account2_id: string | null
          sb_account3_id: string | null
          sb_invoices_id: string | null
          sender_sender_address: string | null
          sender_sender_name_company: string | null
          sender_sender_phone: string | null
          sync_status: Database["public"]["Enums"]["sync_status"] | null
          updated_at: string | null
        }
        Insert: {
          ai_ai_extracted_text?: string | null
          ai_tracking_json_extracted?: string | null
          created_at?: string | null
          glide_id?: string | null
          id?: string
          last_modified_at?: string | null
          last_sync_time?: string | null
          main_account_row_id?: string | null
          main_account_row_id1?: string | null
          main_account_uid?: string | null
          main_account_uid2?: string | null
          main_account_uid3?: string | null
          main_accounuid_list?: string | null
          main_box_sizes?: string | null
          main_box_weight?: number | null
          main_delivery_time_end?: string | null
          main_delveriy_time_start?: string | null
          main_delviery_time_range?: string | null
          main_drop_off_address?: string | null
          main_drop_off_city?: string | null
          main_drop_off_location_uid?: string | null
          main_email_of_user_sub?: string | null
          main_invoices_row_id?: string | null
          main_notes_for_tp_split_orders?: string | null
          main_service_used?: string | null
          main_ship_date?: string | null
          main_ship_date_ical?: string | null
          main_timestamp_submit?: string | null
          main_total_of_units_for_1st_account?: number | null
          main_total_of_units_for_2nd_account?: number | null
          main_total_of_units_for_3rd_account_copy?: number | null
          main_total_of_units_inside?: number | null
          main_tp_id?: string | null
          main_tracking_link?: string | null
          main_tracking_number?: string | null
          multiple_accounts?: boolean | null
          receiver_receiver_address?: string | null
          receiver_receiver_name?: string | null
          receiver_state?: string | null
          rowid_invoicerelated?: string | null
          sb_account1_id?: string | null
          sb_account2_id?: string | null
          sb_account3_id?: string | null
          sb_invoices_id?: string | null
          sender_sender_address?: string | null
          sender_sender_name_company?: string | null
          sender_sender_phone?: string | null
          sync_status?: Database["public"]["Enums"]["sync_status"] | null
          updated_at?: string | null
        }
        Update: {
          ai_ai_extracted_text?: string | null
          ai_tracking_json_extracted?: string | null
          created_at?: string | null
          glide_id?: string | null
          id?: string
          last_modified_at?: string | null
          last_sync_time?: string | null
          main_account_row_id?: string | null
          main_account_row_id1?: string | null
          main_account_uid?: string | null
          main_account_uid2?: string | null
          main_account_uid3?: string | null
          main_accounuid_list?: string | null
          main_box_sizes?: string | null
          main_box_weight?: number | null
          main_delivery_time_end?: string | null
          main_delveriy_time_start?: string | null
          main_delviery_time_range?: string | null
          main_drop_off_address?: string | null
          main_drop_off_city?: string | null
          main_drop_off_location_uid?: string | null
          main_email_of_user_sub?: string | null
          main_invoices_row_id?: string | null
          main_notes_for_tp_split_orders?: string | null
          main_service_used?: string | null
          main_ship_date?: string | null
          main_ship_date_ical?: string | null
          main_timestamp_submit?: string | null
          main_total_of_units_for_1st_account?: number | null
          main_total_of_units_for_2nd_account?: number | null
          main_total_of_units_for_3rd_account_copy?: number | null
          main_total_of_units_inside?: number | null
          main_tp_id?: string | null
          main_tracking_link?: string | null
          main_tracking_number?: string | null
          multiple_accounts?: boolean | null
          receiver_receiver_address?: string | null
          receiver_receiver_name?: string | null
          receiver_state?: string | null
          rowid_invoicerelated?: string | null
          sb_account1_id?: string | null
          sb_account2_id?: string | null
          sb_account3_id?: string | null
          sb_invoices_id?: string | null
          sender_sender_address?: string | null
          sender_sender_name_company?: string | null
          sender_sender_phone?: string | null
          sync_status?: Database["public"]["Enums"]["sync_status"] | null
          updated_at?: string | null
        }
        Relationships: []
      }
      gl_sync_errors: {
        Row: {
          error_message: string | null
          error_time: string | null
          id: string
          record_id: string
          resolution_notes: string | null
          resolved: boolean | null
          resolved_at: string | null
          table_name: string
        }
        Insert: {
          error_message?: string | null
          error_time?: string | null
          id?: string
          record_id: string
          resolution_notes?: string | null
          resolved?: boolean | null
          resolved_at?: string | null
          table_name: string
        }
        Update: {
          error_message?: string | null
          error_time?: string | null
          id?: string
          record_id?: string
          resolution_notes?: string | null
          resolved?: boolean | null
          resolved_at?: string | null
          table_name?: string
        }
        Relationships: []
      }
      gl_sync_logs: {
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
      gl_sync_metadata: {
        Row: {
          created_at: string | null
          error_message: string | null
          id: string
          last_sync_time: string | null
          max_retries: number | null
          next_retry_at: string | null
          retry_count: number | null
          sync_status: Database["public"]["Enums"]["sync_status"] | null
          table_name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          id?: string
          last_sync_time?: string | null
          max_retries?: number | null
          next_retry_at?: string | null
          retry_count?: number | null
          sync_status?: Database["public"]["Enums"]["sync_status"] | null
          table_name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          id?: string
          last_sync_time?: string | null
          max_retries?: number | null
          next_retry_at?: string | null
          retry_count?: number | null
          sync_status?: Database["public"]["Enums"]["sync_status"] | null
          table_name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      gl_table_mappings: {
        Row: {
          description: string
          glide_table_id: string
          id: number
          supabase_table: string
        }
        Insert: {
          description: string
          glide_table_id: string
          id?: never
          supabase_table: string
        }
        Update: {
          description?: string
          glide_table_id?: string
          id?: never
          supabase_table?: string
        }
        Relationships: []
      }
      gl_vendor_payments: {
        Row: {
          created_at: string | null
          glide_id: string | null
          id: string
          last_modified_at: string | null
          last_sync_time: string | null
          main_date_of_payment: string | null
          main_date_of_purchase_order: string | null
          main_payment_amount: number | null
          main_vendor_purchase_note: string | null
          rowid_account_row_id: string | null
          rowid_product_row_id: string | null
          rowid_purchase_order_row_id: string | null
          sb_accounts_id: string | null
          sb_products_id: string | null
          sb_purchase_orders_id: string | null
          sync_status: Database["public"]["Enums"]["sync_status"] | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          glide_id?: string | null
          id?: string
          last_modified_at?: string | null
          last_sync_time?: string | null
          main_date_of_payment?: string | null
          main_date_of_purchase_order?: string | null
          main_payment_amount?: number | null
          main_vendor_purchase_note?: string | null
          rowid_account_row_id?: string | null
          rowid_product_row_id?: string | null
          rowid_purchase_order_row_id?: string | null
          sb_accounts_id?: string | null
          sb_products_id?: string | null
          sb_purchase_orders_id?: string | null
          sync_status?: Database["public"]["Enums"]["sync_status"] | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          glide_id?: string | null
          id?: string
          last_modified_at?: string | null
          last_sync_time?: string | null
          main_date_of_payment?: string | null
          main_date_of_purchase_order?: string | null
          main_payment_amount?: number | null
          main_vendor_purchase_note?: string | null
          rowid_account_row_id?: string | null
          rowid_product_row_id?: string | null
          rowid_purchase_order_row_id?: string | null
          sb_accounts_id?: string | null
          sb_products_id?: string | null
          sb_purchase_orders_id?: string | null
          sync_status?: Database["public"]["Enums"]["sync_status"] | null
          updated_at?: string | null
        }
        Relationships: []
      }
      glide_sync_results: {
        Row: {
          created_at: string | null
          data_id: string
          discrepancy_type: string
          error_message: string | null
          glide_metadata: Json | null
          glide_table_name: string
          id: string
          last_sync_attempt: string | null
          resolution_notes: string | null
          resolution_status:
            | Database["public"]["Enums"]["sync_resolution_status"]
            | null
          resolved_at: string | null
          resolved_by: string | null
          supabase_metadata: Json | null
          sync_attempt_count: number | null
          table_id: string
          table_name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          data_id: string
          discrepancy_type: string
          error_message?: string | null
          glide_metadata?: Json | null
          glide_table_name: string
          id?: string
          last_sync_attempt?: string | null
          resolution_notes?: string | null
          resolution_status?:
            | Database["public"]["Enums"]["sync_resolution_status"]
            | null
          resolved_at?: string | null
          resolved_by?: string | null
          supabase_metadata?: Json | null
          sync_attempt_count?: number | null
          table_id: string
          table_name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          data_id?: string
          discrepancy_type?: string
          error_message?: string | null
          glide_metadata?: Json | null
          glide_table_name?: string
          id?: string
          last_sync_attempt?: string | null
          resolution_notes?: string | null
          resolution_status?:
            | Database["public"]["Enums"]["sync_resolution_status"]
            | null
          resolved_at?: string | null
          resolved_by?: string | null
          supabase_metadata?: Json | null
          sync_attempt_count?: number | null
          table_id?: string
          table_name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      message_processing_queue: {
        Row: {
          attempts: number | null
          correlation_id: string | null
          created_at: string | null
          error: string | null
          id: string
          last_error_at: string | null
          max_attempts: number | null
          message_id: string
          metadata: Json | null
          processing_completed_at: string | null
          processing_started_at: string | null
          status: string
        }
        Insert: {
          attempts?: number | null
          correlation_id?: string | null
          created_at?: string | null
          error?: string | null
          id?: string
          last_error_at?: string | null
          max_attempts?: number | null
          message_id: string
          metadata?: Json | null
          processing_completed_at?: string | null
          processing_started_at?: string | null
          status?: string
        }
        Update: {
          attempts?: number | null
          correlation_id?: string | null
          created_at?: string | null
          error?: string | null
          id?: string
          last_error_at?: string | null
          max_attempts?: number | null
          message_id?: string
          metadata?: Json | null
          processing_completed_at?: string | null
          processing_started_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_processing_queue_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_processing_queue_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "v_message_forwards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_processing_queue_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "v_message_relationships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_processing_queue_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "v_messages_compatibility"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_processing_queue_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "v_messages_with_relationships"
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
          duration: number | null
          edit_count: number | null
          edit_date: string | null
          edit_history: Json | null
          edited_channel_post: boolean | null
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
          last_error_at: string | null
          last_processing_attempt: string | null
          media_group_id: string | null
          media_type: string | null
          message_caption_id: string | null
          message_url: string | null
          mime_type: string | null
          needs_redownload: boolean | null
          notes: string | null
          old_analyzed_content: Json[] | null
          original_file_id: string | null
          original_message_id: string | null
          parsed_caption: string | null
          parsed_notes: string | null
          parsed_product_code: string | null
          parsed_purchase_date: string | null
          parsed_quantity: number | null
          parsed_total_price: number | null
          parsed_unit_price: number | null
          parsed_vendor_uid: string | null
          processing_attempts: number | null
          processing_completed_at: string | null
          processing_correlation_id: string | null
          processing_started_at: string | null
          processing_state: Database["public"]["Enums"]["processing_state_type"]
          product_code: string | null
          product_name: string | null
          product_quantity: number | null
          public_url: string | null
          purchase_date: string | null
          purchase_order: string | null
          redownload_attempts: number | null
          redownload_completed_at: string | null
          redownload_flagged_at: string | null
          redownload_reason: string | null
          redownload_strategy: string | null
          retry_count: number | null
          storage_path: string | null
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
          duration?: number | null
          edit_count?: number | null
          edit_date?: string | null
          edit_history?: Json | null
          edited_channel_post?: boolean | null
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
          last_error_at?: string | null
          last_processing_attempt?: string | null
          media_group_id?: string | null
          media_type?: string | null
          message_caption_id?: string | null
          message_url?: string | null
          mime_type?: string | null
          needs_redownload?: boolean | null
          notes?: string | null
          old_analyzed_content?: Json[] | null
          original_file_id?: string | null
          original_message_id?: string | null
          parsed_caption?: string | null
          parsed_notes?: string | null
          parsed_product_code?: string | null
          parsed_purchase_date?: string | null
          parsed_quantity?: number | null
          parsed_total_price?: number | null
          parsed_unit_price?: number | null
          parsed_vendor_uid?: string | null
          processing_attempts?: number | null
          processing_completed_at?: string | null
          processing_correlation_id?: string | null
          processing_started_at?: string | null
          processing_state?: Database["public"]["Enums"]["processing_state_type"]
          product_code?: string | null
          product_name?: string | null
          product_quantity?: number | null
          public_url?: string | null
          purchase_date?: string | null
          purchase_order?: string | null
          redownload_attempts?: number | null
          redownload_completed_at?: string | null
          redownload_flagged_at?: string | null
          redownload_reason?: string | null
          redownload_strategy?: string | null
          retry_count?: number | null
          storage_path?: string | null
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
          duration?: number | null
          edit_count?: number | null
          edit_date?: string | null
          edit_history?: Json | null
          edited_channel_post?: boolean | null
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
          last_error_at?: string | null
          last_processing_attempt?: string | null
          media_group_id?: string | null
          media_type?: string | null
          message_caption_id?: string | null
          message_url?: string | null
          mime_type?: string | null
          needs_redownload?: boolean | null
          notes?: string | null
          old_analyzed_content?: Json[] | null
          original_file_id?: string | null
          original_message_id?: string | null
          parsed_caption?: string | null
          parsed_notes?: string | null
          parsed_product_code?: string | null
          parsed_purchase_date?: string | null
          parsed_quantity?: number | null
          parsed_total_price?: number | null
          parsed_unit_price?: number | null
          parsed_vendor_uid?: string | null
          processing_attempts?: number | null
          processing_completed_at?: string | null
          processing_correlation_id?: string | null
          processing_started_at?: string | null
          processing_state?: Database["public"]["Enums"]["processing_state_type"]
          product_code?: string | null
          product_name?: string | null
          product_quantity?: number | null
          public_url?: string | null
          purchase_date?: string | null
          purchase_order?: string | null
          redownload_attempts?: number | null
          redownload_completed_at?: string | null
          redownload_flagged_at?: string | null
          redownload_reason?: string | null
          redownload_strategy?: string | null
          retry_count?: number | null
          storage_path?: string | null
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
            referencedRelation: "v_message_forwards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_message_caption"
            columns: ["message_caption_id"]
            isOneToOne: false
            referencedRelation: "v_message_relationships"
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
            foreignKeyName: "fk_message_caption"
            columns: ["message_caption_id"]
            isOneToOne: false
            referencedRelation: "v_messages_with_relationships"
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
            referencedRelation: "v_message_forwards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_message_caption_id_fkey"
            columns: ["message_caption_id"]
            isOneToOne: false
            referencedRelation: "v_message_relationships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_message_caption_id_fkey"
            columns: ["message_caption_id"]
            isOneToOne: false
            referencedRelation: "v_messages_compatibility"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_message_caption_id_fkey"
            columns: ["message_caption_id"]
            isOneToOne: false
            referencedRelation: "v_messages_with_relationships"
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
          id: string
          is_edited: boolean
          is_forward: string | null
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
          id?: string
          is_edited?: boolean
          is_forward?: string | null
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
          id?: string
          is_edited?: boolean
          is_forward?: string | null
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
          telegram_data?: Json | null
          telegram_message_id?: number
          updated_at?: string
          user_id?: string | null
          vendor_uid?: string | null
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
          updated_at: string | null
          webhook_url: string | null
        }
        Insert: {
          bot_token?: string | null
          created_at?: string | null
          id?: string
          updated_at?: string | null
          webhook_url?: string | null
        }
        Update: {
          bot_token?: string | null
          created_at?: string | null
          id?: string
          updated_at?: string | null
          webhook_url?: string | null
        }
        Relationships: []
      }
      storage_validations: {
        Row: {
          error_message: string | null
          file_unique_id: string
          id: string
          is_valid: boolean | null
          last_checked_at: string | null
          storage_path: string
        }
        Insert: {
          error_message?: string | null
          file_unique_id: string
          id?: string
          is_valid?: boolean | null
          last_checked_at?: string | null
          storage_path: string
        }
        Update: {
          error_message?: string | null
          file_unique_id?: string
          id?: string
          is_valid?: boolean | null
          last_checked_at?: string | null
          storage_path?: string
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
      tag_entity: {
        Row: {
          createdAt: string
          id: number
          name: string
          updatedAt: string
        }
        Insert: {
          createdAt?: string
          id?: number
          name: string
          updatedAt?: string
        }
        Update: {
          createdAt?: string
          id?: number
          name?: string
          updatedAt?: string
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
          event_type: Database["public"]["Enums"]["audit_event_type"]
          id: string
          message_type: string | null
          metadata: Json | null
          new_state: Json | null
          previous_state: Json | null
          telegram_message_id: number | null
          user_id: string | null
        }
        Insert: {
          chat_id?: number | null
          correlation_id?: string | null
          entity_id: string
          error_message?: string | null
          event_timestamp?: string
          event_type: Database["public"]["Enums"]["audit_event_type"]
          id?: string
          message_type?: string | null
          metadata?: Json | null
          new_state?: Json | null
          previous_state?: Json | null
          telegram_message_id?: number | null
          user_id?: string | null
        }
        Update: {
          chat_id?: number | null
          correlation_id?: string | null
          entity_id?: string
          error_message?: string | null
          event_timestamp?: string
          event_type?: Database["public"]["Enums"]["audit_event_type"]
          id?: string
          message_type?: string | null
          metadata?: Json | null
          new_state?: Json | null
          previous_state?: Json | null
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
            referencedRelation: "v_message_forwards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_unified_audit_logs_messages"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "v_message_relationships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_unified_audit_logs_messages"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "v_messages_compatibility"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_unified_audit_logs_messages"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "v_messages_with_relationships"
            referencedColumns: ["id"]
          },
        ]
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
          {
            foreignKeyName: "FK_5e29bfe9e22c5d6567f509d4a46"
            columns: ["tagId"]
            isOneToOne: false
            referencedRelation: "tag_entity"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_message_audit_trail: {
        Row: {
          chat_id: number | null
          correlation_id: string | null
          error_message: string | null
          event_timestamp: string | null
          event_type: string | null
          message_id: string | null
          metadata: Json | null
          new_state: Json | null
          previous_state: Json | null
          telegram_message_id: number | null
        }
        Insert: {
          chat_id?: number | null
          correlation_id?: string | null
          error_message?: string | null
          event_timestamp?: string | null
          event_type?: never
          message_id?: string | null
          metadata?: Json | null
          new_state?: Json | null
          previous_state?: Json | null
          telegram_message_id?: number | null
        }
        Update: {
          chat_id?: number | null
          correlation_id?: string | null
          error_message?: string | null
          event_timestamp?: string | null
          event_type?: never
          message_id?: string | null
          metadata?: Json | null
          new_state?: Json | null
          previous_state?: Json | null
          telegram_message_id?: number | null
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
            referencedRelation: "v_message_forwards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_unified_audit_logs_messages"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "v_message_relationships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_unified_audit_logs_messages"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "v_messages_compatibility"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_unified_audit_logs_messages"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "v_messages_with_relationships"
            referencedColumns: ["id"]
          },
        ]
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
      v_message_relationships: {
        Row: {
          caption_references: number | null
          id: string | null
          media_group_id: string | null
          other_messages_references: number | null
          queue_entries: number | null
          telegram_message_id: number | null
          webhook_logs_count: number | null
        }
        Insert: {
          caption_references?: never
          id?: string | null
          media_group_id?: string | null
          other_messages_references?: never
          queue_entries?: never
          telegram_message_id?: number | null
          webhook_logs_count?: never
        }
        Update: {
          caption_references?: never
          id?: string | null
          media_group_id?: string | null
          other_messages_references?: never
          queue_entries?: never
          telegram_message_id?: number | null
          webhook_logs_count?: never
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
          error: string | null
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
          processing_correlation_id: string | null
          processing_started_at: string | null
          processing_state:
            | Database["public"]["Enums"]["processing_state_type"]
            | null
          product_name: string | null
          product_quantity: number | null
          product_sku: string | null
          product_unit: string | null
          public_url: string | null
          purchase_date: string | null
          purchase_order: string | null
          retry_count: number | null
          storage_path: string | null
          sync_attempt: number | null
          telegram_data: Json | null
          telegram_message_id: number | null
          updated_at: string | null
          user_id: string | null
          vendor_name: string | null
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
          error?: string | null
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
          processing_correlation_id?: string | null
          processing_started_at?: string | null
          processing_state?:
            | Database["public"]["Enums"]["processing_state_type"]
            | null
          product_name?: string | null
          product_quantity?: number | null
          product_sku?: string | null
          product_unit?: never
          public_url?: string | null
          purchase_date?: string | null
          purchase_order?: string | null
          retry_count?: number | null
          storage_path?: string | null
          sync_attempt?: number | null
          telegram_data?: Json | null
          telegram_message_id?: number | null
          updated_at?: string | null
          user_id?: string | null
          vendor_name?: string | null
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
          error?: string | null
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
          processing_correlation_id?: string | null
          processing_started_at?: string | null
          processing_state?:
            | Database["public"]["Enums"]["processing_state_type"]
            | null
          product_name?: string | null
          product_quantity?: number | null
          product_sku?: string | null
          product_unit?: never
          public_url?: string | null
          purchase_date?: string | null
          purchase_order?: string | null
          retry_count?: number | null
          storage_path?: string | null
          sync_attempt?: number | null
          telegram_data?: Json | null
          telegram_message_id?: number | null
          updated_at?: string | null
          user_id?: string | null
          vendor_name?: string | null
          width?: number | null
        }
        Relationships: []
      }
      v_messages_with_relationships: {
        Row: {
          analyzed_content: Json | null
          caption: string | null
          caption_references: number | null
          chat_id: number | null
          chat_title: string | null
          chat_type: Database["public"]["Enums"]["telegram_chat_type"] | null
          correlation_id: string | null
          created_at: string | null
          duration: number | null
          edit_date: string | null
          edit_history: Json | null
          error: string | null
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
          other_messages_references: number | null
          processing_completed_at: string | null
          processing_correlation_id: string | null
          processing_started_at: string | null
          processing_state:
            | Database["public"]["Enums"]["processing_state_type"]
            | null
          product_name: string | null
          product_quantity: number | null
          product_sku: string | null
          product_unit: string | null
          public_url: string | null
          purchase_date: string | null
          purchase_order: string | null
          queue_entries: number | null
          retry_count: number | null
          storage_path: string | null
          sync_attempt: number | null
          telegram_data: Json | null
          telegram_message_id: number | null
          updated_at: string | null
          user_id: string | null
          vendor_name: string | null
          webhook_logs_count: number | null
          width: number | null
        }
        Relationships: []
      }
      v_queue_status: {
        Row: {
          avg_age_seconds: number | null
          count: number | null
          oldest_seconds: number | null
          status: string | null
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
      dates_within_range: {
        Args: {
          date1: string
          date2: string
          days?: number
        }
        Returns: boolean
      }
      filter_by_vendor: {
        Args: {
          vendor_param: string
        }
        Returns: {
          id: string
          analyzed_content: Json
          telegram_message_id: string
          caption: string
          media_group_id: string
          created_at: string
          is_original_caption: boolean
          purchase_date: string
        }[]
      }
      generate_share_id: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_accounts_aging_report: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      get_data_quality_report: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      get_database_statistics: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      get_financial_summary: {
        Args: {
          p_start_date?: string
          p_end_date?: string
        }
        Returns: Json
      }
      get_monthly_revenue_analysis: {
        Args: {
          p_year?: number
        }
        Returns: Json
      }
      get_paginated_account_data: {
        Args: {
          p_account_id: string
          p_table_name: string
          p_page?: number
          p_page_size?: number
        }
        Returns: Json
      }
      get_product_sales_analysis: {
        Args: {
          p_start_date?: string
          p_end_date?: string
        }
        Returns: Json
      }
      get_top_customers: {
        Args: {
          p_limit?: number
          p_start_date?: string
          p_end_date?: string
        }
        Returns: Json
      }
      glide_sync_products: {
        Args: Record<PropertyKey, never>
        Returns: number
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
      manually_create_invoice_from_estimate: {
        Args: {
          p_estimate_id: string
        }
        Returns: string
      }
      map_circular_references: {
        Args: Record<PropertyKey, never>
        Returns: undefined
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
      perform_database_maintenance: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      process_glide_sync_queue: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      recalculate_all_totals: {
        Args: Record<PropertyKey, never>
        Returns: undefined
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
      repair_data_issues: {
        Args: Record<PropertyKey, never>
        Returns: {
          fixed_issue: string
          record_count: number
        }[]
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
      sync_glide_configuration: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      update_share_view_stats: {
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
      xan_fetch_glide_products: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      xan_fetch_glide_tables: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      xan_sync_glide_configuration: {
        Args: {
          table_name: string
        }
        Returns: undefined
      }
      xdelo_analyze_message_caption: {
        Args: {
          p_message_id: string
          p_correlation_id: string
          p_caption: string
          p_media_group_id?: string
        }
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
      xdelo_check_webhook_health: {
        Args: Record<PropertyKey, never>
        Returns: {
          last_success_time: string
          last_error_time: string
          error_count: number
          success_count: number
          recent_errors: string[]
        }[]
      }
      xdelo_cleanup_old_queue_entries:
        | {
            Args: Record<PropertyKey, never>
            Returns: number
          }
        | {
            Args: {
              days_old?: number
            }
            Returns: {
              deleted_count: number
            }[]
          }
      xdelo_cleanup_orphaned_audit_logs: {
        Args: Record<PropertyKey, never>
        Returns: {
          deleted_count: number
        }[]
      }
      xdelo_complete_message_processing: {
        Args: {
          p_queue_id: string
          p_analyzed_content: Json
        }
        Returns: boolean
      }
      xdelo_construct_telegram_message_url: {
        Args: {
          chat_type: Database["public"]["Enums"]["telegram_chat_type"]
          chat_id: number
          message_id: number
        }
        Returns: string
      }
      xdelo_diagnose_queue_issues: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      xdelo_fail_message_processing: {
        Args: {
          p_queue_id: string
          p_error_message: string
        }
        Returns: boolean
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
      xdelo_flag_file_for_redownload: {
        Args: {
          p_message_id: string
          p_reason?: string
        }
        Returns: boolean
      }
      xdelo_get_logger: {
        Args: {
          p_correlation_id: string
        }
        Returns: Json
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
      xdelo_get_next_message_for_processing: {
        Args: {
          limit_count: number
        }
        Returns: {
          queue_id: string
          message_id: string
          correlation_id: string
          caption: string
          media_group_id: string
          storage_path: string
          mime_type: string
          file_unique_id: string
          public_url: string
        }[]
      }
      xdelo_get_or_create_file_url: {
        Args: {
          p_file_unique_id: string
          p_mime_type?: string
        }
        Returns: string
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
      xdelo_process_pending_messages: {
        Args: {
          limit_count?: number
        }
        Returns: {
          message_id: string
          caption: string
          media_group_id: string
          processed: boolean
        }[]
      }
      xdelo_queue_message_for_processing: {
        Args: {
          p_message_id: string
          p_correlation_id: string
        }
        Returns: string
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
      xdelo_repair_storage_paths: {
        Args: Record<PropertyKey, never>
        Returns: {
          message_id: string
          old_path: string
          new_path: string
          status: string
        }[]
      }
      xdelo_reset_stalled_messages: {
        Args: Record<PropertyKey, never>
        Returns: {
          message_id: string
          previous_state: string
          reset_reason: string
        }[]
      }
      xdelo_run_scheduled_message_processing: {
        Args: Record<PropertyKey, never>
        Returns: Json
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
      xdelo_sync_media_group_content:
        | {
            Args: {
              p_source_message_id: string
              p_media_group_id: string
              p_correlation_id?: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_source_message_id: string
              p_media_group_id: string
              p_correlation_id?: string
              p_force_sync?: boolean
            }
            Returns: Json
          }
      xdelo_sync_pending_media_group_messages: {
        Args: Record<PropertyKey, never>
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
      xdelo_validate_file_storage: {
        Args: {
          p_file_unique_id: string
          p_storage_path: string
          p_mime_type?: string
        }
        Returns: boolean
      }
    }
    Enums: {
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
      client_type: "Vendor" | "Customer" | "Customer & Vendor"
      processing_state_type:
        | "initialized"
        | "pending"
        | "processing"
        | "completed"
        | "error"
      sync_operation: "sync" | "create" | "update" | "delete"
      sync_resolution_status:
        | "pending"
        | "push_to_glide"
        | "delete_from_supabase"
        | "ignored"
        | "resolved"
      sync_status: "pending" | "synced" | "error" | "locked"
      telegram_chat_type: "private" | "group" | "supergroup" | "channel"
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
