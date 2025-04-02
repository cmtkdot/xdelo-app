import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { CaptionAnalysisRequest } from "../_shared/types.ts";
import {
  corsHeaders,
  formatErrorResponse,
  formatSuccessResponse,
  logEvent,
  parseCaption,
  supabase,
  syncMediaGroup,
  updateMessageState
} from "../_shared/utils.ts";

/**
 * Handles caption parsing requests
 */
async function handleCaptionParsing(request: CaptionAnalysisRequest): Promise<Record<string, unknown>> {
  // Generate correlation ID if not provided
  const correlationId = request.correlationId || crypto.randomUUID();
  
  // Validate request
  if (!request.messageId) {
    return {
      success: false,
      error: 'Message ID is required',
      correlationId
    };
  }
  
  const messageId = request.messageId;
  
  try {
    // Fetch message from database
    const { data: message, error: fetchError } = await supabase
      .from('messages')
      .select('id, caption, telegram_message_id, chat_id, media_group_id, processing_state')
      .eq('id', messageId)
      .single();
    
    if (fetchError || !message) {
      await logEvent(
        'caption_analysis_error',
        messageId,
        correlationId,
        { error: fetchError?.message || 'Message not found' },
        fetchError?.message || 'Message not found'
      );
      
      return {
        success: false,
        error: fetchError?.message || 'Message not found',
        correlationId
      };
    }
    
    // Update message state to processing
    await updateMessageState(messageId, 'processing', correlationId);
    
    // Analyze caption
    const caption = message.caption || '';
    const analyzedContent = await parseCaption(caption);
    
    // Add parsing metadata
    if (analyzedContent.parsing_metadata) {
      analyzedContent.parsing_metadata.is_edit = request.isEdit || false;
      analyzedContent.parsing_metadata.trigger_source = request.trigger_source || 'manual';
    }
    
    // Update database with analyzed content
    const updateResult = await updateMessageState(
      messageId,
      'completed',
      correlationId,
      analyzedContent
    );
    
    if (!updateResult.success) {
      return {
        success: false,
        error: updateResult.error || 'Failed to update message state',
        correlationId
      };
    }
    
    // Log the successful analysis
    await logEvent(
      'caption_analysis_completed',
      messageId,
      correlationId,
      {
        telegram_message_id: message.telegram_message_id,
        chat_id: message.chat_id,
        media_group_id: message.media_group_id,
        analyzed_content: analyzedContent
      }
    );
    
    // If message is part of a media group, sync the content
    if (message.media_group_id && request.syncMediaGroup !== false) {
      const syncResult = await syncMediaGroup(
        messageId,
        message.media_group_id,
        correlationId,
        request.forceSync || false
      );
      
      // Return result with sync info
      return {
        success: true,
        messageId,
        caption,
        analyzedContent,
        correlationId,
        mediaGroupSynced: syncResult.success,
        mediaGroupId: message.media_group_id,
        syncResult
      };
    }
    
    // Return result without sync
    return {
      success: true,
      messageId,
      caption,
      analyzedContent,
      correlationId
    };
  } catch (error) {
    // Log error
    await logEvent(
      'caption_analysis_error',
      messageId,
      correlationId,
      { error: error.message },
      error.message
    );
    
    // Update message state to error
    await updateMessageState(
      messageId,
      'error', 
      correlationId,
      null,
      error.message
    );
    
    return {
      success: false,
      error: `Caption analysis failed: ${error.message}`,
      correlationId
    };
  }
}

// Handle requests
serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  
  try {
    // Parse request
    const request = await req.json() as CaptionAnalysisRequest;
    
    // Process caption
    const result = await handleCaptionParsing(request);
    
    // Return appropriate response
    if (result.success) {
      return formatSuccessResponse(result);
    } else {
      return formatErrorResponse(result.error as string, 400, result.correlationId as string);
    }
  } catch (error) {
    console.error('Error processing request:', error);
    return formatErrorResponse(
      `Failed to process request: ${error.message}`,
      500
    );
  }
});
