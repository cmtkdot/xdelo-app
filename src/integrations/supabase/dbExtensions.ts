
import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from './types';

// Extend SupabaseClient type with custom RPC functions
declare module '@supabase/supabase-js' {
  interface SupabaseClient<T extends Database> {
    from<TableName extends keyof Database['public']['Tables'] | 'gl_products'>(
      relation: TableName
    ): any;
    
    rpc<
      FunctionName extends keyof Database['public']['Functions'] | 
        'xdelo_process_caption_workflow' | 
        'xdelo_get_product_matching_config' | 
        'xdelo_update_product_matching_config' |
        'xdelo_fix_audit_log_uuids' |
        'xdelo_kill_long_queries' |
        'xdelo_execute_sql_migration' |
        'log_processing_event'
    >(
      fn: FunctionName,
      params?: Record<string, any>
    ): any;
  }
}

// Define GL Product structure
export interface GlProduct {
  id: string;
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
  [key: string]: any;
}

// Helper to ensure Message object from entities/Message is compatible with MessagesTypes/Message
export function ensureMessagesCompatibility(message: any): any {
  if (!message) return message;
  
  // Ensure required fields have values
  return {
    ...message,
    file_unique_id: message.file_unique_id || '',
    public_url: message.public_url || '',
  };
}
