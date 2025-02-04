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

    // First, call the parse-caption-with-ai function
    const { data: parseResult, error: parseError } = await supabase.functions.invoke('parse-caption-with-ai', {
      body: { message_id, media_group_id, caption }
    });

    if (parseError) {
      console.error('Error parsing caption:', parseError);
      throw parseError;
    }

    console.log('Caption parsed successfully:', parseResult);

    // Now use the process_media_group_content function
    const { error: processError } = await supabase.rpc('process_media_group_content', {
      p_message_id: message_id,
      p_media_group_id: media_group_id,
      p_analyzed_content: parseResult.analyzed_content,
      p_correlation_id: correlation_id
    });

    if (processError) {
      console.error('Error processing media group:', processError);
      throw processError;
    }

    console.log('Media group processed successfully');

    return new Response(
      JSON.stringify({ 
        message: 'Reanalysis completed successfully',
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
    console.error('Error in reanalyze-low-confidence:', error);
    
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