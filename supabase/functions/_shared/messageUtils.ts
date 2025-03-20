import { supabaseClient } from './supabase.ts';

/**
 * Construct a shareable message URL for a Telegram message
 * @param messageOrChatId Either a full message object, or a chat ID
 * @param messageId Optional message ID if first param is a chat ID
 */
export function constructTelegramMessageUrl(
  messageOrChatId: any,
  messageId?: number
): string | undefined {
  try {
    let chatId: number;
    let msgId: number;
    let username: string | undefined;
    
    // Handle both function signatures
    if (typeof messageOrChatId === 'object' && messageOrChatId !== null) {
      // Called with a message object
      if (!messageOrChatId.chat || !messageOrChatId.message_id) {
        console.warn('Cannot construct Telegram URL: missing message data');
        return undefined;
      }
      chatId = messageOrChatId.chat.id;
      msgId = messageOrChatId.message_id;
      username = messageOrChatId.chat.username;
    } else if (typeof messageOrChatId === 'number' && typeof messageId === 'number') {
      // Called with separate chat ID and message ID
      chatId = messageOrChatId;
      msgId = messageId;
    } else {
      console.warn('Invalid parameters for constructTelegramMessageUrl');
      return undefined;
    }
    
    // For public channels with username
    if (username) {
      return `https://t.me/${username}/${msgId}`;
    }
    
    // Private chat URLs cannot be constructed
    if (chatId > 0) {
      return undefined;
    }
    
    // For private channels/groups
    if (chatId < 0) {
      // Check if it's a supergroup/channel (-100 prefix)
      const chatIdStr = chatId.toString();
      if (chatIdStr.startsWith('-100')) {
        // Remove the -100 prefix
        const channelId = chatIdStr.substring(4);
        return `https://t.me/c/${channelId}/${msgId}`;
      } else {
        // Regular group - strip the minus sign
        const groupId = Math.abs(chatId);
        return `https://t.me/g/${groupId}/${msgId}`;
      }
    }
    
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
