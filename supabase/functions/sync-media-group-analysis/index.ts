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
    const { message_id, media_group_id, correlation_id } = await req.json();
    
    console.log('Starting media group sync:', { message_id, media_group_id, correlation_id });

    if (!message_id || !media_group_id) {
      throw new Error('message_id and media_group_id are required');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase credentials');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get the source message's analyzed content
    const { data: sourceMessage, error: fetchError } = await supabase
      .from('messages')
      .select('analyzed_content')
      .eq('id', message_id)
      .single();

    if (fetchError) {
      console.error('Error fetching source message:', fetchError);
      throw fetchError;
    }

    if (!sourceMessage?.analyzed_content) {
      throw new Error('Source message has no analyzed content');
    }

    console.log('Found source message:', sourceMessage);

    // Update all messages in the media group with the analyzed content
    const { error: updateError } = await supabase
      .rpc('xdelo_sync_media_group_content', {
        p_source_message_id: message_id,
        p_media_group_id: media_group_id,
        p_correlation_id: correlation_id
      });

    if (updateError) {
      console.error('Error updating media group:', updateError);
      throw updateError;
    }

    console.log('Successfully synced media group');

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Media group synced successfully',
        correlation_id: correlation_id
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