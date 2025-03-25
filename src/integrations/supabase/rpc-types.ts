
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

    // RPC for the logProcessingEvent function 
    rpc<T = string>(
      fn: "xdelo_logprocessingevent", 
      params: { 
        p_event_type: string; 
        p_entity_id: string;
        p_correlation_id: string;
        p_metadata?: Record<string, any>;
        p_error_message?: string;
      }
    ): { data: T; error: null } | { data: null; error: Error };

    // Add RPC for ensuring matching config column
    rpc<T = any>(
      fn: "xdelo_ensure_matching_config",
      params?: {}
    ): { data: T; error: null } | { data: null; error: Error };

    // Add RPC for the new product matching configuration functions
    rpc<T = any>(
      fn: "xdelo_get_product_matching_config",
      params?: {}
    ): { data: T; error: null } | { data: null; error: Error };

    rpc<T = any>(
      fn: "xdelo_update_product_matching_config",
      params: { p_config: Record<string, any> }
    ): { data: T; error: null } | { data: null; error: Error };

    // Add RPC for fixing audit log UUIDs
    rpc<T = { fixed_count: number }>(
      fn: "xdelo_fix_audit_log_uuids",
      params?: {}
    ): { data: T; error: null } | { data: null; error: Error };

    // Add RPC for media group synchronization with proper return type
    rpc<T = { updated_count?: number; [key: string]: any }>(
      fn: "xdelo_sync_media_group_content",
      params: {
        p_media_group_id: string;
        p_source_message_id: string;
        p_correlation_id: string;
        p_force_sync?: boolean;
        p_sync_edit_history?: boolean;
      }
    ): { data: T; error: null } | { data: null; error: Error };

    // Add RPC for finding caption message
    rpc<T = string>(
      fn: "xdelo_find_caption_message",
      params: { p_media_group_id: string }
    ): { data: T; error: null } | { data: null; error: Error };

    // Add RPC for processing captions
    rpc<T = { success: boolean; message?: string; [key: string]: any }>(
      fn: "xdelo_process_caption_workflow",
      params: {
        p_message_id: string;
        p_correlation_id: string;
        p_force?: boolean;
      }
    ): { data: T; error: null } | { data: null; error: Error };

    // Add any other custom RPC functions here...
  }
}
