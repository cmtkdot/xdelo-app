
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
