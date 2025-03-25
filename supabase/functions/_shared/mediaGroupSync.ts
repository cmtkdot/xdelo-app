
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { xdelo_logProcessingEvent, syncMediaGroupContent } from './databaseOperations.ts';

// Create Supabase client for database operations
const supabaseClient = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  }
);

/**
 * Asynchronously process a media group synchronization
 * This provides a more reliable approach than trigger-based sync
 */
export async function processMediaGroupSync(
  mediaGroupId: string,
  sourceMessageId: string,
  correlationId: string
) {
  try {
    // Attempt to acquire an advisory lock on the media group
    // This prevents concurrent processing of the same media group
    const { data: lockResult, error: lockError } = await supabaseClient.rpc(
      'pg_try_advisory_xact_lock',
      { key: parseInt(mediaGroupId.replace(/\D/g, '').substring(0, 10) || '0') }
    );
    
    if (lockError || !lockResult) {
      // Lock couldn't be acquired, someone else is processing this group
      await xdelo_logProcessingEvent(
        "media_group_sync_lock_failed",
        mediaGroupId,
        correlationId,
        {
          source_message_id: sourceMessageId,
          error: lockError?.message || "Lock couldn't be acquired"
        }
      );
      
      return {
        success: false,
        error: "Another process is currently synchronizing this media group"
      };
    }
    
    // First verify the source message exists and has analyzed content
    const { data: sourceMessage, error: sourceError } = await supabaseClient
      .from('messages')
      .select('id, analyzed_content, caption')
      .eq('id', sourceMessageId)
      .single();
      
    if (sourceError || !sourceMessage) {
      await xdelo_logProcessingEvent(
        "media_group_sync_error",
        mediaGroupId,
        correlationId,
        {
          error: sourceError?.message || "Source message not found",
          source_message_id: sourceMessageId
        },
        sourceError?.message || "Source message not found"
      );
      
      return {
        success: false,
        error: sourceError?.message || "Source message not found"
      };
    }
    
    if (!sourceMessage.analyzed_content) {
      await xdelo_logProcessingEvent(
        "media_group_sync_error",
        mediaGroupId,
        correlationId,
        {
          error: "Source message has no analyzed content",
          source_message_id: sourceMessageId
        },
        "Source message has no analyzed content"
      );
      
      return {
        success: false,
        error: "Source message has no analyzed content"
      };
    }
    
    // Now perform the sync with error handling and diagnostics
    // First, mark source message as the original caption holder
    await supabaseClient
      .from('messages')
      .update({
        is_original_caption: true,
        group_caption_synced: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', sourceMessageId);
    
    // Get count of messages in the group before sync
    const { count: beforeCount } = await supabaseClient
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('media_group_id', mediaGroupId);
    
    // Get count of messages needing sync
    const { count: needSyncCount } = await supabaseClient
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('media_group_id', mediaGroupId)
      .eq('group_caption_synced', false);
    
    // Perform the sync
    const syncResult = await syncMediaGroupContent(
      mediaGroupId,
      sourceMessageId,
      correlationId,
      true // Always sync edit history for reliability
    );
    
    // Log diagnostics about the operation
    await xdelo_logProcessingEvent(
      "media_group_sync_diagnostics",
      mediaGroupId,
      correlationId,
      {
        total_messages_before: beforeCount,
        needed_sync_count: needSyncCount,
        sync_result: syncResult,
        source_message_id: sourceMessageId
      }
    );
    
    return syncResult;
  } catch (error) {
    // Log any unexpected errors
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    await xdelo_logProcessingEvent(
      "media_group_sync_unexpected_error",
      mediaGroupId,
      correlationId,
      {
        source_message_id: sourceMessageId,
        error: errorMessage
      },
      errorMessage
    );
    
    return {
      success: false,
      error: errorMessage
    };
  }
}

/**
 * Find the best message to use as caption source for a media group
 */
export async function findBestCaptionSource(mediaGroupId: string, correlationId: string) {
  try {
    // Try to find a message with analyzed content and caption
    const { data: messages, error } = await supabaseClient
      .from('messages')
      .select('id, caption, analyzed_content, processing_state, is_original_caption')
      .eq('media_group_id', mediaGroupId)
      .order('is_original_caption', { ascending: false })
      .order('created_at', { ascending: true });
    
    if (error) {
      throw error;
    }
    
    if (!messages || messages.length === 0) {
      return { success: false, error: "No messages found in media group" };
    }
    
    // First priority: message marked as original caption with analyzed content
    const originalWithContent = messages.find(m => 
      m.is_original_caption && m.analyzed_content && m.caption
    );
    
    if (originalWithContent) {
      return {
        success: true,
        messageId: originalWithContent.id,
        reason: "original_with_content"
      };
    }
    
    // Second priority: any message with analyzed content and caption
    const anyWithContent = messages.find(m => 
      m.analyzed_content && m.caption
    );
    
    if (anyWithContent) {
      return {
        success: true,
        messageId: anyWithContent.id,
        reason: "any_with_content"
      };
    }
    
    // Third priority: any message with caption
    const anyWithCaption = messages.find(m => 
      m.caption && m.caption.trim().length > 0
    );
    
    if (anyWithCaption) {
      return {
        success: true,
        messageId: anyWithCaption.id,
        reason: "any_with_caption"
      };
    }
    
    // Fallback: first message in the group
    return {
      success: true,
      messageId: messages[0].id,
      reason: "fallback_first_message"
    };
  } catch (error) {
    await xdelo_logProcessingEvent(
      "find_caption_source_error",
      mediaGroupId,
      correlationId,
      {
        error: error.message
      },
      error.message
    );
    
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Check if a media group needs synchronization
 */
export async function checkMediaGroupSyncStatus(mediaGroupId: string, correlationId: string) {
  try {
    // Get counts of messages in different states
    const { data: counts, error } = await supabaseClient.rpc(
      'get_media_group_sync_status',
      { p_media_group_id: mediaGroupId }
    );
    
    if (error) {
      throw error;
    }
    
    // Determine if sync is needed based on status counts
    const needsSync = counts.total_count > 0 && 
                      (counts.unsynced_count > 0 || 
                       counts.incomplete_count > 0);
    
    return {
      success: true,
      mediaGroupId,
      needsSync,
      ...counts
    };
  } catch (error) {
    await xdelo_logProcessingEvent(
      "check_media_group_sync_error",
      mediaGroupId,
      correlationId,
      {
        error: error.message
      },
      error.message
    );
    
    return {
      success: false,
      mediaGroupId,
      needsSync: true, // Assume needs sync on error
      error: error.message
    };
  }
}
