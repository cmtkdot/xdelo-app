import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { analyzeCaption } from "./aiAnalyzer.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message_id, media_group_id, caption, correlation_id } = await req.json();
    
    console.log('Starting caption analysis:', {
      message_id,
      media_group_id,
      caption_length: caption?.length || 0,
      correlation_id
    });

    // Initialize empty caption handling
    const textToAnalyze = caption?.trim() || '';
    if (!textToAnalyze) {
      console.log('Empty caption received, using default values');
      return new Response(
        JSON.stringify({
          success: true,
          analyzed_content: {
            product_name: 'Untitled Product',
            parsing_metadata: {
              method: 'manual',
              confidence: 0.1,
              timestamp: new Date().toISOString()
            }
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Analyze the caption
    const analyzedContent = await analyzeCaption(textToAnalyze);
    console.log('Analysis completed:', {
      correlation_id,
      product_name: analyzedContent.product_name,
      confidence: analyzedContent.parsing_metadata?.confidence
    });

    // Update the message with analyzed content
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase credentials');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Update the message
    const { error: updateError } = await supabase
      .from('messages')
      .update({
        analyzed_content: analyzedContent,
        processing_state: 'completed',
        processing_completed_at: new Date().toISOString()
      })
      .eq('id', message_id);

    if (updateError) {
      console.error('Error updating message:', updateError);
      throw updateError;
    }

    // If this is part of a media group, update related messages
    if (media_group_id) {
      const { error: groupUpdateError } = await supabase
        .from('messages')
        .update({
          analyzed_content: analyzedContent,
          processing_state: 'completed',
          processing_completed_at: new Date().toISOString(),
          message_caption_id: message_id
        })
        .eq('media_group_id', media_group_id)
        .neq('id', message_id);

      if (groupUpdateError) {
        console.error('Error updating media group:', groupUpdateError);
        throw groupUpdateError;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        analyzed_content: analyzedContent,
        correlation_id
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in parse-caption-with-ai:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        correlation_id: crypto.randomUUID(),
        timestamp: new Date().toISOString()
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});