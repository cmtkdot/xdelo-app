import { supabaseClient } from './supabase.ts';

/**
 * Construct a shareable message URL for a Telegram message
 */
export function constructTelegramMessageUrl(message: any): string | undefined {
  try {
    if (!message || !message.chat || !message.message_id) {
      console.warn('Cannot construct Telegram URL: missing message data');
      return undefined;
    }
    
    const { chat, message_id } = message;
    const chatId = chat.id;
    
    // Private chat URLs cannot be constructed
    if (chatId > 0) {
      return undefined;
    }
    
    // For public channels with username
    if (chat.username) {
      return `https://t.me/${chat.username}/${message_id}`;
    }
    
    // For private channels/groups
    // Format depends on the chat ID format (different for supergroups/channels vs regular groups)
    if (chatId < 0) {
      // Supergroups and channels (usually have 13 digit IDs starting with -100)
      if (chatId < -1000000000000) {
        // For supergroups/channels with 13+ digit IDs: extract the ID without the -100 prefix
        const chatIdStr = Math.abs(chatId).toString();
        const idWithoutPrefix = chatIdStr.substring(3);
        return `https://t.me/c/${idWithoutPrefix}/${message_id}`;
      } else {
        // For regular groups: just use the abs value of the ID
        return `https://t.me/c/${Math.abs(chatId)}/${message_id}`;
      }
    }
    
    // Fallback
    return undefined;
  } catch (error) {
    console.error('Error constructing Telegram URL:', error);
    return undefined;
  }
}

/**
 * Check if a message is forwarded from another source
 */
export function isMessageForwarded(message: any): boolean {
  if (!message) {
    return false;
  }
  
  // Check for standard forward fields
  if (message.forward_from || 
      message.forward_from_chat || 
      message.forward_date || 
      message.forward_signature || 
      message.forward_sender_name) {
    return true;
  }
  
  // Check for forwarded from channel posts which use forward_from_message_id
  if (message.forward_from_message_id) {
    return true;
  }
  
  return false;
}

/**
 * Finds other messages in the same media group and retrieves their info
 */
export async function xdelo_findMediaGroupMessages(
  mediaGroupId: string,
  excludeMessageId?: string
): Promise<any[]> {
  if (!mediaGroupId) {
    return [];
  }

  try {
    let query = supabaseClient
      .from('messages')
      .select('*')
      .eq('media_group_id', mediaGroupId)
      .order('created_at', { ascending: true });
      
    if (excludeMessageId) {
      query = query.neq('id', excludeMessageId);
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('Error finding media group messages:', error);
      return [];
    }
    
    return data || [];
  } catch (error) {
    console.error('Exception finding media group messages:', error);
    return [];
  }
}

/**
 * Find a message with analyzed content in a media group
 */
export async function xdelo_findMessageWithContent(
  mediaGroupId: string,
  excludeMessageId?: string
): Promise<any | null> {
  if (!mediaGroupId) {
    return null;
  }
  
  try {
    // Find messages in the group with a caption and analyzed content
    let query = supabaseClient
      .from('messages')
      .select('*')
      .eq('media_group_id', mediaGroupId)
      .not('analyzed_content', 'is', null)
      .not('caption', 'is', null)
      .order('created_at', { ascending: true });
      
    if (excludeMessageId) {
      query = query.neq('id', excludeMessageId);
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('Error finding message with content:', error);
      return null;
    }
    
    // Return the first message with content or null if none found
    return (data && data.length > 0) ? data[0] : null;
  } catch (error) {
    console.error('Exception finding message with content:', error);
    return null;
  }
}

/**
 * Sync analyzed content across media group messages
 */
