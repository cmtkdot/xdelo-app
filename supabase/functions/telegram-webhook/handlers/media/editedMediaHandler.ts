
import { supabaseClient } from '../../utils/supabase.ts';
import { corsHeaders } from '../../utils/cors.ts';
import { 
  xdelo_detectMimeType,
  xdelo_processMessageMedia,
  xdelo_handleExpiredFileId
} from '../../utils/media/mediaUtils.ts';
import { 
  TelegramMessage, 
  MessageContext
} from '../../types.ts';
import { prepareEditHistoryEntry } from '../../utils/messageUtils.ts';
import { xdelo_logProcessingEvent } from '../../../_shared/databaseOperations.ts';

// For Deno compatibility
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

// Get Telegram bot token from environment
const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN');
if (!TELEGRAM_BOT_TOKEN) {
  console.error('Missing TELEGRAM_BOT_TOKEN environment variable');
}

/**
 * Helper function to handle edited media messages
 */
export async function handleEditedMediaMessage(
  message: TelegramMessage, 
  context: MessageContext,
  previousMessage: TelegramMessage
): Promise<Response> {
  const { correlationId, logger } = context;

  // First, look up the existing message
  const { data: existingMessage, error: lookupError } = await supabaseClient
    .from('messages')
    .select('*')
    .eq('telegram_message_id', message.message_id)
    .eq('chat_id', message.chat.id)
    .single();

  if (lookupError) {
    logger?.error(`Failed to lookup existing message for edit: ${lookupError.message}`);
    throw new Error(`Database lookup failed: ${lookupError.message}`);
  }

  if (existingMessage) {
    // Store previous state in edit_history using our utility function
    const editHistory = existingMessage.edit_history || [];
    
    // Determine what has changed
    const captionChanged = existingMessage.caption !== message.caption;
    const hasNewMedia = message.photo || message.video || message.document;
    
    // Track caption changes
    if (captionChanged) {
      editHistory.push(prepareEditHistoryEntry(existingMessage, message, 'caption'));
    }
    
    // If media has been updated, handle the new media
    if (hasNewMedia) {
      editHistory.push(prepareEditHistoryEntry(existingMessage, message, 'media'));
      
      logger?.info(`Media has changed in edit for message ${message.message_id}`);
      
      try {
        // Determine the current file details
        const telegramFile = message.photo ? 
          message.photo[message.photo.length - 1] : 
          message.video || message.document;
          
        if (!telegramFile) {
          throw new Error('Failed to extract file information from message');
        }
          
        // Get mime type
        const detectedMimeType = xdelo_detectMimeType(message);
        
        // Process the new media file
        const mediaProcessResult = await xdelo_processMessageMedia(
          message,
          telegramFile.file_id,
          telegramFile.file_unique_id,
          TELEGRAM_BOT_TOKEN || '',
          existingMessage.id, // Use existing message ID
          correlationId  // Pass correlation ID for logging
        );
        
        if (!mediaProcessResult.success) {
          // Handle expired file ID case
          if (mediaProcessResult.file_id_expired) {
            logger?.warn(`File ID expired for edit of message ${message.message_id}`);
            
            // Flag message for later redownload
            await xdelo_handleExpiredFileId(
              existingMessage.id,
              telegramFile.file_unique_id,
              correlationId
            );
            
            // Continue processing with the edit even if media download failed
            // This allows caption changes to still be processed
            
            // Update the message with new details except media
            const { error: updateError } = await supabaseClient
              .from('messages')
              .update({
                caption: message.caption,
                file_id: telegramFile.file_id, // Still update this for future retries
                file_unique_id: telegramFile.file_unique_id,
                mime_type: detectedMimeType,
                edit_date: message.edit_date ? new Date(message.edit_date * 1000).toISOString() : new Date().toISOString(),
                edit_count: (existingMessage.edit_count || 0) + 1,
                edit_history: editHistory,
                processing_state: message.caption ? 'pending' : existingMessage.processing_state,
                needs_redownload: true,
                redownload_reason: 'file_id_expired_during_edit',
                redownload_flagged_at: new Date().toISOString(),
                last_edited_at: new Date().toISOString()
              })
              .eq('id', existingMessage.id);
            
            if (updateError) {
              logger?.error(`Failed to update message with expired file details: ${updateError.message}`);
            }
            
            // Return success but indicate the file_id expired
            return new Response(
              JSON.stringify({ 
                success: true, 
                file_id_expired: true,
                message: 'Message updated but media could not be downloaded - file ID expired',
                correlationId 
              }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
          
          throw new Error(`Failed to process edited media: ${mediaProcessResult.error}`);
        }
        
        // Prepare update data with type checks
        const updateData: any = {
          caption: message.caption,
          file_id: telegramFile.file_id,
          file_unique_id: telegramFile.file_unique_id,
          mime_type: detectedMimeType,
          edit_date: message.edit_date ? new Date(message.edit_date * 1000).toISOString() : new Date().toISOString(),
          edit_count: (existingMessage.edit_count || 0) + 1,
          edit_history: editHistory,
          processing_state: message.caption ? 'pending' : existingMessage.processing_state,
          storage_path: mediaProcessResult.fileInfo.storage_path,
          public_url: mediaProcessResult.fileInfo.public_url,
          storage_exists: true,
          storage_path_standardized: true,
          last_edited_at: new Date().toISOString()
        };
        
        // Add optional fields only if they exist in telegramFile
        if ('width' in telegramFile) updateData.width = telegramFile.width;
        if ('height' in telegramFile) updateData.height = telegramFile.height;
        if (message.video?.duration) updateData.duration = message.video.duration;
        if (telegramFile.file_size) updateData.file_size = telegramFile.file_size;
        
        // Update the message with new media info
        const { data: updateResult, error: updateError } = await supabaseClient
          .from('messages')
          .update(updateData)
          .eq('id', existingMessage.id);
          
        if (updateError) {
          throw new Error(`Failed to update message with new media: ${updateError.message}`);
        }
        
        // Log the edit operation
        try {
          await xdelo_logProcessingEvent(
            "message_media_edited",
            existingMessage.id,
            correlationId,
            {
              message_id: message.message_id,
              chat_id: message.chat.id,
              file_id: telegramFile.file_id,
              file_unique_id: telegramFile.file_unique_id,
              storage_path: mediaProcessResult.fileInfo.storage_path
            }
          );
        } catch (logError) {
          logger?.error(`Failed to log media edit operation: ${logError.message}`);
        }
      } catch (mediaError) {
        logger?.error(`Error processing edited media: ${mediaError.message}`);
        throw mediaError;
      }
    } 
    // If only caption has changed, just update the caption
    else if (captionChanged) {
      logger?.info(`Caption has changed in edit for message ${message.message_id}`);
      
      // Update just the caption
      const { error: updateError } = await supabaseClient
        .from('messages')
        .update({
          caption: message.caption,
          edit_date: message.edit_date ? new Date(message.edit_date * 1000).toISOString() : new Date().toISOString(),
          edit_count: (existingMessage.edit_count || 0) + 1,
          edit_history: editHistory,
          processing_state: message.caption ? 'pending' : existingMessage.processing_state,
          last_edited_at: new Date().toISOString()
        })
        .eq('id', existingMessage.id);
        
      if (updateError) {
        throw new Error(`Failed to update message caption: ${updateError.message}`);
      }
      
      // Log the caption edit
      try {
        await xdelo_logProcessingEvent(
          "message_caption_edited",
          existingMessage.id,
          correlationId,
          {
            message_id: message.message_id,
            chat_id: message.chat.id,
            previous_caption: existingMessage.caption,
            new_caption: message.caption
          }
        );
      } catch (logError) {
        logger?.error(`Failed to log caption edit operation: ${logError.message}`);
      }
    } else {
      // No significant changes detected
      logger?.info(`No significant changes detected in edit for message ${message.message_id}`);
      
      // Still update the edit metadata
      const { error: updateError } = await supabaseClient
        .from('messages')
        .update({
          edit_date: message.edit_date ? new Date(message.edit_date * 1000).toISOString() : new Date().toISOString(),
          edit_count: (existingMessage.edit_count || 0) + 1,
          edit_history: editHistory,
          last_edited_at: new Date().toISOString()
        })
        .eq('id', existingMessage.id);
        
      if (updateError) {
        logger?.warn(`Failed to update edit metadata: ${updateError.message}`);
      }
      
      // Log the edit operation anyway
      try {
        await xdelo_logProcessingEvent(
          "message_edit_received",
          existingMessage.id,
          correlationId,
          {
            message_id: message.message_id,
            chat_id: message.chat.id,
            no_changes: true
          }
        );
      } catch (logError) {
        console.error('Error logging edit operation:', logError);
      }
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
  
  // If existing message not found, check in other_messages
  const { data: existingTextMessage, error: textLookupError } = await supabaseClient
    .from('other_messages')
    .select('*')
    .eq('telegram_message_id', message.message_id)
    .eq('chat_id', message.chat.id)
    .single();
    
  if (!textLookupError && existingTextMessage) {
    // This was previously a text message that now has media added
    logger?.info(`Message was previously a text message, now has media. Converting.`, {
      message_id: message.message_id,
      existing_id: existingTextMessage.id
    });
    
    // Prepare edit history for the converted message
    const editHistory = existingTextMessage.edit_history || [];
    editHistory.push(prepareEditHistoryEntry(existingTextMessage, message, 'text_to_media'));
    
    // Process as new media message but preserve history
    context.previousTextMessage = existingTextMessage;
    context.conversionType = 'text_to_media';
    context.editHistory = editHistory;
    
    // Update the original text message to mark it as converted
    await supabaseClient
      .from('other_messages')
      .update({
        converted_to_media: true,
        edit_count: (existingTextMessage.edit_count || 0) + 1,
        edit_history: editHistory,
        updated_at: new Date().toISOString()
      })
      .eq('id', existingTextMessage.id);
      
    // Process as new media with history context
    return await handleNewMediaMessage(message, context);
  }
  
  // If existing message not found in either table, handle as new message
  logger?.info(`Original message not found, creating new message for edit ${message.message_id}`);
  return await handleNewMediaMessage(message, context);
}

// Import the new media handler
import { handleNewMediaMessage } from "./newMediaHandler.ts";
