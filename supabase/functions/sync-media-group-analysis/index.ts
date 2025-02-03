import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SyncRequest {
  message_id: string;
  media_group_id: string;
  correlation_id?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { message_id, media_group_id, correlation_id } = await req.json() as SyncRequest;
    console.log(`Processing media group analysis for message ${message_id} in group ${media_group_id}`);

    // Get the message with caption and its analysis
    const { data: message, error: messageError } = await supabase
      .from('messages')
      .select('*')
      .eq('id', message_id)
      .single();

    if (messageError) throw messageError;
    
    if (!message?.analyzed_content && !message?.fresh_analysis) {
      throw new Error('Message has no analysis to sync');
    }

    // Use fresh_analysis if available, otherwise use analyzed_content
    const analysisToSync = message.fresh_analysis || message.analyzed_content;
    const processing_completed_at = new Date().toISOString();

    // First update the source message
    const { error: updateError } = await supabase
      .from('messages')
      .update({
        analyzed_content: analysisToSync,
        fresh_analysis: analysisToSync,
        processing_state: 'analysis_synced',
        processing_completed_at: processing_completed_at,
        is_original_caption: true,
        group_caption_synced: true
      })
      .eq('id', message_id);

    if (updateError) throw updateError;

    // Then update all other messages in the group
    const { error: groupUpdateError } = await supabase
      .from('messages')
      .update({
        analyzed_content: analysisToSync,
        fresh_analysis: analysisToSync,
        processing_state: 'analysis_synced',
        processing_completed_at: processing_completed_at,
        is_original_caption: false,
        group_caption_synced: true,
        message_caption_id: message_id
      })
      .eq('media_group_id', media_group_id)
      .neq('id', message_id);

    if (groupUpdateError) throw groupUpdateError;

    // Check if all messages in the group are synced
    const { data: unsynced, error: checkError } = await supabase
      .from('messages')
      .select('id')
      .eq('media_group_id', media_group_id)
      .or('processing_state.neq.analysis_synced,group_caption_synced.eq.false');

    if (checkError) throw checkError;

    // If all messages are synced, mark the entire group as completed
    if (!unsynced || unsynced.length === 0) {
      const { error: completeError } = await supabase
        .from('messages')
        .update({
          processing_state: 'completed'
        })
        .eq('media_group_id', media_group_id);

      if (completeError) throw completeError;
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        analyzed_content: analysisToSync,
        message: 'Media group analysis synced successfully'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error processing media group:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: 'Failed to sync media group analysis'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});