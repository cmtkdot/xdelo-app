import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message_id, media_group_id, analyzed_content } = await req.json();
    console.log('Starting analyzed content sync:', { message_id, media_group_id });

    if (!message_id || !analyzed_content) {
      throw new Error('Missing required parameters');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // First, update the source message
    const { error: sourceError } = await supabase
      .from('messages')
      .update({
        analyzed_content,
        processing_state: 'analysis_synced',
        processing_completed_at: new Date().toISOString(),
        is_original_caption: true,
        group_caption_synced: true
      })
      .eq('id', message_id);

    if (sourceError) {
      console.error('Error updating source message:', sourceError);
      throw sourceError;
    }

    // If part of a media group, update all related messages
    if (media_group_id) {
      console.log('Syncing media group:', media_group_id);
      
      const { error: groupError } = await supabase
        .from('messages')
        .update({
          analyzed_content,
          processing_state: 'analysis_synced',
          processing_completed_at: new Date().toISOString(),
          is_original_caption: false,
          group_caption_synced: true,
          message_caption_id: message_id
        })
        .eq('media_group_id', media_group_id)
        .neq('id', message_id);

      if (groupError) {
        console.error('Error updating media group:', groupError);
        throw groupError;
      }
    }

    // Log the sync event
    const { error: logError } = await supabase
      .from('analysis_audit_log')
      .insert({
        message_id,
        media_group_id,
        event_type: media_group_id ? 'GROUP_ANALYSIS_SYNCED' : 'SINGLE_ANALYSIS_SYNCED',
        analyzed_content,
        new_state: 'analysis_synced'
      });

    if (logError) {
      console.error('Error creating audit log:', logError);
      throw logError;
    }

    // Mark messages as completed
    const { error: completionError } = await supabase
      .from('messages')
      .update({
        processing_state: 'completed'
      })
      .eq(media_group_id ? 'media_group_id' : 'id', media_group_id || message_id)
      .eq('processing_state', 'analysis_synced');

    if (completionError) {
      console.error('Error marking messages as completed:', completionError);
      throw completionError;
    }

    console.log('Successfully synced analyzed content');
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Analyzed content synced successfully'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in sync-analyzed-content:', error);
    return new Response(
      JSON.stringify({
        error: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});