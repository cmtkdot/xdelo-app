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

    // Step 1: Parse the caption
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

    // Step 2: Update the message with parsed content
    console.log('Updating message with parsed content');
    const { error: updateError } = await supabase
      .from('messages')
      .update({
        analyzed_content: finalResult,
        processing_state: 'analysis_synced',
        processing_completed_at: new Date().toISOString()
      })
      .eq('id', message_id);

    if (updateError) {
      console.error('Error updating message:', updateError);
      throw updateError;
    }

    // Step 3: If part of a media group, sync to other messages
    if (media_group_id) {
      console.log(`Syncing analysis to media group ${media_group_id}`);
      
      const { error: groupUpdateError } = await supabase
        .from('messages')
        .update({
          analyzed_content: finalResult,
          processing_state: 'analysis_synced',
          processing_completed_at: new Date().toISOString(),
          message_caption_id: message_id,
          group_caption_synced: true
        })
        .eq('media_group_id', media_group_id)
        .neq('id', message_id);

      if (groupUpdateError) {
        console.error('Error updating media group:', groupUpdateError);
        throw groupUpdateError;
      }
    }

    // Step 4: Mark processing as completed
    console.log('Marking processing as completed');
    const { error: completeError } = await supabase
      .from('messages')
      .update({
        processing_state: 'completed'
      })
      .eq('id', message_id);

    if (completeError) {
      console.error('Error completing message:', completeError);
      throw completeError;
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