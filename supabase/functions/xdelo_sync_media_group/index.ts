
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { xdelo_createStandardizedHandler, xdelo_createSuccessResponse, xdelo_createErrorResponse, SecurityLevel } from "../_shared/standardizedHandler.ts";
import { createSupabaseClient } from "../_shared/supabase.ts";
import { Logger } from "../_shared/logger.ts";

interface SyncRequest {
  media_group_id: string;
  trigger_message_id?: string;
  modified_fields?: string[];
  force_all_fields?: boolean;
  correlation_id?: string;
}

const syncMediaGroupHandler = async (req: Request, correlationId: string) => {
  // Create a logger for this request
  const logger = new Logger(correlationId, 'xdelo_sync_media_group');
  
  try {
    logger.info('Media group sync request received');
    
    // Initialize Supabase client
    const supabase = createSupabaseClient();
    
    // Parse request body
    const { 
      media_group_id, 
      trigger_message_id, 
      modified_fields = ['analyzed_content', 'caption'], 
      force_all_fields = false
    }: SyncRequest = await req.json();
    
    // Validate request
    if (!media_group_id) {
      logger.error('Missing required field', { field: 'media_group_id' });
      return xdelo_createErrorResponse(
        new Error('Missing required field: media_group_id'), 
        correlationId, 
        400
      );
    }
    
    logger.info('Syncing media group', { 
      media_group_id, 
      trigger_message_id, 
      modified_fields,
      force_all_fields 
    });
    
    // Get all messages in the media group
    const { data: groupMessages, error: fetchError } = await supabase
      .from('messages')
      .select('id, telegram_message_id, chat_id, caption, analyzed_content')
      .eq('media_group_id', media_group_id)
      .order('created_at', { ascending: true });
      
    if (fetchError) {
      logger.error('Error fetching media group messages', { error: fetchError.message });
      return xdelo_createErrorResponse(
        new Error(`Failed to fetch media group messages: ${fetchError.message}`), 
        correlationId
      );
    }
    
    if (!groupMessages || groupMessages.length === 0) {
      logger.warn('No messages found for media group', { media_group_id });
      return xdelo_createSuccessResponse(
        { message: 'No messages found for this media group', media_group_id },
        correlationId
      );
    }
    
    logger.info('Found messages in media group', { 
      count: groupMessages.length,
      message_ids: groupMessages.map(m => m.telegram_message_id)
    });
    
    // Determine the source message (either trigger message or first message)
    let sourceMessage;
    
    if (trigger_message_id) {
      sourceMessage = groupMessages.find(m => m.id === trigger_message_id);
    }
    
    // If no trigger message specified or not found, use the first message with caption/content
    if (!sourceMessage) {
      sourceMessage = groupMessages.find(m => m.caption || 
        (m.analyzed_content && Object.keys(m.analyzed_content).length > 0));
    }
    
    // If still no source message, use the first message
    if (!sourceMessage && groupMessages.length > 0) {
      sourceMessage = groupMessages[0];
    }
    
    if (!sourceMessage) {
      logger.warn('No suitable source message found', { media_group_id });
      return xdelo_createSuccessResponse(
        { message: 'No suitable source message found', media_group_id },
        correlationId
      );
    }
    
    logger.info('Using source message for sync', { 
      source_id: sourceMessage.id,
      telegram_message_id: sourceMessage.telegram_message_id
    });
    
    // Prepare the update data based on modified fields
    const updateData: Record<string, any> = {};
    
    if (force_all_fields || modified_fields.includes('caption')) {
      updateData.caption = sourceMessage.caption || null;
    }
    
    if (force_all_fields || modified_fields.includes('analyzed_content')) {
      updateData.analyzed_content = sourceMessage.analyzed_content || null;
    }
    
    // Don't proceed if there's nothing to update
    if (Object.keys(updateData).length === 0) {
      logger.info('No fields to update', { modified_fields });
      return xdelo_createSuccessResponse(
        { message: 'No fields to update', media_group_id },
        correlationId
      );
    }
    
    // Add audit/tracking fields
    updateData.updated_at = new Date().toISOString();
    updateData.last_sync_at = new Date().toISOString();
    updateData.sync_source_id = sourceMessage.id;
    
    // Update all messages in the group except the source
    const messagesToUpdate = groupMessages
      .filter(m => m.id !== sourceMessage.id)
      .map(m => m.id);
      
    if (messagesToUpdate.length === 0) {
      logger.info('No other messages to update', { media_group_id });
      return xdelo_createSuccessResponse(
        { message: 'No other messages to update', media_group_id },
        correlationId
      );
    }
    
    logger.info('Updating messages', { 
      count: messagesToUpdate.length, 
      fields: Object.keys(updateData)
    });
    
    const { data: updateResult, error: updateError } = await supabase
      .from('messages')
      .update(updateData)
      .in('id', messagesToUpdate)
      .select('id, telegram_message_id');
      
    if (updateError) {
      logger.error('Error updating media group messages', { error: updateError.message });
      return xdelo_createErrorResponse(
        new Error(`Failed to update media group messages: ${updateError.message}`), 
        correlationId
      );
    }
    
    logger.info('Successfully synced media group', { 
      updated_count: updateResult?.length || 0,
      media_group_id,
      updated_fields: Object.keys(updateData)
    });
    
    // Log the operation to unified audit logs
    const { error: logError } = await supabase
      .from('unified_audit_logs')
      .insert({
        event_type: 'media_group_synced',
        entity_id: media_group_id,
        metadata: {
          source_message_id: sourceMessage.id,
          updated_message_count: updateResult?.length || 0,
          updated_fields: Object.keys(updateData),
          updated_message_ids: updateResult?.map(m => m.id) || []
        },
        correlation_id: correlationId
      });
      
    if (logError) {
      logger.warn('Failed to log media group sync operation', { error: logError.message });
    }
    
    return xdelo_createSuccessResponse({
      message: 'Media group successfully synced',
      media_group_id,
      updated_count: updateResult?.length || 0,
      source_message_id: sourceMessage.id,
      updated_fields: Object.keys(updateData)
    }, correlationId);
    
  } catch (error) {
    logger.error('Unhandled error in media group sync', { 
      error: error.message,
      stack: error.stack
    });
    
    return xdelo_createErrorResponse(error, correlationId, 500);
  }
};

// Wrap the handler with standardized handler
const handler = xdelo_createStandardizedHandler(syncMediaGroupHandler, {
  enableCors: true,
  logRequests: true,
  logResponses: true,
  securityLevel: SecurityLevel.PUBLIC
});

// Start the server
serve(handler);
