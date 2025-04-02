import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import type { AnalyzedContent, TelegramMessage } from './types.ts';

// Define CORS headers for all responses
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

// Initialize Supabase client
export const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
);

/**
 * Log an event to the unified audit log
 */
export async function logEvent(
  eventType: string,
  entityId: string,
  correlationId: string | null = null,
  metadata: Record<string, unknown> = {},
  errorMessage: string | null = null,
): Promise<boolean> {
  try {
    // Use the new consolidated log event function
    const { data, error } = await supabase
      .rpc('xdelo_log_event', {
        p_event_type: eventType,
        p_entity_id: entityId,
        p_metadata: metadata,
        p_correlation_id: correlationId,
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
    // Use the new consolidated update message state function
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
  statusCode: number = 400,
  correlationId?: string,
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
  statusCode: number = 200,
): Response {
  return new Response(
    JSON.stringify({
      success: true,
      ...data,
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
        
      if (error) {
        console.error('Error checking message existence by ID:', error);
        return false;
      }
      
      return !!data;
    } 
    // Otherwise assume it's chat_id and telegram_message_id
    else if (typeof chatIdOrMessageId === 'number' && typeof telegramMessageId === 'number') {
      const { data, error } = await supabase
        .rpc('xdelo_check_message_exists', {
          p_chat_id: chatIdOrMessageId,
          p_telegram_message_id: telegramMessageId
        });

      if (error) {
        console.error('Error checking message existence by chat/message IDs:', error);
        return false;
      }

      return data || false;
    }
    
    console.error('Invalid parameters for checkMessageExists');
    return false;
  } catch (error) {
    console.error('Exception checking message existence:', error);
    return false;
  }
}

/**
 * Synchronize a media group's content from a source message
 */
export async function syncMediaGroup(
  sourceMessageId: string,
  mediaGroupId: string,
  correlationId: string | null = null,
  forceSync: boolean = false,
  syncEditHistory: boolean = false,
): Promise<Record<string, unknown>> {
  try {
    // Use the new consolidated media group sync function
    const { data, error } = await supabase
      .rpc('xdelo_sync_media_group', {
        p_source_message_id: sourceMessageId,
        p_media_group_id: mediaGroupId,
        p_correlation_id: correlationId,
        p_force: forceSync,
        p_sync_edit_history: syncEditHistory,
      });

    if (error) {
      console.error('Error syncing media group:', error);
      return {
        success: false,
        error: error.message,
        sourceMessageId,
        mediaGroupId,
      };
    }

    return data || {
      success: true,
      sourceMessageId,
      mediaGroupId,
      updatedCount: 0,
    };
  } catch (error) {
    console.error('Exception syncing media group:', error.message);
    return {
      success: false,
      error: error.message,
      sourceMessageId,
      mediaGroupId,
    };
  }
}

/**
 * Parse a caption into structured content
 */
export async function parseCaption(caption: string): Promise<AnalyzedContent> {
  if (!caption || caption.trim() === '') {
    return {
      caption,
      parsing_metadata: {
        method: 'empty',
        timestamp: new Date().toISOString(),
        partial_success: true,
        missing_fields: ['product_name', 'product_code', 'vendor_uid', 'purchase_date', 'quantity'],
      },
      product_name: '',
      product_code: '',
      vendor_uid: null,
      purchase_date: null,
      quantity: null,
      notes: '',
    };
  }

  try {
    // Simple parser implementation 
    // Extracts basic product information from the caption
    const productMatch = caption.match(/^(.+?)(?:\s+#|$)/i);
    const codeMatch = caption.match(/#([A-Za-z]{1,4}\d{5,6})/i);
    const quantityMatch = caption.match(/x\s*(\d+)/i) || caption.match(/(\d+)\s*x/i);
    const notesMatch = caption.match(/\(([^)]+)\)/);

    // Build the result
    const result: AnalyzedContent = {
      caption,
      parsing_metadata: {
        method: 'manual',
        timestamp: new Date().toISOString(),
        partial_success: false,
      },
      product_name: productMatch ? productMatch[1].trim() : '',
      product_code: codeMatch ? codeMatch[1] : '',
      vendor_uid: codeMatch ? codeMatch[1].match(/^([A-Za-z]{1,4})/i)?.[1].toUpperCase() || null : null,
      purchase_date: null,
      quantity: quantityMatch ? parseInt(quantityMatch[1], 10) : null,
      notes: notesMatch ? notesMatch[1] : '',
    };

    // Try to parse purchase date from product code
    if (codeMatch) {
      const dateDigits = codeMatch[1].match(/^[A-Za-z]{1,4}(\d{5,6})/i)?.[1];
      if (dateDigits) {
        const paddedDigits = dateDigits.length === 5 ? '0' + dateDigits : dateDigits;
        
        if (paddedDigits.length === 6) {
          const month = paddedDigits.substring(0, 2);
          const day = paddedDigits.substring(2, 4);
          const year = '20' + paddedDigits.substring(4, 6);
          
          // Make sure it's a valid date
          try {
            const date = new Date(`${year}-${month}-${day}`);
            if (!isNaN(date.getTime())) {
              result.purchase_date = `${year}-${month}-${day}`;
            }
          } catch {
            // Invalid date, leave as null
          }
        }
      }
    }

    // Check for missing fields
    const missingFields = [];
    if (!result.product_name) missingFields.push('product_name');
    if (!result.product_code) missingFields.push('product_code');
    if (!result.vendor_uid) missingFields.push('vendor_uid');
    if (!result.purchase_date) missingFields.push('purchase_date');
    if (result.quantity === null) missingFields.push('quantity');

    if (missingFields.length > 0) {
      result.parsing_metadata.partial_success = true;
      result.parsing_metadata.missing_fields = missingFields;
    }

    return result;
  } catch (error) {
    console.error('Error parsing caption:', error);
    
    // Return partial result on error
    return {
      caption,
      parsing_metadata: {
        method: 'error',
        timestamp: new Date().toISOString(),
        partial_success: true,
        error: error.message,
        missing_fields: ['product_name', 'product_code', 'vendor_uid', 'purchase_date', 'quantity'],
      },
      product_name: '',
      product_code: '',
      vendor_uid: null,
      purchase_date: null,
      quantity: null,
      notes: '',
    };
  }
} 