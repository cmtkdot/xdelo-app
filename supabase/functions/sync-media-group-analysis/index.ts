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
    const { message_id, media_group_id } = await req.json();
    console.log('Syncing media group analysis:', { message_id, media_group_id });

    if (!message_id || !media_group_id) {
      throw new Error('Missing required parameters');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase credentials');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get the analyzed content from the source message
    const { data: sourceMessage, error: sourceError } = await supabase
      .from('messages')
      .select('analyzed_content')
      .eq('id', message_id)
      .single();

    if (sourceError || !sourceMessage) {
      throw new Error('Failed to fetch source message');
    }

    // Process the media group
    const { error: syncError } = await supabase.rpc('process_media_group_analysis', {
      p_message_id: message_id,
      p_media_group_id: media_group_id,
      p_analyzed_content: sourceMessage.analyzed_content,
      p_processing_completed_at: new Date().toISOString()
    });

    if (syncError) {
      throw syncError;
    }

    return new Response(
      JSON.stringify({ message: 'Media group analysis synced successfully' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error syncing media group:', error);
    
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});