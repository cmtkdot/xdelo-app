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
  if (!mediaGroupId) return;

  try {
    const response = await supabase.functions.invoke('sync-media-group-analysis', {
      body: {
        message_id: messageId,
        media_group_id: mediaGroupId,
        analyzed_content: analyzedContent,
        processing_completed_at: new Date().toISOString()
      }
    });

    if (!response.data) {
      throw new Error('Failed to sync media group analysis');
    }

    console.log('Successfully synced media group analysis:', response.data);
  } catch (error) {
    console.error('Error syncing media group analysis:', error);
    throw error;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message_id, media_group_id, caption } = await req.json();
    console.log(`Processing caption parsing for message ${message_id}`);

    if (!caption) {
      throw new Error('No caption provided for parsing');
    }

    const manualResult = manualParse(caption);
    console.log('Manual parsing result:', manualResult);

    let finalResult = manualResult;

    if (!validateParsedContent(manualResult)) {
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
      }
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // First update the source message
    const { error: updateError } = await supabase
      .from('messages')
      .update({
        parsed_content: finalResult,
        analyzed_content: finalResult,
        processing_state: media_group_id ? 'analysis_synced' : 'completed'
      })
      .eq('id', message_id);

    if (updateError) throw updateError;

    // If this is part of a media group, sync the analysis
    if (media_group_id) {
      await syncMediaGroupAnalysis(supabase, message_id, media_group_id, finalResult);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        parsed_content: finalResult 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error parsing caption:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: 'Failed to parse caption or update message'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});