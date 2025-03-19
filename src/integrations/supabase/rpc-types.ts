
/**
 * Type definitions for RPC functions
 * This helps TypeScript recognize custom RPC functions in the project
 */
import { SupabaseClient } from "@supabase/supabase-js";

// Extend the SupabaseClient type to include our custom RPC functions
declare module "@supabase/supabase-js" {
  interface SupabaseClient<Database = any, SchemaName = any> {
    rpc<T = any>(
      fn: "xdelo_execute_sql_migration", 
      params?: { sql_command: string }
    ): { data: T; error: Error | null };
    
    rpc<T = any>(
      fn: "xdelo_log_event", 
      params?: { 
        p_event_type: string; 
        p_message_id: string;
        p_metadata?: Record<string, any>;
      }
    ): { data: T; error: Error | null };

    // Add any other custom RPC functions here...
  }
}
