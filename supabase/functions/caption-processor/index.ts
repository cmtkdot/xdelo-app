import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { xdelo_logProcessingEvent, updateMessageState } from "../_shared/databaseOperations.ts";
import { parseCaption } from "./captionParser.ts";
import { syncMediaGroup } from "./mediaGroupSync.ts";
import { Logger } from "../telegram-webhook/utils/logger.ts";

/**
 * Create a direct Supabase client with service role key
 */
function createSupabaseClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase credentials');
  }
  
  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    },
    global: {
      headers: {
        'X-Client-Info': 'caption-processor-edge-function',
      },
    },
  });
}

interface CaptionProcessRequest {
  messageId: string;
  correlationId: string;
  forceReprocess?: boolean;
}

serve(async (req: Request) => {
  // Generate a correlation ID for tracing if not provided
  const correlationId = crypto.randomUUID();
  
  // Create a logger for this request
  const logger = new Logger(correlationId, 'caption-processor');
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    logger.debug('Received OPTIONS request, returning CORS headers');
    return new Response(null, { headers: corsHeaders });
  }
  
  // Create Supabase client
  const supabase = createSupabaseClient();
  
  try {
    // Parse the request body
    const requestData: CaptionProcessRequest = await req.json();
    
    // Validate required fields
    if (!requestData.messageId) {
      logger.error('Missing required field: messageId');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Missing required field: messageId',
          correlationId
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }
    
    // Use provided correlation ID or the generated one
    const reqCorrelationId = requestData.correlationId || correlationId;
    
    logger.info('Processing caption for message', { 
      message_id: requestData.messageId,
      force_reprocess: !!requestData.forceReprocess
    });
    
    // Get the message data
    const { data: message, error: messageError } = await supabase
      .from('messages')
      .select('*')
      .eq('id', requestData.messageId)
      .single();
    
    if (messageError || !message) {
      logger.error('Message not found or error retrieving message', { 
        message_id: requestData.messageId,
        error: messageError?.message
      });
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: messageError?.message || 'Message not found',
          correlationId: reqCorrelationId
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }
    
    // Check if message has a caption
    if (!message.caption) {
      logger.warn('Message has no caption, checking for media group synchronization', {
        message_id: message.id,
        media_group_id: message.media_group_id
      });
      
      // If it's part of a media group, try to sync from other messages
      if (message.media_group_id) {
        logger.info('Message is part of a media group, attempting to sync', {
          media_group_id: message.media_group_id
        });
        
        const syncResult = await syncMediaGroup(supabase, message, logger);
        
        return new Response(
          JSON.stringify({ 
            success: syncResult.success, 
            result: syncResult,
            correlationId: reqCorrelationId
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Not part of a media group and has no caption
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Message has no caption and is not part of a media group',
          correlationId: reqCorrelationId
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }
    
    // Update message state to processing
    await updateMessageState(message.id, 'processing');
    
    // Log the start of caption processing
    await xdelo_logProcessingEvent(
      'caption_processing_started',
      message.id,
      reqCorrelationId,
      {
        message_id: message.telegram_message_id,
        chat_id: message.chat_id,
        caption_length: message.caption.length,
        is_forced: !!requestData.forceReprocess
      }
    );
    
    // Process the caption
    logger.info('Parsing caption', { 
      caption_preview: message.caption.substring(0, 50) + (message.caption.length > 50 ? '...' : ''),
      caption_length: message.caption.length
    });
    
    const startTime = Date.now();
    const parsedCaption = parseCaption(message.caption);
    const processingTime = Date.now() - startTime;
    
    logger.info('Caption parsed successfully', { 
      processing_time_ms: processingTime,
      partial_success: parsedCaption.partial_success,
      missing_fields: parsedCaption.missing_fields
    });
    
    // Prepare analyzed content with parsing metadata
    const analyzedContent = {
      ...parsedCaption.result,
      parsing_metadata: {
        method: 'caption-processor',
        timestamp: new Date().toISOString(),
        processing_time_ms: processingTime,
        partial_success: parsedCaption.partial_success,
        missing_fields: parsedCaption.missing_fields || []
      }
    };
    
    // Update the message with analyzed content
    const { error: updateError } = await supabase
      .from('messages')
      .update({
        analyzed_content: analyzedContent,
        processing_state: 'completed',
        processing_completed_at: new Date().toISOString()
      })
      .eq('id', message.id);
    
    if (updateError) {
      logger.error('Error updating message with analyzed content', { 
        error: updateError.message
      });
      
      await updateMessageState(message.id, 'error', `Failed to update analyzed content: ${updateError.message}`);
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: updateError.message,
          correlationId: reqCorrelationId
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }
    
    // Log successful processing
    await xdelo_logProcessingEvent(
      'caption_processing_completed',
      message.id,
      reqCorrelationId,
      {
        message_id: message.telegram_message_id,
        chat_id: message.chat_id,
        processing_time_ms: processingTime,
        partial_success: parsedCaption.partial_success,
        has_product_name: !!parsedCaption.result.productName,
        has_product_code: !!parsedCaption.result.productCode
      }
    );
    
    // If message is part of a media group, sync the analyzed content to other messages
    if (message.media_group_id) {
      logger.info('Syncing analyzed content across media group', {
        media_group_id: message.media_group_id
      });
      
      const syncResult = await syncMediaGroup(supabase, message, logger, analyzedContent);
      
      logger.info('Media group sync complete', {
        media_group_id: message.media_group_id,
        sync_success: syncResult.success,
        synced_count: syncResult.syncedCount
      });
    }
    
    // Return success response
    return new Response(
      JSON.stringify({ 
        success: true, 
        result: {
          messageId: message.id,
          analyzedContent,
          processingTimeMs: processingTime,
          partialSuccess: parsedCaption.partial_success
        },
        correlationId: reqCorrelationId
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    logger.error('Unhandled error processing caption', { 
      error: error.message,
      stack: error.stack
    });
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Unknown error',
        correlationId
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
}); 