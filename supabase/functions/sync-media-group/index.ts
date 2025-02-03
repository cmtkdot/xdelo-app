import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SyncRequest {
  message_id: string;
  media_group_id: string;
  analyzed_content: any;
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

    const { message_id, media_group_id, analyzed_content } = await req.json() as SyncRequest;
    console.log('Processing media group sync:', { message_id, media_group_id });

    // Update the source message
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

    if (sourceError) throw sourceError;

    // Update all other messages in the group
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

    if (groupError) throw groupError;

    // Log the sync event
    const { error: logError } = await supabase
      .from('analysis_audit_log')
      .insert({
        message_id,
        media_group_id,
        event_type: 'GROUP_ANALYSIS_SYNCED',
        analyzed_content
      });

    if (logError) throw logError;

    // Mark completed messages
    const { error: completionError } = await supabase
      .from('messages')
      .update({ processing_state: 'completed' })
      .eq('media_group_id', media_group_id)
      .eq('processing_state', 'analysis_synced');

    if (completionError) throw completionError;

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Media group sync completed successfully'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in sync-media-group:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});