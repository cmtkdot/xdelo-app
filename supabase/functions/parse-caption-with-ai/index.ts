
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

type ProcessingState = 'initialized' | 'pending' | 'processing' | 'completed' | 'error';

interface AnalyzedContent {
  product_name?: string;
  product_code?: string;
  vendor_uid?: string;
  quantity?: number;
  parsing_metadata?: {
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

async function handleMediaGroupSync(
  supabase: any,
  messageId: string,
  media_group_id: string,
  analyzedContent: AnalyzedContent
): Promise<void> {
  try {
    // Get all messages in the group first
    const { data: groupMessages } = await supabase
      .from('messages')
      .select('id, created_at')
      .eq('media_group_id', media_group_id);

    if (!groupMessages) return;

    // Calculate group metadata
    const groupFirst = groupMessages.reduce((min, msg) => 
      !min || new Date(msg.created_at) < new Date(min.created_at) ? msg : min
    , null);
    const groupLast = groupMessages.reduce((max, msg) => 
      !max || new Date(msg.created_at) > new Date(max.created_at) ? msg : max
    , null);

    // Update all messages in the group
    const { error: updateError } = await supabase
      .from('messages')
      .update({
        analyzed_content: analyzedContent,
        processing_state: 'completed',
        processing_completed_at: new Date().toISOString(),
        is_original_caption: false,
        group_caption_synced: true,
        message_caption_id: messageId,
        group_first_message_time: groupFirst?.created_at,
        group_last_message_time: groupLast?.created_at,
        group_message_count: groupMessages.length,
        updated_at: new Date().toISOString()
      })
      .eq('media_group_id', media_group_id)
      .neq('id', messageId);

    if (updateError) throw updateError;
  } catch (error) {
    console.error('Error in media group sync:', error);
    throw error;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messageId, caption, media_group_id } = await req.json();

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

    // Set processing state
    await supabase
      .from('messages')
      .update({ 
        processing_state: 'processing',
        processing_started_at: new Date().toISOString()
      })
      .eq('id', messageId);

    // Parse the caption
    const parsedContent = extractProductInfo(caption);

    // Update source message
    const { error: updateError } = await supabase
      .from('messages')
      .update({
        analyzed_content: parsedContent,
        processing_state: 'completed',
        processing_completed_at: new Date().toISOString(),
        is_original_caption: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', messageId);

    if (updateError) throw updateError;

    // Handle media group sync if needed
    if (media_group_id) {
      await handleMediaGroupSync(supabase, messageId, media_group_id, parsedContent);
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

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Update error state directly
    try {
      await supabase
        .from('messages')
        .update({
          processing_state: 'error',
          error_message: error.message,
          processing_completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', messageId);
    } catch (stateError) {
      console.error('Error updating error state:', stateError);
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
