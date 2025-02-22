
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { analyzeCaptionWithAI } from "./utils/aiAnalyzer.ts";
import { parseManually } from "./utils/manualParser.ts";
import { ProcessingState, AnalyzedContent, MessageUpdate } from "./types.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messageId, caption, media_group_id, correlationId } = await req.json();
    
    if (!messageId || !caption) {
      throw new Error('Missing required parameters: messageId and caption');
    }

    console.log('[parse-caption] Starting analysis:', { messageId, media_group_id, correlation_id: correlationId });

    const supabaseUrl = Deno.env.get('SUPABASE_URL') as string;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') as string;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Update to processing state
    await supabase
      .from('messages')
      .update({ 
        processing_state: 'processing' as ProcessingState,
        processing_started_at: new Date().toISOString()
      })
      .eq('id', messageId);

    // First try manual parsing
    let parsedContent = await parseManually(caption);
    let method: 'manual' | 'ai' | 'hybrid' = 'manual';
    let confidence = 1.0;

    // If manual parsing doesn't find enough info, use AI
    if (!parsedContent.product_code || !parsedContent.vendor_uid) {
      console.log('[parse-caption] Manual parsing insufficient, trying AI');
      const aiResult = await analyzeCaptionWithAI(caption);
      parsedContent = aiResult.content;
      method = 'ai';
      confidence = aiResult.confidence;
    }

    // Add metadata
    const analyzedContent: AnalyzedContent = {
      ...parsedContent,
      parsing_metadata: {
        method,
        confidence,
        timestamp: new Date().toISOString()
      }
    };

    // Base message update
    const baseUpdate: MessageUpdate = {
      analyzed_content: analyzedContent,
      processing_state: 'completed',
      processing_completed_at: new Date().toISOString(),
      is_original_caption: true
    };

    // Update the message
    const { error: updateError } = await supabase
      .from('messages')
      .update(baseUpdate)
      .eq('id', messageId);

    if (updateError) {
      throw updateError;
    }

    // Handle media group synchronization if needed
    if (media_group_id) {
      const { data: existingAnalyzed } = await supabase
        .from('messages')
        .select('analyzed_content, id')
        .eq('media_group_id', media_group_id)
        .neq('id', messageId)
        .not('analyzed_content', 'is', null)
        .limit(1)
        .maybeSingle();

      const groupUpdate: MessageUpdate = {
        processing_state: 'completed',
        processing_completed_at: new Date().toISOString(),
        is_original_caption: false,
        group_caption_synced: true
      };

      if (existingAnalyzed?.analyzed_content) {
        // Sync with existing analyzed content
        groupUpdate.analyzed_content = {
          ...existingAnalyzed.analyzed_content,
          sync_metadata: {
            sync_source_message_id: existingAnalyzed.id,
            media_group_id
          }
        };
        groupUpdate.message_caption_id = existingAnalyzed.id;

        await supabase
          .from('messages')
          .update(groupUpdate)
          .eq('id', messageId);
      } else {
        // First analyzed content, sync others to this one
        groupUpdate.analyzed_content = {
          ...analyzedContent,
          sync_metadata: {
            sync_source_message_id: messageId,
            media_group_id
          }
        };
        groupUpdate.message_caption_id = messageId;

        await supabase
          .from('messages')
          .update(groupUpdate)
          .eq('media_group_id', media_group_id)
          .neq('id', messageId);
      }
    }

    return new Response(
      JSON.stringify({ success: true }), 
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[parse-caption] Error:', error);
    
    // Try to update message to error state
    try {
      const { messageId } = await req.json();
      if (messageId) {
        const supabaseUrl = Deno.env.get('SUPABASE_URL') as string;
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') as string;
        const supabase = createClient(supabaseUrl, supabaseKey);

        const errorUpdate: MessageUpdate = {
          analyzed_content: null,
          processing_state: 'error',
          error_message: error.message,
          processing_completed_at: new Date().toISOString(),
          last_error_at: new Date().toISOString()
        };

        await supabase
          .from('messages')
          .update(errorUpdate)
          .eq('id', messageId);
      }
    } catch (updateError) {
      console.error('[parse-caption] Error updating error state:', updateError);
    }
    
    return new Response(
      JSON.stringify({ error: error.message }), 
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
