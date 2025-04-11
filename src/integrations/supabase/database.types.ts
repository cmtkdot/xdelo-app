
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
      messages: {
        Row: {
          [key: string]: any
        }
        Insert: {
          [key: string]: any
        }
        Update: {
          [key: string]: any
        }
        Relationships: []
      }
      analysis_queue: {
        Row: {
          [key: string]: any
        }
        Insert: {
          [key: string]: any
        }
        Update: {
          [key: string]: any
        }
        Relationships: []
      }
      deleted_messages: {
        Row: {
          [key: string]: any
        }
        Insert: {
          [key: string]: any
        }
        Update: {
          [key: string]: any
        }
        Relationships: []
      }
      migrations: {
        Row: {
          [key: string]: any
        }
        Insert: {
          [key: string]: any
        }
        Update: {
          [key: string]: any
        }
        Relationships: []
      }
      other_messages: {
        Row: {
          [key: string]: any
        }
        Insert: {
          [key: string]: any
        }
        Update: {
          [key: string]: any
        }
        Relationships: []
      }
      product_matching_config: {
        Row: {
          [key: string]: any
        }
        Insert: {
          [key: string]: any
        }
        Update: {
          [key: string]: any
        }
        Relationships: []
      }
      profiles: {
        Row: {
          [key: string]: any
        }
        Insert: {
          [key: string]: any
        }
        Update: {
          [key: string]: any
        }
        Relationships: []
      }
      raw_product_entries: {
        Row: {
          [key: string]: any
        }
        Insert: {
          [key: string]: any
        }
        Update: {
          [key: string]: any
        }
        Relationships: []
      }
      settings: {
        Row: {
          [key: string]: any
        }
        Insert: {
          [key: string]: any
        }
        Update: {
          [key: string]: any
        }
        Relationships: []
      }
      sync_matches: {
        Row: {
          [key: string]: any
        }
        Insert: {
          [key: string]: any
        }
        Update: {
          [key: string]: any
        }
        Relationships: []
      }
      unified_audit_logs: {
        Row: {
          [key: string]: any
        }
        Insert: {
          [key: string]: any
        }
        Update: {
          [key: string]: any
        }
        Relationships: []
      }
      gl_products: {
        Row: {
          id: string
          glide_id: string
          new_product_name: string
          vendor_product_name: string
          vendor_uid: string
          product_purchase_date: string
          created_at: string
          updated_at: string
          product_name_display: string
        }
        Insert: {
          [key: string]: any
        }
        Update: {
          [key: string]: any
        }
        Relationships: []
      }
      make_webhook_configs: {
        Row: {
          id: string
          name: string
          description: string
          url: string
          event_types: string[]
          is_active: boolean
          field_selection: Json
          payload_template: Json
          transformation_code: string
          headers: Json
          retry_config: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          [key: string]: any
        }
        Update: {
          [key: string]: any
        }
        Relationships: []
      }
      make_test_payloads: {
        Row: {
          id: string
          name: string
          description: string
          event_type: string
          payload: Json
          is_template: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          [key: string]: any
        }
        Update: {
          [key: string]: any
        }
        Relationships: []
      }
    }
    Views: {
      messages_view: {
        Row: {
          [key: string]: any
        }
        Relationships: []
      }
      v_messages_compatibility: {
        Row: {
          [key: string]: any
        }
        Relationships: []
      }
      gl_tables_view: {
        Row: {
          [key: string]: any
        }
        Relationships: []
      }
      pg_stat_statements: {
        Row: {
          [key: string]: any
        }
        Relationships: []
      }
      pg_stat_statements_info: {
        Row: {
          [key: string]: any
        }
        Relationships: []
      }
      v_media_group_consistency: {
        Row: {
          [key: string]: any
        }
        Relationships: []
      }
      v_product_matching_history: {
        Row: {
          [key: string]: any
        }
        Relationships: []
      }
    }
    Functions: {
      [key: string]: any
    }
    Enums: {
      [key: string]: any
    }
    CompositeTypes: {
      [key: string]: any
    }
  }
}
