
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

// Create Supabase client
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
 * Log a processing event to the unified_audit_logs table with retry logic
 */
export async function xdelo_logProcessingEvent(
  eventType: string,
  entityId: string,
  correlationId: string,
  metadata: Record<string, unknown>,
  errorMessage?: string,
  retries: number = 3
) {
  let attempt = 0;
  
  while (attempt < retries) {
    attempt++;
    try {
      // Ensure metadata has a timestamp
      const enhancedMetadata = {
        ...metadata,
        timestamp: metadata.timestamp || new Date().toISOString(),
        correlation_id: correlationId,
        logged_from: 'edge_function',
        retry_attempt: attempt > 1 ? attempt : undefined
      };
      
      await supabaseClient.from('unified_audit_logs').insert({
        event_type: eventType,
        entity_id: entityId,
        metadata: enhancedMetadata,
        error_message: errorMessage,
        correlation_id: correlationId,
        event_timestamp: new Date().toISOString()
      });
      
      // Success, break out of retry loop
      break;
    } catch (error) {
      console.error(`Error logging event (attempt ${attempt}): ${eventType}`, error);
      
      // Last attempt failed, but don't throw as this is just logging
      if (attempt >= retries) {
        console.error(`Failed to log event after ${retries} attempts: ${eventType}`);
        break;
      }
      
      // Wait before retry with exponential backoff
      const backoff = Math.pow(2, attempt) * 100; // 200ms, 400ms, 800ms...
      await new Promise(resolve => setTimeout(resolve, backoff));
    }
  }
}

/**
 * Update message processing state with retry mechanism
 */
export async function updateMessageState(
  messageId: string,
  state: 'pending' | 'processing' | 'completed' | 'error',
  errorMessage?: string,
  retries: number = 3
) {
  let attempt = 0;
  
  while (attempt < retries) {
    attempt++;
    try {
      const updates: Record<string, unknown> = {
        processing_state: state,
        updated_at: new Date().toISOString()
      };
      
      if (state === 'processing') {
        updates.processing_started_at = new Date().toISOString();
      } else if (state === 'completed') {
        updates.processing_completed_at = new Date().toISOString();
        updates.error_message = null;
      } else if (state === 'error' && errorMessage) {
        updates.error_message = errorMessage;
        updates.last_error_at = new Date().toISOString();
        updates.retry_count = supabaseClient.rpc('increment_field', {
          table_name: 'messages',
          column_name: 'retry_count',
          row_id: messageId
        });
      }
      
      const { error } = await supabaseClient
        .from('messages')
        .update(updates)
        .eq('id', messageId);
        
      if (error) {
        throw error;
      }
      
      return true;
    } catch (error) {
      console.error(`Error updating message state (attempt ${attempt}): ${error.message}`);
      
      // Last attempt failed
      if (attempt >= retries) {
        console.error(`Failed to update message state after ${retries} attempts`);
        return false;
      }
      
      // Wait before retry with exponential backoff
      const backoff = Math.pow(2, attempt) * 100; // 200ms, 400ms, 800ms...
      await new Promise(resolve => setTimeout(resolve, backoff));
    }
  }
  
  return false;
}

/**
 * Get message by ID with cache validation
 */
export async function getMessageById(messageId: string) {
  try {
    const { data, error } = await supabaseClient
      .from('messages')
      .select('*')
      .eq('id', messageId)
      .single();
      
    if (error) {
      console.error(`Error getting message: ${error.message}`);
      return null;
    }
    
    return data;
  } catch (error) {
    console.error(`Error getting message: ${error.message}`);
    return null;
  }
}

/**
 * Sync media group content with optimistic locking
 */
export async function syncMediaGroupContent(
  mediaGroupId: string,
  sourceMessageId: string,
  correlationId: string,
  syncEditHistory: boolean = false
) {
  try {
    // Use the RPC function which handles locking internally
    const { data, error } = await supabaseClient.rpc(
      'xdelo_sync_media_group_content',
      {
        p_media_group_id: mediaGroupId,
        p_source_message_id: sourceMessageId,
        p_correlation_id: correlationId,
        p_force_sync: true,
        p_sync_edit_history: syncEditHistory
      }
    );
    
    if (error) {
      throw new Error(`Media group sync failed: ${error.message}`);
    }
    
    return {
      success: true,
      mediaGroupId,
      sourceMessageId,
      updatedCount: data.updated_count || 0,
      syncedEditHistory: syncEditHistory
    };
  } catch (error) {
    console.error(`Error syncing media group: ${error.message}`);
    
    // Log the error but don't throw to prevent cascading failures
    await xdelo_logProcessingEvent(
      "media_group_sync_error",
      mediaGroupId,
      correlationId,
      {
        source_message_id: sourceMessageId,
        error: error.message
      },
      error.message
    );
    
    return {
      success: false,
      error: error.message,
      mediaGroupId,
      sourceMessageId
    };
  }
}

/**
 * Find the best caption message for a media group
 */
export async function findCaptionMessage(mediaGroupId: string) {
  try {
    const { data, error } = await supabaseClient.rpc(
      'xdelo_find_caption_message',
      { p_media_group_id: mediaGroupId }
    );
    
    if (error) {
      console.error(`Error finding caption message: ${error.message}`);
      return null;
    }
    
    return data;
  } catch (error) {
    console.error(`Error finding caption message: ${error.message}`);
    return null;
  }
}

/**
 * Verify message exists in the database
 */
export async function verifyMessageExists(messageId: string): Promise<boolean> {
  try {
    const { count, error } = await supabaseClient
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('id', messageId);
      
    if (error) {
      console.error(`Error verifying message: ${error.message}`);
      return false;
    }
    
    return count === 1;
  } catch (error) {
    console.error(`Error verifying message: ${error.message}`);
    return false;
  }
}

/**
 * Log diagnostic information about a media group
 */
export async function logMediaGroupDiagnostics(
  mediaGroupId: string,
  correlationId: string
) {
  try {
    // Get count of messages in the group
    const { count: totalCount, error: countError } = await supabaseClient
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('media_group_id', mediaGroupId);
      
    if (countError) {
      throw countError;
    }
    
    // Get stats on message states
    const { data: stats, error: statsError } = await supabaseClient
      .from('messages')
      .select('processing_state, count(*)')
      .eq('media_group_id', mediaGroupId)
      .group('processing_state');
      
    if (statsError) {
      throw statsError;
    }
    
    // Log the diagnostics
    await xdelo_logProcessingEvent(
      "media_group_diagnostics",
      mediaGroupId,
      correlationId,
      {
        total_messages: totalCount,
        state_counts: stats,
        timestamp: new Date().toISOString()
      }
    );
    
    return {
      totalCount,
      stats
    };
  } catch (error) {
    console.error(`Error logging media group diagnostics: ${error.message}`);
    
    // Log the error but don't throw
    await xdelo_logProcessingEvent(
      "media_group_diagnostics_error",
      mediaGroupId,
      correlationId,
      {
        error: error.message
      },
      error.message
    );
    
    return null;
  }
}
