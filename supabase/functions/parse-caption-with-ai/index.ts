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
    const { message_id, media_group_id, caption, force_reanalysis } = await req.json();
    console.log('Starting AI caption analysis for message:', { message_id, media_group_id, caption });

    if (!message_id || !caption) {
      throw new Error('Missing required parameters');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase credentials');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Log analysis start
    await supabase.from('analysis_audit_log').insert({
      message_id,
      media_group_id,
      event_type: 'AI_ANALYSIS_STARTED',
      old_state: force_reanalysis ? 'reanalyzing' : 'initialized',
      new_state: 'processing'
    });

    // Update message state to processing
    await supabase
      .from('messages')
      .update({ 
        processing_state: 'processing',
        processing_started_at: new Date().toISOString()
      })
      .eq('id', message_id);

    // If this is part of a media group, find the best message to analyze
    let originalMessageId = message_id;
    let bestCaption = caption;
    
    if (media_group_id) {
      console.log('Checking media group for best caption:', media_group_id);
      
      const { data: groupMessages, error: groupError } = await supabase
        .from('messages')
        .select('*')
        .eq('media_group_id', media_group_id)
        .order('created_at', { ascending: true });

      if (groupError) throw groupError;

      // First, look for JPEG images with captions
      const jpegWithCaption = groupMessages.find(msg => 
        msg.mime_type === 'image/jpeg' && 
        msg.caption && 
        msg.caption.trim() !== ''
      );

      // If no JPEG with caption, use the first message with a caption
      const firstWithCaption = groupMessages.find(msg => 
        msg.caption && 
        msg.caption.trim() !== ''
      );

      const bestMessage = jpegWithCaption || firstWithCaption || groupMessages[0];

      if (bestMessage && bestMessage.id !== message_id) {
        console.log('Found better message for analysis:', bestMessage.id);
        originalMessageId = bestMessage.id;
        bestCaption = bestMessage.caption || caption;
      }
    }

    // Analyze caption
    console.log('Starting AI analysis with caption:', bestCaption);
    const analyzedContent = await analyzeCaption(bestCaption);
    console.log('AI analysis completed:', analyzedContent);

    // Add metadata about the analysis
    analyzedContent.parsing_metadata = {
      method: 'ai',
      confidence: analyzedContent.parsing_metadata?.confidence || 0.8,
      analysis_timestamp: new Date().toISOString(),
      caption_source: media_group_id ? 'media_group' : 'single_message',
      force_reanalysis: force_reanalysis || false
    };

    // First, update the original message with the analysis
    const { error: updateError } = await supabase
      .from('messages')
      .update({
        analyzed_content: analyzedContent,
        processing_state: 'completed',
        processing_completed_at: new Date().toISOString(),
        is_original_caption: true,
        group_caption_synced: true
      })
      .eq('id', originalMessageId);

    if (updateError) {
      throw updateError;
    }

    // Log successful analysis
    await supabase.from('analysis_audit_log').insert({
      message_id: originalMessageId,
      media_group_id,
      event_type: 'AI_ANALYSIS_COMPLETED',
      old_state: 'processing',
      new_state: 'completed',
      analyzed_content: analyzedContent
    });

    // If this is part of a media group, process the entire group
    if (media_group_id) {
      console.log('Starting media group sync:', media_group_id);
      
      // Log group sync start
      await supabase.from('analysis_audit_log').insert({
        message_id: originalMessageId,
        media_group_id,
        event_type: 'GROUP_SYNC_STARTED',
        old_state: 'completed',
        new_state: 'syncing'
      });

      // Update all other messages in the group
      const { error: groupError } = await supabase
        .from('messages')
        .update({
          analyzed_content: analyzedContent,
          processing_state: 'completed',
          processing_completed_at: new Date().toISOString(),
          is_original_caption: false,
          group_caption_synced: true,
          message_caption_id: originalMessageId
        })
        .eq('media_group_id', media_group_id)
        .neq('id', originalMessageId);

      if (groupError) {
        throw groupError;
      }

      // Log group sync completion
      await supabase.from('analysis_audit_log').insert({
        message_id: originalMessageId,
        media_group_id,
        event_type: 'GROUP_SYNC_COMPLETED',
        old_state: 'syncing',
        new_state: 'completed',
        analyzed_content: analyzedContent
      });
    }

    return new Response(
      JSON.stringify({ 
        message: 'Caption analyzed and synced successfully', 
        analyzed_content: analyzedContent 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in AI caption analysis:', error);
    
    try {
      const messageData = await req.json();
      const supabaseUrl = Deno.env.get('SUPABASE_URL');
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      const supabase = createClient(supabaseUrl, supabaseKey);
      
      // Log error
      await supabase.from('analysis_audit_log').insert({
        message_id: messageData.message_id,
        media_group_id: messageData.media_group_id,
        event_type: 'AI_ANALYSIS_ERROR',
        old_state: 'processing',
        new_state: 'error',
        processing_details: {
          error_message: error.message,
          error_timestamp: new Date().toISOString()
        }
      });

      // Update message status
      await supabase
        .from('messages')
        .update({ 
          processing_state: 'error',
          error_message: error.message,
          last_error_at: new Date().toISOString()
        })
        .eq('id', messageData.message_id);
    } catch (updateError) {
      console.error('Failed to update error state:', updateError);
    }
    
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});