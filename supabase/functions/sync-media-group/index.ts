import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  corsHeaders,
  formatErrorResponse,
  formatSuccessResponse,
  logEvent,
  supabase,
  syncMediaGroup
} from "../_shared/utils.ts";

interface SyncRequest {
  mediaGroupId: string;
  sourceMessageId: string;
  correlationId?: string;
  forceSync?: boolean;
  syncEditHistory?: boolean;
}

/**
 * Synchronizes content across all messages in a media group
 */
async function syncMediaGroupContent(request: SyncRequest): Promise<Record<string, unknown>> {
  // Generate correlation ID if not provided
  const correlationId = request.correlationId || crypto.randomUUID();
  
  // Validate request
  if (!request.mediaGroupId || !request.sourceMessageId) {
    return {
      success: false,
      error: 'Media group ID and source message ID are required',
      correlationId
    };
  }
  
  const { mediaGroupId, sourceMessageId } = request;
  
  try {
    // Get source message to validate it exists and has analyzed content
    const { data: sourceMessage, error: fetchError } = await supabase
      .from('messages')
      .select('id, analyzed_content, media_group_id')
      .eq('id', sourceMessageId)
      .single();
    
    if (fetchError || !sourceMessage) {
      // Log error
      await logEvent(
        'media_group_sync_error',
        sourceMessageId,
        correlationId,
        { error: fetchError?.message || 'Source message not found' },
        fetchError?.message || 'Source message not found'
      );
      
      return {
        success: false,
        error: fetchError?.message || 'Source message not found',
        correlationId
      };
    }
    
    // Verify the message has analyzed content
    if (!sourceMessage.analyzed_content && !request.forceSync) {
      return {
        success: false,
        error: 'Source message has no analyzed content',
        correlationId
      };
    }
    
    // Verify the message belongs to the specified media group
    if (sourceMessage.media_group_id !== mediaGroupId) {
      return {
        success: false,
        error: 'Source message does not belong to the specified media group',
        mediaGroupId,
        sourceMediaGroupId: sourceMessage.media_group_id,
        correlationId
      };
    }
    
    // Call utility function to sync the media group
    const result = await syncMediaGroup(
      sourceMessageId,
      mediaGroupId,
      correlationId,
      request.forceSync || false,
      request.syncEditHistory || false
    );
    
    // Log operation
    await logEvent(
      'media_group_sync_completed',
      sourceMessageId,
      correlationId,
      {
        mediaGroupId,
        updateCount: result.updatedCount || 0,
        success: result.success
      }
    );
    
    // Return result
    return {
      success: true,
      mediaGroupId,
      sourceMessageId,
      updatedCount: result.updatedCount || 0,
      correlationId
    };
  } catch (error) {
    // Log error
    await logEvent(
      'media_group_sync_error',
      sourceMessageId,
      correlationId,
      { error: error.message },
      error.message
    );
    
    // Return error response
    return {
      success: false,
      error: `Media group sync failed: ${error.message}`,
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
    const request = await req.json() as SyncRequest;
    
    // Sync media group
    const result = await syncMediaGroupContent(request);
    
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