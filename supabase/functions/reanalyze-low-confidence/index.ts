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
    console.log('Reanalyzing content for message:', { message_id, media_group_id });

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase credentials');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get the message to reanalyze
    const { data: message, error: messageError } = await supabase
      .from('messages')
      .select('*')
      .eq('id', message_id)
      .single();

    if (messageError) throw messageError;

    // Log reanalysis start
    await supabase.from('analysis_audit_log').insert({
      message_id,
      media_group_id,
      event_type: 'REANALYSIS_STARTED',
      old_state: message.processing_state,
      new_state: 'processing'
    });

    // Update message state
    await supabase
      .from('messages')
      .update({ 
        processing_state: 'processing',
        processing_started_at: new Date().toISOString()
      })
      .eq('id', message_id);

    // Trigger reanalysis
    const response = await supabase.functions.invoke('parse-caption-with-ai', {
      body: { 
        message_id,
        media_group_id,
        caption: message.caption,
        force_reanalysis: true
      }
    });

    if (response.error) throw response.error;

    return new Response(
      JSON.stringify({ message: 'Content reanalysis triggered successfully' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error triggering reanalysis:', error);
    
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});