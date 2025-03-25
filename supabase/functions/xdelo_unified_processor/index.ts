
import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { supabaseClient } from '../_shared/supabase.ts';
import { xdelo_logProcessingEvent } from '../_shared/databaseOperations.ts';
import { v4 as uuidv4 } from 'https://esm.sh/uuid@9.0.0';

/**
 * A unified processor for media operations
 * 
 * This edge function centralizes all media processing operations to provide
 * a consistent interface and behavior across the application.
 */
serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { operation, messageId, mediaGroupId, force = false, correlationId } = await req.json();
    
    // Generate a correlation ID if not provided
    const requestCorrelationId = correlationId || uuidv4();

    // Log operation start
    await xdelo_logProcessingEvent(
      `unified_processor_${operation}_start`,
      messageId || mediaGroupId,
      requestCorrelationId,
      { 
        operation,
        messageId,
        mediaGroupId,
        force,
        timestamp: new Date().toISOString()
      }
    );

    let result;
    
    // Execute the requested operation
    switch (operation) {
      case 'process_caption':
        result = await processCaption(messageId, requestCorrelationId, force);
        break;
      
      case 'sync_media_group':
        result = await syncMediaGroup(messageId, mediaGroupId, requestCorrelationId, force);
        break;
      
      case 'reprocess':
        result = await reprocessMessage(messageId, requestCorrelationId, force);
        break;
      
      case 'delayed_sync':
        result = await processDelayedMediaGroupSync(mediaGroupId, requestCorrelationId);
        break;
      
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }

    // Log operation completion
    await xdelo_logProcessingEvent(
      `unified_processor_${operation}_complete`,
      messageId || mediaGroupId,
      requestCorrelationId,
      { 
        operation,
        result,
        success: true,
        timestamp: new Date().toISOString()
      }
    );

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: result,
        operation,
        correlationId: requestCorrelationId
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  } catch (error) {
    const errorMessage = error.message || 'Unknown error';
    console.error('Error in unified processor:', errorMessage);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage,
        stack: error.stack
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      }
    );
  }
});

/**
 * Process a message caption and analyze it
 */
async function processCaption(messageId: string, correlationId: string, force: boolean = false): Promise<any> {
  try {
    // Call the database function to process the caption
    const { data, error } = await supabaseClient.rpc(
      'xdelo_process_caption_workflow',
      {
        p_message_id: messageId,
        p_correlation_id: correlationId,
        p_force: force
      }
    );
    
    if (error) {
      throw new Error(`Error processing caption: ${error.message}`);
    }
    
    return data;
  } catch (error) {
    await xdelo_logProcessingEvent(
      'process_caption_error',
      messageId,
      correlationId,
      { error: error.message },
      error.message
    );
    throw error;
  }
}

/**
 * Synchronize content across a media group
 */
async function syncMediaGroup(
  sourceMessageId: string, 
  mediaGroupId: string, 
  correlationId: string,
  force: boolean = false
): Promise<any> {
  try {
    // Call the database function to sync the media group
    // Make sure to use the correct parameter order matching the database function definition
    const { data, error } = await supabaseClient.rpc(
      'xdelo_sync_media_group_content',
      {
        p_source_message_id: sourceMessageId,
        p_media_group_id: mediaGroupId,
        p_correlation_id: correlationId,
        p_force_sync: force,
        p_sync_edit_history: true
      }
    );
    
    if (error) {
      throw new Error(`Error syncing media group: ${error.message}`);
    }
    
    return data;
  } catch (error) {
    await xdelo_logProcessingEvent(
      'sync_media_group_error',
      sourceMessageId,
      correlationId,
      { mediaGroupId, error: error.message },
      error.message
    );
    throw error;
  }
}

/**
 * Reprocess a message completely
 */
async function reprocessMessage(messageId: string, correlationId: string, force: boolean = true): Promise<any> {
  try {
    // First process the caption
    const captionResult = await processCaption(messageId, correlationId, force);
    
    // Get the message details to check if it's part of a media group
    const { data: message, error } = await supabaseClient
      .from('messages')
      .select('media_group_id')
      .eq('id', messageId)
      .single();
    
    if (error) {
      throw new Error(`Error fetching message: ${error.message}`);
    }
    
    // If it's part of a media group, sync the group as well
    if (message.media_group_id) {
      const syncResult = await syncMediaGroup(
        messageId, 
        message.media_group_id, 
        correlationId,
        force
      );
      
      return {
        captionResult,
        syncResult,
        mediaGroupId: message.media_group_id
      };
    }
    
    return captionResult;
  } catch (error) {
    await xdelo_logProcessingEvent(
      'reprocess_message_error',
      messageId,
      correlationId,
      { error: error.message },
      error.message
    );
    throw error;
  }
}

/**
 * Process delayed media group synchronization
 */
async function processDelayedMediaGroupSync(mediaGroupId: string, correlationId: string): Promise<any> {
  try {
    // First, find the best caption message in the group
    const { data: captionMessageId, error: findError } = await supabaseClient.rpc(
      'xdelo_find_caption_message',
      { p_media_group_id: mediaGroupId }
    );
    
    if (findError) {
      throw new Error(`Error finding caption message: ${findError.message}`);
    }
    
    if (!captionMessageId) {
      throw new Error(`No suitable caption message found for group ${mediaGroupId}`);
    }
    
    // Sync the media group with the found caption message
    return await syncMediaGroup(captionMessageId, mediaGroupId, correlationId, true);
  } catch (error) {
    await xdelo_logProcessingEvent(
      'delayed_sync_error',
      mediaGroupId,
      correlationId,
      { error: error.message },
      error.message
    );
    throw error;
  }
}
