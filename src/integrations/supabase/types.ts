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
          client_type: string | null
          created_at: string | null
          date_added_client: string | null
          email_of_who_added: string | null
          glide_row_id: string
          id: string
          last_sync_time: string | null
          main_account_name: string | null
          main_account_notes: string | null
          main_accounts_uid: string | null
          main_client_address: string | null
          main_client_email: string | null
          main_client_phone: string | null
          main_client_type: string | null
          main_contact_person: string | null
          photo: string | null
          sync_status: string | null
          updated_at: string | null
        }
        Insert: {
          account_name?: string | null
          accounts_uid?: string | null
          client_type?: string | null
          created_at?: string | null
          date_added_client?: string | null
          email_of_who_added?: string | null
          glide_row_id: string
          id?: string
          last_sync_time?: string | null
          main_account_name?: string | null
          main_account_notes?: string | null
          main_accounts_uid?: string | null
          main_client_address?: string | null
          main_client_email?: string | null
          main_client_phone?: string | null
          main_client_type?: string | null
          main_contact_person?: string | null
          photo?: string | null
          sync_status?: string | null
          updated_at?: string | null
        }
        Update: {
          account_name?: string | null
          accounts_uid?: string | null
          client_type?: string | null
          created_at?: string | null
          date_added_client?: string | null
          email_of_who_added?: string | null
          glide_row_id?: string
          id?: string
          last_sync_time?: string | null
          main_account_name?: string | null
          main_account_notes?: string | null
          main_accounts_uid?: string | null
          main_client_address?: string | null
          main_client_email?: string | null
          main_client_phone?: string | null
          main_client_type?: string | null
          main_contact_person?: string | null
          photo?: string | null
          sync_status?: string | null
          updated_at?: string | null
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
          updated_at: string | null
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
          updated_at?: string | null
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
          updated_at?: string | null
        }
        Relationships: []
      }
      gl_customer_credits: {
        Row: {
          created_at: string | null
          date_of_payment: string | null
          glide_row_id: string
          id: string
          last_modified_at: string | null
          last_sync_time: string | null
          main_date_of_payment: string | null
          main_payment_amount: number | null
          main_payment_note: string | null
          payment_amount: number | null
          payment_note: string | null
          payment_type: string | null
          rowid_accounts: string | null
          rowid_estimates: string | null
          rowid_invoices: string | null
          sb_accounts_id: string | null
          sb_estimates_id: string | null
          sync_status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          date_of_payment?: string | null
          glide_row_id: string
          id?: string
          last_modified_at?: string | null
          last_sync_time?: string | null
          main_date_of_payment?: string | null
          main_payment_amount?: number | null
          main_payment_note?: string | null
          payment_amount?: number | null
          payment_note?: string | null
          payment_type?: string | null
          rowid_accounts?: string | null
          rowid_estimates?: string | null
          rowid_invoices?: string | null
          sb_accounts_id?: string | null
          sb_estimates_id?: string | null
          sync_status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          date_of_payment?: string | null
          glide_row_id?: string
          id?: string
          last_modified_at?: string | null
          last_sync_time?: string | null
          main_date_of_payment?: string | null
          main_payment_amount?: number | null
          main_payment_note?: string | null
          payment_amount?: number | null
          payment_note?: string | null
          payment_type?: string | null
          rowid_accounts?: string | null
          rowid_estimates?: string | null
          rowid_invoices?: string | null
          sb_accounts_id?: string | null
          sb_estimates_id?: string | null
          sync_status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_customer_credits_accounts"
            columns: ["sb_accounts_id"]
            isOneToOne: false
            referencedRelation: "gl_account_dashboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_customer_credits_accounts"
            columns: ["sb_accounts_id"]
            isOneToOne: false
            referencedRelation: "gl_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_customer_credits_estimates"
            columns: ["sb_estimates_id"]
            isOneToOne: false
            referencedRelation: "gl_estimate_totals"
            referencedColumns: ["estimate_id"]
          },
          {
            foreignKeyName: "fk_customer_credits_estimates"
            columns: ["sb_estimates_id"]
            isOneToOne: false
            referencedRelation: "gl_estimates"
            referencedColumns: ["id"]
          },
        ]
      }
      gl_customer_payments: {
        Row: {
          created_at: string | null
          date_of_payment: string | null
          email_of_user: string | null
          glide_row_id: string
          id: string
          invoice_id: string | null
          last_modified_at: string | null
          last_sync_time: string | null
          main_date_of_payment: string | null
          main_payment_amount: number | null
          main_payment_method: string | null
          main_payment_note: string | null
          payment_amount: number | null
          payment_method: string | null
          payment_note: string | null
          payment_type: string | null
          rowid_accounts: string | null
          rowid_invoices: string | null
          sb_accounts_id: string | null
          sb_invoices_id: string | null
          sync_status: string | null
          type_of_payment: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          date_of_payment?: string | null
          email_of_user?: string | null
          glide_row_id: string
          id?: string
          invoice_id?: string | null
          last_modified_at?: string | null
          last_sync_time?: string | null
          main_date_of_payment?: string | null
          main_payment_amount?: number | null
          main_payment_method?: string | null
          main_payment_note?: string | null
          payment_amount?: number | null
          payment_method?: string | null
          payment_note?: string | null
          payment_type?: string | null
          rowid_accounts?: string | null
          rowid_invoices?: string | null
          sb_accounts_id?: string | null
          sb_invoices_id?: string | null
          sync_status?: string | null
          type_of_payment?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          date_of_payment?: string | null
          email_of_user?: string | null
          glide_row_id?: string
          id?: string
          invoice_id?: string | null
          last_modified_at?: string | null
          last_sync_time?: string | null
          main_date_of_payment?: string | null
          main_payment_amount?: number | null
          main_payment_method?: string | null
          main_payment_note?: string | null
          payment_amount?: number | null
          payment_method?: string | null
          payment_note?: string | null
          payment_type?: string | null
          rowid_accounts?: string | null
          rowid_invoices?: string | null
          sb_accounts_id?: string | null
          sb_invoices_id?: string | null
          sync_status?: string | null
          type_of_payment?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_customer_payments_accounts"
            columns: ["sb_accounts_id"]
            isOneToOne: false
            referencedRelation: "gl_account_dashboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_customer_payments_accounts"
            columns: ["sb_accounts_id"]
            isOneToOne: false
            referencedRelation: "gl_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_customer_payments_invoices"
            columns: ["sb_invoices_id"]
            isOneToOne: false
            referencedRelation: "gl_invoice_details"
            referencedColumns: ["invoice_id"]
          },
          {
            foreignKeyName: "fk_customer_payments_invoices"
            columns: ["sb_invoices_id"]
            isOneToOne: false
            referencedRelation: "gl_invoice_totals"
            referencedColumns: ["invoice_id"]
          },
          {
            foreignKeyName: "fk_customer_payments_invoices"
            columns: ["sb_invoices_id"]
            isOneToOne: false
            referencedRelation: "gl_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_customer_payments_invoices"
            columns: ["sb_invoices_id"]
            isOneToOne: false
            referencedRelation: "gl_order_fulfillment"
            referencedColumns: ["invoice_id"]
          },
        ]
      }
      gl_estimate_lines: {
        Row: {
          created_at: string | null
          description: string | null
          estimate_id: string | null
          glide_row_id: string
          id: string
          last_sync_time: string | null
          main_date_of_sale: string | null
          main_line_total: number | null
          main_product_sale_note: string | null
          main_qty_sold: number | null
          main_sale_product_name: string | null
          main_selling_price: number | null
          price: number | null
          product_id: string | null
          product_name_display: string | null
          quantity: number | null
          rowid_estimate_row_id_fromline: string | null
          rowid_product_id_estline_items: string | null
          sale_product_name: string | null
          sb_estimates_id: string | null
          sb_invoice_lines_id: string | null
          sb_products_id: string | null
          sync_status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          estimate_id?: string | null
          glide_row_id: string
          id?: string
          last_sync_time?: string | null
          main_date_of_sale?: string | null
          main_line_total?: number | null
          main_product_sale_note?: string | null
          main_qty_sold?: number | null
          main_sale_product_name?: string | null
          main_selling_price?: number | null
          price?: number | null
          product_id?: string | null
          product_name_display?: string | null
          quantity?: number | null
          rowid_estimate_row_id_fromline?: string | null
          rowid_product_id_estline_items?: string | null
          sale_product_name?: string | null
          sb_estimates_id?: string | null
          sb_invoice_lines_id?: string | null
          sb_products_id?: string | null
          sync_status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          estimate_id?: string | null
          glide_row_id?: string
          id?: string
          last_sync_time?: string | null
          main_date_of_sale?: string | null
          main_line_total?: number | null
          main_product_sale_note?: string | null
          main_qty_sold?: number | null
          main_sale_product_name?: string | null
          main_selling_price?: number | null
          price?: number | null
          product_id?: string | null
          product_name_display?: string | null
          quantity?: number | null
          rowid_estimate_row_id_fromline?: string | null
          rowid_product_id_estline_items?: string | null
          sale_product_name?: string | null
          sb_estimates_id?: string | null
          sb_invoice_lines_id?: string | null
          sb_products_id?: string | null
          sync_status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_estimate_lines_estimates"
            columns: ["sb_estimates_id"]
            isOneToOne: false
            referencedRelation: "gl_estimate_totals"
            referencedColumns: ["estimate_id"]
          },
          {
            foreignKeyName: "fk_estimate_lines_estimates"
            columns: ["sb_estimates_id"]
            isOneToOne: false
            referencedRelation: "gl_estimates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_estimate_lines_invoice_lines"
            columns: ["sb_invoice_lines_id"]
            isOneToOne: false
            referencedRelation: "gl_invoice_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_estimate_lines_products"
            columns: ["sb_products_id"]
            isOneToOne: false
            referencedRelation: "gl_product_inventory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_estimate_lines_products"
            columns: ["sb_products_id"]
            isOneToOne: false
            referencedRelation: "gl_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gl_estimate_lines_estimate_id_fkey"
            columns: ["estimate_id"]
            isOneToOne: false
            referencedRelation: "gl_estimate_totals"
            referencedColumns: ["estimate_id"]
          },
          {
            foreignKeyName: "gl_estimate_lines_estimate_id_fkey"
            columns: ["estimate_id"]
            isOneToOne: false
            referencedRelation: "gl_estimates"
            referencedColumns: ["id"]
          },
        ]
      }
      gl_estimates: {
        Row: {
          add_note: string | null
          approved_date: string | null
          balance: number | null
          converted_to_invoice: string | null
          created_at: string | null
          date_invoice_created_date: string | null
          estimate_date: string | null
          estimate_uid: string | null
          glide_row_id: string
          id: string
          is_sample: boolean | null
          last_sync_time: string | null
          main_approved_date: string | null
          main_estimate_balance: number | null
          main_estimate_date: string | null
          main_estimate_total: number | null
          main_notes: string | null
          main_submitted_date: string | null
          main_total_payments: number | null
          main_void_date: string | null
          notes: string | null
          rowid_accounts: string | null
          rowids_account_row_id_estimates: string | null
          rowids_invoice_created: string | null
          sb_accounts_id: string | null
          sb_invoices_id: string | null
          status: string | null
          submitted_date: string | null
          sync_status: string | null
          total_amount: number | null
          total_paid: number | null
          updated_at: string | null
          valid_final_create_invoice_clicked: boolean | null
          void_date: string | null
        }
        Insert: {
          add_note?: string | null
          approved_date?: string | null
          balance?: number | null
          converted_to_invoice?: string | null
          created_at?: string | null
          date_invoice_created_date?: string | null
          estimate_date?: string | null
          estimate_uid?: string | null
          glide_row_id: string
          id?: string
          is_sample?: boolean | null
          last_sync_time?: string | null
          main_approved_date?: string | null
          main_estimate_balance?: number | null
          main_estimate_date?: string | null
          main_estimate_total?: number | null
          main_notes?: string | null
          main_submitted_date?: string | null
          main_total_payments?: number | null
          main_void_date?: string | null
          notes?: string | null
          rowid_accounts?: string | null
          rowids_account_row_id_estimates?: string | null
          rowids_invoice_created?: string | null
          sb_accounts_id?: string | null
          sb_invoices_id?: string | null
          status?: string | null
          submitted_date?: string | null
          sync_status?: string | null
          total_amount?: number | null
          total_paid?: number | null
          updated_at?: string | null
          valid_final_create_invoice_clicked?: boolean | null
          void_date?: string | null
        }
        Update: {
          add_note?: string | null
          approved_date?: string | null
          balance?: number | null
          converted_to_invoice?: string | null
          created_at?: string | null
          date_invoice_created_date?: string | null
          estimate_date?: string | null
          estimate_uid?: string | null
          glide_row_id?: string
          id?: string
          is_sample?: boolean | null
          last_sync_time?: string | null
          main_approved_date?: string | null
          main_estimate_balance?: number | null
          main_estimate_date?: string | null
          main_estimate_total?: number | null
          main_notes?: string | null
          main_submitted_date?: string | null
          main_total_payments?: number | null
          main_void_date?: string | null
          notes?: string | null
          rowid_accounts?: string | null
          rowids_account_row_id_estimates?: string | null
          rowids_invoice_created?: string | null
          sb_accounts_id?: string | null
          sb_invoices_id?: string | null
          status?: string | null
          submitted_date?: string | null
          sync_status?: string | null
          total_amount?: number | null
          total_paid?: number | null
          updated_at?: string | null
          valid_final_create_invoice_clicked?: boolean | null
          void_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_estimates_accounts"
            columns: ["sb_accounts_id"]
            isOneToOne: false
            referencedRelation: "gl_account_dashboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_estimates_accounts"
            columns: ["sb_accounts_id"]
            isOneToOne: false
            referencedRelation: "gl_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_estimates_invoices"
            columns: ["sb_invoices_id"]
            isOneToOne: false
            referencedRelation: "gl_invoice_details"
            referencedColumns: ["invoice_id"]
          },
          {
            foreignKeyName: "fk_estimates_invoices"
            columns: ["sb_invoices_id"]
            isOneToOne: false
            referencedRelation: "gl_invoice_totals"
            referencedColumns: ["invoice_id"]
          },
          {
            foreignKeyName: "fk_estimates_invoices"
            columns: ["sb_invoices_id"]
            isOneToOne: false
            referencedRelation: "gl_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_estimates_invoices"
            columns: ["sb_invoices_id"]
            isOneToOne: false
            referencedRelation: "gl_order_fulfillment"
            referencedColumns: ["invoice_id"]
          },
          {
            foreignKeyName: "gl_estimates_converted_to_invoice_fkey"
            columns: ["converted_to_invoice"]
            isOneToOne: false
            referencedRelation: "gl_invoice_details"
            referencedColumns: ["invoice_id"]
          },
          {
            foreignKeyName: "gl_estimates_converted_to_invoice_fkey"
            columns: ["converted_to_invoice"]
            isOneToOne: false
            referencedRelation: "gl_invoice_totals"
            referencedColumns: ["invoice_id"]
          },
          {
            foreignKeyName: "gl_estimates_converted_to_invoice_fkey"
            columns: ["converted_to_invoice"]
            isOneToOne: false
            referencedRelation: "gl_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gl_estimates_converted_to_invoice_fkey"
            columns: ["converted_to_invoice"]
            isOneToOne: false
            referencedRelation: "gl_order_fulfillment"
            referencedColumns: ["invoice_id"]
          },
        ]
      }
      gl_expenses: {
        Row: {
          amount: number | null
          category: string | null
          created_at: string | null
          date: string | null
          expense_address: string | null
          expense_amount: number | null
          expense_cash: string | null
          expense_category: string | null
          expense_change: string | null
          expense_date: string | null
          expense_description: string | null
          expense_image_url: string | null
          expense_list_of_items: string | null
          expense_receipt_id: string | null
          expense_receipt_image: string | null
          expense_subtotal: number | null
          expense_supplier_name: string | null
          expense_tax: string | null
          expense_text_to_json: string | null
          expense_total: string | null
          expense_vendor: string | null
          glide_row_id: string
          id: string
          last_sync_time: string | null
          main_expense_amount: number | null
          main_expense_category: string | null
          main_expense_date: string | null
          main_expense_description: string | null
          main_expense_vendor: string | null
          notes: string | null
          processing: boolean | null
          submitted_by: string | null
          sync_status: string | null
          updated_at: string | null
        }
        Insert: {
          amount?: number | null
          category?: string | null
          created_at?: string | null
          date?: string | null
          expense_address?: string | null
          expense_amount?: number | null
          expense_cash?: string | null
          expense_category?: string | null
          expense_change?: string | null
          expense_date?: string | null
          expense_description?: string | null
          expense_image_url?: string | null
          expense_list_of_items?: string | null
          expense_receipt_id?: string | null
          expense_receipt_image?: string | null
          expense_subtotal?: number | null
          expense_supplier_name?: string | null
          expense_tax?: string | null
          expense_text_to_json?: string | null
          expense_total?: string | null
          expense_vendor?: string | null
          glide_row_id: string
          id?: string
          last_sync_time?: string | null
          main_expense_amount?: number | null
          main_expense_category?: string | null
          main_expense_date?: string | null
          main_expense_description?: string | null
          main_expense_vendor?: string | null
          notes?: string | null
          processing?: boolean | null
          submitted_by?: string | null
          sync_status?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number | null
          category?: string | null
          created_at?: string | null
          date?: string | null
          expense_address?: string | null
          expense_amount?: number | null
          expense_cash?: string | null
          expense_category?: string | null
          expense_change?: string | null
          expense_date?: string | null
          expense_description?: string | null
          expense_image_url?: string | null
          expense_list_of_items?: string | null
          expense_receipt_id?: string | null
          expense_receipt_image?: string | null
          expense_subtotal?: number | null
          expense_supplier_name?: string | null
          expense_tax?: string | null
          expense_text_to_json?: string | null
          expense_total?: string | null
          expense_vendor?: string | null
          glide_row_id?: string
          id?: string
          last_sync_time?: string | null
          main_expense_amount?: number | null
          main_expense_category?: string | null
          main_expense_date?: string | null
          main_expense_description?: string | null
          main_expense_vendor?: string | null
          notes?: string | null
          processing?: boolean | null
          submitted_by?: string | null
          sync_status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      gl_invoice_lines: {
        Row: {
          created_at: string | null
          description: string | null
          glide_row_id: string
          id: string
          invoice_id: string | null
          last_sync_time: string | null
          main_date_of_sale: string | null
          main_line_total: number | null
          main_product_sale_note: string | null
          main_qty_sold: number | null
          main_renamed_product_name: string | null
          main_selling_price: number | null
          price: number | null
          product_id: string | null
          product_name_display: string | null
          quantity: number | null
          renamed_product_name: string | null
          rowid_invoice_rowid: string | null
          rowid_productid: string | null
          sb_estimate_lines_id: string | null
          sb_invoices_id: string | null
          sb_products_id: string | null
          sync_status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          glide_row_id: string
          id?: string
          invoice_id?: string | null
          last_sync_time?: string | null
          main_date_of_sale?: string | null
          main_line_total?: number | null
          main_product_sale_note?: string | null
          main_qty_sold?: number | null
          main_renamed_product_name?: string | null
          main_selling_price?: number | null
          price?: number | null
          product_id?: string | null
          product_name_display?: string | null
          quantity?: number | null
          renamed_product_name?: string | null
          rowid_invoice_rowid?: string | null
          rowid_productid?: string | null
          sb_estimate_lines_id?: string | null
          sb_invoices_id?: string | null
          sb_products_id?: string | null
          sync_status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          glide_row_id?: string
          id?: string
          invoice_id?: string | null
          last_sync_time?: string | null
          main_date_of_sale?: string | null
          main_line_total?: number | null
          main_product_sale_note?: string | null
          main_qty_sold?: number | null
          main_renamed_product_name?: string | null
          main_selling_price?: number | null
          price?: number | null
          product_id?: string | null
          product_name_display?: string | null
          quantity?: number | null
          renamed_product_name?: string | null
          rowid_invoice_rowid?: string | null
          rowid_productid?: string | null
          sb_estimate_lines_id?: string | null
          sb_invoices_id?: string | null
          sb_products_id?: string | null
          sync_status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_invoice_lines_invoices"
            columns: ["sb_invoices_id"]
            isOneToOne: false
            referencedRelation: "gl_invoice_details"
            referencedColumns: ["invoice_id"]
          },
          {
            foreignKeyName: "fk_invoice_lines_invoices"
            columns: ["sb_invoices_id"]
            isOneToOne: false
            referencedRelation: "gl_invoice_totals"
            referencedColumns: ["invoice_id"]
          },
          {
            foreignKeyName: "fk_invoice_lines_invoices"
            columns: ["sb_invoices_id"]
            isOneToOne: false
            referencedRelation: "gl_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_invoice_lines_invoices"
            columns: ["sb_invoices_id"]
            isOneToOne: false
            referencedRelation: "gl_order_fulfillment"
            referencedColumns: ["invoice_id"]
          },
          {
            foreignKeyName: "fk_invoice_lines_products"
            columns: ["sb_products_id"]
            isOneToOne: false
            referencedRelation: "gl_product_inventory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_invoice_lines_products"
            columns: ["sb_products_id"]
            isOneToOne: false
            referencedRelation: "gl_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gl_invoice_lines_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "gl_invoice_details"
            referencedColumns: ["invoice_id"]
          },
          {
            foreignKeyName: "gl_invoice_lines_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "gl_invoice_totals"
            referencedColumns: ["invoice_id"]
          },
          {
            foreignKeyName: "gl_invoice_lines_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "gl_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gl_invoice_lines_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "gl_order_fulfillment"
            referencedColumns: ["invoice_id"]
          },
        ]
      }
      gl_invoices: {
        Row: {
          amount_paid: number | null
          balance: number | null
          balance_total: number | null
          created_at: string | null
          created_timestamp: string | null
          doc_glideforeverlink: string | null
          due_date: string | null
          glide_row_id: string
          id: string
          invoice_order_date: string | null
          invoice_total: number | null
          invoice_uid: string | null
          last_sync_time: string | null
          main_balance_due: number | null
          main_due_date: string | null
          main_invoice_order_date: string | null
          main_invoice_total: number | null
          main_invoice_uid: string | null
          main_notes: string | null
          main_submitted_timestamp: string | null
          main_void_date: string | null
          notes: string | null
          processed: boolean | null
          rowid_accounts: string | null
          rowids_accountsid_new: string | null
          rowids_estimate_id: string | null
          sb_accounts_id: string | null
          sb_estimates_id: string | null
          status: Database["public"]["Enums"]["document_status_type"] | null
          submitted_timestamp: string | null
          sync_status: string | null
          total_amount: number | null
          total_paid: number | null
          updated_at: string | null
          user_email: string | null
          void_date: string | null
        }
        Insert: {
          amount_paid?: number | null
          balance?: number | null
          balance_total?: number | null
          created_at?: string | null
          created_timestamp?: string | null
          doc_glideforeverlink?: string | null
          due_date?: string | null
          glide_row_id: string
          id?: string
          invoice_order_date?: string | null
          invoice_total?: number | null
          invoice_uid?: string | null
          last_sync_time?: string | null
          main_balance_due?: number | null
          main_due_date?: string | null
          main_invoice_order_date?: string | null
          main_invoice_total?: number | null
          main_invoice_uid?: string | null
          main_notes?: string | null
          main_submitted_timestamp?: string | null
          main_void_date?: string | null
          notes?: string | null
          processed?: boolean | null
          rowid_accounts?: string | null
          rowids_accountsid_new?: string | null
          sb_accounts_id?: string | null
          sb_estimates_id?: string | null
          status?: Database["public"]["Enums"]["document_status_type"] | null
          submitted_timestamp?: string | null
          sync_status?: string | null
          total_amount?: number | null
          total_paid?: number | null
          updated_at?: string | null
          user_email?: string | null
          void_date?: string | null
        }
        Update: {
          amount_paid?: number | null
          balance?: number | null
          balance_total?: number | null
          created_at?: string | null
          created_timestamp?: string | null
          doc_glideforeverlink?: string | null
          due_date?: string | null
          glide_row_id?: string
          id?: string
          invoice_order_date?: string | null
          invoice_total?: number | null
          invoice_uid?: string | null
          last_sync_time?: string | null
          main_balance_due?: number | null
          main_due_date?: string | null
          main_invoice_order_date?: string | null
          main_invoice_total?: number | null
          main_invoice_uid?: string | null
          main_notes?: string | null
          main_submitted_timestamp?: string | null
          main_void_date?: string | null
          notes?: string | null
          processed?: boolean | null
          rowid_accounts?: string | null
          rowids_accountsid_new?: string | null
          sb_accounts_id?: string | null
          sb_estimates_id?: string | null
          status?: Database["public"]["Enums"]["document_status_type"] | null
          submitted_timestamp?: string | null
          sync_status?: string | null
          total_amount?: number | null
          total_paid?: number | null
          updated_at?: string | null
          user_email?: string | null
          void_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_invoices_accounts"
            columns: ["sb_accounts_id"]
            isOneToOne: false
            referencedRelation: "gl_account_dashboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_invoices_accounts"
            columns: ["sb_accounts_id"]
            isOneToOne: false
            referencedRelation: "gl_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_invoices_estimates"
            columns: ["sb_estimates_id"]
            isOneToOne: false
            referencedRelation: "gl_estimate_totals"
            referencedColumns: ["estimate_id"]
          },
          {
            foreignKeyName: "fk_invoices_estimates"
            columns: ["sb_estimates_id"]
            isOneToOne: false
            referencedRelation: "gl_estimates"
            referencedColumns: ["id"]
          },
        ]
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
          column_mappings: Json
          connection_id: string
          created_at?: string | null
          enabled?: boolean
          glide_table: string
          glide_table_display_name: string
          id?: string
<<<<<<< HEAD
          last_modified_at?: string | null
          last_sync_time?: string | null
          main_balance_due?: number | null
          main_created_timestamp?: string | null
          main_invoice_order_date?: string | null
          main_invoice_total?: number | null
          main_invoice_uid?: string | null
          main_notes?: string | null
          main_processed?: string | null
          main_submitted_timestamp?: string | null
          main_user_email?: string | null
          pdf_generated_at?: string | null
          pdf_url?: string | null
          rowids_accountsid?: string | null
          rowids_accountsid_new?: string | null
          rowids_estimate_id?: string | null
          sb_accounts_id?: string | null
          sb_estimates_id?: string | null
          sb_pdf_generated_at?: string | null
          sb_pdf_storage_path?: string | null
          sb_pdf_updated_at?: string | null
          sb_pdf_url?: string | null
          sync_status?: Database["public"]["Enums"]["sync_status"] | null
          temp_account_glide_id?: string | null
=======
          supabase_table: string
          sync_direction?: string
>>>>>>> newmai
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
<<<<<<< HEAD
          last_modified_at?: string | null
          last_sync_time?: string | null
          main_balance_due?: number | null
          main_created_timestamp?: string | null
          main_invoice_order_date?: string | null
          main_invoice_total?: number | null
          main_invoice_uid?: string | null
          main_notes?: string | null
          main_processed?: string | null
          main_submitted_timestamp?: string | null
          main_user_email?: string | null
          pdf_generated_at?: string | null
          pdf_url?: string | null
          rowids_accountsid?: string | null
          rowids_accountsid_new?: string | null
          rowids_estimate_id?: string | null
          sb_accounts_id?: string | null
          sb_estimates_id?: string | null
          sb_pdf_generated_at?: string | null
          sb_pdf_storage_path?: string | null
          sb_pdf_updated_at?: string | null
          sb_pdf_url?: string | null
          sync_status?: Database["public"]["Enums"]["sync_status"] | null
          temp_account_glide_id?: string | null
=======
          supabase_table?: string
          sync_direction?: string
>>>>>>> newmai
          updated_at?: string | null
        }
        Relationships: []
      }
      gl_migration_logs: {
        Row: {
          completed_at: string | null
          details: Json | null
          id: string
          migration_name: string
          status: string
        }
        Insert: {
          completed_at?: string | null
          details?: Json | null
          id?: string
          migration_name: string
          status: string
        }
        Update: {
          completed_at?: string | null
          details?: Json | null
          id?: string
          migration_name?: string
          status?: string
        }
        Relationships: []
      }
      gl_products: {
        Row: {
          category: string | null
          cost: number | null
          created_at: string | null
          current_stock: number | null
          date_timestamp_subm: string | null
          email_email_of_user_who_added_product: string | null
          fronted: boolean | null
          glide_row_id: string
          id: string
          is_sample: boolean | null
          last_sync_time: string | null
          main_cost: number | null
          main_new_product_name: string | null
          main_product_code: string | null
          main_total_qty_purchased: number | null
          main_vendor_product_name: string | null
          miscellaneous_items: boolean | null
          new_product_name: string | null
          po_po_date: string | null
          po_poui_dfrom_add_prod: string | null
          product_code: string | null
          product_image1: string | null
          product_name_display: string | null
          product_notes: string | null
          product_purchase_date: string | null
          purchase_notes: string | null
          purchase_order_date: string | null
          rowid_accounts: string | null
          rowid_purchase_orders: string | null
          rowid_vendor_payments: string | null
          samples: boolean | null
          samples_or_fronted: boolean | null
          sb_accounts_id: string | null
          sb_purchase_orders_id: string | null
          sync_status: string | null
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
          current_stock?: number | null
          date_timestamp_subm?: string | null
          email_email_of_user_who_added_product?: string | null
          fronted?: boolean | null
          glide_row_id: string
          id?: string
          is_sample?: boolean | null
          last_sync_time?: string | null
          main_cost?: number | null
          main_new_product_name?: string | null
          main_product_code?: string | null
          main_total_qty_purchased?: number | null
          main_vendor_product_name?: string | null
          miscellaneous_items?: boolean | null
          new_product_name?: string | null
          po_po_date?: string | null
          po_poui_dfrom_add_prod?: string | null
          product_code?: string | null
          product_image1?: string | null
          product_name_display?: string | null
          product_notes?: string | null
          product_purchase_date?: string | null
          purchase_notes?: string | null
          purchase_order_date?: string | null
          rowid_accounts?: string | null
          rowid_purchase_orders?: string | null
          rowid_vendor_payments?: string | null
          samples?: boolean | null
          samples_or_fronted?: boolean | null
          sb_accounts_id?: string | null
          sb_purchase_orders_id?: string | null
          sync_status?: string | null
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
          current_stock?: number | null
          date_timestamp_subm?: string | null
          email_email_of_user_who_added_product?: string | null
          fronted?: boolean | null
          glide_row_id?: string
          id?: string
          is_sample?: boolean | null
          last_sync_time?: string | null
          main_cost?: number | null
          main_new_product_name?: string | null
          main_product_code?: string | null
          main_total_qty_purchased?: number | null
          main_vendor_product_name?: string | null
          miscellaneous_items?: boolean | null
          new_product_name?: string | null
          po_po_date?: string | null
          po_poui_dfrom_add_prod?: string | null
          product_code?: string | null
          product_image1?: string | null
          product_name_display?: string | null
          product_notes?: string | null
          product_purchase_date?: string | null
          purchase_notes?: string | null
          purchase_order_date?: string | null
          rowid_accounts?: string | null
          rowid_purchase_orders?: string | null
          rowid_vendor_payments?: string | null
          samples?: boolean | null
          samples_or_fronted?: boolean | null
          sb_accounts_id?: string | null
          sb_purchase_orders_id?: string | null
          sync_status?: string | null
          terms_for_fronted_product?: string | null
          total_qty_purchased?: number | null
          total_units_behind_sample?: number | null
          updated_at?: string | null
          vendor_product_name?: string | null
        }
<<<<<<< HEAD
        Relationships: []
=======
        Relationships: [
          {
            foreignKeyName: "fk_products_accounts"
            columns: ["sb_accounts_id"]
            isOneToOne: false
            referencedRelation: "gl_account_dashboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_products_accounts"
            columns: ["sb_accounts_id"]
            isOneToOne: false
            referencedRelation: "gl_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_products_purchase_orders"
            columns: ["sb_purchase_orders_id"]
            isOneToOne: false
            referencedRelation: "gl_purchase_order_totals"
            referencedColumns: ["po_id"]
          },
          {
            foreignKeyName: "fk_products_purchase_orders"
            columns: ["sb_purchase_orders_id"]
            isOneToOne: false
            referencedRelation: "gl_purchase_orders"
            referencedColumns: ["id"]
          },
        ]
>>>>>>> newmai
      }
      gl_purchase_orders: {
        Row: {
          balance: number | null
          created_at: string | null
          date_payment_date_mddyyyy: string | null
          docs_shortlink: string | null
          glide_row_id: string
          id: string
          last_sync_time: string | null
          main_balance_due: number | null
          main_po_date: string | null
          main_po_total: number | null
          main_purchase_order_uid: string | null
          main_submitted_date: string | null
          main_void_date: string | null
          notes: string | null
          pdf_link: string | null
          po_date: string | null
          purchase_order_uid: string | null
          rowid_accntrowid: string | null
          rowid_accounts: string | null
          sb_accounts_id: string | null
          status: Database["public"]["Enums"]["document_status_type"] | null
          submitted_date: string | null
          sync_status: string | null
          total_amount: number | null
          total_paid: number | null
          updated_at: string | null
          void_date: string | null
        }
        Insert: {
          balance?: number | null
          created_at?: string | null
          date_payment_date_mddyyyy?: string | null
          docs_shortlink?: string | null
          glide_row_id: string
          id?: string
          last_sync_time?: string | null
          main_balance_due?: number | null
          main_po_date?: string | null
          main_po_total?: number | null
          main_purchase_order_uid?: string | null
          main_submitted_date?: string | null
          main_void_date?: string | null
          notes?: string | null
          pdf_link?: string | null
          po_date?: string | null
          purchase_order_uid?: string | null
          rowid_accntrowid?: string | null
          rowid_accounts?: string | null
          sb_accounts_id?: string | null
          status?: Database["public"]["Enums"]["document_status_type"] | null
          submitted_date?: string | null
          sync_status?: string | null
          total_amount?: number | null
          total_paid?: number | null
          updated_at?: string | null
          void_date?: string | null
        }
        Update: {
          balance?: number | null
          created_at?: string | null
          date_payment_date_mddyyyy?: string | null
          docs_shortlink?: string | null
          glide_row_id?: string
          id?: string
          last_sync_time?: string | null
          main_balance_due?: number | null
          main_po_date?: string | null
          main_po_total?: number | null
          main_purchase_order_uid?: string | null
          main_submitted_date?: string | null
          main_void_date?: string | null
          notes?: string | null
          pdf_link?: string | null
          po_date?: string | null
          purchase_order_uid?: string | null
          rowid_accntrowid?: string | null
          rowid_accounts?: string | null
          sb_accounts_id?: string | null
          status?: Database["public"]["Enums"]["document_status_type"] | null
          submitted_date?: string | null
          sync_status?: string | null
          total_amount?: number | null
          total_paid?: number | null
          updated_at?: string | null
          void_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_purchase_orders_accounts"
            columns: ["sb_accounts_id"]
            isOneToOne: false
            referencedRelation: "gl_account_dashboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_purchase_orders_accounts"
            columns: ["sb_accounts_id"]
            isOneToOne: false
            referencedRelation: "gl_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      gl_shipping_records: {
        Row: {
          box_sizes: string | null
          box_weight: number | null
          created_at: string | null
          drop_off_location_uid: string | null
          glide_row_id: string
          id: string
          last_sync_time: string | null
          main_account_row_id: string | null
          main_account_row_id1: string | null
          main_account_uid3: string | null
          main_invoices_row_id: string | null
          main_shipping_carrier: string | null
          main_shipping_cost: number | null
          main_shipping_date: string | null
          main_shipping_notes: string | null
          main_tracking_number: string | null
          main_tracking_url: string | null
          receiver_receiver_address: string | null
          receiver_receiver_name: string | null
          receiver_state: string | null
          rowid_accounts: string | null
          rowid_invoices: string | null
          sb_account1_id: string | null
          sb_account2_id: string | null
          sb_account3_id: string | null
          sb_invoices_id: string | null
          sender_sender_address: string | null
          sender_sender_name_company: string | null
          sender_sender_phone: string | null
          ship_date: string | null
          shipping_carrier: string | null
          shipping_cost: number | null
          shipping_date: string | null
          shipping_notes: string | null
          sync_status: string | null
          tp_id: string | null
          tracking_number: string | null
          tracking_url: string | null
          updated_at: string | null
        }
        Insert: {
          box_sizes?: string | null
          box_weight?: number | null
          created_at?: string | null
          drop_off_location_uid?: string | null
          glide_row_id: string
          id?: string
          last_sync_time?: string | null
          main_account_row_id?: string | null
          main_account_row_id1?: string | null
          main_account_uid3?: string | null
          main_invoices_row_id?: string | null
          main_shipping_carrier?: string | null
          main_shipping_cost?: number | null
          main_shipping_date?: string | null
          main_shipping_notes?: string | null
          main_tracking_number?: string | null
          main_tracking_url?: string | null
          receiver_receiver_address?: string | null
          receiver_receiver_name?: string | null
          receiver_state?: string | null
          rowid_accounts?: string | null
          rowid_invoices?: string | null
          sb_account1_id?: string | null
          sb_account2_id?: string | null
          sb_account3_id?: string | null
          sb_invoices_id?: string | null
          sender_sender_address?: string | null
          sender_sender_name_company?: string | null
          sender_sender_phone?: string | null
          ship_date?: string | null
          shipping_carrier?: string | null
          shipping_cost?: number | null
          shipping_date?: string | null
          shipping_notes?: string | null
          sync_status?: string | null
          tp_id?: string | null
          tracking_number?: string | null
          tracking_url?: string | null
          updated_at?: string | null
        }
        Update: {
          box_sizes?: string | null
          box_weight?: number | null
          created_at?: string | null
          drop_off_location_uid?: string | null
          glide_row_id?: string
          id?: string
          last_sync_time?: string | null
          main_account_row_id?: string | null
          main_account_row_id1?: string | null
          main_account_uid3?: string | null
          main_invoices_row_id?: string | null
          main_shipping_carrier?: string | null
          main_shipping_cost?: number | null
          main_shipping_date?: string | null
          main_shipping_notes?: string | null
          main_tracking_number?: string | null
          main_tracking_url?: string | null
          receiver_receiver_address?: string | null
          receiver_receiver_name?: string | null
          receiver_state?: string | null
          rowid_accounts?: string | null
          rowid_invoices?: string | null
          sb_account1_id?: string | null
          sb_account2_id?: string | null
          sb_account3_id?: string | null
          sb_invoices_id?: string | null
          sender_sender_address?: string | null
          sender_sender_name_company?: string | null
          sender_sender_phone?: string | null
          ship_date?: string | null
          shipping_carrier?: string | null
          shipping_cost?: number | null
          shipping_date?: string | null
          shipping_notes?: string | null
          sync_status?: string | null
          tp_id?: string | null
          tracking_number?: string | null
          tracking_url?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_shipping_records_account1"
            columns: ["sb_account1_id"]
            isOneToOne: false
            referencedRelation: "gl_account_dashboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_shipping_records_account1"
            columns: ["sb_account1_id"]
            isOneToOne: false
            referencedRelation: "gl_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_shipping_records_account2"
            columns: ["sb_account2_id"]
            isOneToOne: false
            referencedRelation: "gl_account_dashboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_shipping_records_account2"
            columns: ["sb_account2_id"]
            isOneToOne: false
            referencedRelation: "gl_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_shipping_records_account3"
            columns: ["sb_account3_id"]
            isOneToOne: false
            referencedRelation: "gl_account_dashboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_shipping_records_account3"
            columns: ["sb_account3_id"]
            isOneToOne: false
            referencedRelation: "gl_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_shipping_records_invoices"
            columns: ["sb_invoices_id"]
            isOneToOne: false
            referencedRelation: "gl_invoice_details"
            referencedColumns: ["invoice_id"]
          },
          {
            foreignKeyName: "fk_shipping_records_invoices"
            columns: ["sb_invoices_id"]
            isOneToOne: false
            referencedRelation: "gl_invoice_totals"
            referencedColumns: ["invoice_id"]
          },
          {
            foreignKeyName: "fk_shipping_records_invoices"
            columns: ["sb_invoices_id"]
            isOneToOne: false
            referencedRelation: "gl_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_shipping_records_invoices"
            columns: ["sb_invoices_id"]
            isOneToOne: false
            referencedRelation: "gl_order_fulfillment"
            referencedColumns: ["invoice_id"]
          },
        ]
      }
      gl_sync_audit: {
        Row: {
          created_at: string | null
          details: Json | null
          id: string
          operation: string
          record_id: string | null
          table_name: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          details?: Json | null
          id?: string
          operation: string
          record_id?: string | null
          table_name: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          details?: Json | null
          id?: string
          operation?: string
          record_id?: string | null
          table_name?: string
          user_id?: string | null
        }
        Relationships: []
      }
      gl_sync_errors: {
        Row: {
          created_at: string | null
          error_message: string
          error_type: string
          id: string
          mapping_id: string
          record_data: Json | null
          resolution_notes: string | null
          resolved: boolean | null
          resolved_at: string | null
          retried: boolean | null
          retried_at: string | null
          retryable: boolean | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          error_message: string
          error_type: string
          id?: string
          mapping_id: string
          record_data?: Json | null
          resolution_notes?: string | null
          resolved?: boolean | null
          resolved_at?: string | null
          retried?: boolean | null
          retried_at?: string | null
          retryable?: boolean | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          error_message?: string
          error_type?: string
          id?: string
          mapping_id?: string
          record_data?: Json | null
          resolution_notes?: string | null
          resolved?: boolean | null
          resolved_at?: string | null
          retried?: boolean | null
          retried_at?: string | null
          retryable?: boolean | null
          updated_at?: string | null
        }
        Relationships: []
      }
      gl_sync_logs: {
        Row: {
          completed_at: string | null
          created_at: string | null
          id: string
          mapping_id: string | null
          message: string | null
          records_processed: number | null
          started_at: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          id?: string
          mapping_id?: string | null
          message?: string | null
          records_processed?: number | null
          started_at?: string | null
          status: string
          updated_at?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          id?: string
          mapping_id?: string | null
          message?: string | null
          records_processed?: number | null
          started_at?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      gl_vendor_payments: {
        Row: {
          amount: number | null
          created_at: string | null
          date_of_payment: string | null
          glide_row_id: string
          id: string
          last_modified_at: string | null
          last_sync_time: string | null
          main_date_of_payment: string | null
          main_payment_amount: number | null
          main_payment_method: string | null
          main_vendor_purchase_note: string | null
          notes: string | null
          payment_date: string | null
          payment_method: string | null
          purchase_order_id: string | null
          rowid_accounts: string | null
          rowid_po_rowid: string | null
          sb_accounts_id: string | null
          sb_purchase_orders_id: string | null
          sync_status: string | null
          updated_at: string | null
        }
        Insert: {
          amount?: number | null
          created_at?: string | null
          date_of_payment?: string | null
          glide_row_id: string
          id?: string
          last_modified_at?: string | null
          last_sync_time?: string | null
          main_date_of_payment?: string | null
          main_payment_amount?: number | null
          main_payment_method?: string | null
          main_vendor_purchase_note?: string | null
          notes?: string | null
          payment_date?: string | null
          payment_method?: string | null
          purchase_order_id?: string | null
          rowid_accounts?: string | null
          rowid_po_rowid?: string | null
          sb_accounts_id?: string | null
          sb_purchase_orders_id?: string | null
          sync_status?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number | null
          created_at?: string | null
          date_of_payment?: string | null
          glide_row_id?: string
          id?: string
          last_modified_at?: string | null
          last_sync_time?: string | null
          main_date_of_payment?: string | null
          main_payment_amount?: number | null
          main_payment_method?: string | null
          main_vendor_purchase_note?: string | null
          notes?: string | null
          payment_date?: string | null
          payment_method?: string | null
          purchase_order_id?: string | null
          rowid_accounts?: string | null
          rowid_po_rowid?: string | null
          sb_accounts_id?: string | null
          sb_purchase_orders_id?: string | null
          sync_status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_vendor_payments_accounts"
            columns: ["sb_accounts_id"]
            isOneToOne: false
            referencedRelation: "gl_account_dashboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_vendor_payments_accounts"
            columns: ["sb_accounts_id"]
            isOneToOne: false
            referencedRelation: "gl_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_vendor_payments_purchase_orders"
            columns: ["sb_purchase_orders_id"]
            isOneToOne: false
            referencedRelation: "gl_purchase_order_totals"
            referencedColumns: ["po_id"]
          },
          {
            foreignKeyName: "fk_vendor_payments_purchase_orders"
            columns: ["sb_purchase_orders_id"]
            isOneToOne: false
            referencedRelation: "gl_purchase_orders"
            referencedColumns: ["id"]
          },
        ]
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
<<<<<<< HEAD
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
=======
>>>>>>> newmai
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
            referencedRelation: "messages_view"
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
            referencedRelation: "v_messages_compatibility"
            referencedColumns: ["id"]
          },
        ]
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
      gl_account_dashboard: {
        Row: {
          account_name: string | null
          client_type: string | null
          id: string | null
          last_invoice_date: string | null
          last_payment_date: string | null
          total_credits: number | null
          total_estimates: number | null
          total_invoices: number | null
          total_paid: number | null
          total_payments: number | null
        }
        Relationships: []
      }
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
          estimate_id: string | null
          glide_row_id: string | null
          last_updated: string | null
          total_amount: number | null
          total_credits: number | null
          total_items: number | null
        }
        Relationships: []
      }
      gl_financial_summary: {
        Row: {
          expense_count: number | null
          invoice_count: number | null
          month: string | null
          net_income: number | null
          payment_count: number | null
          total_expenses: number | null
          total_payments: number | null
          total_sales: number | null
        }
        Relationships: []
      }
      gl_invoice_details: {
        Row: {
          account_name: string | null
          amount_paid: number | null
          client_type: string | null
          created_timestamp: string | null
          glide_row_id: string | null
          has_shipping: boolean | null
          invoice_id: string | null
          invoice_order_date: string | null
          payment_status: string | null
          total_amount: number | null
          tracking_number: string | null
        }
        Relationships: []
      }
      gl_invoice_totals: {
        Row: {
          balance: number | null
          glide_row_id: string | null
          invoice_id: string | null
          last_updated: string | null
          total_amount: number | null
          total_items: number | null
          total_paid: number | null
        }
        Relationships: []
      }
      gl_mapping_status: {
        Row: {
          app_id: string | null
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
        Relationships: []
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
      gl_payment_history: {
        Row: {
          date_of_payment: string | null
          document_id: string | null
          document_type: string | null
          entity_name: string | null
          entity_type: string | null
          payment_amount: number | null
          payment_id: string | null
          payment_note: string | null
          payment_type: string | null
        }
        Relationships: []
      }
      gl_product_inventory: {
        Row: {
          category: string | null
          current_stock: number | null
          glide_row_id: string | null
          id: string | null
          last_sale_date: string | null
          new_product_name: string | null
          times_sold: number | null
          total_qty_purchased: number | null
          total_qty_sold: number | null
          unit_cost: number | null
          vendor_product_name: string | null
        }
        Relationships: []
      }
      gl_purchase_order_totals: {
        Row: {
          balance: number | null
          glide_row_id: string | null
          last_updated: string | null
          po_id: string | null
          total_amount: number | null
          total_items: number | null
          total_paid: number | null
        }
        Relationships: []
      }
      gl_recent_logs: {
        Row: {
          app_name: string | null
          completed_at: string | null
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
      gl_sync_status: {
        Row: {
          error_count: number | null
          last_operation: string | null
          last_sync_time: string | null
          sync_status: string | null
          table_name: string | null
        }
        Relationships: []
      }
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
            referencedRelation: "messages_view"
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
            referencedRelation: "v_messages_compatibility"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      add_column_if_not_exists: {
        Args: {
          p_table_name: string
          p_column_name: string
          p_data_type: string
          p_nullable?: boolean
          p_default_value?: string
        }
        Returns: undefined
      }
      add_fk_if_not_exists: {
        Args: {
          p_table_name: string
          p_column_name: string
          p_ref_table: string
          p_ref_column: string
          p_constraint_name: string
          p_on_delete?: string
        }
        Returns: undefined
      }
      add_index_if_not_exists: {
        Args: {
          p_table_name: string
          p_column_name: string
          p_index_name: string
          p_index_type?: string
        }
        Returns: undefined
      }
      add_unique_constraint_if_not_exists: {
        Args: {
          p_table_name: string
          p_column_name: string
          p_constraint_name: string
        }
        Returns: undefined
      }
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
      create_rls_policies_for_glsync: {
        Args: Record<PropertyKey, never>
        Returns: undefined
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
      find_duplicate_accounts: {
        Args: Record<PropertyKey, never>
        Returns: {
          glide_row_id: string
          account_name: string
          accounts_uid: string
          duplicate_count: number
        }[]
      }
      find_duplicate_invoices: {
        Args: Record<PropertyKey, never>
        Returns: {
          glide_row_id: string
          invoice_uid: string
          invoice_date: string
          duplicate_count: number
        }[]
      }
      find_duplicate_products: {
        Args: Record<PropertyKey, never>
        Returns: {
          glide_row_id: string
          product_name: string
          product_code: string
          duplicate_count: number
        }[]
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
      get_make_event_status_summary: {
        Args: Record<PropertyKey, never>
        Returns: {
          status: string
          count: number
        }[]
      }
      gl_admin_execute_sql: {
        Args: {
          sql_query: string
        }
        Returns: undefined
      }
      gl_clean_null_values: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      gl_count_table_records: {
        Args: {
          table_name: string
          search_term?: string
        }
        Returns: number
      }
      gl_get_account_stats: {
        Args: Record<PropertyKey, never>
        Returns: {
          customer_count: number
          vendor_count: number
          dual_count: number
          total_count: number
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
      gl_get_schema_tables: {
        Args: Record<PropertyKey, never>
        Returns: {
          table_name: string
          table_type: string
          table_schema: string
        }[]
      }
      gl_get_schema_tables_fixed: {
        Args: Record<PropertyKey, never>
        Returns: {
          table_name: string
          table_type: string
          table_schema: string
        }[]
      }
      gl_get_sync_errors:
        | {
            Args: {
              p_mapping_id: string
              p_limit?: number
              p_include_resolved?: boolean
            }
            Returns: {
              id: string
              mapping_id: string
              error_type: string
              error_message: string
              record_data: Json
              retryable: boolean
              created_at: string
              resolved_at: string
              resolution_notes: string
            }[]
          }
        | {
            Args: {
              p_mapping_id: string
              p_limit?: number
              p_include_resolved?: boolean
            }
            Returns: {
              id: string
              mapping_id: string
              error_type: string
              error_message: string
              record_data: Json
              retryable: boolean
              created_at: string
              resolved_at: string
              resolution_notes: string
              retried: boolean
              retried_at: string
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
      gl_get_table_records: {
        Args: {
          table_name: string
          page?: number
          page_size?: number
          search_term?: string
        }
        Returns: Json[]
      }
      gl_import_data_from_json: {
        Args: {
          table_name: string
          data: Json
        }
        Returns: number
      }
      gl_is_customer: {
        Args: {
          account_type: string
        }
        Returns: boolean
      }
      gl_is_vendor: {
        Args: {
          account_type: string
        }
        Returns: boolean
      }
      gl_log_migration_completion: {
        Args: {
          migration_name: string
          status: string
          details?: Json
        }
        Returns: string
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
      gl_repair_relationships: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      gl_resolve_sync_error: {
        Args: {
          p_error_id: string
          p_resolution_notes?: string
        }
        Returns: boolean
      }
      gl_retry_failed_sync: {
        Args: {
          p_mapping_id: string
        }
        Returns: string
      }
      gl_sync_data: {
        Args: {
          connection_id: string
          mapping_id: string
        }
        Returns: Json
      }
      gl_validate_column_mapping:
        | {
            Args: {
              p_mapping_id: string
            }
            Returns: {
              is_valid: boolean
              validation_message: string
            }[]
          }
        | {
            Args: {
              p_mapping_id: string
            }
            Returns: {
              is_valid: boolean
              validation_message: string
            }[]
          }
      glsync_get_account_summary: {
        Args: {
          account_id: string
        }
        Returns: Json
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
      manually_create_invoice_from_estimate: {
        Args: {
          p_estimate_id: string
        }
        Returns: string
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
      sync_glide_configuration: {
        Args: Record<PropertyKey, never>
        Returns: undefined
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
      validate_table_relationships: {
        Args: {
          p_table_name: string
        }
        Returns: {
          issue_type: string
          glide_column: string
          supabase_column: string
          affected_records: number
        }[]
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
<<<<<<< HEAD
      xan_categorize_sync_error: {
        Args: {
          error_message: string
        }
        Returns: string
      }
      xan_cleanup_sync_queue: {
        Args: Record<PropertyKey, never>
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
      xan_fix_vendor_payments: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      xan_generate_share_id: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      xan_get_error_stats_by_category: {
        Args: {
          p_start_date?: string
          p_end_date?: string
        }
        Returns: {
          error_category: string
          count: number
          latest_error_message: string
          latest_error_time: string
        }[]
      }
      xan_get_purchase_orders_with_accounts: {
        Args: {
          p_limit?: number
          p_offset?: number
        }
        Returns: {
          id: string
          glide_id: string
          main_po_date: string
          rowid_accntrowid: string
          main_purchase_order_uid: string
          doc_document: string
          main_po_total: number
          main_balance_due: number
          sb_accounts_id: string
          gl_accounts: Json
          has_issues: boolean
          created_at: string
          updated_at: string
          products_count: number
          payments_count: number
        }[]
      }
      xan_get_recent_validation_errors: {
        Args: {
          p_limit?: number
        }
        Returns: {
          table_name: string
          record_id: string
          validation_type: string
          error_message: string
          created_at: string
        }[]
      }
      xan_get_record_validation_errors: {
        Args: {
          p_table_name: string
          p_record_id: string
        }
        Returns: {
          created_at: string
          error_message: string
          id: string
          is_resolved: boolean | null
          record_id: string
          resolved_at: string | null
          table_name: string
          validation_type: string
        }[]
      }
      xan_get_relationship_health: {
        Args: Record<PropertyKey, never>
        Returns: {
          source_table: string
          glide_column: string
          supabase_column: string
          reference_table: string
          missing_count: number
          valid_mappings: number
          last_sync_time: string
          is_active: boolean
        }[]
      }
      xan_log_validation_error: {
        Args: {
          p_table_name: string
          p_record_id: string
          p_validation_type: string
          p_error_message: string
        }
        Returns: string
      }
      xan_perform_maintenance: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      xan_recalculate_entity_totals: {
        Args: Record<PropertyKey, never>
        Returns: {
          entity_type: string
          records_updated: number
        }[]
      }
      xan_recalculate_purchase_order_totals: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      xan_repair_relationships: {
        Args: {
          p_table_name?: string
        }
        Returns: Json
      }
      xan_repair_table_relationships: {
        Args: {
          p_table_name: string
        }
        Returns: {
          fixed_count: number
        }[]
      }
      xan_run_data_repair: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      xan_run_pdf_generation: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      xan_store_relationship_validation_history: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      xan_sync_glide_configuration: {
        Args: {
          table_name: string
        }
        Returns: undefined
      }
      xan_update_share_view_stats: {
        Args: {
          po_id: string
        }
        Returns: undefined
      }
      xan_validate_all_invoices: {
        Args: Record<PropertyKey, never>
        Returns: {
          validated_count: number
          error_count: number
        }[]
      }
=======
      xdelo_add_missing_columns_to_other_messages: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
>>>>>>> newmai
      xdelo_check_media_group_content: {
        Args: {
          p_media_group_id: string
          p_message_id: string
          p_correlation_id?: string
        }
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
      xdelo_update_message_with_analyzed_content:
        | {
            Args: {
              p_message_id: string
              p_analyzed_content: Json
              p_correlation_id?: string
            }
            Returns: Json
          }
        | {
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
