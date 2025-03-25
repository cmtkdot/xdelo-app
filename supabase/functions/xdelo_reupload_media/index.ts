
import { createEdgeHandler, createErrorResponse, createSuccessResponse, HandlerContext } from '../_shared/edgeHandler.ts';
import { supabaseClient } from '../_shared/supabase.ts';
import { xdelo_logProcessingEvent } from '../_shared/databaseOperations.ts';

interface ReuploadMediaRequest {
  messageId: string;
  forceRedownload?: boolean;
}

// Handler for reuploading media from Telegram
const handleReuploadMedia = createEdgeHandler(async (req: Request, context: HandlerContext) => {
  try {
    const { logger, correlationId } = context;
    
    // Parse request body
    const { messageId, forceRedownload = false } = await req.json() as ReuploadMediaRequest;
    
    // Validate input
    if (!messageId) {
      return createErrorResponse('Missing messageId parameter', 400, correlationId);
    }
    
    logger.info(`Processing media reupload request for message ${messageId}`, {
      force_redownload: forceRedownload,
    });
    
    // Step 1: Get message details from database
    const { data: message, error: fetchError } = await supabaseClient
      .from('messages')
      .select('*')
      .eq('id', messageId)
      .single();
      
    if (fetchError) {
      logger.error(`Error fetching message: ${fetchError.message}`, { messageId });
      return createErrorResponse(`Error fetching message: ${fetchError.message}`, 404, correlationId);
    }
    
    if (!message) {
      return createErrorResponse('Message not found', 404, correlationId);
    }
    
    // Step 2: Verify the message has a file_id that we can use to redownload
    if (!message.file_id) {
      logger.error('Message has no file_id to redownload', { messageId });
      return createErrorResponse('Message has no file_id to redownload', 400, correlationId);
    }
    
    // Log the reupload operation
    await xdelo_logProcessingEvent(
      'media_reupload_requested',
      messageId,
      correlationId,
      {
        file_unique_id: message.file_unique_id,
        media_group_id: message.media_group_id,
        force_redownload: forceRedownload
      }
    );
    
    // Step 3: Mark the message for redownload
    const { error: updateError } = await supabaseClient
      .from('messages')
      .update({
        needs_redownload: true,
        redownload_reason: 'user_requested',
        redownload_flagged_at: new Date().toISOString(),
        redownload_attempts: 0, // Reset attempts counter
        processing_state: 'pending', // Reset processing state to trigger reprocessing
        correlation_id: correlationId,
        updated_at: new Date().toISOString()
      })
      .eq('id', messageId);
      
    if (updateError) {
      logger.error(`Error marking message for reupload: ${updateError.message}`, { updateError });
      return createErrorResponse(`Error marking message for reupload: ${updateError.message}`, 500, correlationId);
    }
    
    // Step 4: If forceRedownload is true, immediately trigger the media download process
    if (forceRedownload) {
      logger.info('Triggering immediate media redownload', { messageId });
      
      try {
        // Call the background worker to handle the download
        // This could be a direct database function call, another edge function, or a webhook
        const { data: processingResult, error: processingError } = await supabaseClient.rpc(
          'xdelo_redownload_media_file',
          {
            p_message_id: messageId,
            p_correlation_id: correlationId
          }
        );
        
        if (processingError) {
          logger.error(`Error processing immediate redownload: ${processingError.message}`, { processingError });
          return createErrorResponse(`Error during reupload: ${processingError.message}`, 500, correlationId);
        }
        
        logger.success('Successfully redownloaded media file', { messageId, result: processingResult });
        
        return createSuccessResponse({
          success: true,
          messageId,
          operation: 'reupload_complete',
          result: processingResult
        }, 'Media successfully reuploaded');
        
      } catch (processingError) {
        logger.error(`Exception during immediate redownload: ${processingError.message}`, { processingError });
        return createErrorResponse(`Exception during reupload: ${processingError.message}`, 500, correlationId);
      }
    }
    
    logger.success('Message marked for reupload', { messageId });
    
    return createSuccessResponse({
      success: true,
      messageId,
      operation: 'reupload_queued'
    }, 'Message successfully marked for media reupload');
    
  } catch (error) {
    context.logger.error(`Unexpected error handling media reupload:`, { error });
    return createErrorResponse(
      `Unexpected error: ${error.message || 'Unknown error'}`,
      500,
      context.correlationId
    );
  }
});

// Export the handler for Deno
Deno.serve(handleReuploadMedia);
