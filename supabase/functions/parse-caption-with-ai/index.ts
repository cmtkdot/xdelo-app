
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

// Types
type ProcessingState = 'initialized' | 'pending' | 'processing' | 'completed' | 'error' | 'no_caption';

interface SyncMetadata {
  sync_source_message_id: string;
  media_group_id: string;
}

interface ParsingMetadata {
  method: 'manual' | 'ai';
  timestamp: string;
  needs_ai_analysis?: boolean;
}

interface AnalyzedContent {
  product_name?: string;
  product_code?: string;
  vendor_uid?: string;
  purchase_date?: string;
  quantity?: number;
  notes?: string;
  parsing_metadata?: ParsingMetadata;
  sync_metadata?: SyncMetadata;
}

interface MessageUpdate {
  analyzed_content: AnalyzedContent | null;
  processing_state: ProcessingState;
  processing_completed_at?: string;
  processing_correlation_id?: string;
  is_original_caption?: boolean;
  group_caption_synced?: boolean;
  message_caption_id?: string;
  error_message?: string;
  last_error_at?: string;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function logEvent(category: string, action: string, details: Record<string, any> = {}) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    category,
    action,
    ...details
  };
  console.log(JSON.stringify(logEntry));
}

function extractProductInfo(caption: string): AnalyzedContent {
  logEvent('parsing', 'start_extraction', { caption });
  
  try {
    if (!caption || caption.trim().length === 0) {
      logEvent('parsing', 'empty_caption');
      return {
        parsing_metadata: {
          method: 'manual',
          timestamp: new Date().toISOString(),
          needs_ai_analysis: true
        }
      };
    }

    let result: AnalyzedContent = {
      parsing_metadata: {
        method: 'manual',
        timestamp: new Date().toISOString()
      }
    };

    // Extract product name and code
    const hashtagMatch = caption.match(/([^#]+)\s*#([A-Za-z0-9-]+)/);
    if (hashtagMatch) {
      result.product_name = hashtagMatch[1].trim();
      result.product_code = hashtagMatch[2].trim();
      logEvent('parsing', 'found_product_info', { 
        product_name: result.product_name,
        product_code: result.product_code 
      });
    } else {
      result.product_name = caption.split('#')[0].trim();
      logEvent('parsing', 'found_product_name_only', { 
        product_name: result.product_name 
      });
    }

    // Extract quantity (looking for "x NUMBER" pattern)
    const quantityMatch = caption.match(/x\s*(\d+)/i);
    if (quantityMatch) {
      result.quantity = parseInt(quantityMatch[1], 10);
      logEvent('parsing', 'found_quantity', { quantity: result.quantity });
    }

    // Extract vendor UID from product code if present (first 3 letters)
    if (result.product_code && result.product_code.length >= 3) {
      result.vendor_uid = result.product_code.substring(0, 3);
      logEvent('parsing', 'extracted_vendor_uid', { vendor_uid: result.vendor_uid });
    }

    const needsAiAnalysis = !result.product_code || !result.quantity;
    result.parsing_metadata.needs_ai_analysis = needsAiAnalysis;

    logEvent('parsing', 'completed_extraction', {
      result,
      needs_ai_analysis: needsAiAnalysis
    });

    return result;
  } catch (error) {
    logEvent('parsing', 'extraction_error', { 
      error: error.message,
      caption 
    });
    throw error;
  }
}

async function handleMediaGroupSync(
  supabase: any,
  messageId: string,
  media_group_id: string,
  analyzedContent: AnalyzedContent
): Promise<void> {
  logEvent('sync', 'start_media_group_sync', { 
    messageId, 
    media_group_id,
    has_analyzed_content: !!analyzedContent
  });

  try {
    // Use the xdelo_sync_media_group_content function
    const { error: syncError } = await supabase
      .rpc('xdelo_sync_media_group_content', {
        p_source_message_id: messageId,
        p_media_group_id: media_group_id,
        p_analyzed_content: analyzedContent
      });

    if (syncError) {
      logEvent('sync', 'sync_error', {
        messageId,
        media_group_id,
        error: syncError.message
      });
      throw syncError;
    }

    logEvent('sync', 'success', { messageId, media_group_id });
  } catch (error) {
    logEvent('sync', 'error', {
      messageId,
      media_group_id,
      error: error.message
    });
    throw error;
  }
}

serve(async (req) => {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  let requestData;
  try {
    requestData = await req.json();
  } catch (error) {
    logEvent('request', 'invalid_json', { error: error.message });
    return new Response(
      JSON.stringify({ error: 'Invalid JSON payload' }), 
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const { messageId, caption, media_group_id } = requestData;
  const correlationId = crypto.randomUUID();

  logEvent('request', 'received', {
    requestId,
    messageId,
    caption_length: caption?.length,
    media_group_id,
    correlationId
  });

  if (!messageId || !caption) {
    logEvent('request', 'validation_error', { messageId, caption });
    return new Response(
      JSON.stringify({ error: 'Missing required parameters' }), 
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Use xdelo_handle_message_state for state management
    const { error: stateError } = await supabase
      .rpc('xdelo_handle_message_state', {
        p_message_id: messageId,
        p_state: 'processing',
        p_metadata: {
          correlation_id: correlationId,
          operation: 'parse-caption'
        }
      });

    if (stateError) {
      throw new Error(`Failed to update state: ${stateError.message}`);
    }

    // Parse the caption
    const parsedContent = extractProductInfo(caption);

    // Update message with results using RPC
    const { error: updateError } = await supabase
      .from('messages')
      .update({
        analyzed_content: parsedContent,
        processing_state: 'completed',
        processing_completed_at: new Date().toISOString(),
        is_original_caption: true,
        processing_correlation_id: correlationId,
        updated_at: new Date().toISOString()
      })
      .eq('id', messageId);

    if (updateError) throw updateError;

    // Handle media group sync if needed
    if (media_group_id) {
      await handleMediaGroupSync(supabase, messageId, media_group_id, parsedContent);
    }

    logEvent('request', 'success', {
      requestId,
      processingTime: Date.now() - startTime,
      needs_ai_analysis: parsedContent.parsing_metadata?.needs_ai_analysis
    });

    return new Response(
      JSON.stringify({
        success: true,
        analyzed_content: parsedContent,
        needs_ai_analysis: parsedContent.parsing_metadata?.needs_ai_analysis,
        processing_time: Date.now() - startTime
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    logEvent('request', 'error', {
      requestId,
      error: error.message,
      processingTime: Date.now() - startTime
    });

    // Update error state using xdelo_handle_message_state
    try {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      );

      await supabase
        .rpc('xdelo_handle_message_state', {
          p_message_id: messageId,
          p_state: 'error',
          p_error: error.message,
          p_metadata: {
            correlation_id: correlationId,
            operation: 'parse-caption'
          }
        });

    } catch (updateError) {
      logEvent('error_state_update', 'failed', {
        requestId,
        error: updateError.message
      });
    }

    return new Response(
      JSON.stringify({
        error: error.message,
        requestId,
        processingTime: Date.now() - startTime
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
