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
    const { message_id, media_group_id, caption, correlation_id } = await req.json();
    
    console.log('Starting reanalysis:', { message_id, media_group_id, correlation_id });

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase credentials');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // First, update all messages in the group to pending state
    if (media_group_id) {
      console.log('Updating media group messages to pending state:', media_group_id);
      const { error: groupUpdateError } = await supabase
        .from('messages')
        .update({
          processing_state: 'pending',
          group_caption_synced: false,
          retry_count: 0,
          error_message: null,
          last_error_at: null
        })
        .eq('media_group_id', media_group_id);

      if (groupUpdateError) {
        console.error('Error updating media group:', groupUpdateError);
        throw groupUpdateError;
      }
    }

    // Call the parse-caption-with-ai function
    console.log('Calling parse-caption-with-ai function');
    const parseResponse = await fetch(`${supabaseUrl}/functions/v1/parse-caption-with-ai`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message_id,
        media_group_id,
        caption,
        correlation_id,
        is_reanalysis: true
      }),
    });

    if (!parseResponse.ok) {
      const errorText = await parseResponse.text();
      console.error('Error from parse-caption-with-ai:', errorText);
      throw new Error(`Failed to parse caption: ${errorText}`);
    }

    const parseResult = await parseResponse.json();
    console.log('Caption parsed successfully:', parseResult);

    // Log reanalysis completion
    await supabase.from('analysis_audit_log').insert({
      message_id,
      media_group_id,
      event_type: 'REANALYSIS_COMPLETED',
      old_state: 'pending',
      new_state: 'completed',
      analyzed_content: parseResult.analyzed_content,
      processing_details: {
        correlation_id,
        reanalysis_timestamp: new Date().toISOString(),
        is_media_group: !!media_group_id
      }
    });

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Reanalysis completed successfully',
        analyzed_content: parseResult.analyzed_content,
        correlation_id
      }),
      { 
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    );

  } catch (error) {
    console.error('Error in reanalyze-low-confidence:', error);
    
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