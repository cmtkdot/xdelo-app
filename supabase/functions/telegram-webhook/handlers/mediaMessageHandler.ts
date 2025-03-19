
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { createSupabaseClient } from '../../_shared/supabase.ts';
import { corsHeaders } from '../../_shared/cors.ts';
import { TelegramMessage, MessageContext } from '../types.ts';
import { xdelo_logProcessingEvent } from '../../_shared/databaseOperations.ts';
import { 
  xdelo_downloadMediaFromTelegram,
  xdelo_processMessageMedia
} from '../../_shared/mediaUtils/index.ts';
import { triggerAnalysis } from '../analysisHandler.ts';
import { constructTelegramMessageUrl, isMessageForwarded } from '../../_shared/messageUtils.ts';
import { createMessage, updateMessage } from '../dbOperations.ts';
import { Logger } from '../utils/logger.ts';
import { CONFIG } from '../../_shared/config.ts';

// Create a logger instance
const logger = new Logger('mediaMessageHandler');

export async function handleMediaMessage(
  message: TelegramMessage, 
  context: MessageContext
): Promise<Response> {
  try {
    // Create Supabase client
    const supabase = createSupabaseClient();
    
    const { correlationId, isEdit, isChannelPost, botToken } = context;
    
    // Check if we have a valid bot token
    if (!botToken) {
      throw new Error(CONFIG.ERROR_MESSAGES.TELEGRAM_BOT_TOKEN_MISSING);
    }
    
    // Log the start of message processing with correlation ID
    console.log(`[${correlationId}] Processing media message ${message.message_id} in chat ${message.chat.id}`);
    
    // Determine if message is forwarded using our utility function from _shared/messageUtils.ts
    const isForwarded = isMessageForwarded(message);
    
    // Generate message URL using our utility function
    const message_url = constructTelegramMessageUrl(message);
    
    // Log receiving the message
    await xdelo_logProcessingEvent(
      isEdit ? "edited_message_received" : "message_received",
      "system",
      correlationId,
      {
        telegram_message_id: message.message_id,
        chat_id: message.chat.id,
        message_type: 'media',
        is_forward: isForwarded,
        is_edit: isEdit,
        is_channel_post: isChannelPost
      }
    );
    
    // Create structured forward info if message is forwarded
    let forwardInfo = null;
    if (isForwarded) {
      forwardInfo = {
        from_chat_id: message.forward_from_chat?.id,
        from_message_id: message.forward_from_message_id,
        from_chat_title: message.forward_from_chat?.title,
        from_sender_name: message.forward_sender_name,
        forward_date: message.forward_date ? new Date(message.forward_date * 1000).toISOString() : null
      };
    }
    
    // Process message media using our shared utility
    const processResult = await xdelo_processMessageMedia(
      message,
      message.photo?.at(-1)?.file_id || message.video?.file_id || message.document?.file_id,
      message.photo?.at(-1)?.file_unique_id || message.video?.file_unique_id || message.document?.file_unique_id,
      botToken,
      null
    );
    
    if (!processResult.success) {
      throw new Error(`Failed to process media: ${processResult.error}`);
    }
    
    console.log(`[${correlationId}] Media processed successfully for message ${message.message_id}`);
    
    // Store the message in the database
    let messageId: string;
    
    if (isEdit && message.message_id) {
      // For edited messages, find the existing message
      const { data: existingMessages } = await supabase
        .from('messages')
        .select('id')
        .eq('telegram_message_id', message.message_id.toString())
        .eq('chat_id', message.chat.id)
        .limit(1);
        
      if (existingMessages && existingMessages.length > 0) {
        messageId = existingMessages[0].id;
        
        // Update the existing message
        await updateMessage(
          messageId,
          message,
          processResult.fileInfo,
          isEdit,
          isChannelPost,
          isForwarded,
          forwardInfo,
          message_url,
          correlationId
        );
      } else {
        // Create a new message if we couldn't find the edited one
        messageId = await createMessage(
          message,
          processResult.fileInfo,
          isEdit,
          isChannelPost,
          isForwarded,
          forwardInfo,
          message_url,
          correlationId
        );
      }
    } else {
      // Create a new message
      messageId = await createMessage(
        message,
        processResult.fileInfo,
        isEdit,
        isChannelPost,
        isForwarded,
        forwardInfo,
        message_url,
        correlationId
      );
    }
    
    // If we successfully processed the media and have a message ID, we can trigger analysis
    if (messageId) {
      console.log(`[${correlationId}] Triggering analysis for message ${messageId}`);
      
      // Only trigger caption analysis if there's actual text to analyze
      const hasContent = message.caption && message.caption.trim().length > 0;
      
      if (hasContent) {
        // Trigger analysis for the message
        await triggerAnalysis(messageId, correlationId, supabase, logger);
      } else {
        console.log(`[${correlationId}] Skipping analysis as message has no caption`);
        
        // Update processing state to complete even without analysis
        await supabase
          .from('messages')
          .update({
            processing_state: 'completed',
            processing_completed_at: new Date().toISOString(),
          })
          .eq('id', messageId);
      }
    }
    
    // Return success response
    return new Response(
      JSON.stringify({ 
        success: true, 
        messageId, 
        correlationId,
        message_url 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error(`Error processing media message:`, error);
    
    // Log the error
    await xdelo_logProcessingEvent(
      "message_processing_error",
      "system",
      context.correlationId,
      {
        telegram_message_id: message.message_id,
        chat_id: message.chat.id,
        handler_type: 'media_message'
      },
      error.message
    );
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Unknown error processing media message',
        correlationId: context.correlationId
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
}
