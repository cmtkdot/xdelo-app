/// <reference types="https://deno.land/x/deno/cli/types/dts/index.d.ts" />
import { supabaseClient } from './supabaseClient.ts';
import { createClient, SupabaseClientOptions } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

// Type Definitions
interface LogMetadata {
  timestamp?: string;
  [key: string]: any; // Allows other dynamic properties
}

interface TelegramChat {
  id: number | string;
  type: string;
  title?: string;
  username?: string;
}

interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name?: string;
  last_name?: string;
  username?: string;
}

interface TelegramMessage {
  message_id: any; // Consider a more specific type
  chat?: TelegramChat;
  from?: TelegramUser;
  date: any; // Consider number for Unix timestamp
  text?: string;
  caption?: string;
  media_group_id?: string;
  photo?: any[];
  video?: any;
  document?: any;
  audio?: any;
  edit_date?: any;
  forward_from?: TelegramUser;
  forward_from_chat?: TelegramChat;
  forward_date?: any;
  forward_signature?: string;
  forward_sender_name?: string;
  forward_from_message_id?: any;
  // For root message structure in extractTelegramMetadata
  message?: TelegramMessage; // Recursive for message.message
  channel_post?: TelegramMessage;
  edited_message?: TelegramMessage;
  edited_channel_post?: TelegramMessage;
}

interface ExtractedTelegramMetadata {
  message_type: string;
  message_id: any;
  date: any;
  chat?: TelegramChat;
  from?: TelegramUser;
  text?: string;
  has_text?: boolean;
  caption?: string;
  has_caption?: boolean;
  media_group_id?: string;
  media_type?: 'photo' | 'video' | 'document' | 'audio';
  edit_date?: any;
  is_edit?: boolean;
  is_forwarded?: boolean;
  error?: string;
}

/**
 * Unified logging function for all Telegram webhook operations
 */
export async function logProcessingEvent(
  eventType: string,
  entityId: string | number,
  correlationId?: string | null,
  metadata: LogMetadata = {},
  errorMessage?: string | null
) {
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
      p_error_message: errorMessage,
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
 */
export function constructTelegramMessageUrl(
  messageOrChatId: TelegramMessage | number | string,
  messageId?: number
): string | undefined {
  try {
    let chatId: number | string | undefined;
    let msgId: any;
    let username: string | undefined;

    // Handle both function signatures
    if (typeof messageOrChatId === 'object' && messageOrChatId !== null) {
      // Called with a message object
      const msg = messageOrChatId as TelegramMessage;
      if (!msg.chat || !msg.message_id) {
        console.warn('Cannot construct Telegram URL: missing message data');
        return undefined;
      }
      chatId = msg.chat.id;
      msgId = msg.message_id;
      username = msg.chat.username;
    } else if (
      (typeof messageOrChatId === 'number' || typeof messageOrChatId === 'string') &&
      typeof messageId === 'number'
    ) {
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
    } else if (typeof chatId === 'string' && chatId.startsWith('@')) {
      // Public channel by username (if chat_id was passed as string like '@channelname')
      return `https://t.me/${chatId.substring(1)}/${msgId}`;
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
export function isMessageForwarded(message: TelegramMessage | undefined | null): boolean {
  if (!message) {
    return false;
  }
  // Check for standard forward fields
  if (
    message.forward_from ||
    message.forward_from_chat ||
    message.forward_date ||
    message.forward_signature ||
    message.forward_sender_name
  ) {
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
 */
export function createSupabaseClient(options: SupabaseClientOptions<"public"> = {}) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || 'https://xjhhehxcxkiumnwbirel.supabase.co';
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  if (!supabaseKey) {
    console.error('SUPABASE_SERVICE_ROLE_KEY is not defined in environment');
    // Potentially throw an error or handle appropriately
  }

  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      ...(options.auth || {}),
    },
    global: {
      fetch: globalThis.fetch, // Use globalThis.fetch
      ...(options.global || {}),
    },
    ...options,
  });
}

/**
 * Extract essential metadata from a Telegram message for efficient storage
 */
export function extractTelegramMetadata(message: TelegramMessage | undefined | null): Partial<ExtractedTelegramMetadata> {
  if (!message) {
    return {};
  }

  try {
    // Determine the root message object based on message type
    const rootMessage: TelegramMessage | undefined = 
      message.message || 
      message.channel_post || 
      message.edited_message || 
      message.edited_channel_post || 
      message;

    if (!rootMessage || !rootMessage.message_id || !rootMessage.date) {
      return { error: 'Essential message fields (message_id, date) missing' };
    }
    
    // Basic metadata structure
    const metadata: Partial<ExtractedTelegramMetadata> = {
      message_type: message.message
        ? 'message'
        : message.channel_post
        ? 'channel_post'
        : message.edited_message
        ? 'edited_message'
        : message.edited_channel_post
        ? 'edited_channel_post'
        : 'unknown',
      message_id: rootMessage.message_id,
      date: rootMessage.date,
    };

    // Add chat info if available
    if (rootMessage.chat) {
      metadata.chat = {
        id: rootMessage.chat.id,
        type: rootMessage.chat.type,
        title: rootMessage.chat.title,
        username: rootMessage.chat.username,
      };
    }

    // Add sender info if available (not present in channel posts)
    if (rootMessage.from) {
      metadata.from = {
        id: rootMessage.from.id,
        is_bot: rootMessage.from.is_bot,
        first_name: rootMessage.from.first_name,
        last_name: rootMessage.from.last_name,
        username: rootMessage.from.username,
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
      error: 'Failed to extract metadata',
    };
  }
}
