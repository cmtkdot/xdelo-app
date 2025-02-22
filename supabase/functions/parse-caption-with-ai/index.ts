
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
  logEvent('parsing', 'start_extraction', { caption_length: caption?.length });
  
  try {
    // Basic validation
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

    const lines = caption.split('\n').map(line => line.trim());
    logEvent('parsing', 'split_lines', { line_count: lines.length });

    let result: AnalyzedContent = {
      parsing_metadata: {
        method: 'manual',
        timestamp: new Date().toISOString()
      }
    };

    // Attempt to extract product name from first non-empty line
    for (const line of lines) {
      if (line.length > 0) {
        result.product_name = line;
        break;
      }
    }

    // Look for product code (usually formats like #123, SKU123, etc)
    const codeMatch = caption.match(/#([A-Za-z0-9-]+)|SKU[:\s]*([A-Za-z0-9-]+)/i);
    if (codeMatch) {
      result.product_code = (codeMatch[1] || codeMatch[2]).trim();
      logEvent('parsing', 'found_product_code', { code: result.product_code });
    }

    // Look for quantity (number followed by units or standalone)
    const qtyMatch = caption.match(/(\d+)\s*(pcs?|pieces?|units?|qty|quantity)?/i);
    if (qtyMatch) {
      result.quantity = parseInt(qtyMatch[1], 10);
      logEvent('parsing', 'found_quantity', { quantity: result.quantity });
    }

    // Look for vendor information
    const vendorMatch = caption.match(/vendor[:\s]+([^\n]+)/i);
    if (vendorMatch) {
      result.vendor_uid = vendorMatch[1].trim();
      logEvent('parsing', 'found_vendor', { vendor: result.vendor_uid });
    }

    // Check if AI analysis might be needed
    const needsAiAnalysis = !result.product_code || !result.quantity || !result.vendor_uid;
    result.parsing_metadata.needs_ai_analysis = needsAiAnalysis;

    logEvent('parsing', 'completed_extraction', {
      has_product_name: !!result.product_name,
      has_product_code: !!result.product_code,
      has_quantity: !!result.quantity,
      has_vendor: !!result.vendor_uid,
      needs_ai_analysis: needsAiAnalysis
    });

    return result;
  } catch (error) {
    logEvent('parsing', 'extraction_error', { 
      error: error.message,
      error_stack: error.stack
    });
    throw error;
  }
}

async function handleMediaGroupSync(
  supabase: any,
  messageId: string,
  media_group_id: string,
  analyzedContent: AnalyzedContent,
  correlationId?: string
): Promise<void> {
  logEvent('sync', 'start_media_group_sync', { 
    messageId, 
    media_group_id,
    correlationId,
    has_analyzed_content: !!analyzedContent
  });

  try {
    // Call xdelo_sync_media_group_content function
    const { data: syncResult, error: syncError } = await supabase.rpc(
      'xdelo_sync_media_group_content',
      {
        p_source_message_id: messageId,
        p_media_group_id: media_group_id,
        p_analyzed_content: analyzedContent
      }
    );

    if (syncError) {
      logEvent('sync', 'sync_error', {
        messageId,
        media_group_id,
        error: syncError.message,
        error_code: syncError.code,
        details: syncError.details
      });
      throw new Error(`Failed to sync media group content: ${syncError.message}`);
    }

    logEvent('sync', 'sync_success', {
      messageId,
      media_group_id,
      correlationId
    });

  } catch (error) {
    logEvent('sync', 'sync_critical_error', {
      messageId,
      media_group_id,
      error: error.message,
      error_stack: error.stack
    });
    throw error;
  }
}

