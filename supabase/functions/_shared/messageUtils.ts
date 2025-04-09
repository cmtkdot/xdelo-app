import { supabaseClient } from './cors.ts';

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
      console.warn('Cannot construct Telegram URL: invalid parameters');
      return undefined;
    }

    // Private chats don't have shareable URLs
    if (typeof chatId === 'number' && chatId > 0) {
      // This is a private chat (positive ID)
      return undefined;
    }

    // For public channels with usernames
    if (username) {
      return `https://t.me/${username}/${msgId}`;
    }
    
    // For public channels and supergroups (negative IDs)
    // Supergroups and channels have a specific format for their URLs
    if (typeof chatId === 'number' && chatId < 0) {
      const chatIdStr = chatId.toString();
      
      // Determine if this is a supergroup/channel
      // Supergroups start with -100, channels start with -1
      if (chatIdStr.startsWith('-100')) {
        // This is a supergroup or channel, remove the -100 prefix
        const publicId = chatIdStr.substring(4);
        return `https://t.me/c/${publicId}/${msgId}`;
      } else if (chatIdStr.startsWith('-')) {
        // Regular group, not publicly accessible
        return undefined;
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
