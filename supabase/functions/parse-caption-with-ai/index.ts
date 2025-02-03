import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { manualParse } from './manualParser.ts';
import { aiParse } from './aiParser.ts';
import { validateParsedContent } from './validator.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log('Received caption parsing request');
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message_id, media_group_id, caption } = await req.json();
    console.log(`Processing caption for message ${message_id}`, {
      media_group_id,
      caption_length: caption?.length,
      timestamp: new Date().toISOString()
    });

    if (!message_id) {
      throw new Error('No message_id provided');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Parse the caption
    console.log('Starting caption parsing');
    const manualResult = manualParse(caption);
    console.log('Manual parsing result:', manualResult);

    let finalResult = manualResult;
    const isManualComplete = validateParsedContent(manualResult);

    if (!isManualComplete) {
      try {
        console.log('Manual parsing incomplete, attempting AI parsing');
        const aiResult = await aiParse(caption);
        console.log('AI parsing result:', aiResult);
        
        finalResult = {
          ...aiResult,
          ...manualResult,
          parsing_metadata: {
            method: 'hybrid',
            timestamp: new Date().toISOString(),
            sources: ['manual', 'ai']
          }
        };
      } catch (aiError) {
        console.error('AI parsing failed:', aiError);
      }
    }

    // Update the message with parsed content
    const { error: updateError } = await supabase
      .from('messages')
      .update({
        analyzed_content: finalResult,
        processing_state: 'analyzing',
        processing_started_at: new Date().toISOString()
      })
      .eq('id', message_id);

    if (updateError) throw updateError;

    // If this is part of a media group, sync the analysis
    if (media_group_id) {
      const syncResponse = await fetch(
        `${Deno.env.get('SUPABASE_URL')}/functions/v1/sync-media-group`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            message_id,
            media_group_id,
            analyzed_content: finalResult
          })
        }
      );

      if (!syncResponse.ok) {
        throw new Error('Failed to sync media group');
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        analyzed_content: finalResult,
        message: 'Caption parsed and analysis synced successfully'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in parse-caption-with-ai:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: 'Failed to parse caption or update message',
        timestamp: new Date().toISOString()
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});