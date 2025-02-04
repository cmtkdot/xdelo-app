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

    // Update the source message
    const { error: updateError } = await supabase
      .from('messages')
      .update({
        analyzed_content: parseResult.analyzed_content,
        processing_completed_at: new Date().toISOString(),
        processing_correlation_id: correlation_id || crypto.randomUUID(),
        processing_status: 'completed',
        processing_attempts: 1,
        last_processed_at: new Date().toISOString()
      })
      .eq('id', message_id);

    if (updateError) {
      console.error('Error updating message:', updateError);
      throw updateError;
    }

    console.log('Message updated successfully');

    // If this is part of a media group, update all related messages
    if (media_group_id) {
      console.log('Updating media group messages:', media_group_id);
      
      const { error: groupError } = await supabase
        .from('messages')
        .update({
          analyzed_content: parseResult.analyzed_content,
          processing_completed_at: new Date().toISOString(),
          processing_correlation_id: correlation_id || crypto.randomUUID(),
          processing_status: 'completed',
          last_processed_at: new Date().toISOString()
        })
        .eq('media_group_id', media_group_id)
        .neq('id', message_id); // Don't update the source message again

      if (groupError) {
        console.error('Error updating media group:', groupError);
        throw groupError;
      }

      console.log('Media group updated successfully');
    }

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