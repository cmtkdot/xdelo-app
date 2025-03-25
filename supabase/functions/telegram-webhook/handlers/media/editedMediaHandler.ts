import { supabaseClient } from '../../utils/supabase.ts';
import { corsHeaders } from '../../utils/cors.ts';
import { TelegramMessage, MessageContext } from '../../types.ts';
import { updateMessage } from '../../database/messageUpdates.ts';
import { xdelo_processCaptionFromWebhook, xdelo_syncMediaGroupFromWebhook } from '../../utils/databaseOperations.ts';

// Import other required utilities
import { xdelo_detectMimeType, xdelo_uploadMediaToStorage } from '../../utils/media/mediaUtils.ts';

/**
 * Handle edited media messages, updating existing database records
 */
export async function handleEditedMediaMessage(
  message: TelegramMessage, 
  context: MessageContext, 
  previousMessage: any
): Promise<Response> {
  const { correlationId, logger } = context;
  
  try {
    // Log the start of processing
    logger?.info(`Processing edited media message`, {
      message_id: message.message_id,
      chat_id: message.chat.id
    });
    
    // Determine if the media has changed
    const mediaHasChanged = message.photo?.at(-1)?.file_unique_id !== previousMessage.file_unique_id ||
                            message.video?.file_unique_id !== previousMessage.file_unique_id ||
                            message.document?.file_unique_id !== previousMessage.file_unique_id;
    
    let publicURL = previousMessage.public_url;
    let storagePath = previousMessage.storage_path;
    let detectedMimeType = previousMessage.mime_type;
    
    // If media has changed, re-download and update storage
    if (mediaHasChanged) {
      logger?.info("Media has changed in edited message, re-downloading", {
        message_id: message.message_id,
        chat_id: message.chat.id
      });
      
      // Detect the MIME type
      detectedMimeType = xdelo_detectMimeType(message);
      
      // Upload the new media to storage
      const uploadResult = await xdelo_uploadMediaToStorage(message, detectedMimeType, context);
      
      if (!uploadResult.success) {
        throw new Error(uploadResult.error || 'Media upload failed');
      }
      
      publicURL = uploadResult.publicURL;
      storagePath = uploadResult.storagePath;
    } else {
      logger?.info("Media has not changed in edited message", {
        message_id: message.message_id,
        chat_id: message.chat.id
      });
    }
    
    // Prepare update data for the database
    const updateData: Partial<any> = { // Using 'any' to avoid complex type definitions
      caption: message.caption,
      mime_type: detectedMimeType,
      public_url: publicURL,
      storage_path: storagePath,
      telegram_data: message,
      updated_at: new Date().toISOString(),
      edit_date: new Date(message.edit_date * 1000).toISOString(),
      is_edited_channel_post: context.isChannelPost,
      correlation_id: correlationId
    };
    
    // Update the message in the database
    const updateResult = await updateMessage(
      supabaseClient,
      message.chat.id,
      message.message_id,
      updateData,
      logger
    );
    
    if (!updateResult.success) {
      throw new Error(updateResult.error_message || 'Failed to update message');
    }
    
    // After successful processing, trigger caption processing
    if (message.caption) {
      try {
        logger?.info("Starting background caption processing after successful message update", {
          message_id: message.message_id,
          message_id_db: updateResult.id
        });
        
        // Use waitUntil to not block the response
        EdgeRuntime.waitUntil(
          (async () => {
            try {
              // Process the caption
              const captionResult = await xdelo_processCaptionFromWebhook(
                updateResult.id,
                correlationId,
                true // Force reprocessing
              );
              
              if (!captionResult.success) {
                logger?.error("Error in background caption processing", {
                  error: captionResult.error,
                  message_id: message.message_id,
                  message_id_db: updateResult.id
                });
              } else {
                logger?.info("Background caption processing completed", {
                  message_id: message.message_id,
                  message_id_db: updateResult.id
                });
              }
              
              // If this is a successful message with a caption, trigger media group sync
              if (message.media_group_id) {
                logger?.info("Starting background media group sync after successful message update", {
                  message_id: message.message_id,
                  media_group_id: message.media_group_id,
                  message_id_db: updateResult.id
                });
                
                // Use the unified processor for consistent group syncing
                const syncResult = await xdelo_syncMediaGroupFromWebhook(
                  message.media_group_id,
                  updateResult.id,
                  correlationId,
                  true, // Force sync to ensure it happens
                  true // Sync edit history for edited messages
                );
                
                if (!syncResult.success) {
                  logger?.error("Error in background media group sync", {
                    error: syncResult.error,
                    media_group_id: message.media_group_id,
                    source_message_id: updateResult.id
                  });
                } else {
                  logger?.info("Background media group sync completed", {
                    media_group_id: message.media_group_id,
                    source_message_id: updateResult.id
                  });
                }
              }
            } catch (backgroundError) {
              logger?.error("Error in background processing", {
                error: backgroundError.message,
                message_id: message.message_id,
                message_id_db: updateResult.id
              });
            }
          })()
        );
      } catch (parseError) {
        logger?.warn("Could not parse response for background processing", {
          error: parseError.message
        });
      }
    }
    
    // Respond with success
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Message updated successfully', 
        id: updateResult.id,
        correlationId 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    logger?.error(`Error processing edited media message: ${error.message}`, {
      error: error instanceof Error ? error : { message: error.message },
      message_id: message.message_id,
      chat_id: message.chat?.id
    });
    
    return new Response(
      JSON.stringify({ 
        error: error.message,
        correlationId
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
}
