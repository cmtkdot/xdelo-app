import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log('Received AI analysis trigger request');
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message_id, media_group_id, caption } = await req.json();
    console.log('Triggering AI analysis for message:', {
      message_id,
      media_group_id,
      has_caption: !!caption,
      timestamp: new Date().toISOString()
    });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Update state to analyzing
    const { error: updateError } = await supabase
      .from('messages')
      .update({
        processing_state: 'analyzing',
        processing_started_at: new Date().toISOString()
      })
      .eq('id', message_id);

    if (updateError) {
      throw updateError;
    }

    // Trigger the parse-caption-with-ai function
    const { data, error } = await supabase.functions.invoke('parse-caption-with-ai', {
      body: { message_id, media_group_id, caption }
    });

    if (error) {
      console.error('Error invoking parse-caption-with-ai:', error);
      throw error;
    }

    console.log('Successfully triggered AI analysis:', data);

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'AI analysis triggered successfully',
        data
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in trigger-ai-analysis:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: 'Failed to trigger AI analysis',
        timestamp: new Date().toISOString()
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});