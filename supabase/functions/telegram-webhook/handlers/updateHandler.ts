
import { corsHeaders } from '../../_shared/cors.ts';
import { xdelo_logMessageError } from '../../_shared/messageLogger.ts';
import { handleMediaMessage } from './media/mediaHandler.ts';
import { handleTextMessage } from './textHandler.ts';
import { handleEditedMessage } from './editHandler.ts';

export interface TelegramUpdate {
  message?: TelegramMessage;
  edited_message?: TelegramMessage;
  channel_post?: TelegramMessage;
  edited_channel_post?: TelegramMessage;
  [key: string]: any;
}

export interface TelegramMessage {
  message_id: number;
  chat: {
    id: number;
    type: string;
    title?: string;
  };
  caption?: string;
  date: number;
  edit_date?: number;
  media_group_id?: string;
  from?: {
    id: number;
    username?: string;
  };
  photo?: any[];
  video?: any;
  document?: any;
  animation?: any;
  sticker?: any;
  voice?: any;
  audio?: any;
  forward_from?: any;
  forward_from_chat?: any;
  forward_origin?: any;
  text?: string;
  [key: string]: any;
}

export interface MessageContext {
  isChannelPost: boolean;
  isForwarded: boolean;
  correlationId: string;
  isEdit: boolean;
  previousMessage?: TelegramMessage;
}

/**
 * Main handler for all Telegram update types
 */
export async function handleTelegramUpdate(
  update: TelegramUpdate,
  correlationId: string
): Promise<Response> {
  try {
    // Get the message object, checking for different types of updates
    const message = update.message || 
                    update.edited_message || 
                    update.channel_post || 
                    update.edited_channel_post;
                    
    if (!message) {
      console.log('No processable content in update');
      return new Response(JSON.stringify({ message: "No processable content" }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      });
    }

    // Determine message context
    const context: MessageContext = {
      isChannelPost: !!update.channel_post || !!update.edited_channel_post,
      isForwarded: !!message.forward_from || !!message.forward_from_chat || !!message.forward_origin,
      correlationId,
      isEdit: !!update.edited_message || !!update.edited_channel_post,
      previousMessage: update.edited_message || update.edited_channel_post
    };

    console.log(`Processing message ${message.message_id} with context:`, {
      isEdit: context.isEdit,
      isChannelPost: context.isChannelPost,
      isForwarded: context.isForwarded,
      hasMedia: !!(message.photo || message.video || message.document || 
                message.animation || message.sticker || message.voice || message.audio)
    });

    // Handle edited messages (both text and media)
    if (context.isEdit) {
      return await handleEditedMessage(message, context);
    }

    // Handle media messages (photos, videos, documents, etc.)
    if (message.photo || message.video || message.document || 
        message.animation || message.sticker || message.voice || message.audio) {
      return await handleMediaMessage(message, context);
    }

    // Handle other types of messages (text, etc.)
    return await handleTextMessage(message, context);

  } catch (error) {
    console.error('Error in handleTelegramUpdate:', error);
    
    // Log the error
    await xdelo_logMessageError(
      "unknown",
      `Error processing update: ${error.message}`,
      correlationId,
      'message_update'
    );
    
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
}
