
import { corsHeaders } from "../../_shared/cors.ts";
import { supabaseClient } from "../../_shared/supabase.ts";
import { xdelo_logProcessingEvent } from "../../_shared/databaseOperations.ts";

export interface TextMessageContext {
  isChannelPost: boolean;
  isForwarded: boolean;
  correlationId: string;
  isEdit: boolean;
  previousMessage?: any;
}

export async function handleOtherMessage(
  message: any, 
  context: TextMessageContext
) {
  const { isChannelPost, isForwarded, correlationId } = context;
  
  try {
    console.log(`[${correlationId}] Handling non-media message: ${message.message_id}`);
    
    // Extract forward info if message is forwarded
    const forwardInfo = isForwarded ? extractForwardInfo(message) : null;

    // Determine chat type based on the message
    const chatType = getChatType(message.chat);
    
    // Create Telegram message URL
    const messageUrl = await constructMessageUrl(chatType, message.chat.id, message.message_id);

    // Insert the message into the other_messages table
    const { data, error } = await supabaseClient
      .from('other_messages')
      .insert({
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        telegram_data: message,
        chat_id: message.chat.id,
        chat_type: chatType,
        telegram_message_id: message.message_id,
        message_type: getMessageType(message),
        text: message.text || message.caption,
        is_channel_post: isChannelPost,
        is_forward: isForwarded,
        forward_info: forwardInfo,
        message_url: messageUrl,
        processing_state: 'stored_only'
      })
      .select('id')
      .single();

    if (error) {
      // Check if this is a schema error (missing columns)
      if (error.code === '42703') {
        console.error(`[${correlationId}] Schema error: ${error.message}`);
        await handleSchemaError(correlationId);
        throw new Error(`Database schema error: ${error.message}. Running fix missing columns function.`);
      }

      console.error(`[${correlationId}] Error storing other message:`, error);
      throw error;
    }

    // Log the success event
    await xdelo_logProcessingEvent(
      "other_message_stored",
      message.message_id.toString(),
      correlationId,
      {
        message_id: message.message_id,
        chat_id: message.chat.id,
        is_channel_post: isChannelPost,
        is_forwarded: isForwarded,
        message_type: getMessageType(message),
      }
    );

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Successfully stored other message',
        message_id: message.message_id,
        correlation_id: correlationId,
        entity_id: data?.id,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error(`[${correlationId}] Error processing non-media message:`, error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        correlation_id: correlationId,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200, // Still return 200 to prevent Telegram from retrying
      }
    );
  }
}

// Helper function to determine message type
function getMessageType(message: any): string {
  if (message.text) return 'text';
  if (message.sticker) return 'sticker';
  if (message.voice) return 'voice';
  if (message.audio) return 'audio';
  if (message.animation) return 'animation';
  if (message.contact) return 'contact';
  if (message.location) return 'location';
  if (message.poll) return 'poll';
  if (message.game) return 'game';
  if (message.invoice) return 'invoice';
  if (message.successful_payment) return 'payment';
  if (message.passport_data) return 'passport';
  return 'other';
}

// Helper function to extract forward information
function extractForwardInfo(message: any): any {
  return {
    forward_from: message.forward_from,
    forward_from_chat: message.forward_from_chat,
    forward_from_message_id: message.forward_from_message_id,
    forward_signature: message.forward_signature,
    forward_sender_name: message.forward_sender_name,
    forward_date: message.forward_date,
    forward_origin: message.forward_origin
  };
}

// Helper function to determine chat type
function getChatType(chat: any): string {
  return chat?.type || 'unknown';
}

// Construct message URL using database function
async function constructMessageUrl(chatType: string, chatId: number, messageId: number): Promise<string | null> {
  try {
    // First try using direct SQL function call
    const { data, error } = await supabaseClient.rpc('xdelo_construct_telegram_message_url', {
      chat_type: chatType,
      chat_id: chatId,
      id: messageId.toString() // Note: The function expects UUID, but we'll pass messageId as string
    });
    
    if (!error && data) {
      return data;
    }

    // If RPC fails, fallback to manual URL construction
    const baseUrl = 'https://t.me/';
    let processedChatId: string;

    // Infer chat type from chat_id pattern if not provided
    let inferredChatType = chatType;
    if (!inferredChatType || inferredChatType === 'unknown') {
      if (chatId > 0) {
        inferredChatType = 'private';
      } else if (chatId < -100000000000) {
        inferredChatType = 'supergroup_or_channel';
      } else if (chatId < 0) {
        inferredChatType = 'group';
      }
    }

    // Handle URL construction based on inferred type
    if (inferredChatType === 'private') {
      // Private chats don't have shareable URLs
      return null;
    } else if (inferredChatType === 'channel' || inferredChatType === 'supergroup') {
      // For channels and supergroups with -100 prefix
      if (chatId < 0) {
        processedChatId = Math.abs(chatId).toString().substring(2);
        return `${baseUrl}c/${processedChatId}/${messageId}`;
      } else {
        processedChatId = chatId.toString();
        return `${baseUrl}c/${processedChatId}/${messageId}`;
      }
    } else if (inferredChatType === 'group') {
      // For regular groups
      processedChatId = Math.abs(chatId).toString();
      return `${baseUrl}c/${processedChatId}/${messageId}`;
    } else {
      // Default case for other types
      return null;
    }
  } catch (error) {
    console.error('Error constructing message URL:', error);
    return null;
  }
}

// Handle schema errors by triggering the fix missing columns function
async function handleSchemaError(correlationId: string): Promise<void> {
  try {
    console.log(`[${correlationId}] Attempting to fix database schema...`);
    
    // First try using the RPC function
    const { data: rpcData, error: rpcError } = await supabaseClient
      .rpc('xdelo_run_fix_missing_columns');
    
    if (!rpcError) {
      console.log(`[${correlationId}] Fixed schema using RPC:`, rpcData);
      return;
    }
    
    // If RPC fails, try the edge function
    const { data, error } = await supabaseClient.functions.invoke('xdelo_run_fix_missing_columns');
    
    if (error) {
      console.error(`[${correlationId}] Failed to fix schema:`, error);
      throw error;
    }
    
    console.log(`[${correlationId}] Fixed schema using edge function:`, data);
  } catch (error) {
    console.error(`[${correlationId}] Error fixing schema:`, error);
    throw new Error(`Failed to fix database schema: ${error.message}`);
  }
}
