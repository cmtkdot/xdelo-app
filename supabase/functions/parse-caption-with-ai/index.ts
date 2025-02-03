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
    console.log('Processing caption analysis for message:', { message_id, media_group_id, caption });

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
      event_type: 'ANALYSIS_STARTED',
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

    // If this is part of a media group, ensure we're working with the right message
    if (media_group_id) {
      console.log('Checking media group for original caption:', media_group_id);
      
      const { data: groupMessages, error: groupError } = await supabase
        .from('messages')
        .select('*')
        .eq('media_group_id', media_group_id)
        .order('created_at', { ascending: true });

      if (groupError) throw groupError;

      // Prioritize JPEG images with captions
      const originalMessage = groupMessages.find(msg => 
        msg.mime_type === 'image/jpeg' && msg.caption
      ) || groupMessages[0];

      if (originalMessage && originalMessage.id !== message_id) {
        console.log('Found better message for analysis:', originalMessage.id);
        message_id = originalMessage.id;
      }
    }

    // Analyze caption
    const analyzedContent = await analyzeCaption(caption);
    console.log('Analysis completed:', analyzedContent);

    // Add metadata about the analysis
    analyzedContent.parsing_metadata = {
      ...analyzedContent.parsing_metadata,
      analysis_timestamp: new Date().toISOString(),
      caption_source: media_group_id ? 'media_group' : 'single_message',
      force_reanalysis: force_reanalysis || false
    };

    // If this is part of a media group, process the entire group
    if (media_group_id) {
      console.log('Processing media group:', media_group_id);
      
      // Log group analysis start
      await supabase.from('analysis_audit_log').insert({
        message_id,
        media_group_id,
        event_type: 'GROUP_ANALYSIS_STARTED',
        old_state: 'processing',
        new_state: 'syncing',
        analyzed_content: analyzedContent
      });

      const { error: groupError } = await supabase.rpc('process_media_group_analysis', {
        p_message_id: message_id,
        p_media_group_id: media_group_id,
        p_analyzed_content: analyzedContent,
        p_processing_completed_at: new Date().toISOString()
      });

      if (groupError) {
        throw groupError;
      }

      // Log group analysis completion
      await supabase.from('analysis_audit_log').insert({
        message_id,
        media_group_id,
        event_type: 'GROUP_ANALYSIS_COMPLETED',
        old_state: 'syncing',
        new_state: 'completed',
        analyzed_content: analyzedContent
      });

    } else {
      // Update single message
      const { error: updateError } = await supabase
        .from('messages')
        .update({
          analyzed_content: analyzedContent,
          processing_state: 'completed',
          processing_completed_at: new Date().toISOString(),
          group_caption_synced: true,
          is_original_caption: true
        })
        .eq('id', message_id);

      if (updateError) {
        throw updateError;
      }

      // Log single message completion
      await supabase.from('analysis_audit_log').insert({
        message_id,
        event_type: 'ANALYSIS_COMPLETED',
        old_state: 'processing',
        new_state: 'completed',
        analyzed_content: analyzedContent
      });
    }

    return new Response(
      JSON.stringify({ message: 'Caption analyzed successfully', analyzed_content: analyzedContent }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error processing caption:', error);
    
    // Update message state to error
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    try {
      const messageData = await req.json();
      
      // Log error in audit log
      await supabase.from('analysis_audit_log').insert({
        message_id: messageData.message_id,
        media_group_id: messageData.media_group_id,
        event_type: 'ANALYSIS_ERROR',
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
      console.error('Failed to update message error state:', updateError);
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