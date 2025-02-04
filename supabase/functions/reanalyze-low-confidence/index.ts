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

    // Get the message to reanalyze if no caption provided
    let captionToAnalyze = caption;
    if (!captionToAnalyze) {
      const { data: message, error: fetchError } = await supabase
        .from('messages')
        .select('caption')
        .eq('id', message_id)
        .single();

      if (fetchError) {
        console.error('Error fetching message:', fetchError);
        throw fetchError;
      }

      if (!message) {
        throw new Error('Message not found');
      }

      captionToAnalyze = message.caption;
    }

    // Call the parse-caption-with-ai function
    const parseResponse = await fetch(`${supabaseUrl}/functions/v1/parse-caption-with-ai`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message_id,
        media_group_id,
        caption: captionToAnalyze,
        correlation_id
      }),
    });

    if (!parseResponse.ok) {
      const errorText = await parseResponse.text();
      console.error('Error from parse-caption-with-ai:', errorText);
      throw new Error(`Failed to parse caption: ${errorText}`);
    }

    const parseResult = await parseResponse.json();
    console.log('Caption parsed successfully:', parseResult);

    if (!parseResult.analyzed_content) {
      throw new Error('No analyzed content returned from parser');
    }

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
        success: true,
        message: 'Reanalysis completed successfully',
        analyzed_content: parseResult.analyzed_content,
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