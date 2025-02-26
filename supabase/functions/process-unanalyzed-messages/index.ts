import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    console.log('Starting unanalyzed messages check...');

    // Find messages that need analysis
    const { data: messages, error: fetchError } = await supabase
      .from('messages')
      .select('*')
      .is('analyzed_content', null)
      .eq('is_original_caption', true)
      .eq('group_caption_synced', false)
      .limit(10); // Process in batches

    if (fetchError) {
      throw fetchError;
    }

    console.log(`Found ${messages?.length || 0} messages to process`);

    const results = [];
    for (const message of messages || []) {
      if (!message.caption) {
        console.log(`Skipping message ${message.id} - no caption`);
        continue;
      }

      try {
        // Trigger analysis for each message
        const response = await fetch(
          `${supabaseUrl}/functions/v1/parse-caption-with-ai`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${supabaseKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              message_id: message.id,
              media_group_id: message.media_group_id,
              caption: message.caption,
            }),
          }
        );

        if (!response.ok) {
          throw new Error(`Analysis failed for message ${message.id}: ${response.statusText}`);
        }

        const result = await response.json();
        results.push({
          message_id: message.id,
          status: 'success',
          analyzed_content: result.analyzed_content,
        });

        console.log(`Successfully processed message ${message.id}`);
      } catch (error) {
        console.error(`Error processing message ${message.id}:`, error);
        results.push({
          message_id: message.id,
          status: 'error',
          error: error.message,
        });

        // Log the error in the audit log
        await supabase
          .from('analysis_audit_log')
          .insert({
            message_id: message.id,
            media_group_id: message.media_group_id,
            event_type: 'REANALYSIS_ERROR',
            error_message: error.message,
            processing_details: {
              error_time: new Date().toISOString(),
              retry_source: 'cron-reanalysis',
            },
          });
      }
    }

    return new Response(
      JSON.stringify({
        processed: results.length,
        results,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in process-unanalyzed-messages:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});