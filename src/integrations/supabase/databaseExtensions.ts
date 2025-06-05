
import { Database } from './types';

/**
 * Extends the generated Supabase types with additional tables and fields
 * that might not be in the original schema
 */
export interface ExtendedDatabase extends Database {
  public: Database['public'] & {
    Tables: Database['public']['Tables'] & {
      gl_products: {
        Row: {
          id: string;
          new_product_name?: string;
          vendor_product_name?: string;
          product_purchase_date?: string;
          total_qty_purchased?: number;
          cost?: number;
          category?: string;
          product_image1?: string;
          purchase_notes?: string;
          created_at: string;
          updated_at: string;
          [key: string]: any;
        };
        Insert: {
          id?: string;
          new_product_name?: string;
          vendor_product_name?: string;
          product_purchase_date?: string;
          total_qty_purchased?: number;
          cost?: number;
          category?: string;
          product_image1?: string;
          purchase_notes?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          new_product_name?: string;
          vendor_product_name?: string;
          product_purchase_date?: string;
          total_qty_purchased?: number;
          cost?: number;
          category?: string;
          product_image1?: string;
          purchase_notes?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Functions: Database['public']['Functions'] & {
      xdelo_process_caption_workflow: {
        Args: {
          p_message_id: string;
          p_correlation_id?: string;
          p_force?: boolean;
        };
        Returns: unknown;
      };
      xdelo_get_product_matching_config: {
        Args: Record<string, never>;
        Returns: unknown;
      };
      xdelo_update_product_matching_config: {
        Args: {
          p_config: unknown;
        };
        Returns: unknown;
      };
      xdelo_fix_audit_log_uuids: {
        Args: Record<string, never>;
        Returns: { fixed_count: number };
      };
      xdelo_kill_long_queries: {
        Args: Record<string, never>;
        Returns: unknown[];
      };
      xdelo_execute_sql_migration: {
        Args: {
          p_sql: string;
          p_dry_run?: boolean;
        };
        Returns: unknown;
      };
      xdelo_logprocessingevent: {
        Args: {
          p_event_type: string;
          p_entity_id: string;
          p_correlation_id?: string;
          p_metadata?: unknown;
        };
        Returns: unknown;
      };
    };
  };
}

// Re-export the enhanced client creator
export { createClient } from '@supabase/supabase-js';

// Type helper for custom RPC calls
export type CustomRpcFunction = keyof ExtendedDatabase['public']['Functions'];

/**
 * Check if a function name is a valid custom RPC function
 */
export function isCustomRpcFunction(name: string): name is CustomRpcFunction {
  return Object.prototype.hasOwnProperty.call(customRpcFunctions, name);
}

/**
 * List of all custom RPC functions for type checking
 */
export const customRpcFunctions: Record<string, boolean> = {
  'xdelo_process_caption_workflow': true,
  'xdelo_get_product_matching_config': true,
  'xdelo_update_product_matching_config': true,
  'xdelo_fix_audit_log_uuids': true,
  'xdelo_kill_long_queries': true,
  'xdelo_execute_sql_migration': true,
  'xdelo_logprocessingevent': true,
  'xdelo_sync_media_group_content': true
};
