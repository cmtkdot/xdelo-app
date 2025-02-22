
import "https://deno.land/x/xhr@0.1.0/mod.ts";
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

    console.log('Updating message with analyzed content:', {
      messageId,
      method,
      confidence,
      has_product_code: Boolean(parsedContent.product_code),
      has_vendor_uid: Boolean(parsedContent.vendor_uid)
    });

    // Update the message with analyzed content - using explicit processing_state type cast
    const { error: updateError } = await supabase
      .from('messages')
      .update({
        analyzed_content: analyzedContent,
        processing_state: 'completed'::processing_state_type,
        processing_completed_at: new Date().toISOString(),
        is_original_caption: true
      })
      .eq('id', messageId);

    if (updateError) {
      console.error('Error updating message:', updateError);
      throw updateError;
    }

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
        console.log('Syncing with existing analyzed content:', {
          source_message_id: existingAnalyzed.id,
          target_message_id: messageId
        });

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
            processing_state: 'completed'::processing_state_type,
            processing_completed_at: new Date().toISOString(),
            is_original_caption: false,
            group_caption_synced: true,
            message_caption_id: existingAnalyzed.id
          })
          .eq('id', messageId);
      } else {
        console.log('First analyzed content in group, syncing others:', {
          source_message_id: messageId,
          media_group_id
        });

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
            processing_state: 'completed'::processing_state_type,
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
    
    // Update message to error state if we have the messageId
    try {
      const { messageId } = await req.json();
      if (messageId) {
        const supabaseUrl = Deno.env.get('SUPABASE_URL') as string;
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') as string;
        const supabase = createClient(supabaseUrl, supabaseKey);

        await supabase
          .from('messages')
          .update({
            processing_state: 'error'::processing_state_type,
            error_message: error.message,
            processing_completed_at: new Date().toISOString(),
            last_error_at: new Date().toISOString()
          })
          .eq('id', messageId);
      }
    } catch (updateError) {
      console.error('Error updating message to error state:', updateError);
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
