
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { 
  xdelo_createStandardizedHandler, 
  xdelo_createSuccessResponse, 
  xdelo_createErrorResponse 
} from "../_shared/standardizedHandler.ts";
import { 
  xdelo_syncMediaGroupContent,
  xdelo_getMessagesByMediaGroupId,
  xdelo_getMessage,
  xdelo_logProcessingEvent
} from "../_shared/databaseOperations.ts";

// Main handler function for syncing media group content
const syncMediaGroup = async (req: Request, correlationId: string): Promise<Response> => {
  try {
    // Parse the request payload
    const payload = await req.json();
    
    // Extract parameters from the payload
    const { 
      mediaGroupId, 
      sourceMessageId, 
      forceSync = false,
      syncEditHistory = false
    } = payload;
    
    // Use provided correlation ID if available, otherwise use the generated one
    const requestCorrelationId = payload.correlationId || correlationId;
    
    // Validate required parameters
    if (!mediaGroupId) {
      return xdelo_createErrorResponse(
        'Missing required parameter: mediaGroupId',
        requestCorrelationId,
        400
      );
    }
    
    console.log(JSON.stringify({
      level: 'info',
      message: 'Starting media group sync',
      correlation_id: requestCorrelationId,
      media_group_id: mediaGroupId,
      source_message_id: sourceMessageId || 'auto-detect',
      force_sync: forceSync,
      sync_edit_history: syncEditHistory
    }));
    
    // If source message ID is provided, use it; otherwise find the first message in the group
    let sourceMessage;
    let messagesToSync;
    
    if (sourceMessageId) {
      // Get the source message
      sourceMessage = await xdelo_getMessage(sourceMessageId);
      
      if (!sourceMessage) {
        return xdelo_createErrorResponse(
          `Source message not found: ${sourceMessageId}`,
          requestCorrelationId,
          404
        );
      }
      
      // Validate that the source message belongs to the specified media group
      if (sourceMessage.media_group_id !== mediaGroupId) {
        return xdelo_createErrorResponse(
          `Source message ${sourceMessageId} does not belong to media group ${mediaGroupId}`,
          requestCorrelationId,
          400
        );
      }
      
      // Get all other messages in the group
      messagesToSync = await xdelo_getMessagesByMediaGroupId(mediaGroupId);
    } else {
      // Get all messages in the group
      messagesToSync = await xdelo_getMessagesByMediaGroupId(mediaGroupId);
      
      if (!messagesToSync.length) {
        return xdelo_createErrorResponse(
          `No messages found for media group ${mediaGroupId}`,
          requestCorrelationId,
          404
        );
      }
      
      // Find the first message with analyzed content to use as the source
      sourceMessage = messagesToSync.find(m => m.analyzed_content && m.is_original_caption);
      
      if (!sourceMessage) {
        // If no message has analyzed content, use the first message in the group
        sourceMessage = messagesToSync[0];
      }
    }
    
    // Perform the sync operation
    const syncResult = await xdelo_syncMediaGroupContent(
      mediaGroupId,
      sourceMessage.id,
      requestCorrelationId
    );
    
    // Log the successful sync
    await xdelo_logProcessingEvent(
      'media_group_sync_completed',
      mediaGroupId,
      requestCorrelationId,
      {
        source_message_id: sourceMessage.id,
        synced_message_count: syncResult.synced,
        force_sync: forceSync,
        sync_edit_history: syncEditHistory
      }
    );
    
    return xdelo_createSuccessResponse(
      {
        success: true,
        media_group_id: mediaGroupId,
        source_message_id: sourceMessage.id,
        synced_messages: syncResult.synced,
        total_messages: messagesToSync.length
      },
      requestCorrelationId
    );
  } catch (error) {
    console.error(JSON.stringify({
      level: 'error',
      message: 'Error syncing media group',
      error: error.message,
      correlation_id: correlationId,
      timestamp: new Date().toISOString()
    }));
    
    return xdelo_createErrorResponse(
      `Error syncing media group: ${error.message}`,
      correlationId,
      500
    );
  }
};

// Create a standardized handler for the sync media group function
serve(xdelo_createStandardizedHandler(syncMediaGroup, {
  logRequests: true,
  logResponses: true
}));
