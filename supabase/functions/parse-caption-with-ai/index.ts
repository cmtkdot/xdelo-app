import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { analyzeCaption } from "./utils/aiAnalyzer.ts";

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

    // Set up Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase credentials');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get current message details first
    const { data: currentMessage } = await supabase
      .from('messages')
      .select('id, media_group_id, is_original_caption, group_message_count')
      .eq('id', message_id)
      .single();

    if (!currentMessage) {
      throw new Error('Message not found');
    }

    // Initialize empty caption handling
    const textToAnalyze = caption?.trim() || '';
    if (!textToAnalyze) {
      console.log('Empty caption received, checking for media group caption');
      
      if (media_group_id) {
        // Try to find a caption from the media group
        const { data: groupMessage } = await supabase
          .from('messages')
          .select('id, analyzed_content')
          .eq('media_group_id', media_group_id)
          .eq('is_original_caption', true)
          .maybeSingle();

        if (groupMessage?.analyzed_content) {
          console.log('Found existing analysis in media group');
          
          // Update this message with the group's analysis
          const { error: updateError } = await supabase
            .from('messages')
            .update({
              analyzed_content: groupMessage.analyzed_content,
              processing_state: 'completed',
              processing_completed_at: new Date().toISOString(),
              message_caption_id: groupMessage.id,
              is_original_caption: false
            })
            .eq('id', message_id);

          if (updateError) {
            throw updateError;
          }

          return new Response(
            JSON.stringify({
              success: true,
              analyzed_content: groupMessage.analyzed_content,
              correlation_id,
              is_original_caption: false
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      // No caption found in group, use default values
      const defaultContent = {
        product_name: 'Untitled Product',
        parsing_metadata: {
          method: 'default',
          confidence: 0.1,
          timestamp: new Date().toISOString()
        }
      };

      // Update the message
      const { error: updateError } = await supabase
        .from('messages')
        .update({
          analyzed_content: defaultContent,
          processing_state: 'completed',
          processing_completed_at: new Date().toISOString(),
          is_original_caption: false
        })
        .eq('id', message_id);

      if (updateError) {
        throw updateError;
      }

      return new Response(
        JSON.stringify({
          success: true,
          analyzed_content: defaultContent,
          correlation_id,
          is_original_caption: false
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
    const { error: updateError } = await supabase
      .from('messages')
      .update({
        analyzed_content: analyzedContent,
        processing_state: 'completed',
        processing_completed_at: new Date().toISOString(),
        is_original_caption: true
      })
      .eq('id', message_id);

    if (updateError) {
      throw updateError;
    }

    // If this is part of a media group, sync it
    if (media_group_id) {
      const { error: syncError } = await supabase
        .rpc('process_media_group_analysis', {
          p_message_id: message_id,
          p_media_group_id: media_group_id,
          p_analyzed_content: analyzedContent,
          p_processing_completed_at: new Date().toISOString(),
          p_correlation_id: correlation_id
        });

      if (syncError) {
        console.error('Error syncing media group:', syncError);
        // Log error but don't throw - we still want to return the analysis
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        analyzed_content: analyzedContent,
        correlation_id,
        is_original_caption: true
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error processing request:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        correlation_id: req.json?.correlation_id
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});