export async function xdelo_syncMediaGroupContent(
  sourceMessageId: string,
  targetMessageId: string,
  correlationId?: string
): Promise<boolean> {
  try {
    // Get source message content
    const { data: sourceMessage, error: sourceError } = await supabaseClient
      .from('messages')
      .select('analyzed_content, caption')
      .eq('id', sourceMessageId)
      .single();
      
    if (sourceError || !sourceMessage || !sourceMessage.analyzed_content) {
      console.error(`[${correlationId}] Error getting source message content:`, sourceError);
      return false;
    }
    
    // Update target message with content from source
    const { error: updateError } = await supabaseClient
      .from('messages')
      .update({
        analyzed_content: sourceMessage.analyzed_content,
        group_caption_synced: true,
        is_original_caption: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', targetMessageId);
      
    if (updateError) {
      console.error(`[${correlationId}] Error syncing media group content:`, updateError);
      return false;
    }
    
    // Log the sync event
    await supabaseClient.from('unified_audit_logs').insert({
      event_type: 'media_group_content_synced',
      entity_id: targetMessageId,
      metadata: {
        source_message_id: sourceMessageId,
        correlation_id: correlationId,
        timestamp: new Date().toISOString()
      }
    });
    
    return true;
  } catch (error) {
    console.error(`[${correlationId}] Exception syncing media group content:`, error);
    return false;
  }
}

/**
 * Find a working file within the same media group when a file_id fails
 * 
 * @param mediaGroupId The media group ID to search within
 * @param fileUniqueId The original file's unique ID
 * @param excludeMessageId Optional message ID to exclude from search
 * @returns The first message found with a valid file_id, or null if none found
 */
export async function xdelo_findAlternativeFileInMediaGroup(
  mediaGroupId: string,
  fileUniqueId: string,
  excludeMessageId?: string
): Promise<any | null> {
  if (!mediaGroupId || !fileUniqueId) {
    return null;
  }

  try {
    console.log(`Searching for alternative file in media group ${mediaGroupId} with file_unique_id ${fileUniqueId}`);
    
    // Find all messages in the same media group with the same file_unique_id
    let query = supabaseClient
      .from('messages')
      .select('*')
      .eq('media_group_id', mediaGroupId)
      .eq('file_unique_id', fileUniqueId)
      .eq('needs_redownload', false) // Prefer messages not already flagged for redownload
      .order('created_at', { ascending: false });
      
    if (excludeMessageId) {
      query = query.neq('id', excludeMessageId);
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('Error finding alternative file in media group:', error);
      return null;
    }
    
    if (!data || data.length === 0) {
      console.log('No alternative files found in media group');
      return null;
    }
    
    console.log(`Found ${data.length} potential alternative files in the media group`);
    
    // Find the first one with a valid file_id
    for (const message of data) {
      if (message.file_id && !message.file_id_expires_at) {
        console.log(`Using alternative file from message ${message.id}`);
        return message;
      }
    }
    
    // If no clear valid file_id, just return the first one and hope for the best
    console.log(`Using first available message ${data[0].id} (no clearly valid file_id found)`);
    return data[0];
  } catch (error) {
    console.error('Exception finding alternative file in media group:', error);
    return null;
  }
}

/**
 * Mark a message as needing redownload due to expired file_id
 */
export async function xdelo_markMessageForRedownload(
  messageId: string, 
  reason: string = 'expired_file_id'
): Promise<boolean> {
  try {
    const { error } = await supabaseClient
      .from('messages')
      .update({
        needs_redownload: true,
        redownload_reason: reason,
        redownload_flagged_at: new Date().toISOString(),
        file_id_expires_at: new Date().toISOString(), // Mark the current file_id as expired
        updated_at: new Date().toISOString()
      })
      .eq('id', messageId);
      
    if (error) {
      console.error(`Error marking message ${messageId} for redownload:`, error);
      return false;
    }
    
    // Log the event
    await supabaseClient.from('unified_audit_logs').insert({
      event_type: 'message_flagged_for_redownload',
      entity_id: messageId,
      metadata: {
        reason,
        timestamp: new Date().toISOString()
      }
    });
    
    return true;
  } catch (error) {
    console.error(`Exception marking message ${messageId} for redownload:`, error);
    return false;
  }
}
