import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SyncRequest {
  message_id: string;
  media_group_id: string;
  caption: string;
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

    const { message_id, media_group_id, caption } = await req.json() as SyncRequest;
    console.log(`Processing caption sync for message ${message_id} in group ${media_group_id}`);

    // Create synced caption JSON
    const syncedCaption = {
      caption,
      synced_at: new Date().toISOString(),
      source_message_id: message_id
    };

    // Update the source message
    const { error: sourceError } = await supabase
      .from('messages')
      .update({
        is_original_caption: true,
        group_caption_synced: true,
        synced_caption: syncedCaption
      })
      .eq('id', message_id);

    if (sourceError) {
      throw sourceError;
    }

    // Update all other messages in the group
    const { error: groupError } = await supabase
      .from('messages')
      .update({
        is_original_caption: false,
        group_caption_synced: true,
        synced_caption: syncedCaption
      })
      .eq('media_group_id', media_group_id)
      .neq('id', message_id);

    if (groupError) {
      throw groupError;
    }

    // Trigger caption parsing with AI fallback
    const parseResponse = await fetch(
      `${Deno.env.get('SUPABASE_URL')}/functions/v1/parse-caption-with-ai`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message_id,
          caption
        })
      }
    );

    if (!parseResponse.ok) {
      console.error('Error triggering caption parsing:', await parseResponse.text());
    }

    return new Response(
      JSON.stringify({ success: true }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error syncing caption:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});