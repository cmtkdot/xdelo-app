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
    console.log('Starting media group sync process');
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { message_id, media_group_id, analyzed_content } = await req.json() as SyncRequest;
    console.log('Processing sync request:', { message_id, media_group_id });

    if (!message_id || !media_group_id) {
      throw new Error('Missing required parameters: message_id and media_group_id are required');
    }

    // Verify the message exists and is part of the specified group
    const { data: sourceMessage, error: messageError } = await supabase
      .from('messages')
      .select('*')
      .eq('id', message_id)
      .eq('media_group_id', media_group_id)
      .single();

    if (messageError || !sourceMessage) {
      console.error('Error fetching source message:', messageError);
      throw new Error(`Source message not found or not part of group: ${message_id}`);
    }

    console.log('Source message verified, proceeding with group sync');

    // Use the process_media_group_analysis function for atomic updates
    const { error: syncError } = await supabase.rpc('process_media_group_analysis', {
      p_message_id: message_id,
      p_media_group_id: media_group_id,
      p_analyzed_content: analyzed_content,
      p_processing_completed_at: new Date().toISOString(),
      p_correlation_id: crypto.randomUUID()
    });

    if (syncError) {
      console.error('Error in process_media_group_analysis:', syncError);
      throw syncError;
    }

    console.log('Media group sync completed successfully');

    // Verify the sync was successful
    const { data: groupMessages, error: verifyError } = await supabase
      .from('messages')
      .select('id, processing_state, group_caption_synced')
      .eq('media_group_id', media_group_id);

    if (verifyError) {
      console.error('Error verifying sync status:', verifyError);
      throw verifyError;
    }

    const allSynced = groupMessages?.every(msg => msg.group_caption_synced);
    const allCompleted = groupMessages?.every(msg => msg.processing_state === 'completed');

    console.log('Sync verification results:', {
      messageCount: groupMessages?.length,
      allSynced,
      allCompleted
    });

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Media group sync completed successfully',
        status: {
          allSynced,
          allCompleted,
          messageCount: groupMessages?.length
        }
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );

  } catch (error) {
    console.error('Error in sync-media-group:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: error.toString()
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});