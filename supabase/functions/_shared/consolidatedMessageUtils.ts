import { supabaseClient } from './supabaseClient.ts';
/**
 * Unified logging function for all Telegram webhook operations
 */ export async function logProcessingEvent(eventType, entityId, correlationId, metadata = {}, errorMessage) {
  try {
    // Ensure entityId is a string
    const entityIdStr = entityId.toString();
    // Add timestamp if not already present
    if (!metadata.timestamp) {
      metadata.timestamp = new Date().toISOString();
    }
    // Log to database
    const { error } = await supabaseClient.rpc('xdelo_log_event', {
      p_event_type: eventType,
      p_entity_id: entityIdStr,
      p_correlation_id: correlationId,
      p_metadata: metadata,
      p_error_message: errorMessage
    });
    if (error) {
      console.error(`Error logging event ${eventType}:`, error);
    }
  } catch (err) {
    console.error(`Exception in logProcessingEvent:`, err);
  }
}
/**
 * Construct a shareable message URL for a Telegram message
 * @param messageOrChatId Either a full message object, or a chat ID
 * @param messageId Optional message ID if first param is a chat ID
 */ export function constructTelegramMessageUrl(messageOrChatId, messageId) {
  try {
    let chatId;
    let msgId;
    let username;
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
 */ export function isMessageForwarded(message) {
  if (!message) {
    return false;
  }
  // Check for standard forward fields
  if (message.forward_from || message.forward_from_chat || message.forward_date || message.forward_signature || message.forward_sender_name) {
    return true;
  }
  // Check for forwarded from channel posts which use forward_from_message_id
  if (message.forward_from_message_id) {
    return true;
  }
  return false;
}
/**
 * Create Supabase client with enhanced error handling and retry capabilities
 */ export function createSupabaseClient(options = {}) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || 'https://xjhhehxcxkiumnwbirel.supabase.co';
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  if (!supabaseKey) {
    console.error('SUPABASE_SERVICE_ROLE_KEY is not defined in environment');
  }
  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    },
    global: {
      fetch: (...args)=>fetch(...args)
    }
  });
}
/**
 * Extract essential metadata from a Telegram message for efficient storage
 */ export function extractTelegramMetadata(message) {
  if (!message) {
    return {};
  }
  try {
    // Determine the root message object based on message type
    const rootMessage = message.message || message.channel_post || message.edited_message || message.edited_channel_post || message;
    // Basic metadata structure
    const metadata = {
      message_type: message.message ? 'message' : message.channel_post ? 'channel_post' : message.edited_message ? 'edited_message' : message.edited_channel_post ? 'edited_channel_post' : 'unknown',
      message_id: rootMessage.message_id,
      date: rootMessage.date
    };
    // Add chat info if available
    if (rootMessage.chat) {
      metadata.chat = {
        id: rootMessage.chat.id,
        type: rootMessage.chat.type,
        title: rootMessage.chat.title,
        username: rootMessage.chat.username
      };
    }
    // Add sender info if available (not present in channel posts)
    if (rootMessage.from) {
      metadata.from = {
        id: rootMessage.from.id,
        is_bot: rootMessage.from.is_bot,
        first_name: rootMessage.from.first_name,
        last_name: rootMessage.from.last_name,
        username: rootMessage.from.username
      };
    }
    // Add message content indicators
    if (rootMessage.text) {
      metadata.text = rootMessage.text.substring(0, 100) + (rootMessage.text.length > 100 ? '...' : '');
      metadata.has_text = true;
    }
    if (rootMessage.caption) {
      metadata.caption = rootMessage.caption.substring(0, 100) + (rootMessage.caption.length > 100 ? '...' : '');
      metadata.has_caption = true;
    }
    // Add media group ID if present
    if (rootMessage.media_group_id) {
      metadata.media_group_id = rootMessage.media_group_id;
    }
    // Add media types
    if (rootMessage.photo) {
      metadata.media_type = 'photo';
    } else if (rootMessage.video) {
      metadata.media_type = 'video';
    } else if (rootMessage.document) {
      metadata.media_type = 'document';
    } else if (rootMessage.audio) {
      metadata.media_type = 'audio';
    }
    // Add edit metadata if applicable
    if (rootMessage.edit_date) {
      metadata.edit_date = rootMessage.edit_date;
      metadata.is_edit = true;
    }
    // Add forward metadata if applicable
    if (isMessageForwarded(rootMessage)) {
      metadata.is_forwarded = true;
    }
    return metadata;
  } catch (error) {
    console.error('Error extracting telegram metadata:', error);
    return {
      error: 'Failed to extract metadata'
    };
  }
}
/**
 * Import needed for createClient to work
 */ import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
