import { SupabaseClient } from "@supabase/supabase-js";

export type ProcessingState = 'initialized' | 'pending' | 'processing' | 'completed' | 'error';

export const PROCESSING_STATES: Record<string, ProcessingState> = {
  INITIALIZED: 'initialized',
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  ERROR: 'error'
};

export interface ProcessingMetadata {
  state: ProcessingState;
  completedAt?: string;
  correlationId: string;
  lastProcessedAt: string;
  syncAttempt: number;
  error?: string;
}

export interface MediaGroupInfo {
  messageCount: number;
  firstMessageTime: string | null;
  lastMessageTime: string | null;
  analyzedContent?: Record<string, any>;
}

export async function getMediaGroupInfo(
  supabase: SupabaseClient,
  mediaGroupId: string
): Promise<MediaGroupInfo | undefined> {
  const { data: messages } = await supabase
    .from('messages')
    .select('*')
    .eq('media_group_id', mediaGroupId)
    .order('created_at', { ascending: true });

  if (!messages?.length) {
    return undefined;
  }

  // Find any analyzed content in the group
  const analyzedMessage = messages.find(m => m.analyzed_content);

  return {
    messageCount: messages.length,
    firstMessageTime: messages[0]?.created_at || null,
    lastMessageTime: messages[messages.length - 1]?.created_at || null,
    analyzedContent: analyzedMessage?.analyzed_content
  };
}

export async function syncMediaGroupContent(
  supabase: SupabaseClient,
  sourceMessageId: string,
  mediaGroupId: string,
  correlationId?: string
): Promise<void> {
  await supabase.rpc('xdelo_sync_media_group_content', {
    p_source_message_id: sourceMessageId,
    p_media_group_id: mediaGroupId,
    p_correlation_id: correlationId
  });
}

export async function xdelo_update_message_state(
  supabase: SupabaseClient,
  messageId: string,
  state: ProcessingState,
  errorMessage?: string
): Promise<void> {
  const updateData: Record<string, any> = {
    processing_state: state,
    updated_at: new Date().toISOString()
  };
  
  if (state === 'processing') {
    updateData.processing_started_at = new Date().toISOString();
  } else if (state === 'completed') {
    updateData.processing_completed_at = new Date().toISOString();
  } else if (state === 'error' && errorMessage) {
    updateData.error_message = errorMessage;
    updateData.last_error_at = new Date().toISOString();
  }
  
  await supabase
    .from('messages')
    .update(updateData)
    .eq('id', messageId);
}

export async function xdelo_get_message_processing_stats(
  supabase: SupabaseClient
): Promise<Record<string, any>> {
  const { data } = await supabase.rpc('xdelo_get_message_processing_stats');
  return data || {
    total: 0,
    initialized: 0,
    pending: 0,
    processing: 0,
    completed: 0,
    error: 0,
    stalled_processing: 0,
    stalled_pending: 0,
    processing_times: {
      avg_minutes: 0,
      max_minutes: 0
    }
  };
}

// Function to find files with potential MIME type issues
export async function xdelo_find_mime_type_issues(
  supabase: SupabaseClient,
  limit: number = 100
): Promise<any[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('id, file_unique_id, mime_type, telegram_data')
    .or('mime_type.is.null,mime_type.eq.application/octet-stream')
    .eq('deleted_from_telegram', false)
    .is('file_unique_id', 'not', null)
    .order('created_at', { ascending: false })
    .limit(limit);
    
  if (error) {
    console.error('Error finding MIME type issues:', error);
    return [];
  }
  
  return data || [];
}

// Function to synchronize storage paths with the database
export async function xdelo_sync_storage_paths(
  supabase: SupabaseClient,
  messageIds?: string[],
  limit: number = 100
): Promise<Record<string, any>> {
  try {
    const { data, error } = await supabase.rpc(
      'xdelo_fix_storage_paths',
      {
        p_limit: limit,
        p_only_check: false
      }
    );
    
    if (error) {
      throw error;
    }
    
    // Count results
    const results = {
      total: data?.length || 0,
      fixed: 0,
      needsRedownload: 0
    };
    
    if (data && data.length > 0) {
      results.fixed = data.filter(item => item.fixed).length;
      results.needsRedownload = data.filter(item => item.needs_redownload).length;
    }
    
    return results;
  } catch (error) {
    console.error('Error syncing storage paths:', error);
    return {
      error: error.message,
      total: 0,
      fixed: 0,
      needsRedownload: 0
    };
  }
}

