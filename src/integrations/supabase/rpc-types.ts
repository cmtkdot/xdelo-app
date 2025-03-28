
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

    // RPC for the logProcessingEvent function - Updated to accept both string and number entity IDs
    rpc<T = string>(
      fn: "xdelo_logprocessingevent", 
      params: { 
        p_event_type: string; 
        p_entity_id: string | number;
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

    // Updated: Add RPC for media group synchronization with new parameter signature
    rpc<T = { updated_count?: number; [key: string]: any }>(
      fn: "xdelo_sync_media_group_content",
      params: {
        p_message_id: string;
        p_analyzed_content: any;
        p_force_sync?: boolean;
        p_sync_edit_history?: boolean;
      }
    ): { data: T; error: null } | { data: null; error: Error };

    // Backwards compatibility signature
    rpc<T = { updated_count?: number; [key: string]: any }>(
      fn: "xdelo_sync_media_group_content",
      params: {
        p_source_message_id: string;
        p_media_group_id: string;
        p_correlation_id: string;
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
    
    // Add RPC for direct caption parsing
    rpc<T = any>(
      fn: "xdelo_parse_caption",
      params: {
        p_caption: string;
      }
    ): { data: T; error: null } | { data: null; error: Error };

    // Add RPC for handling message edits
    rpc<T = any>(
      fn: "xdelo_handle_message_edit",
      params: {
        p_message_id: string;
        p_caption: string;
        p_is_edit?: boolean;
        p_correlation_id?: string;
      }
    ): { data: T; error: null } | { data: null; error: Error };
    
    // Add RPC for completing message processing
    rpc<T = any>(
      fn: "xdelo_complete_message_processing",
      params: {
        p_message_id: string;
        p_analyzed_content: Record<string, any>;
        p_correlation_id?: string;
      }
    ): { data: T; error: null } | { data: null; error: Error };

    // Add RPC for setting statement timeout
    rpc<T = void>(
      fn: "xdelo_set_statement_timeout",
      params?: { p_timeout_ms?: number }
    ): { data: T; error: null } | { data: null; error: Error };

    // Add RPC for retry operation with exponential backoff
    rpc<T = any>(
      fn: "xdelo_retry_operation",
      params?: { 
        p_max_attempts?: number;
        p_initial_delay_ms?: number;
      }
    ): { data: T; error: null } | { data: null; error: Error };

    // Add RPC for killing long queries
    rpc<T = any[]>(
      fn: "xdelo_kill_long_queries",
      params?: { older_than_seconds?: number }
    ): { data: T; error: null } | { data: null; error: Error };

    // Add RPC for migrating telegram data to metadata
    rpc<T = { migrated_count: number }>(
      fn: "migrate_telegram_data_to_metadata",
      params?: {}
    ): { data: T; error: null } | { data: null; error: Error };
  }
}