serve(async (req) => {
  const requestStart = Date.now();
  const requestId = crypto.randomUUID();
  
  logEvent('request', 'start', { 
    requestId,
    method: req.method,
    url: req.url
  });

  if (req.method === 'OPTIONS') {
    logEvent('request', 'cors_preflight', { requestId });
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messageId, caption, media_group_id, correlationId } = await req.json();
    
    logEvent('request', 'payload_received', {
      requestId,
      messageId,
      has_caption: !!caption,
      caption_length: caption?.length,
      media_group_id,
      correlationId
    });

    if (!messageId || !caption) {
      logEvent('request', 'validation_error', {
        requestId,
        missing_fields: {
          messageId: !messageId,
          caption: !caption
        }
      });
      throw new Error('Missing required parameters: messageId and caption');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      logEvent('config', 'missing_env_vars', {
        requestId,
        missing_vars: {
          SUPABASE_URL: !supabaseUrl,
          SUPABASE_SERVICE_ROLE_KEY: !supabaseKey
        }
      });
      throw new Error('Missing required environment variables');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Set state to processing
    logEvent('state', 'updating_to_processing', {
      requestId,
      messageId,
      correlationId
    });

    const { error: stateError } = await supabase
      .from('messages')
      .update({ 
        processing_state: 'processing',
        processing_started_at: new Date().toISOString(),
        processing_correlation_id: correlationId
      })
      .eq('id', messageId);

    if (stateError) {
      logEvent('state', 'update_error', {
        requestId,
        messageId,
        error: stateError.message,
        error_code: stateError.code,
        details: stateError.details
      });
      throw new Error(`Failed to update processing state: ${stateError.message}`);
    }

    // Perform manual parsing
    logEvent('processing', 'start_parsing', {
      requestId,
      messageId,
      correlationId
    });

    const parsedContent = extractProductInfo(caption);

    // Base message update
    const baseUpdate: MessageUpdate = {
      analyzed_content: parsedContent,
      processing_state: 'completed',
      processing_completed_at: new Date().toISOString(),
      processing_correlation_id: correlationId,
      is_original_caption: true
    };

    // Update the message
    logEvent('state', 'updating_with_results', {
      requestId,
      messageId,
      update_fields: Object.keys(baseUpdate),
      needs_ai_analysis: parsedContent.parsing_metadata?.needs_ai_analysis
    });

    const { error: updateError } = await supabase
      .from('messages')
      .update(baseUpdate)
      .eq('id', messageId);

    if (updateError) {
      logEvent('state', 'update_error', {
        requestId,
        messageId,
        error: updateError.message,
        error_code: updateError.code,
        details: updateError.details
      });
      throw new Error(`Failed to update message: ${updateError.message}`);
    }

    // Handle media group synchronization if needed
    if (media_group_id) {
      logEvent('sync', 'initiating_group_sync', {
        requestId,
        messageId,
        media_group_id
      });
      await handleMediaGroupSync(supabase, messageId, media_group_id, parsedContent, correlationId);
    }

    const processingTime = Date.now() - requestStart;
    logEvent('request', 'completed', {
      requestId,
      messageId,
      processing_time_ms: processingTime,
      needs_ai_analysis: parsedContent.parsing_metadata?.needs_ai_analysis
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        needs_ai_analysis: parsedContent.parsing_metadata?.needs_ai_analysis,
        processing_time_ms: processingTime
      }), 
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    logEvent('error', 'request_failed', {
      requestId,
      error: error.message,
      error_stack: error.stack,
      processing_time_ms: Date.now() - requestStart
    });
    
    // Try to update message to error state
    try {
      const { messageId, correlationId } = await req.json();
      if (messageId) {
        const supabaseUrl = Deno.env.get('SUPABASE_URL') as string;
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') as string;
        const supabase = createClient(supabaseUrl, supabaseKey);

        logEvent('error', 'updating_error_state', {
          requestId,
          messageId,
          correlationId,
          error: error.message
        });

        const errorUpdate: MessageUpdate = {
          analyzed_content: null,
          processing_state: 'error',
          error_message: error.message,
          processing_completed_at: new Date().toISOString(),
          last_error_at: new Date().toISOString(),
          processing_correlation_id: correlationId
        };

        await supabase
          .from('messages')
          .update(errorUpdate)
          .eq('id', messageId);

      }
    } catch (updateError) {
      logEvent('error', 'error_state_update_failed', {
        requestId,
        error: updateError.message,
        original_error: error.message,
        error_stack: updateError.stack
      });
    }
    
    return new Response(
      JSON.stringify({ 
        error: error.message,
        request_id: requestId,
        processing_time_ms: Date.now() - requestStart
      }), 
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
