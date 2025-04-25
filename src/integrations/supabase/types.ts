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
          account_id: string | null
          created_at: string
          id: number
          rowid_accounts: string
        }
        Insert: {
          account_id?: string | null
          created_at?: string
          id?: number
          rowid_accounts: string
        }
        Update: {
          account_id?: string | null
          created_at?: string
          id?: number
          rowid_accounts?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_account_id"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "gl_account_invoice_relations"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "fk_account_id"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "gl_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_account_id"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "mv_account_finance_summary"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "fk_account_id"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "mv_customer_aging"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "fk_account_id"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "mv_vendor_aging"
            referencedColumns: ["account_id"]
          },
        ]
      }
      apps: {
        Row: {
          app_identifier: string
          created_at: string | null
          id: string
          name: string | null
        }
        Insert: {
          app_identifier: string
          created_at?: string | null
          id?: string
          name?: string | null
        }
        Update: {
          app_identifier?: string
          created_at?: string | null
          id?: string
          name?: string | null
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
        Relationships: [
          {
            foreignKeyName: "fk_message_caption_id"
            columns: ["message_caption_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_original_message_id"
            columns: ["original_message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
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
      gl_account_invoice_junction: {
        Row: {
          account_glide_row_id: string
          account_id: string | null
          created_at: string | null
          id: string
          invoice_id: string | null
          invoice_rowid_accounts: string
        }
        Insert: {
          account_glide_row_id: string
          account_id?: string | null
          created_at?: string | null
          id?: string
          invoice_id?: string | null
          invoice_rowid_accounts: string
        }
        Update: {
          account_glide_row_id?: string
          account_id?: string | null
          created_at?: string | null
          id?: string
          invoice_id?: string | null
          invoice_rowid_accounts?: string
        }
        Relationships: [
          {
            foreignKeyName: "gl_account_invoice_junction_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "gl_account_invoice_relations"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "gl_account_invoice_junction_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "gl_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gl_account_invoice_junction_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "mv_account_finance_summary"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "gl_account_invoice_junction_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "mv_customer_aging"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "gl_account_invoice_junction_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "mv_vendor_aging"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "gl_account_invoice_junction_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "gl_account_invoice_relations"
            referencedColumns: ["invoice_id"]
          },
          {
            foreignKeyName: "gl_account_invoice_junction_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "gl_invoices"
            referencedColumns: ["id"]
          },
        ]
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
          is_customer: boolean | null
          is_vendor: boolean | null
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
          is_customer?: boolean | null
          is_vendor?: boolean | null
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
          is_customer?: boolean | null
          is_vendor?: boolean | null
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
          app_uuid: string | null
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
          app_uuid?: string | null
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
          app_uuid?: string | null
          created_at?: string | null
          id?: string
          last_sync?: string | null
          settings?: Json | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_app_uuid"
            columns: ["app_uuid"]
            isOneToOne: false
            referencedRelation: "apps"
            referencedColumns: ["id"]
          },
        ]
      }
      gl_customer_credits: {
        Row: {
          account_id: string | null
          created_at: string | null
          date_of_payment: string | null
          estimate_id: string | null
          glide_row_id: string
          id: string
          invoice_id: string | null
          payment_amount: number | null
          payment_document_type: string | null
          payment_note: string | null
          payment_type: string | null
          rowid_accounts: string | null
          rowid_estimates: string | null
          rowid_invoices: string | null
          updated_at: string | null
        }
        Insert: {
          account_id?: string | null
          created_at?: string | null
          date_of_payment?: string | null
          estimate_id?: string | null
          glide_row_id: string
          id?: string
          invoice_id?: string | null
          payment_amount?: number | null
          payment_document_type?: string | null
          payment_note?: string | null
          payment_type?: string | null
          rowid_accounts?: string | null
          rowid_estimates?: string | null
          rowid_invoices?: string | null
          updated_at?: string | null
        }
        Update: {
          account_id?: string | null
          created_at?: string | null
          date_of_payment?: string | null
          estimate_id?: string | null
          glide_row_id?: string
          id?: string
          invoice_id?: string | null
          payment_amount?: number | null
          payment_document_type?: string | null
          payment_note?: string | null
          payment_type?: string | null
          rowid_accounts?: string | null
          rowid_estimates?: string | null
          rowid_invoices?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_account_id"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "gl_account_invoice_relations"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "fk_account_id"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "gl_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_account_id"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "mv_account_finance_summary"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "fk_account_id"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "mv_customer_aging"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "fk_account_id"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "mv_vendor_aging"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "fk_estimate_id"
            columns: ["estimate_id"]
            isOneToOne: false
            referencedRelation: "gl_estimates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_invoice_id"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "gl_account_invoice_relations"
            referencedColumns: ["invoice_id"]
          },
          {
            foreignKeyName: "fk_invoice_id"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "gl_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      gl_customer_payments: {
        Row: {
          account_id: string | null
          created_at: string | null
          date_of_payment: string | null
          email_of_user: string | null
          estimate_id: string | null
          glide_row_id: string
          id: string
          invoice_id: string | null
          payment_amount: number | null
          payment_document_type: string | null
          payment_note: string | null
          payment_type: string | null
          rowid_accounts: string | null
          rowid_invoices: string | null
          updated_at: string | null
        }
        Insert: {
          account_id?: string | null
          created_at?: string | null
          date_of_payment?: string | null
          email_of_user?: string | null
          estimate_id?: string | null
          glide_row_id: string
          id?: string
          invoice_id?: string | null
          payment_amount?: number | null
          payment_document_type?: string | null
          payment_note?: string | null
          payment_type?: string | null
          rowid_accounts?: string | null
          rowid_invoices?: string | null
          updated_at?: string | null
        }
        Update: {
          account_id?: string | null
          created_at?: string | null
          date_of_payment?: string | null
          email_of_user?: string | null
          estimate_id?: string | null
          glide_row_id?: string
          id?: string
          invoice_id?: string | null
          payment_amount?: number | null
          payment_document_type?: string | null
          payment_note?: string | null
          payment_type?: string | null
          rowid_accounts?: string | null
          rowid_invoices?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_account_id"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "gl_account_invoice_relations"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "fk_account_id"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "gl_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_account_id"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "mv_account_finance_summary"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "fk_account_id"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "mv_customer_aging"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "fk_account_id"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "mv_vendor_aging"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "fk_customer_payments_account"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "gl_account_invoice_relations"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "fk_customer_payments_account"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "gl_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_customer_payments_account"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "mv_account_finance_summary"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "fk_customer_payments_account"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "mv_customer_aging"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "fk_customer_payments_account"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "mv_vendor_aging"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "fk_customer_payments_invoice"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "gl_account_invoice_relations"
            referencedColumns: ["invoice_id"]
          },
          {
            foreignKeyName: "fk_customer_payments_invoice"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "gl_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_invoice_id"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "gl_account_invoice_relations"
            referencedColumns: ["invoice_id"]
          },
          {
            foreignKeyName: "fk_invoice_id"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "gl_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_payment_account"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "gl_account_invoice_relations"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "fk_payment_account"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "gl_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_payment_account"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "mv_account_finance_summary"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "fk_payment_account"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "mv_customer_aging"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "fk_payment_account"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "mv_vendor_aging"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "fk_payment_invoice"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "gl_account_invoice_relations"
            referencedColumns: ["invoice_id"]
          },
          {
            foreignKeyName: "fk_payment_invoice"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "gl_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      gl_estimate_lines: {
        Row: {
          created_at: string | null
          date_of_sale: string | null
          estimate_id: string | null
          glide_row_id: string | null
          id: string
          line_total: number | null
          product_id: string | null
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
          estimate_id?: string | null
          glide_row_id?: string | null
          id?: string
          line_total?: number | null
          product_id?: string | null
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
          estimate_id?: string | null
          glide_row_id?: string | null
          id?: string
          line_total?: number | null
          product_id?: string | null
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
        Relationships: [
          {
            foreignKeyName: "fk_product_id"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "gl_inventory_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_product_id"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "gl_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_product_id"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "mv_product_sales_summary"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "fk_product_id"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_sales"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "gl_estimate_lines_estimate_id_fkey"
            columns: ["estimate_id"]
            isOneToOne: false
            referencedRelation: "gl_estimates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gl_estimate_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "gl_inventory_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gl_estimate_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "gl_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gl_estimate_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "mv_product_sales_summary"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "gl_estimate_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_sales"
            referencedColumns: ["product_id"]
          },
        ]
      }
      gl_estimates: {
        Row: {
          account_id: string | null
          amount: number | null
          balance: number | null
          created_at: string | null
          date: string | null
          date_invoice_created: string | null
          estimate_date: string | null
          estimate_number: string | null
          estimate_uid: string | null
          glide_pdf_url: string | null
          glide_pdf_url_secondary: string | null
          glide_row_id: string | null
          id: string
          invoice_id: string | null
          is_a_sample: boolean | null
          is_invoice_created: boolean | null
          is_note_added: boolean | null
          notes: string | null
          number: string | null
          rowid_accounts: string | null
          rowid_invoices: string | null
          status: string | null
          supabase_pdf_url: string | null
          total_amount: number | null
          total_credits: number | null
          updated_at: string | null
        }
        Insert: {
          account_id?: string | null
          amount?: number | null
          balance?: number | null
          created_at?: string | null
          date?: string | null
          date_invoice_created?: string | null
          estimate_date?: string | null
          estimate_number?: string | null
          estimate_uid?: string | null
          glide_pdf_url?: string | null
          glide_pdf_url_secondary?: string | null
          glide_row_id?: string | null
          id?: string
          invoice_id?: string | null
          is_a_sample?: boolean | null
          is_invoice_created?: boolean | null
          is_note_added?: boolean | null
          notes?: string | null
          number?: string | null
          rowid_accounts?: string | null
          rowid_invoices?: string | null
          status?: string | null
          supabase_pdf_url?: string | null
          total_amount?: number | null
          total_credits?: number | null
          updated_at?: string | null
        }
        Update: {
          account_id?: string | null
          amount?: number | null
          balance?: number | null
          created_at?: string | null
          date?: string | null
          date_invoice_created?: string | null
          estimate_date?: string | null
          estimate_number?: string | null
          estimate_uid?: string | null
          glide_pdf_url?: string | null
          glide_pdf_url_secondary?: string | null
          glide_row_id?: string | null
          id?: string
          invoice_id?: string | null
          is_a_sample?: boolean | null
          is_invoice_created?: boolean | null
          is_note_added?: boolean | null
          notes?: string | null
          number?: string | null
          rowid_accounts?: string | null
          rowid_invoices?: string | null
          status?: string | null
          supabase_pdf_url?: string | null
          total_amount?: number | null
          total_credits?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_account_id"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "gl_account_invoice_relations"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "fk_account_id"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "gl_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_account_id"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "mv_account_finance_summary"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "fk_account_id"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "mv_customer_aging"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "fk_account_id"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "mv_vendor_aging"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "fk_invoice_id"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "gl_account_invoice_relations"
            referencedColumns: ["invoice_id"]
          },
          {
            foreignKeyName: "fk_invoice_id"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "gl_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gl_estimates_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "gl_account_invoice_relations"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "gl_estimates_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "gl_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gl_estimates_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "mv_account_finance_summary"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "gl_estimates_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "mv_customer_aging"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "gl_estimates_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "mv_vendor_aging"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "gl_estimates_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "gl_account_invoice_relations"
            referencedColumns: ["invoice_id"]
          },
          {
            foreignKeyName: "gl_estimates_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "gl_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      gl_expense_categories: {
        Row: {
          created_at: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      gl_expenses: {
        Row: {
          amount: number | null
          category: string | null
          category_id: string | null
          created_at: string | null
          date_of_expense: string | null
          expense_address: string | null
          expense_cash: string | null
          expense_change: string | null
          expense_date: string | null
          expense_list_of_items: string | null
          expense_receipt_image: string | null
          expense_supplier_name: string | null
          expense_tax: string | null
          expense_text_to_json: string | null
          expense_total: string | null
          expense_type: string | null
          glide_row_id: string | null
          id: string
          is_processing: boolean | null
          last_modified_by: string | null
          notes: string | null
          status: string | null
          submitted_by: string | null
          total_amount: number | null
          updated_at: string | null
        }
        Insert: {
          amount?: number | null
          category?: string | null
          category_id?: string | null
          created_at?: string | null
          date_of_expense?: string | null
          expense_address?: string | null
          expense_cash?: string | null
          expense_change?: string | null
          expense_date?: string | null
          expense_list_of_items?: string | null
          expense_receipt_image?: string | null
          expense_supplier_name?: string | null
          expense_tax?: string | null
          expense_text_to_json?: string | null
          expense_total?: string | null
          expense_type?: string | null
          glide_row_id?: string | null
          id?: string
          is_processing?: boolean | null
          last_modified_by?: string | null
          notes?: string | null
          status?: string | null
          submitted_by?: string | null
          total_amount?: number | null
          updated_at?: string | null
        }
        Update: {
          amount?: number | null
          category?: string | null
          category_id?: string | null
          created_at?: string | null
          date_of_expense?: string | null
          expense_address?: string | null
          expense_cash?: string | null
          expense_change?: string | null
          expense_date?: string | null
          expense_list_of_items?: string | null
          expense_receipt_image?: string | null
          expense_supplier_name?: string | null
          expense_tax?: string | null
          expense_text_to_json?: string | null
          expense_total?: string | null
          expense_type?: string | null
          glide_row_id?: string | null
          id?: string
          is_processing?: boolean | null
          last_modified_by?: string | null
          notes?: string | null
          status?: string | null
          submitted_by?: string | null
          total_amount?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_category_id"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "gl_expense_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      gl_invoice_lines: {
        Row: {
          created_at: string | null
          date_of_sale: string | null
          glide_row_id: string
          id: string
          invoice_id: string | null
          line_total: number | null
          product_id: string | null
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
          invoice_id?: string | null
          line_total?: number | null
          product_id?: string | null
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
          invoice_id?: string | null
          line_total?: number | null
          product_id?: string | null
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
        Relationships: [
          {
            foreignKeyName: "fk_invoice_line_product"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "gl_inventory_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_invoice_line_product"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "gl_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_invoice_line_product"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "mv_product_sales_summary"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "fk_invoice_line_product"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_sales"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "fk_product_id"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "gl_inventory_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_product_id"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "gl_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_product_id"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "mv_product_sales_summary"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "fk_product_id"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_sales"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "gl_invoice_lines_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "gl_account_invoice_relations"
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
            foreignKeyName: "gl_invoice_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "gl_inventory_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gl_invoice_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "gl_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gl_invoice_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "mv_product_sales_summary"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "gl_invoice_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_sales"
            referencedColumns: ["product_id"]
          },
        ]
      }
      gl_invoices: {
        Row: {
          account_id: string | null
          amount: number | null
          balance: number | null
          created_at: string | null
          created_timestamp: string | null
          date: string | null
          date_of_invoice: string | null
          glide_pdf_url: string | null
          glide_row_id: string
          id: string
          invoice_order_date: string | null
          invoice_uid: string | null
          is_processed: boolean | null
          notes: string | null
          number: string | null
          payment_status: string | null
          rowid_accounts: string | null
          status: string | null
          submitted_timestamp: string | null
          supabase_pdf_url: string | null
          total_amount: number | null
          total_paid: number | null
          updated_at: string | null
          user_email: string | null
        }
        Insert: {
          account_id?: string | null
          amount?: number | null
          balance?: number | null
          created_at?: string | null
          created_timestamp?: string | null
          date?: string | null
          date_of_invoice?: string | null
          glide_pdf_url?: string | null
          glide_row_id: string
          id?: string
          invoice_order_date?: string | null
          invoice_uid?: string | null
          is_processed?: boolean | null
          notes?: string | null
          number?: string | null
          payment_status?: string | null
          rowid_accounts?: string | null
          status?: string | null
          submitted_timestamp?: string | null
          supabase_pdf_url?: string | null
          total_amount?: number | null
          total_paid?: number | null
          updated_at?: string | null
          user_email?: string | null
        }
        Update: {
          account_id?: string | null
          amount?: number | null
          balance?: number | null
          created_at?: string | null
          created_timestamp?: string | null
          date?: string | null
          date_of_invoice?: string | null
          glide_pdf_url?: string | null
          glide_row_id?: string
          id?: string
          invoice_order_date?: string | null
          invoice_uid?: string | null
          is_processed?: boolean | null
          notes?: string | null
          number?: string | null
          payment_status?: string | null
          rowid_accounts?: string | null
          status?: string | null
          submitted_timestamp?: string | null
          supabase_pdf_url?: string | null
          total_amount?: number | null
          total_paid?: number | null
          updated_at?: string | null
          user_email?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_account_id"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "gl_account_invoice_relations"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "fk_account_id"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "gl_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_account_id"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "mv_account_finance_summary"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "fk_account_id"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "mv_customer_aging"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "fk_account_id"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "mv_vendor_aging"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "fk_invoice_account"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "gl_account_invoice_relations"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "fk_invoice_account"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "gl_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_invoice_account"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "mv_account_finance_summary"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "fk_invoice_account"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "mv_customer_aging"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "fk_invoice_account"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "mv_vendor_aging"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "gl_invoices_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "gl_account_invoice_relations"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "gl_invoices_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "gl_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gl_invoices_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "mv_account_finance_summary"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "gl_invoices_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "mv_customer_aging"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "gl_invoices_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "mv_vendor_aging"
            referencedColumns: ["account_id"]
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
            foreignKeyName: "fk_connection_id"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "gl_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gl_mappings_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "gl_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      gl_payments: {
        Row: {
          amount: number | null
          created_at: string | null
          glide_row_id: string | null
          id: string
          invoice_id: string | null
          notes: string | null
          payment_date: string | null
          payment_method: string | null
          reference_number: string | null
          updated_at: string | null
        }
        Insert: {
          amount?: number | null
          created_at?: string | null
          glide_row_id?: string | null
          id?: string
          invoice_id?: string | null
          notes?: string | null
          payment_date?: string | null
          payment_method?: string | null
          reference_number?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number | null
          created_at?: string | null
          glide_row_id?: string | null
          id?: string
          invoice_id?: string | null
          notes?: string | null
          payment_date?: string | null
          payment_method?: string | null
          reference_number?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gl_payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "gl_account_invoice_relations"
            referencedColumns: ["invoice_id"]
          },
          {
            foreignKeyName: "gl_payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "gl_invoices"
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
          name: string | null
          new_product_name: string | null
          new_product_sku: string | null
          po_date: string | null
          price: number | null
          product_image1: string | null
          product_sku: string | null
          public_url_photo: string | null
          public_url_video: string | null
          purchase_note: string | null
          purchase_order_id: string | null
          purchase_order_uid: string | null
          rowid_accounts: string | null
          rowid_purchase_orders: string | null
          rowid_vendor_payments: string | null
          sku: string | null
          supabase_pdf_url: string | null
          terms_for_fronted_product: string | null
          total_cost: number | null
          total_qty_purchased: number | null
          total_units_behind_sample: number | null
          updated_at: string | null
          vendor_account_id: string | null
          vendor_payment_id: string | null
          vendor_product_name: string | null
          vendor_uid: string | null
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
          name?: string | null
          new_product_name?: string | null
          new_product_sku?: string | null
          po_date?: string | null
          price?: number | null
          product_image1?: string | null
          product_sku?: string | null
          public_url_photo?: string | null
          public_url_video?: string | null
          purchase_note?: string | null
          purchase_order_id?: string | null
          purchase_order_uid?: string | null
          rowid_accounts?: string | null
          rowid_purchase_orders?: string | null
          rowid_vendor_payments?: string | null
          sku?: string | null
          supabase_pdf_url?: string | null
          terms_for_fronted_product?: string | null
          total_cost?: number | null
          total_qty_purchased?: number | null
          total_units_behind_sample?: number | null
          updated_at?: string | null
          vendor_account_id?: string | null
          vendor_payment_id?: string | null
          vendor_product_name?: string | null
          vendor_uid?: string | null
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
          name?: string | null
          new_product_name?: string | null
          new_product_sku?: string | null
          po_date?: string | null
          price?: number | null
          product_image1?: string | null
          product_sku?: string | null
          public_url_photo?: string | null
          public_url_video?: string | null
          purchase_note?: string | null
          purchase_order_id?: string | null
          purchase_order_uid?: string | null
          rowid_accounts?: string | null
          rowid_purchase_orders?: string | null
          rowid_vendor_payments?: string | null
          sku?: string | null
          supabase_pdf_url?: string | null
          terms_for_fronted_product?: string | null
          total_cost?: number | null
          total_qty_purchased?: number | null
          total_units_behind_sample?: number | null
          updated_at?: string | null
          vendor_account_id?: string | null
          vendor_payment_id?: string | null
          vendor_product_name?: string | null
          vendor_uid?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gl_products_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "gl_purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gl_products_vendor_account_id_fkey"
            columns: ["vendor_account_id"]
            isOneToOne: false
            referencedRelation: "gl_account_invoice_relations"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "gl_products_vendor_account_id_fkey"
            columns: ["vendor_account_id"]
            isOneToOne: false
            referencedRelation: "gl_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gl_products_vendor_account_id_fkey"
            columns: ["vendor_account_id"]
            isOneToOne: false
            referencedRelation: "mv_account_finance_summary"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "gl_products_vendor_account_id_fkey"
            columns: ["vendor_account_id"]
            isOneToOne: false
            referencedRelation: "mv_customer_aging"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "gl_products_vendor_account_id_fkey"
            columns: ["vendor_account_id"]
            isOneToOne: false
            referencedRelation: "mv_vendor_aging"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "gl_products_vendor_payment_id_fkey"
            columns: ["vendor_payment_id"]
            isOneToOne: false
            referencedRelation: "gl_vendor_payments"
            referencedColumns: ["id"]
          },
        ]
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
          vendor_account_id: string | null
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
          vendor_account_id?: string | null
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
          vendor_account_id?: string | null
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
          account_id: string | null
          created_at: string | null
          date_of_payment: string | null
          date_of_purchase_order: string | null
          glide_row_id: string
          id: string
          payment_amount: number | null
          payment_document_type: string | null
          product_id: string | null
          purchase_order_id: string | null
          rowid_accounts: string | null
          rowid_products: string | null
          rowid_purchase_orders: string | null
          updated_at: string | null
          vendor_note: string | null
        }
        Insert: {
          account_id?: string | null
          created_at?: string | null
          date_of_payment?: string | null
          date_of_purchase_order?: string | null
          glide_row_id: string
          id?: string
          payment_amount?: number | null
          payment_document_type?: string | null
          product_id?: string | null
          purchase_order_id?: string | null
          rowid_accounts?: string | null
          rowid_products?: string | null
          rowid_purchase_orders?: string | null
          updated_at?: string | null
          vendor_note?: string | null
        }
        Update: {
          account_id?: string | null
          created_at?: string | null
          date_of_payment?: string | null
          date_of_purchase_order?: string | null
          glide_row_id?: string
          id?: string
          payment_amount?: number | null
          payment_document_type?: string | null
          product_id?: string | null
          purchase_order_id?: string | null
          rowid_accounts?: string | null
          rowid_products?: string | null
          rowid_purchase_orders?: string | null
          updated_at?: string | null
          vendor_note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_account_id"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "gl_account_invoice_relations"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "fk_account_id"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "gl_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_account_id"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "mv_account_finance_summary"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "fk_account_id"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "mv_customer_aging"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "fk_account_id"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "mv_vendor_aging"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "fk_product_id"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "gl_inventory_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_product_id"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "gl_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_product_id"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "mv_product_sales_summary"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "fk_product_id"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_sales"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "fk_purchase_order_id"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "gl_purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_vendor_payments_account"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "gl_account_invoice_relations"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "fk_vendor_payments_account"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "gl_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_vendor_payments_account"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "mv_account_finance_summary"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "fk_vendor_payments_account"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "mv_customer_aging"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "fk_vendor_payments_account"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "mv_vendor_aging"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "gl_vendor_payments_rowid_accounts_fkey"
            columns: ["rowid_accounts"]
            isOneToOne: false
            referencedRelation: "gl_account_invoice_relations"
            referencedColumns: ["account_glide_row_id"]
          },
          {
            foreignKeyName: "gl_vendor_payments_rowid_accounts_fkey"
            columns: ["rowid_accounts"]
            isOneToOne: false
            referencedRelation: "gl_accounts"
            referencedColumns: ["glide_row_id"]
          },
        ]
      }
      gl_webhook_config: {
        Row: {
          auth_token: string | null
          created_at: string | null
          description: string | null
          enabled: boolean | null
          endpoint_url: string
          entity_type: string
          event_types: string[] | null
          feature: string
          headers: Json | null
          id: string
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
          entity_type: string
          event_types?: string[] | null
          feature: string
          headers?: Json | null
          id?: string
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
          entity_type?: string
          event_types?: string[] | null
          feature?: string
          headers?: Json | null
          id?: string
          retry_count?: number | null
          timeout_seconds?: number | null
          updated_at?: string | null
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
            referencedRelation: "gl_inventory_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_logs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "gl_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_logs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "mv_product_sales_summary"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "match_logs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_sales"
            referencedColumns: ["product_id"]
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
          edit_history: Json | null
          edit_timestamp: string | null
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
          group_message_count: string | null
          height: number | null
          id: string
          is_channel_post: boolean | null
          is_duplicate: boolean | null
          is_edit: boolean | null
          is_edited: boolean | null
          is_edited_channel_post: boolean | null
          is_forward: boolean | null
          is_forward_from: string | null
          is_forwarded_from: string | null
          is_miscellaneous_item: boolean | null
          is_original_caption: boolean | null
          last_edited_at: string | null
          last_error_at: string | null
          last_processing_attempt: string | null
          last_synced_at: string | null
          match_type: Database["public"]["Enums"]["match_type"] | null
          media_group_id: string | null
          media_group_sync: string | null
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
          processing_error: string | null
          processing_state: Database["public"]["Enums"]["processing_state_type"]
          product_code: string | null
          product_id: string | null
          product_match_confidence: number | null
          product_match_date: string | null
          product_match_status: string | null
          product_name: string | null
          product_quantity: number | null
          product_sku: string | null
          public_url: string | null
          public_url_glide: string | null
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
          edit_history?: Json | null
          edit_timestamp?: string | null
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
          group_message_count?: string | null
          height?: number | null
          id?: string
          is_channel_post?: boolean | null
          is_duplicate?: boolean | null
          is_edit?: boolean | null
          is_edited?: boolean | null
          is_edited_channel_post?: boolean | null
          is_forward?: boolean | null
          is_forward_from?: string | null
          is_forwarded_from?: string | null
          is_miscellaneous_item?: boolean | null
          is_original_caption?: boolean | null
          last_edited_at?: string | null
          last_error_at?: string | null
          last_processing_attempt?: string | null
          last_synced_at?: string | null
          match_type?: Database["public"]["Enums"]["match_type"] | null
          media_group_id?: string | null
          media_group_sync?: string | null
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
          processing_error?: string | null
          processing_state?: Database["public"]["Enums"]["processing_state_type"]
          product_code?: string | null
          product_id?: string | null
          product_match_confidence?: number | null
          product_match_date?: string | null
          product_match_status?: string | null
          product_name?: string | null
          product_quantity?: number | null
          product_sku?: string | null
          public_url?: string | null
          public_url_glide?: string | null
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
          edit_history?: Json | null
          edit_timestamp?: string | null
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
          group_message_count?: string | null
          height?: number | null
          id?: string
          is_channel_post?: boolean | null
          is_duplicate?: boolean | null
          is_edit?: boolean | null
          is_edited?: boolean | null
          is_edited_channel_post?: boolean | null
          is_forward?: boolean | null
          is_forward_from?: string | null
          is_forwarded_from?: string | null
          is_miscellaneous_item?: boolean | null
          is_original_caption?: boolean | null
          last_edited_at?: string | null
          last_error_at?: string | null
          last_processing_attempt?: string | null
          last_synced_at?: string | null
          match_type?: Database["public"]["Enums"]["match_type"] | null
          media_group_id?: string | null
          media_group_sync?: string | null
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
          processing_error?: string | null
          processing_state?: Database["public"]["Enums"]["processing_state_type"]
          product_code?: string | null
          product_id?: string | null
          product_match_confidence?: number | null
          product_match_date?: string | null
          product_match_status?: string | null
          product_name?: string | null
          product_quantity?: number | null
          product_sku?: string | null
          public_url?: string | null
          public_url_glide?: string | null
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
            foreignKeyName: "fk_product"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "gl_inventory_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_product"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "gl_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_product"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "mv_product_sales_summary"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "fk_product"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_sales"
            referencedColumns: ["product_id"]
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
      pdf_generation_queue: {
        Row: {
          created_at: string
          id: string
          processed_at: string | null
          record_id: string
          record_type: string
          status: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          processed_at?: string | null
          record_id: string
          record_type: string
          status?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          processed_at?: string | null
          record_id?: string
          record_type?: string
          status?: string | null
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
      portal_access: {
        Row: {
          account_id: string | null
          created_at: string | null
          id: string
          pin: string
          updated_at: string | null
        }
        Insert: {
          account_id?: string | null
          created_at?: string | null
          id?: string
          pin: string
          updated_at?: string | null
        }
        Update: {
          account_id?: string | null
          created_at?: string | null
          id?: string
          pin?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "portal_access_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "gl_account_invoice_relations"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "portal_access_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "gl_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portal_access_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "mv_account_finance_summary"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "portal_access_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "mv_customer_aging"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "portal_access_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "mv_vendor_aging"
            referencedColumns: ["account_id"]
          },
        ]
      }
      product_units: {
        Row: {
          abbreviation: string | null
          created_at: string | null
          id: string
          name: string
          updated_at: string | null
        }
        Insert: {
          abbreviation?: string | null
          created_at?: string | null
          id?: string
          name: string
          updated_at?: string | null
        }
        Update: {
          abbreviation?: string | null
          created_at?: string | null
          id?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: []
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
      telegram_settings: {
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
    }
    Views: {
      expense_summary: {
        Row: {
          category: string | null
          expense_count: number | null
          month: string | null
          total_expenses: number | null
        }
        Relationships: []
      }
      gl_account_invoice_relations: {
        Row: {
          account_glide_row_id: string | null
          account_id: string | null
          account_name: string | null
          client_type: string | null
          date_of_invoice: string | null
          invoice_id: string | null
          invoice_order_date: string | null
          invoice_rowid_accounts: string | null
          invoice_uid: string | null
          junction_id: string | null
          payment_status: string | null
          total_amount: number | null
        }
        Relationships: []
      }
      gl_all_payments: {
        Row: {
          account_id: string | null
          created_at: string | null
          date_of_payment: string | null
          estimate_id: string | null
          id: string | null
          invoice_id: string | null
          notes: string | null
          payment_amount: number | null
          payment_document_type: string | null
          payment_table: string | null
          payment_type: string | null
          purchase_order_id: string | null
          updated_at: string | null
        }
        Relationships: []
      }
      gl_dual_id_relationships: {
        Row: {
          parent_table: string | null
          parent_text_id: string | null
          parent_uuid_id: string | null
          relationship_type: string | null
          table_name: string | null
          text_id: string | null
          uuid_id: string | null
        }
        Relationships: []
      }
      gl_inventory_view: {
        Row: {
          category: string | null
          cost: number | null
          created_at: string | null
          date_of_purchase: string | null
          days_in_inventory: number | null
          days_since_last_sale: number | null
          glide_row_id: string | null
          id: string | null
          inventory_turnover_rate: number | null
          is_fronted: boolean | null
          is_sample: boolean | null
          is_sample_or_fronted: boolean | null
          last_payment_date: string | null
          last_sale_date: string | null
          pct_sold: number | null
          product_name: string | null
          product_sku: string | null
          profit: number | null
          profit_margin: number | null
          public_url_image: string | null
          public_url_video: string | null
          purchase_note: string | null
          qty_available: number | null
          qty_committed: number | null
          qty_remaining: number | null
          qty_sampled: number | null
          qty_sold: number | null
          revenue: number | null
          rowid_accounts: string | null
          rowid_purchase_orders: string | null
          rowid_vendor_payments: string | null
          total_cost: number | null
          total_qty_purchased: number | null
          updated_at: string | null
          vendor_balance: number | null
          vendor_name: string | null
          vendor_uid: string | null
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
            foreignKeyName: "fk_connection_id"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "gl_connections"
            referencedColumns: ["id"]
          },
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
            foreignKeyName: "fk_connection_id"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "gl_connections"
            referencedColumns: ["id"]
          },
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
      mv_account_finance_summary: {
        Row: {
          account_id: string | null
          account_name: string | null
          client_type: string | null
          open_invoices_count: number | null
          open_pos_count: number | null
          outstanding_customer_balance: number | null
          outstanding_vendor_balance: number | null
          total_invoiced: number | null
          total_paid_vendor: number | null
          total_purchased: number | null
          total_received: number | null
        }
        Relationships: []
      }
      mv_customer_aging: {
        Row: {
          account_id: string | null
          account_name: string | null
          balance_1_30_days: number | null
          balance_31_60_days: number | null
          balance_61_90_days: number | null
          balance_current: number | null
          balance_over_90_days: number | null
          total_outstanding_balance: number | null
        }
        Relationships: []
      }
      mv_financial_dashboard: {
        Row: {
          gross_profit: number | null
          month: string | null
          outstanding_balance: number | null
          outstanding_po_balance: number | null
          total_collected: number | null
          total_ordered: number | null
          total_paid: number | null
          total_revenue: number | null
        }
        Relationships: []
      }
      mv_monthly_finance_summary: {
        Row: {
          month: string | null
          total_expenses: number | null
          total_invoice_amount: number | null
          total_purchase_order_amount: number | null
        }
        Relationships: []
      }
      mv_product_sales_summary: {
        Row: {
          display_name: string | null
          product_id: string | null
          total_profit: number | null
          total_qty_sold: number | null
          total_revenue: number | null
        }
        Relationships: []
      }
      mv_vendor_aging: {
        Row: {
          account_id: string | null
          account_name: string | null
          balance_1_30_days: number | null
          balance_31_60_days: number | null
          balance_61_90_days: number | null
          balance_current: number | null
          balance_over_90_days: number | null
          total_outstanding_vendor_balance: number | null
        }
        Relationships: []
      }
      product_sales: {
        Row: {
          display_name: string | null
          product_id: string | null
          total_quantity_sold: number | null
          total_revenue: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      audit_glide_uuid_relationships: {
        Args: Record<PropertyKey, never>
        Returns: {
          table_name: string
          relationship_type: string
          mismatched_count: number
          missing_fk_count: number
          missing_rowid_count: number
          total_records: number
        }[]
      }
      binary_quantize: {
        Args: { "": string } | { "": unknown }
        Returns: unknown
      }
      create_invoice_from_estimate: {
        Args: { estimate_id: string }
        Returns: string
      }
      custom_access_token_hook: {
        Args: { event: Json }
        Returns: Json
      }
      ent: {
        Args: {
          p_event_type: string
          p_entity_id: string
          p_correlation_id: string
          p_metadata?: Json
          p_error_message?: string
        }
        Returns: undefined
      }
      fix_glide_uuid_relationships: {
        Args: { p_test_mode?: boolean; p_target_table?: string }
        Returns: {
          table_name: string
          operation: string
          affected_rows: number
        }[]
      }
      fix_orphaned_records: {
        Args: { p_test_mode?: boolean }
        Returns: {
          table_name: string
          operation: string
          affected_rows: number
        }[]
      }
      get_account_balance: {
        Args: { p_account_id: string }
        Returns: number
      }
      get_monthly_profit: {
        Args: { p_month: string }
        Returns: number
      }
      get_potential_product_matches: {
        Args: {
          message_id: string
          max_results?: number
          min_confidence?: number
        }
        Returns: {
          product_id: string
          product_name: string
          sku: string
          confidence: number
        }[]
      }
      gl_find_dual_id_inconsistencies: {
        Args: Record<PropertyKey, never>
        Returns: {
          table_name: string
          uuid_id: string
          text_id: string
          parent_table: string
          parent_uuid_id: string
          parent_text_id: string
          issue_description: string
        }[]
      }
      gl_get_accounts_with_balances: {
        Args: {
          p_account_type?: string
          p_is_customer?: boolean
          p_is_vendor?: boolean
        }
        Returns: {
          id: string
          account_name: string
          glide_row_id: string
          client_type: string
          balance: number
          customer_balance: number
          vendor_balance: number
          is_customer: boolean
          is_vendor: boolean
          created_at: string
          updated_at: string
        }[]
      }
      gl_get_business_stats: {
        Args: Record<PropertyKey, never>
        Returns: {
          total_revenue: number
          total_expenses: number
          profit: number
          customer_count: number
          vendor_count: number
          invoice_count: number
        }[]
      }
      gl_get_estimate_metrics: {
        Args: Record<PropertyKey, never>
        Returns: {
          total_estimates: number
          total_amount: number
          sample_amount: number
          converted_amount: number
          pending_amount: number
        }[]
      }
      gl_get_estimate_totals_by_category: {
        Args: { p_from_date?: string; p_to_date?: string }
        Returns: {
          category: string
          total: number
        }[]
      }
      gl_get_expense_metrics: {
        Args: Record<PropertyKey, never>
        Returns: {
          total_amount: number
          pending_amount: number
          paid_amount: number
        }[]
      }
      gl_get_expense_totals_by_category: {
        Args: { p_from_date?: string; p_to_date?: string }
        Returns: {
          category: string
          total: number
        }[]
      }
      gl_get_invoice_metrics: {
        Args: Record<PropertyKey, never>
        Returns: {
          total_invoices: number
          paid_invoices: number
          partial_invoices: number
          unpaid_invoices: number
          overdue_invoices: number
          total_amount: number
          paid_amount: number
          outstanding_amount: number
        }[]
      }
      gl_get_monthly_revenue: {
        Args: { months_back?: number }
        Returns: {
          month: string
          revenue: number
          expenses: number
          profit: number
        }[]
      }
      gl_get_payment_metrics: {
        Args: { days_back?: number }
        Returns: {
          payment_count: number
          received_amount: number
          paid_amount: number
          net_amount: number
        }[]
      }
      gl_get_recent_transactions: {
        Args: { days_back?: number; limit_count?: number }
        Returns: {
          id: string
          transaction_date: string
          description: string
          account_name: string
          amount: number
          transaction_type: string
        }[]
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
      halfvec_avg: {
        Args: { "": number[] }
        Returns: unknown
      }
      halfvec_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      halfvec_send: {
        Args: { "": unknown }
        Returns: string
      }
      halfvec_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
      hnsw_bit_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnsw_halfvec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnsw_sparsevec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnswhandler: {
        Args: { "": unknown }
        Returns: unknown
      }
      identify_orphaned_records: {
        Args: Record<PropertyKey, never>
        Returns: {
          table_name: string
          relationship_type: string
          orphaned_count: number
          sample_rowids: string[]
        }[]
      }
      ivfflat_bit_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      ivfflat_halfvec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      ivfflathandler: {
        Args: { "": unknown }
        Returns: unknown
      }
      l2_norm: {
        Args: { "": unknown } | { "": unknown }
        Returns: number
      }
      l2_normalize: {
        Args: { "": string } | { "": unknown } | { "": unknown }
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
      maintain_glide_uuid_relationships: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      match_documents: {
        Args: { query_embedding: string; match_count?: number; filter?: Json }
        Returns: {
          id: number
          content: string
          metadata: Json
          similarity: number
        }[]
      }
      refresh_financial_views: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      reset_pdf_generation_failure: {
        Args: { p_document_type: string; p_document_id: string }
        Returns: undefined
      }
      run_sync_media_group_captions: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      set_limit: {
        Args: { "": number }
        Returns: number
      }
      show_limit: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      show_trgm: {
        Args: { "": string }
        Returns: string[]
      }
      sparsevec_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      sparsevec_send: {
        Args: { "": unknown }
        Returns: string
      }
      sparsevec_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
      standardize_existing_pdf_urls: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      sync_media_group_captions: {
        Args: { p_media_group_id: string }
        Returns: undefined
      }
      update_account_customer_balance: {
        Args: { account_id: string }
        Returns: undefined
      }
      update_estimate_finance_metrics: {
        Args: { estimate_id: string }
        Returns: undefined
      }
      update_po_finance_metrics: {
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
          p_telegram_data?: Json
        }
        Returns: string
      }
      upsert_text_message: {
        Args: {
          p_id: string
          p_message_text: string
          p_message_data: Json
          p_processing_state?: string
          p_correlation_id?: string
        }
        Returns: {
          id: string
          is_duplicate: boolean
          updated: boolean
        }[]
      }
      vector_avg: {
        Args: { "": number[] }
        Returns: string
      }
      vector_dims: {
        Args: { "": string } | { "": unknown }
        Returns: number
      }
      vector_norm: {
        Args: { "": string }
        Returns: number
      }
      vector_out: {
        Args: { "": string }
        Returns: unknown
      }
      vector_send: {
        Args: { "": string }
        Returns: string
      }
      vector_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
    }
    Enums: {
      account_type: "Customer" | "Vendor" | "Customer & Vendor"
      account_type_enum: "Customer" | "Vendor" | "Both"
      approval_status: "pending" | "approved" | "rejected" | "auto_matched"
      confidence_level: "high" | "medium" | "low"
      estimate_status_enum:
        | "Draft"
        | "Sent"
        | "Accepted"
        | "Rejected"
        | "Converted"
      invoice_status_enum:
        | "Unpaid"
        | "Partial"
        | "Paid"
        | "Overdue"
        | "Cancelled"
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
      payment_status_enum: "pending" | "approved" | "rejected"
      processing_state_type:
        | "initialized"
        | "pending"
        | "processing"
        | "completed"
        | "error"
        | "no_caption"
        | "pending_analysis"
        | "edited"
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
      account_type_enum: ["Customer", "Vendor", "Both"],
      approval_status: ["pending", "approved", "rejected", "auto_matched"],
      confidence_level: ["high", "medium", "low"],
      estimate_status_enum: [
        "Draft",
        "Sent",
        "Accepted",
        "Rejected",
        "Converted",
      ],
      invoice_status_enum: [
        "Unpaid",
        "Partial",
        "Paid",
        "Overdue",
        "Cancelled",
      ],
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
      payment_status_enum: ["pending", "approved", "rejected"],
      processing_state_type: [
        "initialized",
        "pending",
        "processing",
        "completed",
        "error",
        "no_caption",
        "pending_analysis",
        "edited",
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
