// Import the singleton client instance
import { supabaseClient } from "./supabase.ts";

/**
 * Sync content across media group
 * This allows us to reuse the same sync logic across different functions
 */
export async function syncMediaGroupContent(
  messageId: string,
  analyzedContent: any, // Consider defining a stricter type for analyzedContent
  options: {
    forceSync?: boolean;
    syncEditHistory?: boolean;
  } = {}
): Promise<any> { // Consider defining a stricter return type
  // Use the imported singleton client
  const supabase = supabaseClient;

  // Default options
  const { forceSync = true, syncEditHistory = false } = options;

  try {
    // Only sync if we have valid analyzed content
    if (!analyzedContent) {
      console.warn(`[syncMediaGroupContent] No analyzed content provided for message ${messageId}`);
      return {
        success: false,
        error: 'No analyzed content provided'
      };
    }

    // Call the database function to sync media group content
    const { data, error } = await supabase.rpc(
      'xdelo_sync_media_group_content',
      {
        p_message_id: messageId,
        p_analyzed_content: analyzedContent,
        p_force_sync: forceSync,
        p_sync_edit_history: syncEditHistory
      }
    );

    if (error) {
      console.error(`[syncMediaGroupContent] Media group sync RPC error for message ${messageId}:`, error);
      return {
        success: false,
        error: error.message
      };
    }

    console.log(`[syncMediaGroupContent] Successfully synced media group for message ${messageId}`, data);
    return {
      success: true,
      ...data // Spread the result data from the RPC call
    };
  } catch (error: unknown) { // Added type annotation
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[syncMediaGroupContent] Exception syncing media group for message ${messageId}:`, errorMessage, error);
    return {
      success: false,
      error: errorMessage
    };
  }
}
