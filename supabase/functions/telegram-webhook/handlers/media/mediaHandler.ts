
import { corsHeaders } from '../../../_shared/cors.ts';
import { TelegramMessage, MessageContext } from '../../types';
import { xdelo_getMediaInfoFromTelegram } from '../../../_shared/mediaUtils.ts';
import { createMessageRecord } from './messageCreator';
import { MediaMessageHandlerResult } from './types';

export async function handleMediaMessage(
  message: TelegramMessage, 
  context: MessageContext
): Promise<Response> {
  try {
    const { correlationId } = context;
    console.log(`Processing media message ${message.message_id} in chat ${message.chat.id}, correlation_id: ${correlationId}`);
    
    // Get media information from the message
    const photo = message.photo ? message.photo[message.photo.length - 1] : null;
    const video = message.video;
    const document = message.document;
    
    const media = photo || video || document;
    if (!media) {
      throw new Error('No media found in message');
    }

    // Process media and get info
    const mediaInfo = await xdelo_getMediaInfoFromTelegram(message, correlationId);
    
    if (!mediaInfo.success && !mediaInfo.public_url) {
      console.error('Failed to process media:', mediaInfo.error || 'Unknown error');
    }

    // Create message record
    const messageId = await createMessageRecord(message, mediaInfo, context);
    console.log(`Created message record with ID: ${messageId}`);
    
    const result: MediaMessageHandlerResult = {
      success: true,
      messageId
    };

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error handling media message:', error);
    
    const errorResult: MediaMessageHandlerResult = {
      success: false,
      error: error.message
    };

    return new Response(
      JSON.stringify(errorResult),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
}
