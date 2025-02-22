
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { analyzeCaptionWithAI } from "./utils/aiAnalyzer.ts";
import { parseManually } from "./utils/manualParser.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messageId, caption, media_group_id, correlationId } = await req.json();
    
    console.log('Starting caption analysis:', {
      messageId, 
      media_group_id,
      caption_length: caption?.length,
      correlation_id: correlationId
    });

    const supabaseUrl = Deno.env.get('SUPABASE_URL') as string;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') as string;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // First try manual parsing
    let parsedContent = await parseManually(caption);
    let method = 'manual';
    let confidence = 1.0;

    // If manual parsing doesn't find enough info, use AI
    if (!parsedContent.product_code || !parsedContent.vendor_uid) {
      const aiResult = await analyzeCaptionWithAI(caption);
      parsedContent = aiResult.content;
      method = 'ai';
      confidence = aiResult.confidence;
    }

    // Add metadata
    const analyzedContent = {
      ...parsedContent,
      parsing_metadata: {
        method,
        confidence,
        timestamp: new Date().toISOString()
      }
    };

    // Update the message with analyzed content
    const { error: updateError } = await supabase
      .from('messages')
      .update({
        analyzed_content: analyzedContent,
        processing_state: 'completed',
        processing_completed_at: new Date().toISOString(),
        is_original_caption: true
      })
      .eq('id', messageId);

    if (updateError) throw updateError;

    // If this is part of a media group, check if we need to sync with existing analyzed content
    if (media_group_id) {
      const { data: existingAnalyzed } = await supabase
        .from('messages')
        .select('analyzed_content, id')
        .eq('media_group_id', media_group_id)
        .neq('id', messageId)
        .not('analyzed_content', 'is', null)
        .limit(1)
        .maybeSingle();

      if (existingAnalyzed?.analyzed_content) {
        // Sync this message with existing analyzed content
        const syncedContent = {
          ...existingAnalyzed.analyzed_content,
          sync_metadata: {
            sync_source_message_id: existingAnalyzed.id,
            media_group_id
          }
        };

        await supabase
          .from('messages')
          .update({
            analyzed_content: syncedContent,
            processing_state: 'completed',
            processing_completed_at: new Date().toISOString(),
            is_original_caption: false,
            group_caption_synced: true,
            message_caption_id: existingAnalyzed.id
          })
          .eq('id', messageId);
      } else {
        // This is the first analyzed content in the group, sync others to this one
        const syncedContent = {
          ...analyzedContent,
          sync_metadata: {
            sync_source_message_id: messageId,
            media_group_id
          }
        };

        await supabase
          .from('messages')
          .update({
            analyzed_content: syncedContent,
            processing_state: 'completed',
            processing_completed_at: new Date().toISOString(),
            is_original_caption: false,
            group_caption_synced: true,
            message_caption_id: messageId
          })
          .eq('media_group_id', media_group_id)
          .neq('id', messageId);
      }
    }

    return new Response(
      JSON.stringify({ success: true }), 
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error processing caption:', error);
    
    return new Response(
      JSON.stringify({ error: error.message }), 
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
