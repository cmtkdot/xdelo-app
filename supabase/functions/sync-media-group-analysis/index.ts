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
    const { message_id, media_group_id, caption } = await req.json();
    console.log('Syncing media group analysis:', { message_id, media_group_id, caption });

    // Validate required fields
    if (!message_id) {
      throw new Error('message_id is required');
    }

    if (!caption && !media_group_id) {
      throw new Error('Either caption or media_group_id must be provided');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase credentials');
    }

    // Ensure the URL is properly formatted
    const supabaseUrlObj = new URL(supabaseUrl);
    const supabase = createClient(supabaseUrlObj.toString(), supabaseKey);

    // Get the source message with all relevant fields
    const { data: sourceMessage, error: sourceError } = await supabase
      .from('messages')
      .select(`
        id,
        media_group_id,
        analyzed_content,
        processing_state,
        is_original_caption,
        group_caption_synced,
        group_message_count,
        caption
      `)
      .eq('id', message_id)
      .maybeSingle();

    if (sourceError) {
      console.error('Error fetching source message:', sourceError);
      throw new Error('Failed to fetch source message');
    }

    if (!sourceMessage) {
      throw new Error('Source message not found');
    }

    // Log sync attempt in audit log
    const { error: auditError } = await supabase
      .from('analysis_audit_log')
      .insert({
        message_id: sourceMessage.id,
        media_group_id: sourceMessage.media_group_id,
        event_type: 'SYNC_ATTEMPT',
        old_state: sourceMessage.processing_state,
        analyzed_content: sourceMessage.analyzed_content,
        processing_details: {
          sync_timestamp: new Date().toISOString(),
          has_caption: !!sourceMessage.caption,
          is_original_caption: sourceMessage.is_original_caption,
          group_message_count: sourceMessage.group_message_count
        }
      });

    if (auditError) {
      console.error('Error logging sync attempt:', auditError);
      // Continue with sync despite audit log error
    }

    // Process the media group
    const { error: syncError } = await supabase.rpc('process_media_group_analysis', {
      p_message_id: message_id,
      p_media_group_id: media_group_id,
      p_analyzed_content: sourceMessage.analyzed_content,
      p_processing_completed_at: new Date().toISOString()
    });

    if (syncError) {
      // Log sync failure
      await supabase
        .from('analysis_audit_log')
        .insert({
          message_id: sourceMessage.id,
          media_group_id: sourceMessage.media_group_id,
          event_type: 'SYNC_FAILED',
          old_state: sourceMessage.processing_state,
          error_message: syncError.message,
          processing_details: {
            error_timestamp: new Date().toISOString(),
            error_details: syncError.message
          }
        });

      throw syncError;
    }

    // Log successful sync
    await supabase
      .from('analysis_audit_log')
      .insert({
        message_id: sourceMessage.id,
        media_group_id: sourceMessage.media_group_id,
        event_type: 'SYNC_COMPLETED',
        old_state: sourceMessage.processing_state,
        new_state: 'completed',
        analyzed_content: sourceMessage.analyzed_content,
        processing_details: {
          completion_timestamp: new Date().toISOString(),
          group_message_count: sourceMessage.group_message_count,
          is_original_caption: sourceMessage.is_original_caption
        }
      });

    return new Response(
      JSON.stringify({ 
        message: 'Media group analysis synced successfully',
        details: {
          message_id: sourceMessage.id,
          media_group_id: sourceMessage.media_group_id,
          sync_timestamp: new Date().toISOString()
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error syncing media group:', error);
    
    return new Response(
      JSON.stringify({ 
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      }
    );
  }
});