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
          created_at: string | null
          glide_id: string | null
          id: string
          last_modified_at: string | null
          last_sync_time: string | null
          main_account_name: string | null
          main_accounts_uid: string | null
          main_client_type: string | null
          main_date_added_client: string | null
          main_email_of_who_added: string | null
          main_photo: string | null
          sync_status: Database["public"]["Enums"]["sync_status"] | null
          updated_at: string | null
          user_email_who_added: string | null
        }
        Insert: {
          created_at?: string | null
          glide_id?: string | null
          id?: string
          last_modified_at?: string | null
          last_sync_time?: string | null
          main_account_name?: string | null
          main_accounts_uid?: string | null
          main_client_type?: string | null
          main_date_added_client?: string | null
          main_email_of_who_added?: string | null
          main_photo?: string | null
          sync_status?: Database["public"]["Enums"]["sync_status"] | null
          updated_at?: string | null
          user_email_who_added?: string | null
        }
        Update: {
          created_at?: string | null
          glide_id?: string | null
          id?: string
          last_modified_at?: string | null
          last_sync_time?: string | null
          main_account_name?: string | null
          main_accounts_uid?: string | null
          main_client_type?: string | null
          main_date_added_client?: string | null
          main_email_of_who_added?: string | null
          main_photo?: string | null
          sync_status?: Database["public"]["Enums"]["sync_status"] | null
          updated_at?: string | null
          user_email_who_added?: string | null
        }
        Relationships: []
      }
      gl_column_mappings: {
        Row: {
          created_at: string | null
          data_type: string
          glide_column_id: string
          glide_column_name: string
          id: string
          supabase_column_name: string
          table_name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          data_type: string
          glide_column_id: string
          glide_column_name: string
          id?: string
          supabase_column_name: string
          table_name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          data_type?: string
          glide_column_id?: string
          glide_column_name?: string
          id?: string
          supabase_column_name?: string
          table_name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      gl_configuration: {
        Row: {
          api_endpoint: string
          api_key: string
          app_id: string
          created_at: string | null
          glide_table_name: string
          id: string
          is_active: boolean
          is_valid: boolean | null
          last_validation_time: string | null
          max_retries: number | null
          retry_interval: unknown | null
          supabase_table_name: string
          supported_operations: string[]
          table_id: string
          updated_at: string | null
          validation_error: string | null
        }
        Insert: {
          api_endpoint: string
          api_key: string
          app_id: string
          created_at?: string | null
          glide_table_name: string
          id?: string
          is_active?: boolean
          is_valid?: boolean | null
          last_validation_time?: string | null
          max_retries?: number | null
          retry_interval?: unknown | null
          supabase_table_name: string
          supported_operations?: string[]
          table_id: string
          updated_at?: string | null
          validation_error?: string | null
        }
        Update: {
          api_endpoint?: string
          api_key?: string
          app_id?: string
          created_at?: string | null
          glide_table_name?: string
          id?: string
          is_active?: boolean
          is_valid?: boolean | null
          last_validation_time?: string | null
          max_retries?: number | null
          retry_interval?: unknown | null
          supabase_table_name?: string
          supported_operations?: string[]
          table_id?: string
          updated_at?: string | null
          validation_error?: string | null
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
          main_customeruid: string | null
          main_date_of_payment: string | null
          main_email_of_user: string | null
          main_payment_amount: number | null
          main_payment_note: string | null
          main_payment_typ: string | null
          rowid_accountrowid: string | null
          rowid_estimatorowid: string | null
          rowid_invoice_row_id: string | null
          sync_status: Database["public"]["Enums"]["sync_status"] | null
          timestamp_added: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          glide_id?: string | null
          id?: string
          last_modified_at?: string | null
          last_sync_time?: string | null
          main_customeruid?: string | null
          main_date_of_payment?: string | null
          main_email_of_user?: string | null
          main_payment_amount?: number | null
          main_payment_note?: string | null
          main_payment_typ?: string | null
          rowid_accountrowid?: string | null
          rowid_estimatorowid?: string | null
          rowid_invoice_row_id?: string | null
          sync_status?: Database["public"]["Enums"]["sync_status"] | null
          timestamp_added?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          glide_id?: string | null
          id?: string
          last_modified_at?: string | null
          last_sync_time?: string | null
          main_customeruid?: string | null
          main_date_of_payment?: string | null
          main_email_of_user?: string | null
          main_payment_amount?: number | null
          main_payment_note?: string | null
          main_payment_typ?: string | null
          rowid_accountrowid?: string | null
          rowid_estimatorowid?: string | null
          rowid_invoice_row_id?: string | null
          sync_status?: Database["public"]["Enums"]["sync_status"] | null
          timestamp_added?: string | null
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
          main_customeruid: string | null
          main_date_of_payment: string | null
          main_payment_amount: number | null
          main_payment_note: string | null
          main_type_of_payment: string | null
          rowid_accountrowid: string | null
          rowid_invoice_row_id: string | null
          rowid_invoiceline_row_id: string | null
          sync_status: Database["public"]["Enums"]["sync_status"] | null
          timestamp_added: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email_of_user?: string | null
          glide_id?: string | null
          id?: string
          last_modified_at?: string | null
          last_sync_time?: string | null
          main_customeruid?: string | null
          main_date_of_payment?: string | null
          main_payment_amount?: number | null
          main_payment_note?: string | null
          main_type_of_payment?: string | null
          rowid_accountrowid?: string | null
          rowid_invoice_row_id?: string | null
          rowid_invoiceline_row_id?: string | null
          sync_status?: Database["public"]["Enums"]["sync_status"] | null
          timestamp_added?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email_of_user?: string | null
          glide_id?: string | null
          id?: string
          last_modified_at?: string | null
          last_sync_time?: string | null
          main_customeruid?: string | null
          main_date_of_payment?: string | null
          main_payment_amount?: number | null
          main_payment_note?: string | null
          main_type_of_payment?: string | null
          rowid_accountrowid?: string | null
          rowid_invoice_row_id?: string | null
          rowid_invoiceline_row_id?: string | null
          sync_status?: Database["public"]["Enums"]["sync_status"] | null
          timestamp_added?: string | null
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
          main_original_product_name: string | null
          main_product_sale_note: string | null
          main_qty_sold: number | null
          main_sale_product_name: string | null
          main_selling_price: number | null
          main_total_stock_after_sell: number | null
          main_user_email_of_added: string | null
          product_sold: boolean | null
          rowid_estimate_row_id: string | null
          rowid_invline_row_id: string | null
          rowid_productid_estline_items: string | null
          rowid_userid_est_lineitems: string | null
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
          main_original_product_name?: string | null
          main_product_sale_note?: string | null
          main_qty_sold?: number | null
          main_sale_product_name?: string | null
          main_selling_price?: number | null
          main_total_stock_after_sell?: number | null
          main_user_email_of_added?: string | null
          product_sold?: boolean | null
          rowid_estimate_row_id?: string | null
          rowid_invline_row_id?: string | null
          rowid_productid_estline_items?: string | null
          rowid_userid_est_lineitems?: string | null
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
          main_original_product_name?: string | null
          main_product_sale_note?: string | null
          main_qty_sold?: number | null
          main_sale_product_name?: string | null
          main_selling_price?: number | null
          main_total_stock_after_sell?: number | null
          main_user_email_of_added?: string | null
          product_sold?: boolean | null
          rowid_estimate_row_id?: string | null
          rowid_invline_row_id?: string | null
          rowid_productid_estline_items?: string | null
          rowid_userid_est_lineitems?: string | null
          sync_status?: Database["public"]["Enums"]["sync_status"] | null
          updated_at?: string | null
        }
        Relationships: []
      }
      gl_estimates: {
        Row: {
          add_note: string | null
          created_at: string | null
          date_created_timestamp: string | null
          date_invoice_created_date: string | null
          date_processed_timestamp: string | null
          date_submitted_timestamp: string | null
          glide_id: string | null
          id: string
          last_modified_at: string | null
          last_sync_time: string | null
          main_estimate_date: string | null
          main_estimate_notes: string | null
          main_is_a_sample: boolean | null
          main_payment_type: string | null
          order_items_est: Json | null
          paymentpdf: string | null
          pdf_docs: string | null
          rowids_accountrowid_estimates: string | null
          rowids_invoice_created: string | null
          short_link_pdf: string | null
          short_link_pdf_copy: Json | null
          shortlink_pdf2: string | null
          sync_status: Database["public"]["Enums"]["sync_status"] | null
          updated_at: string | null
          user_user_email: string | null
          valid_final_create_invoice_clicked: boolean | null
        }
        Insert: {
          add_note?: string | null
          created_at?: string | null
          date_created_timestamp?: string | null
          date_invoice_created_date?: string | null
          date_processed_timestamp?: string | null
          date_submitted_timestamp?: string | null
          glide_id?: string | null
          id?: string
          last_modified_at?: string | null
          last_sync_time?: string | null
          main_estimate_date?: string | null
          main_estimate_notes?: string | null
          main_is_a_sample?: boolean | null
          main_payment_type?: string | null
          order_items_est?: Json | null
          paymentpdf?: string | null
          pdf_docs?: string | null
          rowids_accountrowid_estimates?: string | null
          rowids_invoice_created?: string | null
          short_link_pdf?: string | null
          short_link_pdf_copy?: Json | null
          shortlink_pdf2?: string | null
          sync_status?: Database["public"]["Enums"]["sync_status"] | null
          updated_at?: string | null
          user_user_email?: string | null
          valid_final_create_invoice_clicked?: boolean | null
        }
        Update: {
          add_note?: string | null
          created_at?: string | null
          date_created_timestamp?: string | null
          date_invoice_created_date?: string | null
          date_processed_timestamp?: string | null
          date_submitted_timestamp?: string | null
          glide_id?: string | null
          id?: string
          last_modified_at?: string | null
          last_sync_time?: string | null
          main_estimate_date?: string | null
          main_estimate_notes?: string | null
          main_is_a_sample?: boolean | null
          main_payment_type?: string | null
          order_items_est?: Json | null
          paymentpdf?: string | null
          pdf_docs?: string | null
          rowids_accountrowid_estimates?: string | null
          rowids_invoice_created?: string | null
          short_link_pdf?: string | null
          short_link_pdf_copy?: Json | null
          shortlink_pdf2?: string | null
          sync_status?: Database["public"]["Enums"]["sync_status"] | null
          updated_at?: string | null
          user_user_email?: string | null
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
          expense_ai_text: string | null
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
          expense_ai_text?: string | null
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
          expense_ai_text?: string | null
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
          cart_id: string | null
          confirm_submit_newprod_line: boolean | null
          created_at: string | null
          edit_price: boolean | null
          edit_quantity: boolean | null
          gl_products: Json | null
          glide_id: string | null
          id: string
          last_modified_at: string | null
          last_sync_time: string | null
          main_date_of_sale: string | null
          main_product_sale_note: string | null
          main_qty_sold: number | null
          main_rename_product: boolean | null
          main_renamed_product_name: string | null
          main_selling_price: number | null
          main_total_stock_after_sell: number | null
          main_user_email_of_added: string | null
          rowid_estimate_rowid: string | null
          rowid_invoice_rowid: string | null
          rowid_logrowid: string | null
          rowid_productid: string | null
          rowid_productid_question: string | null
          sync_status: Database["public"]["Enums"]["sync_status"] | null
          updated_at: string | null
        }
        Insert: {
          cart_id?: string | null
          confirm_submit_newprod_line?: boolean | null
          created_at?: string | null
          edit_price?: boolean | null
          edit_quantity?: boolean | null
          gl_products?: Json | null
          glide_id?: string | null
          id?: string
          last_modified_at?: string | null
          last_sync_time?: string | null
          main_date_of_sale?: string | null
          main_product_sale_note?: string | null
          main_qty_sold?: number | null
          main_rename_product?: boolean | null
          main_renamed_product_name?: string | null
          main_selling_price?: number | null
          main_total_stock_after_sell?: number | null
          main_user_email_of_added?: string | null
          rowid_estimate_rowid?: string | null
          rowid_invoice_rowid?: string | null
          rowid_logrowid?: string | null
          rowid_productid?: string | null
          rowid_productid_question?: string | null
          sync_status?: Database["public"]["Enums"]["sync_status"] | null
          updated_at?: string | null
        }
        Update: {
          cart_id?: string | null
          confirm_submit_newprod_line?: boolean | null
          created_at?: string | null
          edit_price?: boolean | null
          edit_quantity?: boolean | null
          gl_products?: Json | null
          glide_id?: string | null
          id?: string
          last_modified_at?: string | null
          last_sync_time?: string | null
          main_date_of_sale?: string | null
          main_product_sale_note?: string | null
          main_qty_sold?: number | null
          main_rename_product?: boolean | null
          main_renamed_product_name?: string | null
          main_selling_price?: number | null
          main_total_stock_after_sell?: number | null
          main_user_email_of_added?: string | null
          rowid_estimate_rowid?: string | null
          rowid_invoice_rowid?: string | null
          rowid_logrowid?: string | null
          rowid_productid?: string | null
          rowid_productid_question?: string | null
          sync_status?: Database["public"]["Enums"]["sync_status"] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_invoice_lines_product"
            columns: ["rowid_productid"]
            isOneToOne: false
            referencedRelation: "gl_products"
            referencedColumns: ["glide_id"]
          },
          {
            foreignKeyName: "gl_invoice_lines_rowid_productid_fkey"
            columns: ["rowid_productid"]
            isOneToOne: false
            referencedRelation: "gl_products"
            referencedColumns: ["glide_id"]
          },
        ]
      }
      gl_invoices: {
        Row: {
          account_name: string | null
          account_uid: string | null
          created_at: string | null
          doc_document: string | null
          doc_glideforeverlink: string | null
          glide_id: string | null
          id: string
          last_modified_at: string | null
          last_sync_time: string | null
          main_created_timestamp: string | null
          main_edit_date: string | null
          main_invoice_order_date: string | null
          main_invoice_uid: string | null
          main_notes: string | null
          main_processed: boolean | null
          main_submitted_timestamp: string | null
          main_user_email: string | null
          rowids_accountid_sales_invoices: string | null
          rowids_accountsid_new: string | null
          rowids_credit_row_id: string | null
          rowids_editordeletelogid: string | null
          rowids_estimatorowid: string | null
          rowids_userid_sales_invoices: string | null
          sync_status: Database["public"]["Enums"]["sync_status"] | null
          timestamp_estimate_converted: string | null
          tre_order_items_invoice: Json | null
          tre_total: number | null
          updated_at: string | null
        }
        Insert: {
          account_name?: string | null
          account_uid?: string | null
          created_at?: string | null
          doc_document?: string | null
          doc_glideforeverlink?: string | null
          glide_id?: string | null
          id?: string
          last_modified_at?: string | null
          last_sync_time?: string | null
          main_created_timestamp?: string | null
          main_edit_date?: string | null
          main_invoice_order_date?: string | null
          main_invoice_uid?: string | null
          main_notes?: string | null
          main_processed?: boolean | null
          main_submitted_timestamp?: string | null
          main_user_email?: string | null
          rowids_accountid_sales_invoices?: string | null
          rowids_accountsid_new?: string | null
          rowids_credit_row_id?: string | null
          rowids_editordeletelogid?: string | null
          rowids_estimatorowid?: string | null
          rowids_userid_sales_invoices?: string | null
          sync_status?: Database["public"]["Enums"]["sync_status"] | null
          timestamp_estimate_converted?: string | null
          tre_order_items_invoice?: Json | null
          tre_total?: number | null
          updated_at?: string | null
        }
        Update: {
          account_name?: string | null
          account_uid?: string | null
          created_at?: string | null
          doc_document?: string | null
          doc_glideforeverlink?: string | null
          glide_id?: string | null
          id?: string
          last_modified_at?: string | null
          last_sync_time?: string | null
          main_created_timestamp?: string | null
          main_edit_date?: string | null
          main_invoice_order_date?: string | null
          main_invoice_uid?: string | null
          main_notes?: string | null
          main_processed?: boolean | null
          main_submitted_timestamp?: string | null
          main_user_email?: string | null
          rowids_accountid_sales_invoices?: string | null
          rowids_accountsid_new?: string | null
          rowids_credit_row_id?: string | null
          rowids_editordeletelogid?: string | null
          rowids_estimatorowid?: string | null
          rowids_userid_sales_invoices?: string | null
          sync_status?: Database["public"]["Enums"]["sync_status"] | null
          timestamp_estimate_converted?: string | null
          tre_order_items_invoice?: Json | null
          tre_total?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      gl_products: {
        Row: {
          cart_add_note: boolean | null
          cart_rename: boolean | null
          created_at: string | null
          date_timestamp_subm: string | null
          email_email_of_user_who_added_product: string | null
          glide_id: string | null
          id: string
          last_edited_date: string | null
          last_modified_at: string | null
          last_sync_time: string | null
          main_category: string | null
          main_cost: number | null
          main_cost_update: number | null
          main_fronted: boolean | null
          main_leave_no: boolean | null
          main_miscellaneous_items: boolean | null
          main_more_units_behind: boolean | null
          main_new_product_name: string | null
          main_product_image1: string | null
          main_product_name: string | null
          main_product_purchase_date: string | null
          main_purchase_notes: string | null
          main_rename_product: boolean | null
          main_samples: boolean | null
          main_samples_or_fronted: boolean | null
          main_terms_for_fronted_product: string | null
          main_total_qty_purchased: number | null
          main_total_units_behind_sample: number | null
          main_vendor_product_name: string | null
          main_vendor_uid: string | null
          po_added_to_old_po: boolean | null
          po_converted_po: boolean | null
          po_old_po_rowid: boolean | null
          po_old_po_uid: boolean | null
          po_po_date: string | null
          po_pouid_from_add_prod: string | null
          product_name_display: string | null
          rowid_account_rowid: string | null
          rowid_product_row_id_for_choice_add_item: string | null
          rowid_purchase_order_row_id: string | null
          rowid_sheet21_pics: string | null
          rowid_vpay_row_id: string | null
          sync_status: string | null
          updated_at: string | null
        }
        Insert: {
          cart_add_note?: boolean | null
          cart_rename?: boolean | null
          created_at?: string | null
          date_timestamp_subm?: string | null
          email_email_of_user_who_added_product?: string | null
          glide_id?: string | null
          id?: string
          last_edited_date?: string | null
          last_modified_at?: string | null
          last_sync_time?: string | null
          main_category?: string | null
          main_cost?: number | null
          main_cost_update?: number | null
          main_fronted?: boolean | null
          main_leave_no?: boolean | null
          main_miscellaneous_items?: boolean | null
          main_more_units_behind?: boolean | null
          main_new_product_name?: string | null
          main_product_image1?: string | null
          main_product_name?: string | null
          main_product_purchase_date?: string | null
          main_purchase_notes?: string | null
          main_rename_product?: boolean | null
          main_samples?: boolean | null
          main_samples_or_fronted?: boolean | null
          main_terms_for_fronted_product?: string | null
          main_total_qty_purchased?: number | null
          main_total_units_behind_sample?: number | null
          main_vendor_product_name?: string | null
          main_vendor_uid?: string | null
          po_added_to_old_po?: boolean | null
          po_converted_po?: boolean | null
          po_old_po_rowid?: boolean | null
          po_old_po_uid?: boolean | null
          po_po_date?: string | null
          po_pouid_from_add_prod?: string | null
          product_name_display?: string | null
          rowid_account_rowid?: string | null
          rowid_product_row_id_for_choice_add_item?: string | null
          rowid_purchase_order_row_id?: string | null
          rowid_sheet21_pics?: string | null
          rowid_vpay_row_id?: string | null
          sync_status?: string | null
          updated_at?: string | null
        }
        Update: {
          cart_add_note?: boolean | null
          cart_rename?: boolean | null
          created_at?: string | null
          date_timestamp_subm?: string | null
          email_email_of_user_who_added_product?: string | null
          glide_id?: string | null
          id?: string
          last_edited_date?: string | null
          last_modified_at?: string | null
          last_sync_time?: string | null
          main_category?: string | null
          main_cost?: number | null
          main_cost_update?: number | null
          main_fronted?: boolean | null
          main_leave_no?: boolean | null
          main_miscellaneous_items?: boolean | null
          main_more_units_behind?: boolean | null
          main_new_product_name?: string | null
          main_product_image1?: string | null
          main_product_name?: string | null
          main_product_purchase_date?: string | null
          main_purchase_notes?: string | null
          main_rename_product?: boolean | null
          main_samples?: boolean | null
          main_samples_or_fronted?: boolean | null
          main_terms_for_fronted_product?: string | null
          main_total_qty_purchased?: number | null
          main_total_units_behind_sample?: number | null
          main_vendor_product_name?: string | null
          main_vendor_uid?: string | null
          po_added_to_old_po?: boolean | null
          po_converted_po?: boolean | null
          po_old_po_rowid?: boolean | null
          po_old_po_uid?: boolean | null
          po_po_date?: string | null
          po_pouid_from_add_prod?: string | null
          product_name_display?: string | null
          rowid_account_rowid?: string | null
          rowid_product_row_id_for_choice_add_item?: string | null
          rowid_purchase_order_row_id?: string | null
          rowid_sheet21_pics?: string | null
          rowid_vpay_row_id?: string | null
          sync_status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      gl_purchase_orders: {
        Row: {
          created_at: string | null
          date_payment_date_mddyyyy: string | null
          docs_pdf_created_on: string | null
          docs_pdf_link: string | null
          docs_shortlink: string | null
          glide_id: string | null
          id: string
          last_edited_date: string | null
          last_modified_at: string | null
          last_sync_time: string | null
          main_po_date_used_for_uid: string | null
          main_purchase_order_uid_from_product: string | null
          rowid_accntrowid: string | null
          rowid_vpayrowid: string | null
          sync_status: Database["public"]["Enums"]["sync_status"] | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          date_payment_date_mddyyyy?: string | null
          docs_pdf_created_on?: string | null
          docs_pdf_link?: string | null
          docs_shortlink?: string | null
          glide_id?: string | null
          id?: string
          last_edited_date?: string | null
          last_modified_at?: string | null
          last_sync_time?: string | null
          main_po_date_used_for_uid?: string | null
          main_purchase_order_uid_from_product?: string | null
          rowid_accntrowid?: string | null
          rowid_vpayrowid?: string | null
          sync_status?: Database["public"]["Enums"]["sync_status"] | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          date_payment_date_mddyyyy?: string | null
          docs_pdf_created_on?: string | null
          docs_pdf_link?: string | null
          docs_shortlink?: string | null
          glide_id?: string | null
          id?: string
          last_edited_date?: string | null
          last_modified_at?: string | null
          last_sync_time?: string | null
          main_po_date_used_for_uid?: string | null
          main_purchase_order_uid_from_product?: string | null
          rowid_accntrowid?: string | null
          rowid_vpayrowid?: string | null
          sync_status?: Database["public"]["Enums"]["sync_status"] | null
          updated_at?: string | null
        }
        Relationships: []
      }
      gl_shipping_records: {
        Row: {
          ai_ai_extracted_text: string | null
          ai_ai_json: Json | null
          ai_label_upload: Json | null
          ai_tracking_ai_extracted_text: string | null
          ai_tracking_json_extracted: Json | null
          created_at: string | null
          glide_id: string | null
          ical_calendar_google_updated: boolean | null
          ical_end_date: string | null
          ical_last_tracked: string | null
          ical_last_updated: string | null
          ical_state_abbrievation: string | null
          ical_status: string | null
          id: string
          last_modified_at: string | null
          last_sync_time: string | null
          main_account_rowid: string | null
          main_account_rowid_2: string | null
          main_account_uid: string | null
          main_account_uid_2: string | null
          main_account_uid_3: string | null
          main_accounuid_list: string | null
          main_box_sizes: string | null
          main_box_weight: number | null
          main_delivery_time_end: string | null
          main_delivery_time_range: string | null
          main_delivery_time_start: string | null
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
          main_total_units_1st_account: number | null
          main_total_units_2nd_account: number | null
          main_total_units_3rd_account_copy: number | null
          main_total_units_inside: number | null
          main_tp_id: string | null
          main_tp_id_ical: string | null
          main_tracking_link: string | null
          main_tracking_number: string | null
          multiple_accounts: boolean | null
          receiver_receiver_address: string | null
          receiver_receiver_name: string | null
          receiver_state: string | null
          rowid_invoicerelated: string | null
          sender_sender_address: string | null
          sender_sender_name_company: string | null
          sender_sender_phone: string | null
          sync_status: Database["public"]["Enums"]["sync_status"] | null
          tp_history_rowid: string | null
          updated_at: string | null
        }
        Insert: {
          ai_ai_extracted_text?: string | null
          ai_ai_json?: Json | null
          ai_label_upload?: Json | null
          ai_tracking_ai_extracted_text?: string | null
          ai_tracking_json_extracted?: Json | null
          created_at?: string | null
          glide_id?: string | null
          ical_calendar_google_updated?: boolean | null
          ical_end_date?: string | null
          ical_last_tracked?: string | null
          ical_last_updated?: string | null
          ical_state_abbrievation?: string | null
          ical_status?: string | null
          id?: string
          last_modified_at?: string | null
          last_sync_time?: string | null
          main_account_rowid?: string | null
          main_account_rowid_2?: string | null
          main_account_uid?: string | null
          main_account_uid_2?: string | null
          main_account_uid_3?: string | null
          main_accounuid_list?: string | null
          main_box_sizes?: string | null
          main_box_weight?: number | null
          main_delivery_time_end?: string | null
          main_delivery_time_range?: string | null
          main_delivery_time_start?: string | null
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
          main_total_units_1st_account?: number | null
          main_total_units_2nd_account?: number | null
          main_total_units_3rd_account_copy?: number | null
          main_total_units_inside?: number | null
          main_tp_id?: string | null
          main_tp_id_ical?: string | null
          main_tracking_link?: string | null
          main_tracking_number?: string | null
          multiple_accounts?: boolean | null
          receiver_receiver_address?: string | null
          receiver_receiver_name?: string | null
          receiver_state?: string | null
          rowid_invoicerelated?: string | null
          sender_sender_address?: string | null
          sender_sender_name_company?: string | null
          sender_sender_phone?: string | null
          sync_status?: Database["public"]["Enums"]["sync_status"] | null
          tp_history_rowid?: string | null
          updated_at?: string | null
        }
        Update: {
          ai_ai_extracted_text?: string | null
          ai_ai_json?: Json | null
          ai_label_upload?: Json | null
          ai_tracking_ai_extracted_text?: string | null
          ai_tracking_json_extracted?: Json | null
          created_at?: string | null
          glide_id?: string | null
          ical_calendar_google_updated?: boolean | null
          ical_end_date?: string | null
          ical_last_tracked?: string | null
          ical_last_updated?: string | null
          ical_state_abbrievation?: string | null
          ical_status?: string | null
          id?: string
          last_modified_at?: string | null
          last_sync_time?: string | null
          main_account_rowid?: string | null
          main_account_rowid_2?: string | null
          main_account_uid?: string | null
          main_account_uid_2?: string | null
          main_account_uid_3?: string | null
          main_accounuid_list?: string | null
          main_box_sizes?: string | null
          main_box_weight?: number | null
          main_delivery_time_end?: string | null
          main_delivery_time_range?: string | null
          main_delivery_time_start?: string | null
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
          main_total_units_1st_account?: number | null
          main_total_units_2nd_account?: number | null
          main_total_units_3rd_account_copy?: number | null
          main_total_units_inside?: number | null
          main_tp_id?: string | null
          main_tp_id_ical?: string | null
          main_tracking_link?: string | null
          main_tracking_number?: string | null
          multiple_accounts?: boolean | null
          receiver_receiver_address?: string | null
          receiver_receiver_name?: string | null
          receiver_state?: string | null
          rowid_invoicerelated?: string | null
          sender_sender_address?: string | null
          sender_sender_name_company?: string | null
          sender_sender_phone?: string | null
          sync_status?: Database["public"]["Enums"]["sync_status"] | null
          tp_history_rowid?: string | null
          updated_at?: string | null
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
          created_at: string | null
          description: string | null
          glide_table_id: string
          id: string
          supabase_table: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          glide_table_id: string
          id?: string
          supabase_table: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          glide_table_id?: string
          id?: string
          supabase_table?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      gl_vendor_payments: {
        Row: {
          automatically_recorded: boolean | null
          created_at: string | null
          date_timestamp_date: string | null
          glide_id: string | null
          id: string
          last_modified_at: string | null
          last_sync_time: string | null
          main_date_of_payment: string | null
          main_dateofpurchaseorder: string | null
          main_payment_amount: number | null
          main_productnotestoo: string | null
          rowid_account_row_id: string | null
          rowid_po_uid_from_addprod: string | null
          rowid_productrowid: string | null
          rowid_purchaseorderrowid: string | null
          sync_status: Database["public"]["Enums"]["sync_status"] | null
          updated_at: string | null
          user_emailuseradded: string | null
        }
        Insert: {
          automatically_recorded?: boolean | null
          created_at?: string | null
          date_timestamp_date?: string | null
          glide_id?: string | null
          id?: string
          last_modified_at?: string | null
          last_sync_time?: string | null
          main_date_of_payment?: string | null
          main_dateofpurchaseorder?: string | null
          main_payment_amount?: number | null
          main_productnotestoo?: string | null
          rowid_account_row_id?: string | null
          rowid_po_uid_from_addprod?: string | null
          rowid_productrowid?: string | null
          rowid_purchaseorderrowid?: string | null
          sync_status?: Database["public"]["Enums"]["sync_status"] | null
          updated_at?: string | null
          user_emailuseradded?: string | null
        }
        Update: {
          automatically_recorded?: boolean | null
          created_at?: string | null
          date_timestamp_date?: string | null
          glide_id?: string | null
          id?: string
          last_modified_at?: string | null
          last_sync_time?: string | null
          main_date_of_payment?: string | null
          main_dateofpurchaseorder?: string | null
          main_payment_amount?: number | null
          main_productnotestoo?: string | null
          rowid_account_row_id?: string | null
          rowid_po_uid_from_addprod?: string | null
          rowid_productrowid?: string | null
          rowid_purchaseorderrowid?: string | null
          sync_status?: Database["public"]["Enums"]["sync_status"] | null
          updated_at?: string | null
          user_emailuseradded?: string | null
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
          edit_date: string | null
          error_message: string | null
          file_id: string | null
          file_size: number | null
          file_unique_id: string | null
          glide_row_id: string | null
          glide_stock: string | null
          group_caption_synced: boolean | null
          group_first_message_time: string | null
          group_last_message_time: string | null
          group_message_count: number | null
          height: number | null
          id: string
          is_deleted: boolean | null
          is_edited: boolean | null
          is_miscellaneous_item: string | null
          is_original_caption: boolean | null
          last_error_at: string | null
          media_group_id: string | null
          message_caption_id: string | null
          message_url: string | null
          mime_type: string | null
          notes: string | null
          processing_completed_at: string | null
          processing_started_at: string | null
          processing_state:
            | Database["public"]["Enums"]["message_processing_state"]
            | null
          product_code: string | null
          product_name: string | null
          product_quantity: number | null
          product_sku: string | null
          product_unit: string | null
          public_url: string | null
          purchase_date: string | null
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
          edit_date?: string | null
          error_message?: string | null
          file_id?: string | null
          file_size?: number | null
          file_unique_id?: string | null
          glide_row_id?: string | null
          glide_stock?: string | null
          group_caption_synced?: boolean | null
          group_first_message_time?: string | null
          group_last_message_time?: string | null
          group_message_count?: number | null
          height?: number | null
          id?: string
          is_deleted?: boolean | null
          is_edited?: boolean | null
          is_miscellaneous_item?: string | null
          is_original_caption?: boolean | null
          last_error_at?: string | null
          media_group_id?: string | null
          message_caption_id?: string | null
          message_url?: string | null
          mime_type?: string | null
          notes?: string | null
          processing_completed_at?: string | null
          processing_started_at?: string | null
          processing_state?:
            | Database["public"]["Enums"]["message_processing_state"]
            | null
          product_code?: string | null
          product_name?: string | null
          product_quantity?: number | null
          product_sku?: string | null
          product_unit?: string | null
          public_url?: string | null
          purchase_date?: string | null
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
          edit_date?: string | null
          error_message?: string | null
          file_id?: string | null
          file_size?: number | null
          file_unique_id?: string | null
          glide_row_id?: string | null
          glide_stock?: string | null
          group_caption_synced?: boolean | null
          group_first_message_time?: string | null
          group_last_message_time?: string | null
          group_message_count?: number | null
          height?: number | null
          id?: string
          is_deleted?: boolean | null
          is_edited?: boolean | null
          is_miscellaneous_item?: string | null
          is_original_caption?: boolean | null
          last_error_at?: string | null
          media_group_id?: string | null
          message_caption_id?: string | null
          message_url?: string | null
          mime_type?: string | null
          notes?: string | null
          processing_completed_at?: string | null
          processing_started_at?: string | null
          processing_state?:
            | Database["public"]["Enums"]["message_processing_state"]
            | null
          product_code?: string | null
          product_name?: string | null
          product_quantity?: number | null
          product_sku?: string | null
          product_unit?: string | null
          public_url?: string | null
          purchase_date?: string | null
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
            foreignKeyName: "messages_glide_row_id_fkey"
            columns: ["glide_row_id"]
            isOneToOne: false
            referencedRelation: "gl_products"
            referencedColumns: ["glide_id"]
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
      sync_records: {
        Row: {
          error_message: string | null
          id: number
          last_synced: string | null
          supabase_table: string
          sync_status: string
        }
        Insert: {
          error_message?: string | null
          id?: never
          last_synced?: string | null
          supabase_table: string
          sync_status: string
        }
        Update: {
          error_message?: string | null
          id?: never
          last_synced?: string | null
          supabase_table?: string
          sync_status?: string
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
      construct_telegram_message_url: {
        Args: {
          chat_type: string
          chat_id: number
          message_id: number
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
      extract_notes: {
        Args: {
          analyzed_content: Json
        }
        Returns: string
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
      fix_media_groups: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      fuzzy_match: {
        Args: {
          text1: string
          text2: string
          threshold?: number
        }
        Returns: boolean
      }
      glapp_manual_sync_products_messages: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      glapp_sync_products_messages: {
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
      process_glide_sync_queue: {
        Args: Record<PropertyKey, never>
        Returns: undefined
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
      schedule_sync_check: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      text_to_bytea: {
        Args: {
          data: string
        }
        Returns: string
      }
      update_product_sku: {
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
      sync_operation: "sync" | "create" | "update" | "delete"
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
