
/**
 * Type definitions for RPC functions
 * This helps TypeScript recognize custom RPC functions in the project
 */

// We need to extend the SupabaseClient type to include our custom RPC functions
declare module "@supabase/supabase-js" {
  interface SupabaseClient {
    rpc<T = any>(
      fn: "execute_sql_migration" | "xdelo_execute_sql_migration", 
      params?: { sql_command: string }
    ): { data: T; error: null } | { data: null; error: Error };
    
    rpc<T = any>(
      fn: "xdelo_log_event", 
      params?: { 
        p_event_type: string; 
        p_message_id: string;
        p_metadata?: Record<string, any>;
      }
    ): { data: T; error: null } | { data: null; error: Error };

    // Add RPC for ensuring matching config column
    rpc<T = any>(
      fn: "xdelo_ensure_matching_config",
      params?: {}
    ): { data: T; error: null } | { data: null; error: Error };

    // Add any other custom RPC functions here...
  }
}
