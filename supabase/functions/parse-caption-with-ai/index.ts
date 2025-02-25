
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { AnalyzedContent } from "../_shared/types.ts";

type ProcessingState = 'initialized' | 'pending' | 'processing' | 'completed' | 'error';

// Define a type for log data that covers common values
type LogData = Record<string, string | number | boolean | null | undefined | string[] | number[] | Record<string, unknown>>;

interface Logger {
  info: (message: string, data?: LogData) => void;
  error: (message: string, data?: LogData) => void;
  warn: (message: string, data?: LogData) => void;
}

function getLogger(correlationId: string): Logger {
  return {
    info: (message: string, data?: LogData) => {
      console.log(`ℹ️ ${message}`, {
        correlation_id: correlationId,
        ...data
      });
    },
    error: (message: string, data?: LogData) => {
      console.error(`❌ ${message}`, {
        correlation_id: correlationId,
        ...data
      });
    },
    warn: (message: string, data?: LogData) => {
      console.warn(`⚠️ ${message}`, {
        correlation_id: correlationId,
        ...data
      });
    }
  };
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function extractProductInfo(caption: string): AnalyzedContent {
  if (!caption || caption.trim().length === 0) {
    return {
      parsing_metadata: {
        method: 'manual',
        timestamp: new Date().toISOString(),
        needs_ai_analysis: true,
        confidence: 0
      }
    };
  }

  const analyzedContent: AnalyzedContent = {
    parsing_metadata: {
      method: 'manual',
      timestamp: new Date().toISOString(),
      confidence: 0.8 // Default confidence for manual parsing
    }
  };

  // Extract product name and code
  const hashtagMatch = caption.match(/([^#]+)\s*#([A-Za-z0-9-]+)/);
  if (hashtagMatch) {
    analyzedContent.product_name = hashtagMatch[1].trim();
    analyzedContent.product_code = hashtagMatch[2].trim();
  } else {
    analyzedContent.product_name = caption.split('#')[0].trim();
  }

  // Extract quantity (looking for "x NUMBER" pattern)
  const quantityMatch = caption.match(/x\s*(\d+)/i);
  if (quantityMatch) {
    analyzedContent.quantity = parseInt(quantityMatch[1], 10);
  }

  // Extract vendor UID from product code if present (first 3 letters)
  if (analyzedContent.product_code && analyzedContent.product_code.length >= 3) {
    analyzedContent.vendor_uid = analyzedContent.product_code.substring(0, 3);
  }

  if (analyzedContent.parsing_metadata) {
    analyzedContent.parsing_metadata.needs_ai_analysis = !analyzedContent.product_code || !analyzedContent.quantity;
  }
  
  return analyzedContent;
}

async function syncMediaGroup(
  supabase: any,
  sourceMessageId: string,
  media_group_id: string,
  analyzedContent: AnalyzedContent,
  correlationId: string
): Promise<void> {
  const logger = getLogger(correlationId);
  
  try {
    logger.info('Syncing media group content', {
      source_message_id: sourceMessageId,
      media_group_id: media_group_id
    });

    // Get all messages in the group to calculate group metadata
    const { data: groupMessages, error: fetchError } = await supabase
      .from('messages')
      .select('*')
      .eq('media_group_id', media_group_id);
      
    if (fetchError) {
      logger.error('Error fetching group messages', { error: fetchError.message });
      throw fetchError;
    }
    
    const groupCount = groupMessages?.length || 0;
    logger.info('Found messages in group', { count: groupCount });
    
    if (groupCount === 0) {
      logger.warn('No messages found in group, skipping sync');
      return;
    }
    
    // Calculate group timestamps
    const timestamps = groupMessages.map(m => new Date(m.created_at).getTime());
    const firstMessageTime = new Date(Math.min(...timestamps)).toISOString();
    const lastMessageTime = new Date(Math.max(...timestamps)).toISOString();
    
    // Update source message first to mark it as the original caption
    const { error: sourceUpdateError } = await supabase
      .from('messages')
      .update({
        is_original_caption: true,
        group_caption_synced: true,
        group_message_count: groupCount.toString(),
        group_first_message_time: firstMessageTime,
        group_last_message_time: lastMessageTime,
        processing_correlation_id: correlationId,
        updated_at: new Date().toISOString()
      })
      .eq('id', sourceMessageId);
      
    if (sourceUpdateError) {
      logger.error('Error updating source message', { error: sourceUpdateError.message });
      throw sourceUpdateError;
    }
    
    // Update all other messages in the group
    const { error: updateError } = await supabase
      .from('messages')
      .update({
        analyzed_content: analyzedContent,
        processing_state: 'completed',
        processing_completed_at: new Date().toISOString(),
        group_caption_synced: true,
        message_caption_id: sourceMessageId,  // Set the source message ID as the caption reference
        is_original_caption: false,  // These are not the original caption messages
        group_message_count: groupCount.toString(),
        group_first_message_time: firstMessageTime,
        group_last_message_time: lastMessageTime,
        processing_correlation_id: correlationId,
        updated_at: new Date().toISOString()
      })
      .eq('media_group_id', media_group_id)
      .neq('id', sourceMessageId);

    if (updateError) {
      logger.error('Error updating group messages', { error: updateError.message });
      throw updateError;
    }
    
    logger.info('Successfully synced media group content', { 
      group_count: groupCount,
      first_message_time: firstMessageTime,
      last_message_time: lastMessageTime
    });
  } catch (error) {
    logger.error('Error in syncMediaGroup', { 
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  let sourceMessageId: string | null = null;
  // Use the correlation ID from the webhook if provided, or generate a new one
  const correlationId = `caption-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  const logger = getLogger(correlationId);

  try {
    const body = await req.json();
    const { messageId, caption, media_group_id, correlation_id: webhookCorrelationId } = body;
    
    // Use the correlation ID from the webhook if provided
    const requestCorrelationId = webhookCorrelationId || correlationId;
    const requestLogger = getLogger(requestCorrelationId);
    
    sourceMessageId = messageId; // Store messageId in wider scope for error handling
    
    requestLogger.info('Received caption analysis request', { 
      messageId, 
      captionLength: caption?.length,
      hasMediaGroup: !!media_group_id
    });

    if (!messageId || !caption) {
      requestLogger.error('Missing required parameters', { 
        hasMessageId: !!messageId, 
        hasCaption: !!caption 
      });
      
      return new Response(
        JSON.stringify({ 
          error: 'Missing required parameters',
          correlation_id: requestCorrelationId
        }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Parse the caption
    requestLogger.info('Parsing caption', { captionLength: caption.length });
    const analyzedContent = extractProductInfo(caption);
    requestLogger.info('Caption parsed', { 
      hasProductName: !!analyzedContent.product_name,
      hasProductCode: !!analyzedContent.product_code,
      hasQuantity: !!analyzedContent.quantity,
      needsAiAnalysis: analyzedContent.parsing_metadata?.needs_ai_analysis
    });

    // Update source message first
    requestLogger.info('Updating source message', { messageId });
    const { error: updateError } = await supabase
      .from('messages')
      .update({
        analyzed_content: analyzedContent,
        processing_state: 'completed',
        processing_started_at: new Date().toISOString(),
        processing_completed_at: new Date().toISOString(),
        is_original_caption: true,        // This is the original caption message
        message_caption_id: messageId,    // Reference itself as the caption source
        processing_correlation_id: requestCorrelationId,
        updated_at: new Date().toISOString()
      })
      .eq('id', messageId);

    if (updateError) {
      requestLogger.error('Error updating source message', { error: updateError.message });
      throw updateError;
    }

    // If part of a media group, sync other messages
    if (media_group_id) {
      requestLogger.info('Message is part of a media group, syncing to other messages', { media_group_id });
      await syncMediaGroup(supabase, messageId, media_group_id, analyzedContent, requestCorrelationId);
    }

    requestLogger.info('Caption analysis completed successfully');
    return new Response(
      JSON.stringify({
        success: true,
        analyzed_content: analyzedContent,
        needs_ai_analysis: analyzedContent.parsing_metadata?.needs_ai_analysis,
        correlation_id: requestCorrelationId
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    logger.error('Error processing message', { 
      error: error.message,
      stack: error.stack
    });

    // Only try to update error state if we have a messageId
    if (sourceMessageId) {
      logger.info('Updating message to error state', { messageId: sourceMessageId });
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      );

      try {
        await supabase
          .from('messages')
          .update({
            processing_state: 'error',
            error_message: error.message,
            processing_completed_at: new Date().toISOString(),
            processing_correlation_id: correlationId,
            updated_at: new Date().toISOString()
          })
          .eq('id', sourceMessageId);
      } catch (stateError) {
        logger.error('Error updating error state', { error: stateError.message });
      }
    }

    return new Response(
      JSON.stringify({ 
        error: error.message,
        correlation_id: correlationId
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
