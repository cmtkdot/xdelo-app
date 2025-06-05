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
      gl_accounts: {
        Row: {
          account_name: string | null
          accounts_uid: string
          balance: number | null
          client_type: string | null
          created_at: string | null
          customer_balance: number | null
          glide_row_id: string | null
          id: string
          is_customer: boolean | null
          is_vendor: boolean | null
          last_synced_at: string | null
          photo: string | null
          sync_direction: string | null
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
          glide_row_id?: string | null
          id?: string
          is_customer?: boolean | null
          is_vendor?: boolean | null
          last_synced_at?: string | null
          photo?: string | null
          sync_direction?: string | null
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
          glide_row_id?: string | null
          id?: string
          is_customer?: boolean | null
          is_vendor?: boolean | null
          last_synced_at?: string | null
          photo?: string | null
          sync_direction?: string | null
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
          account_id: string | null
          created_at: string | null
          date_of_payment: string | null
          estimate_id: string | null
          glide_row_id: string | null
          id: string
          last_synced_at: string | null
          payment_amount: number | null
          payment_document_type: string | null
          payment_method: string | null
          payment_note: string | null
          rowid_accounts: string | null
          rowid_estimates: string | null
          rowid_invoices: string | null
          sync_direction: string | null
          updated_at: string | null
        }
        Insert: {
          account_id?: string | null
          created_at?: string | null
          date_of_payment?: string | null
          estimate_id?: string | null
          glide_row_id?: string | null
          id?: string
          last_synced_at?: string | null
          payment_amount?: number | null
          payment_document_type?: string | null
          payment_method?: string | null
          payment_note?: string | null
          rowid_accounts?: string | null
          rowid_estimates?: string | null
          rowid_invoices?: string | null
          sync_direction?: string | null
          updated_at?: string | null
        }
        Update: {
          account_id?: string | null
          created_at?: string | null
          date_of_payment?: string | null
          estimate_id?: string | null
          glide_row_id?: string | null
          id?: string
          last_synced_at?: string | null
          payment_amount?: number | null
          payment_document_type?: string | null
          payment_method?: string | null
          payment_note?: string | null
          rowid_accounts?: string | null
          rowid_estimates?: string | null
          rowid_invoices?: string | null
          sync_direction?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gl_customer_credits_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "gl_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gl_customer_credits_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "gl_inventory_view"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "gl_customer_credits_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "mv_product_inventory"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "gl_customer_credits_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "v_non_match_messages_approval"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "gl_customer_credits_estimate_id_fkey"
            columns: ["estimate_id"]
            isOneToOne: false
            referencedRelation: "gl_estimates"
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
          glide_row_id: string | null
          id: string
          invoice_id: string | null
          last_synced_at: string | null
          payment_amount: number | null
          payment_document_type:
            | Database["public"]["Enums"]["payment_document_type_enum"]
            | null
          payment_method: string | null
          payment_note: string | null
          rowid_accounts: string | null
          rowid_invoices: string | null
          sync_direction: string | null
          updated_at: string | null
        }
        Insert: {
          account_id?: string | null
          created_at?: string | null
          date_of_payment?: string | null
          email_of_user?: string | null
          glide_row_id?: string | null
          id?: string
          invoice_id?: string | null
          last_synced_at?: string | null
          payment_amount?: number | null
          payment_document_type?:
            | Database["public"]["Enums"]["payment_document_type_enum"]
            | null
          payment_method?: string | null
          payment_note?: string | null
          rowid_accounts?: string | null
          rowid_invoices?: string | null
          sync_direction?: string | null
          updated_at?: string | null
        }
        Update: {
          account_id?: string | null
          created_at?: string | null
          date_of_payment?: string | null
          email_of_user?: string | null
          glide_row_id?: string | null
          id?: string
          invoice_id?: string | null
          last_synced_at?: string | null
          payment_amount?: number | null
          payment_document_type?:
            | Database["public"]["Enums"]["payment_document_type_enum"]
            | null
          payment_method?: string | null
          payment_note?: string | null
          rowid_accounts?: string | null
          rowid_invoices?: string | null
          sync_direction?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gl_customer_payments_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "gl_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gl_customer_payments_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "gl_inventory_view"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "gl_customer_payments_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "mv_product_inventory"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "gl_customer_payments_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "v_non_match_messages_approval"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "gl_customer_payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "gl_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      gl_document_share_access_logs: {
        Row: {
          access_timestamp: string
          access_type: string
          created_at: string
          document_share_id: string
          id: string
          ip_address: unknown | null
          pin_attempt_success: boolean | null
          session_id: string | null
          user_agent: string | null
        }
        Insert: {
          access_timestamp?: string
          access_type: string
          created_at?: string
          document_share_id: string
          id?: string
          ip_address?: unknown | null
          pin_attempt_success?: boolean | null
          session_id?: string | null
          user_agent?: string | null
        }
        Update: {
          access_timestamp?: string
          access_type?: string
          created_at?: string
          document_share_id?: string
          id?: string
          ip_address?: unknown | null
          pin_attempt_success?: boolean | null
          session_id?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gl_document_share_access_logs_document_share_id_fkey"
            columns: ["document_share_id"]
            isOneToOne: false
            referencedRelation: "gl_document_shares"
            referencedColumns: ["id"]
          },
        ]
      }
      gl_document_shares: {
        Row: {
          access_count: number | null
          document_type: string
          estimate_id: string | null
          id: string
          invoice_id: string | null
          is_active: boolean
          last_accessed_at: string | null
          link_created_at: string
          pin_removed_at: string | null
          pin_set_at: string | null
          purchase_order_id: string | null
          shared_link_pin_hash: string | null
          shared_link_token: string
          show_copyright_on_view: boolean | null
        }
        Insert: {
          access_count?: number | null
          document_type: string
          estimate_id?: string | null
          id?: string
          invoice_id?: string | null
          is_active?: boolean
          last_accessed_at?: string | null
          link_created_at?: string
          pin_removed_at?: string | null
          pin_set_at?: string | null
          purchase_order_id?: string | null
          shared_link_pin_hash?: string | null
          shared_link_token?: string
          show_copyright_on_view?: boolean | null
        }
        Update: {
          access_count?: number | null
          document_type?: string
          estimate_id?: string | null
          id?: string
          invoice_id?: string | null
          is_active?: boolean
          last_accessed_at?: string | null
          link_created_at?: string
          pin_removed_at?: string | null
          pin_set_at?: string | null
          purchase_order_id?: string | null
          shared_link_pin_hash?: string | null
          shared_link_token?: string
          show_copyright_on_view?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "gl_document_shares_estimate_id_fkey"
            columns: ["estimate_id"]
            isOneToOne: false
            referencedRelation: "gl_estimates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gl_document_shares_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "gl_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gl_document_shares_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "gl_purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gl_document_shares_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "v_non_match_messages_approval"
            referencedColumns: ["existing_po_id"]
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
          last_synced_at: string | null
          line_total: number | null
          product_id: string | null
          product_name_display: string | null
          qty_sold: number | null
          rowid_estimates: string | null
          rowid_products: string | null
          sale_note: string | null
          sale_product_name: string | null
          selling_price: number | null
          sync_direction: string | null
          total_stock_after_sell: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          date_of_sale?: string | null
          estimate_id?: string | null
          glide_row_id?: string | null
          id?: string
          last_synced_at?: string | null
          line_total?: number | null
          product_id?: string | null
          product_name_display?: string | null
          qty_sold?: number | null
          rowid_estimates?: string | null
          rowid_products?: string | null
          sale_note?: string | null
          sale_product_name?: string | null
          selling_price?: number | null
          sync_direction?: string | null
          total_stock_after_sell?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          date_of_sale?: string | null
          estimate_id?: string | null
          glide_row_id?: string | null
          id?: string
          last_synced_at?: string | null
          line_total?: number | null
          product_id?: string | null
          product_name_display?: string | null
          qty_sold?: number | null
          rowid_estimates?: string | null
          rowid_products?: string | null
          sale_note?: string | null
          sale_product_name?: string | null
          selling_price?: number | null
          sync_direction?: string | null
          total_stock_after_sell?: number | null
          updated_at?: string | null
        }
        Relationships: [
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
            referencedRelation: "mv_product_inventory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gl_estimate_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_messages_gl_products_linked"
            referencedColumns: ["gl_product_id"]
          },
        ]
      }
      gl_estimates: {
        Row: {
          account_id: string | null
          balance: number | null
          created_at: string | null
          date_invoice_created: string | null
          estimate_date: string | null
          estimate_uid: string | null
          glide_pdf_url: string | null
          glide_pdf_url_secondary: string | null
          glide_row_id: string | null
          id: string
          invoice_id: string | null
          is_a_sample: boolean | null
          is_invoice_created: boolean | null
          is_note_added: boolean | null
          last_synced_at: string | null
          notes: string | null
          payment_status: string | null
          rowid_accounts: string | null
          rowid_invoices: string | null
          supabase_pdf_url: string | null
          sync_direction: string | null
          total_amount: number | null
          total_credits: number | null
          updated_at: string | null
        }
        Insert: {
          account_id?: string | null
          balance?: number | null
          created_at?: string | null
          date_invoice_created?: string | null
          estimate_date?: string | null
          estimate_uid?: string | null
          glide_pdf_url?: string | null
          glide_pdf_url_secondary?: string | null
          glide_row_id?: string | null
          id?: string
          invoice_id?: string | null
          is_a_sample?: boolean | null
          is_invoice_created?: boolean | null
          is_note_added?: boolean | null
          last_synced_at?: string | null
          notes?: string | null
          payment_status?: string | null
          rowid_accounts?: string | null
          rowid_invoices?: string | null
          supabase_pdf_url?: string | null
          sync_direction?: string | null
          total_amount?: number | null
          total_credits?: number | null
          updated_at?: string | null
        }
        Update: {
          account_id?: string | null
          balance?: number | null
          created_at?: string | null
          date_invoice_created?: string | null
          estimate_date?: string | null
          estimate_uid?: string | null
          glide_pdf_url?: string | null
          glide_pdf_url_secondary?: string | null
          glide_row_id?: string | null
          id?: string
          invoice_id?: string | null
          is_a_sample?: boolean | null
          is_invoice_created?: boolean | null
          is_note_added?: boolean | null
          last_synced_at?: string | null
          notes?: string | null
          payment_status?: string | null
          rowid_accounts?: string | null
          rowid_invoices?: string | null
          supabase_pdf_url?: string | null
          sync_direction?: string | null
          total_amount?: number | null
          total_credits?: number | null
          updated_at?: string | null
        }
        Relationships: [
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
            referencedRelation: "gl_inventory_view"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "gl_estimates_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "mv_product_inventory"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "gl_estimates_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "v_non_match_messages_approval"
            referencedColumns: ["account_id"]
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
          budget_amount: number | null
          category: string
          color_code: string | null
          created_at: string | null
          description: string | null
          icon_name: string | null
          id: string
          is_active: boolean | null
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          budget_amount?: number | null
          category: string
          color_code?: string | null
          created_at?: string | null
          description?: string | null
          icon_name?: string | null
          id?: string
          is_active?: boolean | null
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          budget_amount?: number | null
          category?: string
          color_code?: string | null
          created_at?: string | null
          description?: string | null
          icon_name?: string | null
          id?: string
          is_active?: boolean | null
          sort_order?: number | null
          updated_at?: string | null
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
          expense_date: string | null
          expense_receipt_image: string | null
          glide_row_id: string | null
          id: string
          is_processing: boolean | null
          last_synced_at: string | null
          notes: string | null
          submitted_by: string | null
          sync_direction: string | null
          updated_at: string | null
        }
        Insert: {
          amount?: number | null
          category?: string | null
          category_id?: string | null
          created_at?: string | null
          date_of_expense?: string | null
          expense_date?: string | null
          expense_receipt_image?: string | null
          glide_row_id?: string | null
          id?: string
          is_processing?: boolean | null
          last_synced_at?: string | null
          notes?: string | null
          submitted_by?: string | null
          sync_direction?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number | null
          category?: string | null
          category_id?: string | null
          created_at?: string | null
          date_of_expense?: string | null
          expense_date?: string | null
          expense_receipt_image?: string | null
          glide_row_id?: string | null
          id?: string
          is_processing?: boolean | null
          last_synced_at?: string | null
          notes?: string | null
          submitted_by?: string | null
          sync_direction?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gl_expenses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "gl_expense_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gl_expenses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "gl_expense_category_summary"
            referencedColumns: ["id"]
          },
        ]
      }
      gl_invoice_lines: {
        Row: {
          created_at: string | null
          date_of_sale: string | null
          glide_row_id: string | null
          id: string
          invoice_id: string | null
          last_synced_at: string | null
          line_total: number | null
          product_id: string | null
          product_name_display: string | null
          qty_sold: number | null
          renamed_product_name: string | null
          rowid_invoices: string | null
          rowid_products: string | null
          sale_note: string | null
          selling_price: number | null
          sync_direction: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          date_of_sale?: string | null
          glide_row_id?: string | null
          id?: string
          invoice_id?: string | null
          last_synced_at?: string | null
          line_total?: number | null
          product_id?: string | null
          product_name_display?: string | null
          qty_sold?: number | null
          renamed_product_name?: string | null
          rowid_invoices?: string | null
          rowid_products?: string | null
          sale_note?: string | null
          selling_price?: number | null
          sync_direction?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          date_of_sale?: string | null
          glide_row_id?: string | null
          id?: string
          invoice_id?: string | null
          last_synced_at?: string | null
          line_total?: number | null
          product_id?: string | null
          product_name_display?: string | null
          qty_sold?: number | null
          renamed_product_name?: string | null
          rowid_invoices?: string | null
          rowid_products?: string | null
          sale_note?: string | null
          selling_price?: number | null
          sync_direction?: string | null
          updated_at?: string | null
        }
        Relationships: [
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
            referencedRelation: "mv_product_inventory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gl_invoice_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_messages_gl_products_linked"
            referencedColumns: ["gl_product_id"]
          },
        ]
      }
      gl_invoices: {
        Row: {
          account_id: string | null
          balance: number | null
          created_at: string | null
          created_timestamp: string | null
          date_of_invoice: string | null
          glide_pdf_url: string | null
          glide_row_id: string | null
          id: string
          invoice_uid: string | null
          is_processed: boolean | null
          last_synced_at: string | null
          notes: string | null
          payment_status: string | null
          rowid_accounts: string | null
          submitted_timestamp: string | null
          supabase_pdf_url: string | null
          sync_direction: string | null
          total_amount: number | null
          total_paid: number | null
          updated_at: string | null
        }
        Insert: {
          account_id?: string | null
          balance?: number | null
          created_at?: string | null
          created_timestamp?: string | null
          date_of_invoice?: string | null
          glide_pdf_url?: string | null
          glide_row_id?: string | null
          id?: string
          invoice_uid?: string | null
          is_processed?: boolean | null
          last_synced_at?: string | null
          notes?: string | null
          payment_status?: string | null
          rowid_accounts?: string | null
          submitted_timestamp?: string | null
          supabase_pdf_url?: string | null
          sync_direction?: string | null
          total_amount?: number | null
          total_paid?: number | null
          updated_at?: string | null
        }
        Update: {
          account_id?: string | null
          balance?: number | null
          created_at?: string | null
          created_timestamp?: string | null
          date_of_invoice?: string | null
          glide_pdf_url?: string | null
          glide_row_id?: string | null
          id?: string
          invoice_uid?: string | null
          is_processed?: boolean | null
          last_synced_at?: string | null
          notes?: string | null
          payment_status?: string | null
          rowid_accounts?: string | null
          submitted_timestamp?: string | null
          supabase_pdf_url?: string | null
          sync_direction?: string | null
          total_amount?: number | null
          total_paid?: number | null
          updated_at?: string | null
        }
        Relationships: [
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
            referencedRelation: "gl_inventory_view"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "gl_invoices_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "mv_product_inventory"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "gl_invoices_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "v_non_match_messages_approval"
            referencedColumns: ["account_id"]
          },
        ]
      }
      gl_mappings: {
        Row: {
          column_mappings: Json
          connection_id: string
          created_at: string | null
          data_owner: string | null
          description: string | null
          enabled: boolean
          fix_relationships_command: string | null
          glide_sync_notes: string | null
          glide_table: string
          glide_table_display_name: string
          glide_to_supabase_curl: string | null
          glide_to_supabase_description: string | null
          id: string
          include_in_testing: boolean | null
          last_sync_status: string | null
          last_sync_timestamp: string | null
          logic: Json | null
          mapping_notes: string | null
          records_processed_count: number | null
          supabase_table: string
          supabase_to_glide_curl: string | null
          supabase_to_glide_description: string | null
          sync_direction: string
          updated_at: string | null
        }
        Insert: {
          column_mappings?: Json
          connection_id: string
          created_at?: string | null
          data_owner?: string | null
          description?: string | null
          enabled?: boolean
          fix_relationships_command?: string | null
          glide_sync_notes?: string | null
          glide_table: string
          glide_table_display_name: string
          glide_to_supabase_curl?: string | null
          glide_to_supabase_description?: string | null
          id?: string
          include_in_testing?: boolean | null
          last_sync_status?: string | null
          last_sync_timestamp?: string | null
          logic?: Json | null
          mapping_notes?: string | null
          records_processed_count?: number | null
          supabase_table: string
          supabase_to_glide_curl?: string | null
          supabase_to_glide_description?: string | null
          sync_direction?: string
          updated_at?: string | null
        }
        Update: {
          column_mappings?: Json
          connection_id?: string
          created_at?: string | null
          data_owner?: string | null
          description?: string | null
          enabled?: boolean
          fix_relationships_command?: string | null
          glide_sync_notes?: string | null
          glide_table?: string
          glide_table_display_name?: string
          glide_to_supabase_curl?: string | null
          glide_to_supabase_description?: string | null
          id?: string
          include_in_testing?: boolean | null
          last_sync_status?: string | null
          last_sync_timestamp?: string | null
          logic?: Json | null
          mapping_notes?: string | null
          records_processed_count?: number | null
          supabase_table?: string
          supabase_to_glide_curl?: string | null
          supabase_to_glide_description?: string | null
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
      gl_portal_pending_payments: {
        Row: {
          account_id: string
          admin_action_at: string | null
          admin_approver_id: string | null
          admin_notes: string | null
          converted_payment_id: string | null
          converted_payment_type: string | null
          customer_notes: string | null
          estimate_id: string | null
          id: string
          invoice_id: string | null
          payment_method: string | null
          payment_method_hint: string | null
          shared_document_id: string
          status: string
          submission_date: string | null
          submitted_amount: number
        }
        Insert: {
          account_id: string
          admin_action_at?: string | null
          admin_approver_id?: string | null
          admin_notes?: string | null
          converted_payment_id?: string | null
          converted_payment_type?: string | null
          customer_notes?: string | null
          estimate_id?: string | null
          id?: string
          invoice_id?: string | null
          payment_method?: string | null
          payment_method_hint?: string | null
          shared_document_id: string
          status?: string
          submission_date?: string | null
          submitted_amount: number
        }
        Update: {
          account_id?: string
          admin_action_at?: string | null
          admin_approver_id?: string | null
          admin_notes?: string | null
          converted_payment_id?: string | null
          converted_payment_type?: string | null
          customer_notes?: string | null
          estimate_id?: string | null
          id?: string
          invoice_id?: string | null
          payment_method?: string | null
          payment_method_hint?: string | null
          shared_document_id?: string
          status?: string
          submission_date?: string | null
          submitted_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "gl_portal_pending_payments_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "gl_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gl_portal_pending_payments_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "gl_inventory_view"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "gl_portal_pending_payments_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "mv_product_inventory"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "gl_portal_pending_payments_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "v_non_match_messages_approval"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "gl_portal_pending_payments_estimate_id_fkey"
            columns: ["estimate_id"]
            isOneToOne: false
            referencedRelation: "gl_estimates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gl_portal_pending_payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "gl_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gl_portal_pending_payments_shared_document_id_fkey"
            columns: ["shared_document_id"]
            isOneToOne: false
            referencedRelation: "gl_document_shares"
            referencedColumns: ["id"]
          },
        ]
      }
      gl_products: {
        Row: {
          account_id: string | null
          account_uid: string | null
          category: string | null
          cost: number | null
          created_at: string | null
          date_of_purchase: string | null
          date_timestamp_subm: string | null
          deleted_at: string | null
          display_name: string | null
          email_email_of_user_who_added_product: string | null
          glide_row_id: string | null
          id: string
          is_deleted: boolean
          is_fronted: boolean | null
          is_miscellaneous: boolean | null
          is_paid: boolean | null
          is_sample: boolean | null
          is_sample_or_fronted: boolean | null
          is_service: boolean | null
          last_synced_at: string | null
          new_product_name: string | null
          new_product_sku: string | null
          po_date: string | null
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
          supabase_pdf_url: string | null
          sync_direction: string | null
          terms_for_fronted_product: string | null
          total_cost: number | null
          total_qty_purchased: number | null
          total_units_behind_sample: number | null
          updated_at: string | null
          vendor_product_name: string | null
        }
        Insert: {
          account_id?: string | null
          account_uid?: string | null
          category?: string | null
          cost?: number | null
          created_at?: string | null
          date_of_purchase?: string | null
          date_timestamp_subm?: string | null
          deleted_at?: string | null
          display_name?: string | null
          email_email_of_user_who_added_product?: string | null
          glide_row_id?: string | null
          id?: string
          is_deleted?: boolean
          is_fronted?: boolean | null
          is_miscellaneous?: boolean | null
          is_paid?: boolean | null
          is_sample?: boolean | null
          is_sample_or_fronted?: boolean | null
          is_service?: boolean | null
          last_synced_at?: string | null
          new_product_name?: string | null
          new_product_sku?: string | null
          po_date?: string | null
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
          supabase_pdf_url?: string | null
          sync_direction?: string | null
          terms_for_fronted_product?: string | null
          total_cost?: number | null
          total_qty_purchased?: number | null
          total_units_behind_sample?: number | null
          updated_at?: string | null
          vendor_product_name?: string | null
        }
        Update: {
          account_id?: string | null
          account_uid?: string | null
          category?: string | null
          cost?: number | null
          created_at?: string | null
          date_of_purchase?: string | null
          date_timestamp_subm?: string | null
          deleted_at?: string | null
          display_name?: string | null
          email_email_of_user_who_added_product?: string | null
          glide_row_id?: string | null
          id?: string
          is_deleted?: boolean
          is_fronted?: boolean | null
          is_miscellaneous?: boolean | null
          is_paid?: boolean | null
          is_sample?: boolean | null
          is_sample_or_fronted?: boolean | null
          is_service?: boolean | null
          last_synced_at?: string | null
          new_product_name?: string | null
          new_product_sku?: string | null
          po_date?: string | null
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
          supabase_pdf_url?: string | null
          sync_direction?: string | null
          terms_for_fronted_product?: string | null
          total_cost?: number | null
          total_qty_purchased?: number | null
          total_units_behind_sample?: number | null
          updated_at?: string | null
          vendor_product_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gl_products_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "gl_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gl_products_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "gl_inventory_view"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "gl_products_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "mv_product_inventory"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "gl_products_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "v_non_match_messages_approval"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "gl_products_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "gl_purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gl_products_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "v_non_match_messages_approval"
            referencedColumns: ["existing_po_id"]
          },
        ]
      }
      gl_purchase_orders: {
        Row: {
          account_id: string | null
          balance: number | null
          created_at: string | null
          date_payment_date_mddyyyy: string | null
          glide_pdf_url: string | null
          glide_pdf_url_secondary: string | null
          glide_row_id: string | null
          id: string
          is_paid: boolean
          last_synced_at: string | null
          payment_status: string | null
          po_date: string | null
          po_notes: string | null
          product_count: number | null
          purchase_order_uid: string | null
          rowid_accounts: string | null
          supabase_pdf_url: string | null
          sync_direction: string | null
          total_amount: number | null
          total_paid: number | null
          updated_at: string | null
        }
        Insert: {
          account_id?: string | null
          balance?: number | null
          created_at?: string | null
          date_payment_date_mddyyyy?: string | null
          glide_pdf_url?: string | null
          glide_pdf_url_secondary?: string | null
          glide_row_id?: string | null
          id?: string
          is_paid?: boolean
          last_synced_at?: string | null
          payment_status?: string | null
          po_date?: string | null
          po_notes?: string | null
          product_count?: number | null
          purchase_order_uid?: string | null
          rowid_accounts?: string | null
          supabase_pdf_url?: string | null
          sync_direction?: string | null
          total_amount?: number | null
          total_paid?: number | null
          updated_at?: string | null
        }
        Update: {
          account_id?: string | null
          balance?: number | null
          created_at?: string | null
          date_payment_date_mddyyyy?: string | null
          glide_pdf_url?: string | null
          glide_pdf_url_secondary?: string | null
          glide_row_id?: string | null
          id?: string
          is_paid?: boolean
          last_synced_at?: string | null
          payment_status?: string | null
          po_date?: string | null
          po_notes?: string | null
          product_count?: number | null
          purchase_order_uid?: string | null
          rowid_accounts?: string | null
          supabase_pdf_url?: string | null
          sync_direction?: string | null
          total_amount?: number | null
          total_paid?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gl_purchase_orders_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "gl_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gl_purchase_orders_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "gl_inventory_view"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "gl_purchase_orders_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "mv_product_inventory"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "gl_purchase_orders_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "v_non_match_messages_approval"
            referencedColumns: ["account_id"]
          },
        ]
      }
      gl_shipping_records: {
        Row: {
          account_id: string | null
          box_sizes: string | null
          box_weight: number | null
          created_at: string | null
          drop_off_location_uid: string | null
          glide_row_id: string | null
          id: string
          invoice_id: string | null
          last_synced_at: string | null
          receiver_address: string | null
          receiver_name: string | null
          receiver_state: string | null
          rowid_accounts: string | null
          rowid_invoices: string | null
          secondary_account_id: string | null
          secondary_invoice_id: string | null
          sender_address: string | null
          sender_name_company: string | null
          sender_phone: string | null
          ship_date: string | null
          shipping_service: string | null
          sync_direction: string | null
          tertiary_account_id: string | null
          tertiary_invoice_id: string | null
          tp_id: string | null
          tracking_number: string | null
          updated_at: string | null
        }
        Insert: {
          account_id?: string | null
          box_sizes?: string | null
          box_weight?: number | null
          created_at?: string | null
          drop_off_location_uid?: string | null
          glide_row_id?: string | null
          id?: string
          invoice_id?: string | null
          last_synced_at?: string | null
          receiver_address?: string | null
          receiver_name?: string | null
          receiver_state?: string | null
          rowid_accounts?: string | null
          rowid_invoices?: string | null
          secondary_account_id?: string | null
          secondary_invoice_id?: string | null
          sender_address?: string | null
          sender_name_company?: string | null
          sender_phone?: string | null
          ship_date?: string | null
          shipping_service?: string | null
          sync_direction?: string | null
          tertiary_account_id?: string | null
          tertiary_invoice_id?: string | null
          tp_id?: string | null
          tracking_number?: string | null
          updated_at?: string | null
        }
        Update: {
          account_id?: string | null
          box_sizes?: string | null
          box_weight?: number | null
          created_at?: string | null
          drop_off_location_uid?: string | null
          glide_row_id?: string | null
          id?: string
          invoice_id?: string | null
          last_synced_at?: string | null
          receiver_address?: string | null
          receiver_name?: string | null
          receiver_state?: string | null
          rowid_accounts?: string | null
          rowid_invoices?: string | null
          secondary_account_id?: string | null
          secondary_invoice_id?: string | null
          sender_address?: string | null
          sender_name_company?: string | null
          sender_phone?: string | null
          ship_date?: string | null
          shipping_service?: string | null
          sync_direction?: string | null
          tertiary_account_id?: string | null
          tertiary_invoice_id?: string | null
          tp_id?: string | null
          tracking_number?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gl_shipping_records_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "gl_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gl_shipping_records_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "gl_inventory_view"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "gl_shipping_records_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "mv_product_inventory"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "gl_shipping_records_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "v_non_match_messages_approval"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "gl_shipping_records_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "gl_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gl_shipping_records_secondary_account_id_fkey"
            columns: ["secondary_account_id"]
            isOneToOne: false
            referencedRelation: "gl_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gl_shipping_records_secondary_account_id_fkey"
            columns: ["secondary_account_id"]
            isOneToOne: false
            referencedRelation: "gl_inventory_view"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "gl_shipping_records_secondary_account_id_fkey"
            columns: ["secondary_account_id"]
            isOneToOne: false
            referencedRelation: "mv_product_inventory"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "gl_shipping_records_secondary_account_id_fkey"
            columns: ["secondary_account_id"]
            isOneToOne: false
            referencedRelation: "v_non_match_messages_approval"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "gl_shipping_records_secondary_invoice_id_fkey"
            columns: ["secondary_invoice_id"]
            isOneToOne: false
            referencedRelation: "gl_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gl_shipping_records_tertiary_account_id_fkey"
            columns: ["tertiary_account_id"]
            isOneToOne: false
            referencedRelation: "gl_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gl_shipping_records_tertiary_account_id_fkey"
            columns: ["tertiary_account_id"]
            isOneToOne: false
            referencedRelation: "gl_inventory_view"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "gl_shipping_records_tertiary_account_id_fkey"
            columns: ["tertiary_account_id"]
            isOneToOne: false
            referencedRelation: "mv_product_inventory"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "gl_shipping_records_tertiary_account_id_fkey"
            columns: ["tertiary_account_id"]
            isOneToOne: false
            referencedRelation: "v_non_match_messages_approval"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "gl_shipping_records_tertiary_invoice_id_fkey"
            columns: ["tertiary_invoice_id"]
            isOneToOne: false
            referencedRelation: "gl_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      gl_sync_errors: {
        Row: {
          created_at: string | null
          error_message: string | null
          error_type: string | null
          id: string
          is_retryable: boolean | null
          mapping_id: string | null
          record_data: Json | null
          resolved_at: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          error_type?: string | null
          id?: string
          is_retryable?: boolean | null
          mapping_id?: string | null
          record_data?: Json | null
          resolved_at?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          error_type?: string | null
          id?: string
          is_retryable?: boolean | null
          mapping_id?: string | null
          record_data?: Json | null
          resolved_at?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_mapping"
            columns: ["mapping_id"]
            isOneToOne: false
            referencedRelation: "gl_mapping_status"
            referencedColumns: ["mapping_id"]
          },
          {
            foreignKeyName: "fk_mapping"
            columns: ["mapping_id"]
            isOneToOne: false
            referencedRelation: "gl_mappings"
            referencedColumns: ["id"]
          },
        ]
      }
      gl_sync_history: {
        Row: {
          completed_at: string | null
          details: Json | null
          error_message: string | null
          id: string
          mapping_id: string
          records_processed: number | null
          started_at: string
          status: string
        }
        Insert: {
          completed_at?: string | null
          details?: Json | null
          error_message?: string | null
          id?: string
          mapping_id: string
          records_processed?: number | null
          started_at?: string
          status: string
        }
        Update: {
          completed_at?: string | null
          details?: Json | null
          error_message?: string | null
          id?: string
          mapping_id?: string
          records_processed?: number | null
          started_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "gl_sync_history_mapping_id_fkey"
            columns: ["mapping_id"]
            isOneToOne: false
            referencedRelation: "gl_mapping_status"
            referencedColumns: ["mapping_id"]
          },
          {
            foreignKeyName: "gl_sync_history_mapping_id_fkey"
            columns: ["mapping_id"]
            isOneToOne: false
            referencedRelation: "gl_mappings"
            referencedColumns: ["id"]
          },
        ]
      }
      gl_sync_logs: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          is_processing: boolean | null
          mapping_id: string | null
          message: string | null
          processing_started_at: string | null
          records_processed: number | null
          started_at: string | null
          status: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          is_processing?: boolean | null
          mapping_id?: string | null
          message?: string | null
          processing_started_at?: string | null
          records_processed?: number | null
          started_at?: string | null
          status: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          is_processing?: boolean | null
          mapping_id?: string | null
          message?: string | null
          processing_started_at?: string | null
          records_processed?: number | null
          started_at?: string | null
          status?: string
        }
        Relationships: []
      }
      gl_sync_metrics: {
        Row: {
          duration_ms: number | null
          id: string
          mapping_id: string | null
          records_failed: number | null
          records_processed: number | null
          sync_direction: string | null
          timestamp: string | null
        }
        Insert: {
          duration_ms?: number | null
          id?: string
          mapping_id?: string | null
          records_failed?: number | null
          records_processed?: number | null
          sync_direction?: string | null
          timestamp?: string | null
        }
        Update: {
          duration_ms?: number | null
          id?: string
          mapping_id?: string | null
          records_failed?: number | null
          records_processed?: number | null
          sync_direction?: string | null
          timestamp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gl_sync_metrics_mapping_id_fkey"
            columns: ["mapping_id"]
            isOneToOne: false
            referencedRelation: "gl_mapping_status"
            referencedColumns: ["mapping_id"]
          },
          {
            foreignKeyName: "gl_sync_metrics_mapping_id_fkey"
            columns: ["mapping_id"]
            isOneToOne: false
            referencedRelation: "gl_mappings"
            referencedColumns: ["id"]
          },
        ]
      }
      gl_sync_status: {
        Row: {
          completed_at: string | null
          created_at: string | null
          id: string
          metadata: Json | null
          started_at: string
          status: string
          sync_type: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          started_at?: string
          status: string
          sync_type: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          started_at?: string
          status?: string
          sync_type?: string
        }
        Relationships: []
      }
      gl_vendor_payments: {
        Row: {
          account_id: string | null
          created_at: string | null
          date_of_payment: string | null
          date_of_purchase_order: string | null
          glide_row_id: string | null
          id: string
          last_synced_at: string | null
          payment_amount: number | null
          payment_document_type:
            | Database["public"]["Enums"]["payment_document_type_enum"]
            | null
          payment_method:
            | Database["public"]["Enums"]["payment_method_enum"]
            | null
          payment_note: string | null
          product_id: string | null
          purchase_order_id: string | null
          rowid_accounts: string | null
          rowid_products: string | null
          rowid_purchase_orders: string | null
          sync_direction: string | null
          updated_at: string | null
        }
        Insert: {
          account_id?: string | null
          created_at?: string | null
          date_of_payment?: string | null
          date_of_purchase_order?: string | null
          glide_row_id?: string | null
          id?: string
          last_synced_at?: string | null
          payment_amount?: number | null
          payment_document_type?:
            | Database["public"]["Enums"]["payment_document_type_enum"]
            | null
          payment_method?:
            | Database["public"]["Enums"]["payment_method_enum"]
            | null
          payment_note?: string | null
          product_id?: string | null
          purchase_order_id?: string | null
          rowid_accounts?: string | null
          rowid_products?: string | null
          rowid_purchase_orders?: string | null
          sync_direction?: string | null
          updated_at?: string | null
        }
        Update: {
          account_id?: string | null
          created_at?: string | null
          date_of_payment?: string | null
          date_of_purchase_order?: string | null
          glide_row_id?: string | null
          id?: string
          last_synced_at?: string | null
          payment_amount?: number | null
          payment_document_type?:
            | Database["public"]["Enums"]["payment_document_type_enum"]
            | null
          payment_method?:
            | Database["public"]["Enums"]["payment_method_enum"]
            | null
          payment_note?: string | null
          product_id?: string | null
          purchase_order_id?: string | null
          rowid_accounts?: string | null
          rowid_products?: string | null
          rowid_purchase_orders?: string | null
          sync_direction?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gl_vendor_payments_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "gl_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gl_vendor_payments_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "gl_inventory_view"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "gl_vendor_payments_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "mv_product_inventory"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "gl_vendor_payments_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "v_non_match_messages_approval"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "gl_vendor_payments_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "gl_inventory_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gl_vendor_payments_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "gl_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gl_vendor_payments_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "mv_product_inventory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gl_vendor_payments_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_messages_gl_products_linked"
            referencedColumns: ["gl_product_id"]
          },
          {
            foreignKeyName: "gl_vendor_payments_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "gl_purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gl_vendor_payments_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "v_non_match_messages_approval"
            referencedColumns: ["existing_po_id"]
          },
        ]
      }
      glide_sync_queue: {
        Row: {
          created_at: string
          error_details: Json | null
          glide_row_id: string | null
          glide_table_name: string | null
          id: string
          last_attempt_at: string | null
          operation_type: Database["public"]["Enums"]["glide_operation_type"]
          payload_supabase: Json | null
          processed_at: string | null
          retry_count: number | null
          status: Database["public"]["Enums"]["glide_sync_status"]
          supabase_row_id: string
          supabase_table_name: string
          sync_priority: number | null
        }
        Insert: {
          created_at?: string
          error_details?: Json | null
          glide_row_id?: string | null
          glide_table_name?: string | null
          id?: string
          last_attempt_at?: string | null
          operation_type: Database["public"]["Enums"]["glide_operation_type"]
          payload_supabase?: Json | null
          processed_at?: string | null
          retry_count?: number | null
          status?: Database["public"]["Enums"]["glide_sync_status"]
          supabase_row_id: string
          supabase_table_name: string
          sync_priority?: number | null
        }
        Update: {
          created_at?: string
          error_details?: Json | null
          glide_row_id?: string | null
          glide_table_name?: string | null
          id?: string
          last_attempt_at?: string | null
          operation_type?: Database["public"]["Enums"]["glide_operation_type"]
          payload_supabase?: Json | null
          processed_at?: string | null
          retry_count?: number | null
          status?: Database["public"]["Enums"]["glide_sync_status"]
          supabase_row_id?: string
          supabase_table_name?: string
          sync_priority?: number | null
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
          chat_type: string | null
          correlation_id: string | null
          created_at: string
          deleted_from_telegram: boolean | null
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
          forward_from: Json | null
          forward_from_chat: Json | null
          forward_info: Json | null
          glide_row_id: string | null
          group_caption_synced: boolean | null
          height: number | null
          id: string
          is_channel_post: boolean | null
          is_duplicate: boolean | null
          is_edit: boolean | null
          is_edited: boolean | null
          is_edited_channel_post: boolean | null
          is_forward: boolean | null
          is_miscellaneous_item: boolean | null
          is_original_caption: boolean | null
          last_edited_at: string | null
          last_error_at: string | null
          last_processing_attempt: string | null
          last_synced_at: string | null
          media_group_id: string | null
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
          old_product_sku: string | null
          original_file_id: string | null
          original_message_id: string | null
          processing_attempts: number | null
          processing_error: string | null
          processing_state: Database["public"]["Enums"]["processing_state_type"]
          product_code: string | null
          product_id: string | null
          product_link_confidence: number | null
          product_link_correlation_id: string | null
          product_link_date: string | null
          product_link_method: string | null
          product_linked: boolean | null
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
          updated_at: string
          vendor_uid: string | null
          width: number | null
        }
        Insert: {
          analyzed_content?: Json | null
          caption?: string | null
          caption_data?: Json | null
          chat_id?: number | null
          chat_title?: string | null
          chat_type?: string | null
          correlation_id?: string | null
          created_at?: string
          deleted_from_telegram?: boolean | null
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
          forward_from?: Json | null
          forward_from_chat?: Json | null
          forward_info?: Json | null
          glide_row_id?: string | null
          group_caption_synced?: boolean | null
          height?: number | null
          id?: string
          is_channel_post?: boolean | null
          is_duplicate?: boolean | null
          is_edit?: boolean | null
          is_edited?: boolean | null
          is_edited_channel_post?: boolean | null
          is_forward?: boolean | null
          is_miscellaneous_item?: boolean | null
          is_original_caption?: boolean | null
          last_edited_at?: string | null
          last_error_at?: string | null
          last_processing_attempt?: string | null
          last_synced_at?: string | null
          media_group_id?: string | null
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
          old_product_sku?: string | null
          original_file_id?: string | null
          original_message_id?: string | null
          processing_attempts?: number | null
          processing_error?: string | null
          processing_state?: Database["public"]["Enums"]["processing_state_type"]
          product_code?: string | null
          product_id?: string | null
          product_link_confidence?: number | null
          product_link_correlation_id?: string | null
          product_link_date?: string | null
          product_link_method?: string | null
          product_linked?: boolean | null
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
          updated_at?: string
          vendor_uid?: string | null
          width?: number | null
        }
        Update: {
          analyzed_content?: Json | null
          caption?: string | null
          caption_data?: Json | null
          chat_id?: number | null
          chat_title?: string | null
          chat_type?: string | null
          correlation_id?: string | null
          created_at?: string
          deleted_from_telegram?: boolean | null
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
          forward_from?: Json | null
          forward_from_chat?: Json | null
          forward_info?: Json | null
          glide_row_id?: string | null
          group_caption_synced?: boolean | null
          height?: number | null
          id?: string
          is_channel_post?: boolean | null
          is_duplicate?: boolean | null
          is_edit?: boolean | null
          is_edited?: boolean | null
          is_edited_channel_post?: boolean | null
          is_forward?: boolean | null
          is_miscellaneous_item?: boolean | null
          is_original_caption?: boolean | null
          last_edited_at?: string | null
          last_error_at?: string | null
          last_processing_attempt?: string | null
          last_synced_at?: string | null
          media_group_id?: string | null
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
          old_product_sku?: string | null
          original_file_id?: string | null
          original_message_id?: string | null
          processing_attempts?: number | null
          processing_error?: string | null
          processing_state?: Database["public"]["Enums"]["processing_state_type"]
          product_code?: string | null
          product_id?: string | null
          product_link_confidence?: number | null
          product_link_correlation_id?: string | null
          product_link_date?: string | null
          product_link_method?: string | null
          product_linked?: boolean | null
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
          updated_at?: string
          vendor_uid?: string | null
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
          {
            foreignKeyName: "messages_message_caption_id_fkey"
            columns: ["message_caption_id"]
            isOneToOne: false
            referencedRelation: "v_messages_gl_products_linked"
            referencedColumns: ["message_id"]
          },
          {
            foreignKeyName: "messages_message_caption_id_fkey"
            columns: ["message_caption_id"]
            isOneToOne: false
            referencedRelation: "v_non_match_messages_approval"
            referencedColumns: ["message_id"]
          },
          {
            foreignKeyName: "messages_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "gl_inventory_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "gl_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "mv_product_inventory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_messages_gl_products_linked"
            referencedColumns: ["gl_product_id"]
          },
        ]
      }
      mv_refresh_logs: {
        Row: {
          created_at: string | null
          error_message: string | null
          id: string
          refresh_completed_at: string | null
          refresh_duration: unknown | null
          refresh_started_at: string
          refresh_status: string
          refresh_type: string
          rows_affected: number | null
          view_name: string
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          id?: string
          refresh_completed_at?: string | null
          refresh_duration?: unknown | null
          refresh_started_at: string
          refresh_status?: string
          refresh_type?: string
          rows_affected?: number | null
          view_name: string
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          id?: string
          refresh_completed_at?: string | null
          refresh_duration?: unknown | null
          refresh_started_at?: string
          refresh_status?: string
          refresh_type?: string
          rows_affected?: number | null
          view_name?: string
        }
        Relationships: []
      }
      non_match_messages_products: {
        Row: {
          approval_status: string
          approved_at: string | null
          approved_by: string | null
          confidence_score: number | null
          correlation_id: string | null
          created_at: string | null
          created_product_id: string | null
          created_purchase_order_id: string | null
          estimated_quantity: number | null
          estimated_total_cost: number | null
          estimated_unit_cost: number | null
          final_date_of_purchase: string | null
          final_is_paid: boolean | null
          final_is_sample: boolean | null
          final_product_category: string | null
          final_product_name: string | null
          final_quantity: number | null
          final_total_cost: number | null
          final_unit_cost: number | null
          id: string
          media_count: number | null
          media_group_id: string | null
          media_urls: Json | null
          message_id: string
          missing_fields: Json | null
          parsing_metadata: Json | null
          po_notes: string | null
          processing_error: string | null
          processing_notes: string | null
          product_category: string | null
          product_name: string
          product_sku: string | null
          purchase_date: string | null
          purchase_order_uid: string | null
          rejection_reason: string | null
          updated_at: string | null
          vendor_name: string | null
          vendor_payment_needed: boolean | null
          vendor_uid: string | null
        }
        Insert: {
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          confidence_score?: number | null
          correlation_id?: string | null
          created_at?: string | null
          created_product_id?: string | null
          created_purchase_order_id?: string | null
          estimated_quantity?: number | null
          estimated_total_cost?: number | null
          estimated_unit_cost?: number | null
          final_date_of_purchase?: string | null
          final_is_paid?: boolean | null
          final_is_sample?: boolean | null
          final_product_category?: string | null
          final_product_name?: string | null
          final_quantity?: number | null
          final_total_cost?: number | null
          final_unit_cost?: number | null
          id?: string
          media_count?: number | null
          media_group_id?: string | null
          media_urls?: Json | null
          message_id: string
          missing_fields?: Json | null
          parsing_metadata?: Json | null
          po_notes?: string | null
          processing_error?: string | null
          processing_notes?: string | null
          product_category?: string | null
          product_name: string
          product_sku?: string | null
          purchase_date?: string | null
          purchase_order_uid?: string | null
          rejection_reason?: string | null
          updated_at?: string | null
          vendor_name?: string | null
          vendor_payment_needed?: boolean | null
          vendor_uid?: string | null
        }
        Update: {
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          confidence_score?: number | null
          correlation_id?: string | null
          created_at?: string | null
          created_product_id?: string | null
          created_purchase_order_id?: string | null
          estimated_quantity?: number | null
          estimated_total_cost?: number | null
          estimated_unit_cost?: number | null
          final_date_of_purchase?: string | null
          final_is_paid?: boolean | null
          final_is_sample?: boolean | null
          final_product_category?: string | null
          final_product_name?: string | null
          final_quantity?: number | null
          final_total_cost?: number | null
          final_unit_cost?: number | null
          id?: string
          media_count?: number | null
          media_group_id?: string | null
          media_urls?: Json | null
          message_id?: string
          missing_fields?: Json | null
          parsing_metadata?: Json | null
          po_notes?: string | null
          processing_error?: string | null
          processing_notes?: string | null
          product_category?: string | null
          product_name?: string
          product_sku?: string | null
          purchase_date?: string | null
          purchase_order_uid?: string | null
          rejection_reason?: string | null
          updated_at?: string | null
          vendor_name?: string | null
          vendor_payment_needed?: boolean | null
          vendor_uid?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "non_match_messages_products_created_product_id_fkey"
            columns: ["created_product_id"]
            isOneToOne: false
            referencedRelation: "gl_inventory_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "non_match_messages_products_created_product_id_fkey"
            columns: ["created_product_id"]
            isOneToOne: false
            referencedRelation: "gl_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "non_match_messages_products_created_product_id_fkey"
            columns: ["created_product_id"]
            isOneToOne: false
            referencedRelation: "mv_product_inventory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "non_match_messages_products_created_product_id_fkey"
            columns: ["created_product_id"]
            isOneToOne: false
            referencedRelation: "v_messages_gl_products_linked"
            referencedColumns: ["gl_product_id"]
          },
          {
            foreignKeyName: "non_match_messages_products_created_purchase_order_id_fkey"
            columns: ["created_purchase_order_id"]
            isOneToOne: false
            referencedRelation: "gl_purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "non_match_messages_products_created_purchase_order_id_fkey"
            columns: ["created_purchase_order_id"]
            isOneToOne: false
            referencedRelation: "v_non_match_messages_approval"
            referencedColumns: ["existing_po_id"]
          },
          {
            foreignKeyName: "non_match_messages_products_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "non_match_messages_products_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "v_messages_gl_products_linked"
            referencedColumns: ["message_id"]
          },
          {
            foreignKeyName: "non_match_messages_products_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "v_non_match_messages_approval"
            referencedColumns: ["message_id"]
          },
        ]
      }
      other_messages: {
        Row: {
          analyzed_content: Json | null
          chat_id: number
          chat_title: string | null
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
      supabase_to_glide_logs: {
        Row: {
          api_response: Json | null
          batch_size: number | null
          duration_ms: number | null
          error_message: string | null
          glide_table: string | null
          id: string
          initiated_by: string | null
          mapping_id: string | null
          metadata: Json | null
          operation_type: string
          records_created: number | null
          records_failed: number | null
          records_processed: number | null
          records_updated: number | null
          request_payload: Json | null
          stack_trace: string | null
          status: string
          supabase_table: string
          sync_direction: string
          timestamp: string | null
        }
        Insert: {
          api_response?: Json | null
          batch_size?: number | null
          duration_ms?: number | null
          error_message?: string | null
          glide_table?: string | null
          id?: string
          initiated_by?: string | null
          mapping_id?: string | null
          metadata?: Json | null
          operation_type: string
          records_created?: number | null
          records_failed?: number | null
          records_processed?: number | null
          records_updated?: number | null
          request_payload?: Json | null
          stack_trace?: string | null
          status: string
          supabase_table: string
          sync_direction?: string
          timestamp?: string | null
        }
        Update: {
          api_response?: Json | null
          batch_size?: number | null
          duration_ms?: number | null
          error_message?: string | null
          glide_table?: string | null
          id?: string
          initiated_by?: string | null
          mapping_id?: string | null
          metadata?: Json | null
          operation_type?: string
          records_created?: number | null
          records_failed?: number | null
          records_processed?: number | null
          records_updated?: number | null
          request_payload?: Json | null
          stack_trace?: string | null
          status?: string
          supabase_table?: string
          sync_direction?: string
          timestamp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supabase_to_glide_logs_mapping_id_fkey"
            columns: ["mapping_id"]
            isOneToOne: false
            referencedRelation: "gl_mapping_status"
            referencedColumns: ["mapping_id"]
          },
          {
            foreignKeyName: "supabase_to_glide_logs_mapping_id_fkey"
            columns: ["mapping_id"]
            isOneToOne: false
            referencedRelation: "gl_mappings"
            referencedColumns: ["id"]
          },
        ]
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
    }
    Views: {
      gl_expense_category_summary: {
        Row: {
          budget_amount: number | null
          budget_usage_percent: number | null
          category: string | null
          color_code: string | null
          created_at: string | null
          description: string | null
          expense_count: number | null
          icon_name: string | null
          id: string | null
          is_active: boolean | null
          last_expense_date: string | null
          sort_order: number | null
          total_spent: number | null
          updated_at: string | null
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
          display_name: string | null
          estimate_count: number | null
          glide_row_id: string | null
          id: string | null
          inventory_turnover_rate: number | null
          invoice_count: number | null
          is_fronted: boolean | null
          is_sample: boolean | null
          is_sample_or_fronted: boolean | null
          is_service: boolean | null
          last_payment_date: string | null
          last_sale_date: string | null
          name: string | null
          new_product_name: string | null
          payment_count: number | null
          pct_sold: number | null
          po_balance: number | null
          po_date: string | null
          po_payment_status: string | null
          po_total_amount: number | null
          po_total_paid: number | null
          product_name: string | null
          product_sku: string | null
          profit: number | null
          profit_margin: number | null
          public_url_image: string | null
          public_url_video: string | null
          purchase_note: string | null
          purchase_order_id: string | null
          purchase_order_uid: string | null
          qty_committed: number | null
          qty_remaining: number | null
          qty_sampled: number | null
          qty_sold: number | null
          revenue: number | null
          rowid_accounts: string | null
          rowid_purchase_orders: string | null
          rowid_vendor_payments: string | null
          sample_estimate_count: number | null
          selling_price: number | null
          stock_quantity: number | null
          total_cost: number | null
          total_qty_purchased: number | null
          updated_at: string | null
          vendor_account_id: string | null
          vendor_balance: number | null
          vendor_id: string | null
          vendor_name: string | null
          vendor_payment_total: number | null
          vendor_product_name: string | null
          vendor_uid: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gl_products_account_id_fkey"
            columns: ["vendor_account_id"]
            isOneToOne: false
            referencedRelation: "gl_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gl_products_account_id_fkey"
            columns: ["vendor_account_id"]
            isOneToOne: false
            referencedRelation: "gl_inventory_view"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "gl_products_account_id_fkey"
            columns: ["vendor_account_id"]
            isOneToOne: false
            referencedRelation: "mv_product_inventory"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "gl_products_account_id_fkey"
            columns: ["vendor_account_id"]
            isOneToOne: false
            referencedRelation: "v_non_match_messages_approval"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "gl_products_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "gl_purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gl_products_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "v_non_match_messages_approval"
            referencedColumns: ["existing_po_id"]
          },
        ]
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
      gl_portal_pending_payments_view: {
        Row: {
          account_id: string | null
          account_name: string | null
          admin_action_at: string | null
          admin_approver_id: string | null
          admin_notes: string | null
          converted_payment_id: string | null
          customer_notes: string | null
          document_balance: number | null
          document_number: string | null
          document_total: number | null
          document_type: string | null
          estimate_id: string | null
          estimate_number: string | null
          id: string | null
          invoice_id: string | null
          invoice_number: string | null
          payment_method_hint: string | null
          shared_document_id: string | null
          status: string | null
          submission_date: string | null
          submitted_amount: number | null
        }
        Relationships: [
          {
            foreignKeyName: "gl_portal_pending_payments_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "gl_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gl_portal_pending_payments_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "gl_inventory_view"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "gl_portal_pending_payments_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "mv_product_inventory"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "gl_portal_pending_payments_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "v_non_match_messages_approval"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "gl_portal_pending_payments_estimate_id_fkey"
            columns: ["estimate_id"]
            isOneToOne: false
            referencedRelation: "gl_estimates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gl_portal_pending_payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "gl_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gl_portal_pending_payments_shared_document_id_fkey"
            columns: ["shared_document_id"]
            isOneToOne: false
            referencedRelation: "gl_document_shares"
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
        Relationships: [
          {
            foreignKeyName: "gl_sync_history_mapping_id_fkey"
            columns: ["mapping_id"]
            isOneToOne: false
            referencedRelation: "gl_mapping_status"
            referencedColumns: ["mapping_id"]
          },
          {
            foreignKeyName: "gl_sync_history_mapping_id_fkey"
            columns: ["mapping_id"]
            isOneToOne: false
            referencedRelation: "gl_mappings"
            referencedColumns: ["id"]
          },
        ]
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
      mv_monthly_finance_summary: {
        Row: {
          avg_revenue_per_invoice: number | null
          cost_of_goods_sold: number | null
          count_expenses: number | null
          count_invoices: number | null
          count_purchase_orders: number | null
          count_regular_estimates: number | null
          count_sample_estimates: number | null
          count_shipping_records: number | null
          count_total_estimates: number | null
          expense_to_revenue_ratio_percent: number | null
          gross_profit: number | null
          gross_profit_margin_percent: number | null
          month: string | null
          new_customers_count: number | null
          operating_profit: number | null
          operating_profit_margin_percent: number | null
          outstanding_invoice_balance: number | null
          outstanding_payables_po: number | null
          outstanding_po_balance: number | null
          outstanding_receivables: number | null
          outstanding_regular_estimates_balance: number | null
          outstanding_sample_estimates_balance: number | null
          total_expenses: number | null
          total_invoice_amount: number | null
          total_operating_expenses: number | null
          total_purchase_order_amount: number | null
          total_purchase_order_value: number | null
          total_revenue: number | null
          total_value_estimates_created: number | null
        }
        Relationships: []
      }
      mv_product_inventory: {
        Row: {
          category: string | null
          cost: number | null
          created_at: string | null
          date_of_purchase: string | null
          days_in_inventory: number | null
          days_since_last_sale: number | null
          display_name: string | null
          estimate_count: number | null
          glide_row_id: string | null
          id: string | null
          inventory_turnover_rate: number | null
          invoice_count: number | null
          is_fronted: boolean | null
          is_sample: boolean | null
          is_sample_or_fronted: boolean | null
          is_service: boolean | null
          last_payment_date: string | null
          last_sale_date: string | null
          name: string | null
          new_product_name: string | null
          payment_count: number | null
          pct_sold: number | null
          po_balance: number | null
          po_date: string | null
          po_payment_status: string | null
          po_total_amount: number | null
          po_total_paid: number | null
          product_name: string | null
          product_sku: string | null
          profit: number | null
          profit_margin: number | null
          public_url_image: string | null
          public_url_video: string | null
          purchase_note: string | null
          purchase_order_id: string | null
          purchase_order_uid: string | null
          qty_committed: number | null
          qty_remaining: number | null
          qty_sampled: number | null
          qty_sold: number | null
          revenue: number | null
          rowid_accounts: string | null
          rowid_purchase_orders: string | null
          rowid_vendor_payments: string | null
          sample_estimate_count: number | null
          selling_price: number | null
          stock_quantity: number | null
          total_cost: number | null
          total_qty_purchased: number | null
          updated_at: string | null
          vendor_account_id: string | null
          vendor_balance: number | null
          vendor_id: string | null
          vendor_name: string | null
          vendor_payment_total: number | null
          vendor_product_name: string | null
          vendor_uid: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gl_products_account_id_fkey"
            columns: ["vendor_account_id"]
            isOneToOne: false
            referencedRelation: "gl_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gl_products_account_id_fkey"
            columns: ["vendor_account_id"]
            isOneToOne: false
            referencedRelation: "gl_inventory_view"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "gl_products_account_id_fkey"
            columns: ["vendor_account_id"]
            isOneToOne: false
            referencedRelation: "mv_product_inventory"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "gl_products_account_id_fkey"
            columns: ["vendor_account_id"]
            isOneToOne: false
            referencedRelation: "v_non_match_messages_approval"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "gl_products_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "gl_purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gl_products_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "v_non_match_messages_approval"
            referencedColumns: ["existing_po_id"]
          },
        ]
      }
      v_messages_gl_products_linked: {
        Row: {
          caption: string | null
          gl_category: string | null
          gl_new_product_sku: string | null
          gl_photo_url: string | null
          gl_product_created_at: string | null
          gl_product_id: string | null
          gl_product_sku: string | null
          gl_video_url: string | null
          glide_row_id: string | null
          media_type: string | null
          message_created_at: string | null
          message_id: string | null
          message_product_sku: string | null
          message_public_url: string | null
          new_product_name: string | null
          product_link_confidence: number | null
          product_link_date: string | null
          product_link_method: string | null
          product_linked: boolean | null
          telegram_message_id: number | null
          vendor_product_name: string | null
        }
        Relationships: []
      }
      v_non_match_messages_approval: {
        Row: {
          account_id: string | null
          analyzed_content: Json | null
          approval_status: string | null
          approved_at: string | null
          approved_by: string | null
          confidence_level: string | null
          confidence_score: number | null
          created_at: string | null
          created_product_id: string | null
          created_purchase_order_id: string | null
          data_completeness: string | null
          estimated_quantity: number | null
          estimated_total_cost: number | null
          estimated_unit_cost: number | null
          existing_po_date: string | null
          existing_po_id: string | null
          existing_po_status: string | null
          existing_po_total: number | null
          final_product_category: string | null
          final_product_name: string | null
          final_quantity: number | null
          final_total_cost: number | null
          final_unit_cost: number | null
          id: string | null
          media_count: number | null
          media_group_id: string | null
          media_type: string | null
          media_urls: Json | null
          message_created_at: string | null
          message_id: string | null
          message_media_url: string | null
          missing_fields: Json | null
          original_caption: string | null
          other_messages_same_po: number | null
          po_exists: boolean | null
          processing_error: string | null
          processing_notes: string | null
          product_category: string | null
          product_name: string | null
          product_sku: string | null
          purchase_date: string | null
          purchase_order_uid: string | null
          rejection_reason: string | null
          updated_at: string | null
          vendor_account_uid: string | null
          vendor_company_name: string | null
          vendor_name: string | null
          vendor_uid: string | null
        }
        Relationships: [
          {
            foreignKeyName: "non_match_messages_products_created_product_id_fkey"
            columns: ["created_product_id"]
            isOneToOne: false
            referencedRelation: "gl_inventory_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "non_match_messages_products_created_product_id_fkey"
            columns: ["created_product_id"]
            isOneToOne: false
            referencedRelation: "gl_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "non_match_messages_products_created_product_id_fkey"
            columns: ["created_product_id"]
            isOneToOne: false
            referencedRelation: "mv_product_inventory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "non_match_messages_products_created_product_id_fkey"
            columns: ["created_product_id"]
            isOneToOne: false
            referencedRelation: "v_messages_gl_products_linked"
            referencedColumns: ["gl_product_id"]
          },
          {
            foreignKeyName: "non_match_messages_products_created_purchase_order_id_fkey"
            columns: ["created_purchase_order_id"]
            isOneToOne: false
            referencedRelation: "gl_purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "non_match_messages_products_created_purchase_order_id_fkey"
            columns: ["created_purchase_order_id"]
            isOneToOne: false
            referencedRelation: "v_non_match_messages_approval"
            referencedColumns: ["existing_po_id"]
          },
        ]
      }
    }
    Functions: {
      add_estimate_line: {
        Args: {
          p_estimate_id: string
          p_product_id?: string
          p_qty_sold?: number
          p_selling_price?: number
          p_sale_note?: string
          p_sale_product_name?: string
        }
        Returns: string
      }
      add_invoice_line: {
        Args: {
          p_invoice_id: string
          p_product_id?: string
          p_qty_sold?: number
          p_selling_price?: number
          p_sale_note?: string
          p_renamed_product_name?: string
        }
        Returns: string
      }
      api_add_estimate_line: {
        Args: {
          p_estimate_id: string
          p_product_id?: string
          p_qty_sold?: number
          p_selling_price?: number
          p_sale_note?: string
          p_sale_product_name?: string
        }
        Returns: Json
      }
      api_add_invoice_line: {
        Args: {
          p_invoice_id: string
          p_product_id?: string
          p_qty_sold?: number
          p_selling_price?: number
          p_sale_note?: string
          p_renamed_product_name?: string
        }
        Returns: Json
      }
      api_add_product_to_po: {
        Args: {
          purchase_order_id: string
          vendor_product_name: string
          new_product_name?: string
          total_qty_purchased?: number
          cost?: number
          is_sample_or_fronted?: boolean
          is_fronted?: boolean
          is_sample?: boolean
          terms_for_fronted_product?: string
          total_units_behind_sample?: number
          is_miscellaneous?: boolean
          category?: string
          purchase_note?: string
          is_paid?: boolean
        }
        Returns: Json
      }
      api_apply_estimate_credit: {
        Args: {
          p_estimate_id: string
          p_payment_amount: number
          p_date_of_payment?: string
          p_payment_type?: string
          p_payment_note?: string
        }
        Returns: Json
      }
      api_convert_estimate_to_invoice: {
        Args: { p_estimate_id: string }
        Returns: Json
      }
      api_create_estimate: {
        Args: {
          p_account_id: string
          p_estimate_date?: string
          p_is_a_sample?: boolean
          p_notes?: string
        }
        Returns: Json
      }
      api_create_invoice: {
        Args: {
          p_account_id: string
          p_date_of_invoice?: string
          p_notes?: string
        }
        Returns: Json
      }
      api_create_po_with_product: {
        Args: {
          account_id: string
          vendor_product_name: string
          po_date?: string
          new_product_name?: string
          total_qty_purchased?: number
          cost?: number
          is_sample_or_fronted?: boolean
          is_fronted?: boolean
          is_sample?: boolean
          terms_for_fronted_product?: string
          total_units_behind_sample?: number
          is_miscellaneous?: boolean
          category?: string
          purchase_note?: string
          is_paid?: boolean
        }
        Returns: Json
      }
      api_create_purchase_order: {
        Args: { account_id: string; po_date?: string }
        Returns: Json
      }
      api_finalize_estimate: {
        Args: { p_estimate_id: string }
        Returns: Json
      }
      api_finalize_invoice: {
        Args: { p_invoice_id: string }
        Returns: Json
      }
      api_get_estimate_details: {
        Args: { p_estimate_id: string }
        Returns: Json
      }
      api_get_invoice_details: {
        Args: { p_invoice_id: string }
        Returns: Json
      }
      api_get_purchase_order_products: {
        Args: { purchase_order_id: string }
        Returns: Json
      }
      api_get_vendor_purchase_orders: {
        Args: { vendor_id: string }
        Returns: Json
      }
      api_get_vendors: {
        Args: Record<PropertyKey, never>
        Returns: {
          id: string
          account_name: string
          accounts_uid: string
          is_vendor: boolean
        }[]
      }
      api_record_invoice_payment: {
        Args: {
          p_invoice_id: string
          p_payment_amount: number
          p_date_of_payment?: string
          p_payment_type?: string
          p_payment_note?: string
          p_payment_number?: string
        }
        Returns: Json
      }
      api_update_estimate_status: {
        Args: { p_estimate_id: string; p_status: string }
        Returns: Json
      }
      apply_estimate_credit: {
        Args: {
          p_estimate_id: string
          p_payment_amount: number
          p_date_of_payment?: string
          p_payment_type?: string
          p_payment_note?: string
        }
        Returns: string
      }
      audit_glide_uuid_relationships_v2: {
        Args: {
          p_table_name: string
          p_uuid_column: string
          p_glide_uuid_column: string
          p_parent_table?: string
          p_parent_uuid_column?: string
          p_parent_glide_uuid_column?: string
          p_child_fk_to_parent_glide_uuid_column?: string
          p_child_fk_to_parent_supabase_uuid_column?: string
        }
        Returns: {
          table_name: string
          uuid_id: string
          glide_uuid: string
          parent_table_name: string
          parent_uuid_id: string
          parent_glide_uuid: string
          child_foreign_key_to_parent_supabase_uuid: string
          relationship_type: string
          issue_description: string
        }[]
      }
      calculate_payment_status: {
        Args: {
          balance_amount: number
          total_amount: number
          due_date?: string
        }
        Returns: string
      }
      check_dual_id_consistency: {
        Args: Record<PropertyKey, never>
        Returns: {
          table_name: string
          uuid_column: string
          rowid_column: string
          uuid_count: number
          rowid_count: number
          matched_count: number
          consistency_pct: number
        }[]
      }
      clean_orphaned_glide_references: {
        Args: Record<PropertyKey, never>
        Returns: {
          table_name: string
          field_name: string
          records_cleaned: number
        }[]
      }
      cleanup_invalid_glide_syncs: {
        Args: { p_dry_run?: boolean }
        Returns: {
          table_name: string
          records_deleted: number
        }[]
      }
      cleanup_orphaned_avatars: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      cleanup_orphaned_sync_records: {
        Args: { p_dry_run?: boolean }
        Returns: {
          action: string
          table_name: string
          record_count: number
          details: Json
        }[]
      }
      convert_estimate_to_invoice: {
        Args: { p_estimate_id: string }
        Returns: string
      }
      create_estimate: {
        Args: {
          p_account_id: string
          p_estimate_date?: string
          p_is_a_sample?: boolean
          p_notes?: string
        }
        Returns: string
      }
      create_invoice: {
        Args: {
          p_account_id: string
          p_date_of_invoice?: string
          p_notes?: string
        }
        Returns: string
      }
      create_invoice_from_estimate: {
        Args: { estimate_id: string }
        Returns: string
      }
      create_invoice_with_optional_payment: {
        Args: {
          p_account_id: string
          p_invoice_date: string
          p_notes: string
          p_line_items: Json
          p_initial_payment_amount?: number
          p_payment_date?: string
          p_payment_type?: string
          p_payment_note?: string
          p_user_email?: string
        }
        Returns: {
          created_invoice_id: string
          created_invoice_uid: string
        }[]
      }
      create_po_with_product: {
        Args: {
          p_account_id: string
          p_vendor_product_name: string
          p_po_date?: string
          p_new_product_name?: string
          p_total_qty_purchased?: number
          p_cost?: number
          p_is_sample_or_fronted?: boolean
          p_is_fronted?: boolean
          p_is_sample?: boolean
          p_terms_for_fronted_product?: string
          p_total_units_behind_sample?: number
          p_is_miscellaneous?: boolean
          p_category?: string
          p_purchase_note?: string
          p_is_paid?: boolean
        }
        Returns: Json
      }
      create_product: {
        Args: {
          p_purchase_order_id: string
          p_vendor_product_name: string
          p_new_product_name?: string
          p_total_qty_purchased?: number
          p_cost?: number
          p_is_sample_or_fronted?: boolean
          p_is_fronted?: boolean
          p_is_sample?: boolean
          p_terms_for_fronted_product?: string
          p_total_units_behind_sample?: number
          p_is_miscellaneous?: boolean
          p_category?: string
          p_purchase_note?: string
          p_is_paid?: boolean
        }
        Returns: string
      }
      create_product_with_po: {
        Args:
          | {
              p_account_id: string
              p_po_date: string
              p_vendor_product_name: string
              p_new_product_name?: string
              p_total_qty_purchased?: number
              p_cost?: number
              p_is_sample_or_fronted?: boolean
              p_is_fronted?: boolean
              p_is_sample?: boolean
              p_terms_for_fronted_product?: string
              p_total_units_behind_sample?: number
              p_is_miscellaneous?: boolean
              p_category?: string
              p_purchase_note?: string
              p_is_paid?: boolean
            }
          | {
              p_purchase_order_id: string
              p_vendor_product_name: string
              p_new_product_name?: string
              p_total_qty_purchased?: number
              p_cost?: number
              p_is_sample_or_fronted?: boolean
              p_is_fronted?: boolean
              p_is_sample?: boolean
              p_terms_for_fronted_product?: string
              p_total_units_behind_sample?: number
              p_is_miscellaneous?: boolean
              p_category?: string
              p_purchase_note?: string
              p_is_paid?: boolean
            }
        Returns: Record<string, unknown>
      }
      create_purchase_order: {
        Args:
          | { p_account_id: string; p_po_date?: string }
          | { p_po_date: string; p_account_id: string }
        Returns: string
      }
      create_purchase_order_with_details: {
        Args: {
          p_vendor_id: string
          p_po_date: string
          p_notes: string
          p_products_data: Json
          p_payments_data: Json
        }
        Returns: string
      }
      create_standard_product_payment: {
        Args: { p_product_id: string }
        Returns: Json
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
      execute_sql_as_text: {
        Args: { query_text: string }
        Returns: string
      }
      finalize_estimate: {
        Args: { p_estimate_id: string }
        Returns: boolean
      }
      finalize_invoice: {
        Args: { p_invoice_id: string }
        Returns: boolean
      }
      find_or_create_purchase_order: {
        Args: { p_vendor_id: string; p_date: string }
        Returns: string
      }
      fix_all_glide_uuid_relationships: {
        Args: Record<PropertyKey, never>
        Returns: {
          table_name: string
          relationship_type: string
          records_fixed: number
        }[]
      }
      fix_glide_uuid_relationships: {
        Args:
          | { p_test_mode?: boolean; p_target_table?: string }
          | { table_name?: string }
        Returns: {
          table_name: string
          operation: string
          affected_rows: number
        }[]
      }
      fix_missing_public_urls: {
        Args: Record<PropertyKey, never>
        Returns: {
          fixed_count: number
          still_missing: number
          success_rate: number
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
      func_approve_portal_payment: {
        Args: { p_pending_payment_id: string; p_admin_notes?: string }
        Returns: string
      }
      func_approve_portal_payment_safe: {
        Args: { p_pending_payment_id: string; p_admin_notes?: string }
        Returns: Json
      }
      func_auto_approve_portal_payment: {
        Args: { p_pending_payment_id: string; p_criteria?: string }
        Returns: Json
      }
      func_create_document_share: {
        Args: { p_document_id: string; p_document_type: string }
        Returns: {
          access_count: number | null
          document_type: string
          estimate_id: string | null
          id: string
          invoice_id: string | null
          is_active: boolean
          last_accessed_at: string | null
          link_created_at: string
          pin_removed_at: string | null
          pin_set_at: string | null
          purchase_order_id: string | null
          shared_link_pin_hash: string | null
          shared_link_token: string
          show_copyright_on_view: boolean | null
        }[]
      }
      func_get_document_share: {
        Args: { p_document_id: string; p_document_type: string }
        Returns: {
          access_count: number | null
          document_type: string
          estimate_id: string | null
          id: string
          invoice_id: string | null
          is_active: boolean
          last_accessed_at: string | null
          link_created_at: string
          pin_removed_at: string | null
          pin_set_at: string | null
          purchase_order_id: string | null
          shared_link_pin_hash: string | null
          shared_link_token: string
          show_copyright_on_view: boolean | null
        }[]
      }
      func_get_document_share_stats: {
        Args: { p_share_id: string }
        Returns: Json
      }
      func_get_share_dashboard_stats: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      func_get_shared_document_by_identifier: {
        Args: { p_identifier: string }
        Returns: Json
      }
      func_get_shared_document_details: {
        Args: { p_token: string }
        Returns: Json
      }
      func_list_pending_payments: {
        Args: Record<PropertyKey, never>
        Returns: {
          payment_id: string
          document_type: string
          document_number: string
          customer_name: string
          amount: number
          payment_method: string
          submission_date: string
          customer_notes: string
        }[]
      }
      func_reject_portal_payment: {
        Args: { p_pending_payment_id: string; p_admin_notes?: string }
        Returns: boolean
      }
      func_remove_document_share_pin: {
        Args: { p_share_id: string }
        Returns: {
          access_count: number | null
          document_type: string
          estimate_id: string | null
          id: string
          invoice_id: string | null
          is_active: boolean
          last_accessed_at: string | null
          link_created_at: string
          pin_removed_at: string | null
          pin_set_at: string | null
          purchase_order_id: string | null
          shared_link_pin_hash: string | null
          shared_link_token: string
          show_copyright_on_view: boolean | null
        }[]
      }
      func_set_document_share_pin: {
        Args: { p_share_id: string; p_new_pin: string }
        Returns: {
          access_count: number | null
          document_type: string
          estimate_id: string | null
          id: string
          invoice_id: string | null
          is_active: boolean
          last_accessed_at: string | null
          link_created_at: string
          pin_removed_at: string | null
          pin_set_at: string | null
          purchase_order_id: string | null
          shared_link_pin_hash: string | null
          shared_link_token: string
          show_copyright_on_view: boolean | null
        }[]
      }
      func_submit_portal_payment: {
        Args: {
          p_shared_doc_id: string
          p_amount: number
          p_payment_hint?: string
          p_customer_notes?: string
        }
        Returns: Json
      }
      func_toggle_document_share_activity: {
        Args: { p_share_id: string; p_is_active: boolean }
        Returns: {
          access_count: number | null
          document_type: string
          estimate_id: string | null
          id: string
          invoice_id: string | null
          is_active: boolean
          last_accessed_at: string | null
          link_created_at: string
          pin_removed_at: string | null
          pin_set_at: string | null
          purchase_order_id: string | null
          shared_link_pin_hash: string | null
          shared_link_token: string
          show_copyright_on_view: boolean | null
        }[]
      }
      func_verify_pin_simple: {
        Args: { p_token: string; p_pin_attempt: string }
        Returns: boolean
      }
      func_verify_shared_document_pin: {
        Args: {
          p_token: string
          p_pin_attempt: string
          p_session_id?: string
          p_ip_address?: unknown
          p_user_agent?: string
        }
        Returns: boolean
      }
      func_verify_shared_document_pin_by_identifier: {
        Args: {
          p_identifier: string
          p_pin_attempt: string
          p_ip_address?: string
          p_user_agent?: string
          p_session_id?: string
        }
        Returns: boolean
      }
      generate_invoice_uid: {
        Args: { account_uid: string; invoice_date: string }
        Returns: string
      }
      get_account_balance: {
        Args: { p_account_id: string }
        Returns: number
      }
      get_account_outstanding_sample_value: {
        Args: { p_account_id: string }
        Returns: number
      }
      get_avatar_public_url: {
        Args: { file_path: string }
        Returns: string
      }
      get_distinct_supabase_tables_from_mappings: {
        Args: Record<PropertyKey, never>
        Returns: {
          supabase_table: string
        }[]
      }
      get_document_sharing_stats: {
        Args: Record<PropertyKey, never>
        Returns: {
          total_documents: number
          active_shares: number
          estimates_shared: number
          invoices_shared: number
          purchase_orders_shared: number
        }[]
      }
      get_monthly_profit: {
        Args: { p_month: string }
        Returns: number
      }
      get_payment_status_stats: {
        Args: Record<PropertyKey, never>
        Returns: {
          table_name: string
          status: string
          count: number
          total_amount: number
        }[]
      }
      get_portal_payment_stats: {
        Args: Record<PropertyKey, never>
        Returns: Json
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
      get_public_tables: {
        Args: Record<PropertyKey, never>
        Returns: {
          table_name: string
        }[]
      }
      get_singular_table_name: {
        Args: { rowid_column: string }
        Returns: string
      }
      get_table_columns: {
        Args: { p_table_name: string }
        Returns: {
          column_name: string
          data_type: string
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
        Args: { start_date?: string; end_date?: string }
        Returns: Json
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
        Args:
          | { p_from_date?: string; p_to_date?: string }
          | { p_from_date?: string; p_to_date?: string }
        Returns: {
          category: string
          total: number
        }[]
      }
      gl_get_financial_metrics: {
        Args: {
          start_date?: string
          end_date?: string
          compare_with_previous?: boolean
        }
        Returns: Json
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
        Args: { months_back?: number; start_date?: string; end_date?: string }
        Returns: Json
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
      gl_get_quick_contacts: {
        Args:
          | { contact_limit?: number }
          | { limit_count?: number; start_date?: string; end_date?: string }
        Returns: Json
      }
      gl_get_recent_transactions: {
        Args:
          | {
              days_back?: number
              limit_count?: number
              start_date?: string
              end_date?: string
              transaction_type?: string
            }
          | {
              days_back?: number
              limit_count?: number
              transaction_type?: string
              start_date?: string
              end_date?: string
            }
        Returns: Json
      }
      gl_record_sync_error: {
        Args: {
          p_mapping_id: string
          p_error_type: string
          p_error_message: string
          p_record_data: Json
          p_retryable: boolean
        }
        Returns: undefined
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
      is_sync_running: {
        Args: { p_sync_type?: string }
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
      maintain_glide_uuid_relationships: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      manage_sync_triggers: {
        Args: { p_action: string; p_table_name?: string }
        Returns: undefined
      }
      mark_storage_deletion_retry_success: {
        Args: { p_retry_id: string }
        Returns: boolean
      }
      monitor_sync_health: {
        Args: Record<PropertyKey, never>
        Returns: {
          check_name: string
          status: string
          details: Json
        }[]
      }
      n8n_product_url_matching: {
        Args: {
          p_message_id: string
          p_product_name: string
          p_product_code: string
          p_public_url: string
          p_glide_row_id?: string
          p_execution_id?: string
        }
        Returns: Json
      }
      recalculate_all_payment_statuses: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      record_invoice_payment: {
        Args: {
          p_invoice_id: string
          p_payment_amount: number
          p_date_of_payment?: string
          p_payment_type?: string
          p_payment_note?: string
          p_payment_number?: string
        }
        Returns: string
      }
      refresh_all_materialized_views: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      refresh_all_materialized_views_non_concurrent: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      refresh_financial_views: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      refresh_monthly_finance_summary: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      refresh_monthly_finance_summary_cron: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      refresh_monthly_finance_summary_enhanced: {
        Args: Record<PropertyKey, never>
        Returns: {
          status: string
          duration: unknown
          rows_refreshed: number
          refresh_type: string
          log_id: string
        }[]
      }
      refresh_mv_all_payments: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      reset_pdf_generation_failure: {
        Args: { p_document_type: string; p_document_id: string }
        Returns: undefined
      }
      retry_failed_storage_cleanup: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      rpc_add_product_to_po: {
        Args: {
          purchase_order_id: string
          vendor_product_name: string
          new_product_name?: string
          total_qty_purchased?: number
          cost?: number
          is_sample_or_fronted?: boolean
          is_fronted?: boolean
          is_sample?: boolean
          terms_for_fronted_product?: string
          total_units_behind_sample?: number
          is_miscellaneous?: boolean
          category?: string
          purchase_note?: string
          is_paid?: boolean
        }
        Returns: string
      }
      rpc_create_purchase_order: {
        Args: { account_id: string; po_date?: string }
        Returns: string
      }
      rpc_get_vendor_purchase_orders: {
        Args: { vendor_id: string }
        Returns: {
          id: string
          po_date: string
          purchase_order_uid: string
          product_count: number
          total_amount: number
        }[]
      }
      rpc_get_vendors: {
        Args: Record<PropertyKey, never>
        Returns: {
          id: string
          account_name: string
          accounts_uid: string
        }[]
      }
      rpc_refresh_mv_product_inventory_on_change: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      safe_fix_glide_uuid_relationships: {
        Args: { p_test_mode?: boolean; p_target_table?: string }
        Returns: {
          table_name: string
          operation: string
          affected_rows: number
        }[]
      }
      safe_timestamp_convert: {
        Args: { input_value: unknown }
        Returns: string
      }
      schedule_storage_deletion_retry: {
        Args: {
          p_storage_path: string
          p_error?: string
          p_correlation_id?: string
          p_max_retries?: number
        }
        Returns: string
      }
      scheduled_sync_integrity_check: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      standardize_existing_pdf_urls: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      sync_media_group_parsed_caption: {
        Args: {
          p_source_message_table_id: string
          p_media_group_id: string
          p_chat_id: number
          p_parsed_caption_data: Json
          p_caption_source_message_id: number
        }
        Returns: undefined
      }
      trigger_glide_sync: {
        Args: { p_mapping_id: string }
        Returns: Json
      }
      trigger_simple_media_downloader: {
        Args: { p_correlation_id?: string }
        Returns: Json
      }
      truncate_table_cascade: {
        Args: { table_name: string }
        Returns: undefined
      }
      update_account_customer_balance: {
        Args: { p_account_id: string }
        Returns: undefined
      }
      update_account_vendor_balance: {
        Args: { account_id: string }
        Returns: undefined
      }
      update_all_account_balances: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      update_estimate_finance_metrics: {
        Args: { estimate_id: string }
        Returns: undefined
      }
      update_estimate_status: {
        Args: { p_estimate_id: string; p_status: string }
        Returns: boolean
      }
      update_invoice_finance_metrics: {
        Args: { p_invoice_id: string }
        Returns: undefined
      }
      update_messages_and_products_with_limit: {
        Args: { limit_count: number }
        Returns: undefined
      }
      update_product_id_in_messages: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      update_product_skus: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      update_products_with_check: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      update_purchase_order_finance_metrics: {
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
      upsert_media_message_v2: {
        Args: {
          p_telegram_message_id: number
          p_chat_id: number
          p_file_unique_id: string
          p_file_id: string
          p_storage_path: string
          p_public_url: string
          p_mime_type: string
          p_extension: string
          p_media_type: string
          p_caption: string
          p_processing_state?: string
          p_message_data?: Json
          p_correlation_id?: string
          p_media_group_id?: string
          p_forward_info?: Json
          p_processing_error?: string
          p_caption_data?: Json
          p_analyzed_content?: Json
        }
        Returns: Json
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
      validate_avatar_upload: {
        Args: { file_name: string; file_size: number; content_type: string }
        Returns: boolean
      }
      validate_before_sync: {
        Args: { p_table_name: string }
        Returns: boolean
      }
      validate_glide_sync_integrity: {
        Args: Record<PropertyKey, never>
        Returns: {
          table_name: string
          issue: string
          count: number
          action_taken: string
        }[]
      }
      validate_mv_monthly_finance_data: {
        Args: Record<PropertyKey, never>
        Returns: {
          validation_check: string
          status: string
          details: string
        }[]
      }
      validate_payment_method: {
        Args: { method: string }
        Returns: string
      }
      validate_public_urls_sample: {
        Args: Record<PropertyKey, never>
        Returns: {
          total_checked: number
          valid_urls: number
          invalid_urls: number
          sample_invalid: Json
        }[]
      }
      validate_sync_dependencies: {
        Args: Record<PropertyKey, never>
        Returns: {
          table_name: string
          dependency_table: string
          missing_count: number
          sample_missing_rowids: string[]
        }[]
      }
      webhook_n8n_product_matching: {
        Args: { payload: Json }
        Returns: Json
      }
      x_archive_message_for_deletion: {
        Args: { p_message_id: string }
        Returns: Json
      }
      x_auto_link_messages_by_enhanced_matching: {
        Args: { p_limit?: number; p_correlation_id?: string }
        Returns: Json
      }
      x_auto_link_messages_by_product_name: {
        Args: { p_limit?: number; p_correlation_id?: string }
        Returns: Json
      }
      x_auto_link_messages_by_sku: {
        Args: { p_limit?: number; p_correlation_id?: string }
        Returns: Json
      }
      x_backfill_message_data_extraction: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      x_backfill_message_urls: {
        Args: { p_batch_size?: number }
        Returns: string
      }
      x_backfill_old_product_sku: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      x_backfill_product_skus: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      x_cleanup_existing_duplicates: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      x_cleanup_unified_audit_logs_improved: {
        Args: { p_keep_records?: number }
        Returns: Json
      }
      x_cleanup_unified_audit_logs_to_latest_n: {
        Args: { p_records_to_keep?: number }
        Returns: undefined
      }
      x_compare_sku_components: {
        Args: { p_message_id: string }
        Returns: {
          field_name: string
          current_value: string
          old_value: string
          changed: boolean
        }[]
      }
      x_construct_telegram_message_url: {
        Args: {
          p_chat_id: number
          p_message_id: number
          p_chat_username: string
        }
        Returns: string
      }
      x_find_and_repair_unsynced_media_groups: {
        Args: { p_limit?: number }
        Returns: Json
      }
      x_find_inconsistent_media_groups: {
        Args: Record<PropertyKey, never>
        Returns: {
          media_group_id: string
          potential_source_message_id: string
          inconsistency_reason: string
        }[]
      }
      x_generate_product_sku: {
        Args: { p_analyzed_content: Json }
        Returns: string
      }
      x_generate_sku_from_old_content: {
        Args: { p_old_analyzed_content: Json }
        Returns: string
      }
      x_get_message_audit_logs: {
        Args: { p_message_id: string }
        Returns: {
          id: string
          event_type: string
          event_timestamp: string
          operation_type: string
          metadata: Json
          correlation_id: string
          error_message: string
        }[]
      }
      x_get_message_sku_history: {
        Args: { p_message_id: string }
        Returns: {
          current_sku: string
          old_sku: string
          sku_changed: boolean
          current_content_has_name: boolean
          current_content_has_code: boolean
          old_content_has_name: boolean
          old_content_has_code: boolean
        }[]
      }
      x_handle_forward_message: {
        Args: {
          p_message_id: string
          p_file_unique_id: string
          p_chat_id: number
          p_telegram_message_id: number
          p_forward_info?: Json
        }
        Returns: Json
      }
      x_link_message_to_gl_product: {
        Args: {
          p_message_id: string
          p_gl_product_id: string
          p_link_method?: string
          p_confidence?: number
          p_correlation_id?: string
        }
        Returns: Json
      }
      x_populate_non_match_messages_products: {
        Args: Record<PropertyKey, never> | { p_limit?: number }
        Returns: Json
      }
      x_process_approved_non_match_messages: {
        Args: { p_limit?: number }
        Returns: Json
      }
      x_retry_failed_storage_cleanup: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      x_run_sync_media_group_captions: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      x_schedule_delayed_media_group_sync: {
        Args: {
          p_media_group_id: string
          p_delay_seconds?: number
          p_correlation_id?: string
        }
        Returns: Json
      }
      x_sku_changed: {
        Args: { p_old_analyzed_content: Json; p_new_analyzed_content: Json }
        Returns: boolean
      }
      x_sync_media_group_analyzed_content: {
        Args: { message_id: string }
        Returns: Json
      }
      x_sync_media_group_captions: {
        Args: { p_media_group_id: string }
        Returns: undefined
      }
      x_sync_media_group_captions_enhanced: {
        Args: { p_media_group_id: string }
        Returns: undefined
      }
      x_sync_media_group_captions_with_detection: {
        Args: { p_media_group_id: string; p_correlation_id?: string }
        Returns: Json
      }
      x_sync_media_urls_to_gl_products: {
        Args: { p_gl_product_id?: string; p_correlation_id?: string }
        Returns: Json
      }
      x_sync_message_caption_edge: {
        Args: { p_message_id: string; p_new_caption: string }
        Returns: Json
      }
      x_unlink_message_from_gl_product: {
        Args: { p_message_id: string; p_correlation_id?: string }
        Returns: Json
      }
      x_upsert_media_message_enhanced: {
        Args: {
          p_telegram_message_id: number
          p_chat_id: number
          p_file_unique_id: string
          p_caption?: string
          p_analyzed_content?: Json
          p_message_data?: Json
          p_media_group_id?: string
          p_correlation_id?: string
        }
        Returns: Json
      }
      xgl_check_relationship_issues: {
        Args: { p_table_name: string }
        Returns: {
          table_name: string
          total_records: number
          missing_glide_rowid: number
          missing_relationships: number
          fixable_relationships: number
          relationship_type: string
        }[]
      }
      xgl_check_sync_status: {
        Args: Record<PropertyKey, never>
        Returns: {
          mapping_name: string
          table_name: string
          status: string
          records_processed: number
          started_at: string
          completed_at: string
          runtime_seconds: number
        }[]
      }
      xgl_fix_table_relationships: {
        Args: { p_table_name: string }
        Returns: Json
      }
      xgl_generate_curl_command: {
        Args: { p_mapping_id: string }
        Returns: string
      }
      xgl_get_all_push_status: {
        Args: Record<PropertyKey, never>
        Returns: {
          table_name: string
          new_records: number
          modified_records: number
          total_to_sync: number
        }[]
      }
      xgl_get_all_tables_sync_status: {
        Args: Record<PropertyKey, never>
        Returns: {
          supabase_table: string
          glide_table_display_name: string
          total_records: number
          records_in_glide: number
          records_to_push_to_glide: number
        }[]
      }
      xgl_get_curl_with_env_vars_note: {
        Args: { p_curl: string }
        Returns: string
      }
      xgl_get_fix_relationships_curl: {
        Args: { p_table_name: string }
        Returns: string
      }
      xgl_get_push_status: {
        Args: { p_table_name: string }
        Returns: Json
      }
      xgl_get_sync_all_tables_curl: {
        Args: { p_mode?: string }
        Returns: string
      }
      xgl_get_sync_curl: {
        Args: { p_table_name: string; p_mode?: string }
        Returns: string
      }
      xgl_get_table_mapping: {
        Args: { p_table_name: string }
        Returns: Json
      }
      xgl_get_table_sync_info: {
        Args: { p_table_name: string }
        Returns: Json
      }
      xgl_push_all_to_glide: {
        Args: { p_batch_size?: number; p_dry_run?: boolean }
        Returns: Json
      }
      xgl_sync_all_tables: {
        Args: Record<PropertyKey, never>
        Returns: Json[]
      }
      xgl_sync_all_with_curl: {
        Args: { p_print_only?: boolean }
        Returns: string[]
      }
      xgl_sync_and_fix_table: {
        Args: { p_table_name: string; p_mode?: string }
        Returns: Json
      }
      xgl_sync_table: {
        Args:
          | { p_table_name: string; p_mode?: string }
          | {
              p_table_name: string
              p_mode?: string
              p_fix_relationships?: boolean
            }
        Returns: Json
      }
      xgl_trigger_sync: {
        Args: { p_mapping_id: string }
        Returns: Json
      }
      xgl_truncate_table_cascade: {
        Args: { p_table_name: string }
        Returns: Json
      }
    }
    Enums: {
      account_type: "Customer" | "Vendor" | "Customer & Vendor"
      approval_status: "pending" | "approved" | "rejected" | "auto_matched"
      estimate_status_enum:
        | "Draft"
        | "Sent"
        | "Accepted"
        | "Rejected"
        | "Converted"
      glide_operation_type: "CREATE" | "UPDATE" | "DELETE"
      glide_sync_status:
        | "pending"
        | "processing"
        | "synced_to_glide"
        | "failed_glide_sync"
        | "requires_manual_review"
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
      payment_document_type_enum: "purchase_order" | "invoice" | "estimate"
      payment_method_enum:
        | "Cash"
        | "Apple Pay"
        | "Cash App"
        | "Zelle"
        | "Crypto"
        | "Other"
      payment_status_enum: "unpaid" | "paid" | "partial" | "credit"
      processing_state_type:
        | "initialized"
        | "pending"
        | "processing"
        | "completed"
        | "error"
        | "no_caption"
        | "pending_analysis"
        | "edited"
      product_category_enum:
        | "Vaporizers and Cartridges"
        | "Raw Mushrooms"
        | "THCA"
        | "Concentrates"
        | "Moon Rocks"
        | "Psychedelic Products"
        | "Edibles"
        | "Pre Rolls"
        | "Flower"
        | "Service"
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
      estimate_status_enum: [
        "Draft",
        "Sent",
        "Accepted",
        "Rejected",
        "Converted",
      ],
      glide_operation_type: ["CREATE", "UPDATE", "DELETE"],
      glide_sync_status: [
        "pending",
        "processing",
        "synced_to_glide",
        "failed_glide_sync",
        "requires_manual_review",
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
      payment_document_type_enum: ["purchase_order", "invoice", "estimate"],
      payment_method_enum: [
        "Cash",
        "Apple Pay",
        "Cash App",
        "Zelle",
        "Crypto",
        "Other",
      ],
      payment_status_enum: ["unpaid", "paid", "partial", "credit"],
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
      product_category_enum: [
        "Vaporizers and Cartridges",
        "Raw Mushrooms",
        "THCA",
        "Concentrates",
        "Moon Rocks",
        "Psychedelic Products",
        "Edibles",
        "Pre Rolls",
        "Flower",
        "Service",
      ],
    },
  },
} as const
