import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { manualParse } from './manualParser.ts';
import { aiParse } from './aiParser.ts';
import { validateParsedContent } from './validator.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function syncMediaGroupAnalysis(
  supabase: ReturnType<typeof createClient>,
  messageId: string,
  mediaGroupId: string | null,
  analyzedContent: any
) {
  if (!mediaGroupId) {
    console.log('No media group ID provided, skipping sync');
    return;
  }

  if (!analyzedContent) {
    console.log('No analyzed content to sync, skipping');
    return;
  }

  try {
    console.log(`Starting media group analysis sync for message ${messageId} in group ${mediaGroupId}`, {
      analyzed_content: analyzedContent
    });
    
    const { error } = await supabase.rpc('process_media_group_analysis', {
      p_message_id: messageId,
      p_media_group_id: mediaGroupId,
      p_analyzed_content: analyzedContent,
      p_processing_completed_at: new Date().toISOString()
    });

    if (error) {
      console.error('Error in process_media_group_analysis:', error);
      throw error;
    }

    console.log('Successfully synced media group analysis');
  } catch (error) {
    console.error('Error syncing media group analysis:', error);
    throw new Error(`Failed to sync media group analysis: ${error.message}`);
  }
}

serve(async (req) => {
  console.log('Received caption parsing request');
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message_id, media_group_id, caption } = await req.json();
    console.log(`Processing caption parsing for message ${message_id}`, {
      media_group_id,
      caption_length: caption?.length,
      timestamp: new Date().toISOString()
    });

    if (!message_id) {
      throw new Error('No message_id provided');
    }

    if (!caption) {
      throw new Error('No caption provided for parsing');
    }

    // First try manual parsing
    const manualResult = manualParse(caption);
    console.log('Manual parsing result:', manualResult);

    let finalResult = manualResult;
    const isManualComplete = validateParsedContent(manualResult);

    // If manual parsing is incomplete, try AI parsing
    if (!isManualComplete) {
      console.log('Manual parsing incomplete, attempting AI parsing');
      try {
        const aiResult = await aiParse(caption);
        console.log('AI parsing result:', aiResult);
        
        finalResult = {
          ...aiResult,
          ...manualResult, // Manual results take precedence
          parsing_metadata: {
            method: 'hybrid',
            timestamp: new Date().toISOString(),
            sources: ['manual', 'ai']
          }
        };
        console.log('Merged parsing result:', finalResult);
      } catch (aiError) {
        console.error('AI parsing failed:', aiError);
        // Continue with manual results if AI fails
      }
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log(`Updating message ${message_id} with parsed content`);
    
    // First update the source message
    const { error: updateError } = await supabase
      .from('messages')
      .update({
        parsed_content: finalResult,
        analyzed_content: finalResult,
        processing_state: 'analysis_ready'
      })
      .eq('id', message_id);

    if (updateError) {
      console.error('Error updating message:', updateError);
      throw updateError;
    }

    // If this is part of a media group, sync the analysis
    if (media_group_id) {
      await syncMediaGroupAnalysis(supabase, message_id, media_group_id, finalResult);
    } else {
      // For single messages, mark as completed
      const { error: completeError } = await supabase
        .from('messages')
        .update({
          processing_state: 'completed',
          processing_completed_at: new Date().toISOString()
        })
        .eq('id', message_id);

      if (completeError) {
        console.error('Error completing message:', completeError);
        throw completeError;
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        parsed_content: finalResult,
        message: 'Caption parsed and analysis synced successfully'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
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