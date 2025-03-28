
import { createSupabaseClient } from "./supabase.ts";

/**
 * Sync content across media group
 * This allows us to reuse the same sync logic across different functions
 */
export async function syncMediaGroupContent(
  messageId: string,
  analyzedContent: any,
  options: {
    forceSync?: boolean;
    syncEditHistory?: boolean;
  } = {}
): Promise<any> {
  // Create Supabase client
  const supabase = createSupabaseClient();

  // Default options
  const { forceSync = true, syncEditHistory = false } = options;

  try {
    // Only sync if we have valid analyzed content
    if (!analyzedContent) {
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
      console.error('Media group sync error:', error);
      return {
        success: false,
        error: error.message
      };
    }

    return {
      success: true,
      ...data
    };
  } catch (error) {
    console.error('Exception in syncMediaGroupContent:', error);
    return {
      success: false,
      error: error.message
    };
  }
}
