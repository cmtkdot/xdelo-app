import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import type { AnalyzedContent, TelegramMessage } from './types.ts';

// CORS headers for all responses
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

/**
 * Create Supabase client with enhanced error handling and retry capabilities
 */
export function createSupabaseClient(options = {}) {
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
      fetch: (...args) => fetch(...args)
    },
    ...options
  });
}

// Initialize Supabase client
export const supabase = createSupabaseClient();

/**
 * Unified logging function for all operations
 */
export async function logEvent(
  eventType: string,
  entityId: string | number,
  correlationId: string | null = null,
  metadata: Record<string, unknown> = {},
  errorMessage: string | null = null,
): Promise<boolean> {
  try {
    // Ensure entityId is a string
    const entityIdStr = entityId.toString();
    
    // Add timestamp if not already present
    if (!metadata.timestamp) {
      metadata.timestamp = new Date().toISOString();
    }
    
    // Use the consolidated log event function
    const { data, error } = await supabase.rpc(
      'xdelo_log_event',
      {
        p_event_type: eventType,
        p_entity_id: entityIdStr,
        p_correlation_id: correlationId,
        p_metadata: metadata,
        p_error_message: errorMessage,
      });

    if (error) {
      console.error('Error logging event:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Exception logging event:', error);
    return false;
  }
}

/**
 * Update a message's processing state
 */
export async function updateMessageState(
  messageId: string,
  state: 'pending' | 'processing' | 'completed' | 'error',
  correlationId: string | null = null,
  analyzedContent: Record<string, unknown> | null = null,
  errorMessage: string | null = null,
): Promise<Record<string, unknown>> {
  try {
    // Use the consolidated update message state function
    const { data, error } = await supabase
      .rpc('xdelo_update_message_state', {
        p_message_id: messageId,
        p_state: state,
        p_correlation_id: correlationId,
        p_analyzed_content: analyzedContent,
        p_error_message: errorMessage,
      });

    if (error) {
      console.error('Error updating message state:', error);
      return {
        success: false,
        error: error.message,
        messageId,
      };
    }

    return data || {
      success: true,
      messageId,
      state,
    };
  } catch (error) {
    console.error('Exception updating message state:', error.message);
    return {
      success: false,
      error: error.message,
      messageId,
    };
  }
}

/**
 * Format an error response
 */
export function formatErrorResponse(
  error: string | Error,
  correlationId?: string,
  statusCode: number = 400,
): Response {
  const errorMessage = error instanceof Error ? error.message : error;
  
  return new Response(
    JSON.stringify({
      success: false,
      error: errorMessage,
      correlationId,
      timestamp: new Date().toISOString(),
    }),
    {
      status: statusCode,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}

/**
 * Format a success response
 */
export function formatSuccessResponse(
  data: Record<string, unknown>,
  correlationId?: string,
  statusCode: number = 200,
): Response {
  return new Response(
    JSON.stringify({
      success: true,
      ...data,
      correlationId,
      timestamp: new Date().toISOString(),
    }),
    {
      status: statusCode,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}

/**
 * Construct a message URL for Telegram messages
 */
export function constructMessageUrl(chatId: number, messageId: number): string {
  const chatIdStr = chatId.toString();
  
  if (chatIdStr.startsWith('-100')) {
    // Channel or supergroup
    const channelId = chatIdStr.substring(4);
    return `https://t.me/c/${channelId}/${messageId}`;
  } else if (chatIdStr.startsWith('-')) {
    // Group
    return `https://t.me/chat/NA/${messageId}`;
  } else {
    // Private chat
    return `https://t.me/NA/${messageId}`;
  }
}

/**
 * Extract forward information from a Telegram message
 */
export function extractForwardInfo(message: TelegramMessage): {
  isForwarded: boolean;
  forwardFrom?: Record<string, unknown>;
  forwardFromChat?: Record<string, unknown>;
  forwardDate?: number;
  forwardFromMessageId?: number;
} {
  // Handle both newer and older message structures
  const forwardFrom = message.forward_from || message.forwardFrom;
  const forwardFromChat = message.forward_from_chat || message.forwardFromChat;
  const forwardDate = message.forward_date || message.forwardDate;
  const forwardFromMessageId = message.forward_from_message_id || message.forwardFromMessageId;

  if (!forwardFrom && !forwardFromChat && !forwardDate) {
    return { isForwarded: false };
  }

  return {
    isForwarded: true,
    forwardFrom,
    forwardFromChat,
    forwardDate,
    forwardFromMessageId,
  };
}

/**
 * Check if a message exists in the database
 */
export async function checkMessageExists(
  chatIdOrMessageId: number | string,
  telegramMessageId?: number
): Promise<boolean> {
  try {
    // If only one parameter is provided and it's a string, assume it's a message ID (UUID)
    if (typeof chatIdOrMessageId === 'string' && telegramMessageId === undefined) {
      const { data, error } = await supabase
        .from('messages')
        .select('id')
        .eq('id', chatIdOrMessageId)
        .maybeSingle();
      
      return !error && !!data;
    }
    
    // Otherwise check by chat_id and telegram_message_id
    const { data, error } = await supabase
      .from('messages')
      .select('id')
      .eq('chat_id', chatIdOrMessageId)
      .eq('telegram_message_id', telegramMessageId)
      .maybeSingle();
    
    return !error && !!data;
  } catch (error) {
    console.error('Error checking message existence:', error);
    return false;
  }
}

/**
 * Parse a caption/text to extract structured data
 */
export async function parseCaption(
  caption: string,
  options: Record<string, any> = {}
): Promise<AnalyzedContent> {
  // Basic implementation - should be enhanced with actual parsing logic
  return {
    raw_text: caption,
    parsing_metadata: {
      trigger_source: options.trigger_source || 'manual',
      parsing_time: Date.now().toString(),
      success: true
    },
    parsed_at: new Date().toISOString()
  };
}

/**
 * Synchronize content across all messages in a media group
 */
export async function syncMediaGroup(
  sourceMessageId: string,
  mediaGroupId: string,
  correlationId: string | null = null,
  forceSync: boolean = false,
  syncEditHistory: boolean = false
): Promise<Record<string, unknown>> {
  try {
    const { data, error } = await supabase.rpc(
      'xdelo_sync_media_group',
      {
        p_source_message_id: sourceMessageId,
        p_media_group_id: mediaGroupId,
        p_correlation_id: correlationId,
        p_force_sync: forceSync,
        p_sync_edit_history: syncEditHistory
      }
    );
    
    if (error) {
      console.error('Error in syncMediaGroup:', error);
      return {
        success: false,
        error: error.message,
        mediaGroupId,
        sourceMessageId
      };
    }
    
    return data || {
      success: true,
      mediaGroupId,
      sourceMessageId
    };
  } catch (error) {
    console.error('Exception in syncMediaGroup:', error);
    return {
      success: false,
      error: error.message,
      mediaGroupId,
      sourceMessageId
    };
  }
}

/**
 * Extract essential metadata from a Telegram message for efficient storage
 */
export function extractMessageMetadata(message: any): Record<string, any> {
  if (!message) {
    return {};
  }

  try {
    // Determine the root message object based on message type
    const rootMessage = message.message || message.channel_post || 
                      message.edited_message || message.edited_channel_post || 
                      message;

    // Basic metadata structure
    const metadata: Record<string, any> = {
      message_type: message.message ? 'message' : 
                  message.channel_post ? 'channel_post' :
                  message.edited_message ? 'edited_message' :
                  message.edited_channel_post ? 'edited_channel_post' : 'unknown',
      message_id: rootMessage.message_id,
      date: rootMessage.date, // Unix timestamp
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
        first_name: rootMessage.from.first_name,
        last_name: rootMessage.from.last_name,
        username: rootMessage.from.username,
        is_bot: rootMessage.from.is_bot
      };
    }

    return metadata;
  } catch (error) {
    console.error('Error extracting message metadata:', error);
    return {};
  }
}

 