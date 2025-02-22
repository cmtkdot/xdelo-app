import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

type ProcessingState = 'initialized' | 'pending' | 'processing' | 'completed' | 'error';

interface AnalyzedContent {
  product_name?: string;
  product_code?: string;
  vendor_uid?: string;
  quantity?: number;
  parsing_metadata: {
    method: 'manual' | 'ai';
    timestamp: string;
    needs_ai_analysis?: boolean;
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
        needs_ai_analysis: true
      }
    };
  }

  const result: AnalyzedContent = {
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
  } else {
    result.product_name = caption.split('#')[0].trim();
  }

  // Extract quantity (looking for "x NUMBER" pattern)
  const quantityMatch = caption.match(/x\s*(\d+)/i);
  if (quantityMatch) {
    result.quantity = parseInt(quantityMatch[1], 10);
  }

  // Extract vendor UID from product code if present (first 3 letters)
  if (result.product_code && result.product_code.length >= 3) {
    result.vendor_uid = result.product_code.substring(0, 3);
  }

  result.parsing_metadata.needs_ai_analysis = !result.product_code || !result.quantity;
  return result;
}

async function syncMediaGroup(
  supabase: SupabaseClient,
  sourceMessageId: string,
  media_group_id: string,
  analyzedContent: AnalyzedContent
): Promise<void> {
  // Simple direct update of all messages in the group
  const { error: updateError } = await supabase
    .from('messages')
    .update({
      analyzed_content: analyzedContent,
      processing_state: 'completed',
      processing_completed_at: new Date().toISOString(),
      group_caption_synced: true,
      message_caption_id: sourceMessageId,  // Set the source message ID as the caption reference
      is_original_caption: false,  // These are not the original caption messages
      updated_at: new Date().toISOString()
    })
    .eq('media_group_id', media_group_id)
    .neq('id', sourceMessageId);

  if (updateError) throw updateError;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  let sourceMessageId: string | null = null;

  try {
    const body = await req.json();
    const { messageId, caption, media_group_id } = body;
    sourceMessageId = messageId; // Store messageId in wider scope for error handling

    if (!messageId || !caption) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters' }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Parse the caption
    const parsedContent = extractProductInfo(caption);

    // Update source message first
    const { error: updateError } = await supabase
      .from('messages')
      .update({
        analyzed_content: parsedContent,
        processing_state: 'completed',
        processing_started_at: new Date().toISOString(),
        processing_completed_at: new Date().toISOString(),
        is_original_caption: true,        // This is the original caption message
        message_caption_id: messageId,    // Reference itself as the caption source
        updated_at: new Date().toISOString()
      })
      .eq('id', messageId);

    if (updateError) throw updateError;

    // If part of a media group, sync other messages
    if (media_group_id) {
      await syncMediaGroup(supabase, messageId, media_group_id, parsedContent);
    }

    return new Response(
      JSON.stringify({
        success: true,
        analyzed_content: parsedContent,
        needs_ai_analysis: parsedContent.parsing_metadata?.needs_ai_analysis
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error processing message:', error);

    // Only try to update error state if we have a messageId
    if (sourceMessageId) {
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
            updated_at: new Date().toISOString()
          })
          .eq('id', sourceMessageId);
      } catch (stateError) {
        console.error('Error updating error state:', stateError);
      }
    }

    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