// Enhanced function to fix MIME types in the database
export async function xdelo_fix_file_mime_types(
  supabase: SupabaseClient,
  messageId?: string | null,
  limit: number = 50
): Promise<{success: boolean, updated: number, error?: string}> {
  try {
    if (messageId) {
      // Fix a specific message
      const { data: message, error: messageError } = await supabase
        .from('messages')
        .select('*')
        .eq('id', messageId)
        .single();
        
      if (messageError || !message) {
        throw new Error(`Message not found: ${messageError?.message || 'No data returned'}`);
      }
      
      // Skip if no telegram_data
      if (!message.telegram_data) {
        return { success: false, updated: 0, error: 'No telegram_data available' };
      }
      
      // Get more accurate MIME type
      const { data: detectedType, error: typeError } = await supabase.rpc(
        'xdelo_get_accurate_mime_type',
        { p_message_data: JSON.stringify(message) }
      );
      
      if (typeError) {
        throw new Error(`Failed to detect MIME type: ${typeError.message}`);
      }
      
      // Only update if detected type is different and not empty
      if (detectedType && detectedType !== message.mime_type) {
        const { error: updateError } = await supabase
          .from('messages')
          .update({
            mime_type: detectedType,
            mime_type_original: message.mime_type,
            updated_at: new Date().toISOString()
          })
          .eq('id', messageId);
          
        if (updateError) {
          throw new Error(`Failed to update MIME type: ${updateError.message}`);
        }
        
        return { success: true, updated: 1 };
      }
      
      return { success: true, updated: 0 };
    } else {
      // Fix multiple messages
      const { data, error } = await supabase.rpc(
        'xdelo_fix_mime_types',
        {
          p_limit: limit,
          p_only_octet_stream: true
        }
      );
      
      if (error) {
        throw new Error(`Failed to run fix_mime_types: ${error.message}`);
      }
      
      return { success: true, updated: data?.length || 0 };
    }
  } catch (error) {
    console.error('Error fixing MIME types:', error);
    return { success: false, updated: 0, error: error.message };
  }
}

export async function xdelo_fix_message_mime_type(
  supabase: SupabaseClient,
  messageId: string
): Promise<{success: boolean, original?: string, updated?: string}> {
  try {
    // Get the message
    const { data: message, error: messageError } = await supabase
      .from('messages')
      .select('*')
      .eq('id', messageId)
      .single();
      
    if (messageError || !message) {
      throw new Error(`Message not found: ${messageError?.message || 'No data returned'}`);
    }
    
    // Skip if no telegram_data or file_unique_id
    if (!message.telegram_data || !message.file_unique_id) {
      return { success: false };
    }
    
    // Detect better MIME type from telegram_data
    const detectedMimeType = getMoreAccurateMimeType(message);
    
    // If detected type is the same as current, no need to update
    if (detectedMimeType === message.mime_type) {
      return { 
        success: true,
        original: message.mime_type,
        updated: message.mime_type
      };
    }
    
    // Update the message with the detected MIME type
    const { error: updateError } = await supabase
      .from('messages')
      .update({
        mime_type: detectedMimeType,
        mime_type_original: message.mime_type,
        updated_at: new Date().toISOString()
      })
      .eq('id', messageId);
      
    if (updateError) {
      throw new Error(`Failed to update MIME type: ${updateError.message}`);
    }
    
    return {
      success: true,
      original: message.mime_type,
      updated: detectedMimeType
    };
  } catch (error) {
    console.error(`Error fixing MIME type for message ${messageId}:`, error);
    return { success: false };
  }
}

function getMoreAccurateMimeType(message: any): string {
  // If mime_type exists and is not octet-stream, trust it
  if (message.mime_type && message.mime_type !== 'application/octet-stream') {
    return message.mime_type;
  }
  
  const telegramData = message.telegram_data || {};
  
  // Check based on media type in telegram_data
  if (telegramData.photo) return 'image/jpeg';
  if (telegramData.video?.mime_type) return telegramData.video.mime_type;
  if (telegramData.video) return 'video/mp4';
  if (telegramData.document?.mime_type) return telegramData.document.mime_type;
  if (telegramData.audio?.mime_type) return telegramData.audio.mime_type;
  if (telegramData.audio) return 'audio/mpeg';
  if (telegramData.voice?.mime_type) return telegramData.voice.mime_type;
  if (telegramData.voice) return 'audio/ogg';
  if (telegramData.animation) return 'video/mp4';
  if (telegramData.sticker?.is_animated) return 'application/x-tgsticker';
  if (telegramData.sticker) return 'image/webp';
  
  // If we can't determine a better type, keep the existing one
  return message.mime_type || 'application/octet-stream';
}

async function updateRetryCount(supabase, messageId) {
  // Update the message with incremented retry count
  await supabase
    .from('messages')
    .update({
      retry_count: supabase.rpc('increment', { row_id: messageId, column_name: 'retry_count' }),
      last_retry_at: new Date().toISOString()
    })
    .eq('id', messageId);
}
