
import { Database } from './types';

/**
 * Extends the generated Supabase types with additional tables and fields
 * that might not be in the original schema
 */
export interface GlProduct {
  id: string;
  name: string;
  code: string;
  vendor_id: string;
  purchase_date?: string;
  created_at: string;
  updated_at: string;
}

export interface ExtendedDatabase extends Database {
  public: Database['public'] & {
    Tables: Database['public']['Tables'] & {
      gl_products: {
        Row: GlProduct;
        Insert: Omit<GlProduct, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<GlProduct, 'id' | 'created_at'>>;
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
  'xdelo_fix_audit_log_uuids': true,
  'xdelo_kill_long_queries': true,
  'xdelo_execute_sql_migration': true,
  'xdelo_logprocessingevent': true,
  'xdelo_sync_media_group_content': true
};
