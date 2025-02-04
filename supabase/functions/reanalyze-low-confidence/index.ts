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
    const { message_id, media_group_id, caption, correlation_id = crypto.randomUUID() } = await req.json();
    
    console.log('Reanalyzing content:', { message_id, media_group_id, correlation_id });

    if (!message_id) {
      throw new Error('message_id is required');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase credentials');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get the message to reanalyze
    const { data: message, error: fetchError } = await supabase
      .from('messages')
      .select('*')
      .eq('id', message_id)
      .maybeSingle();

    if (fetchError) {
      console.error('Error fetching message:', fetchError);
      throw fetchError;
    }

    if (!message) {
      throw new Error('Message not found');
    }

    // Call the parse-caption-with-ai function
    const response = await fetch(`${supabaseUrl}/functions/v1/parse-caption-with-ai`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message_id,
        media_group_id,
        caption: caption || message.caption,
        correlation_id
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to parse caption: ${errorText}`);
    }

    const result = await response.json();

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Reanalysis completed successfully',
        result,
        correlation_id
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in reanalyze-low-confidence function:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message,
        correlation_id: crypto.randomUUID()
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});