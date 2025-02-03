import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { aiParse } from "./aiParser.ts";
import { manualParse } from "./manualParser.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  let messageId: string;
  let mediaGroupId: string | null;
  let caption: string;

  try {
    const requestData = await req.json();
    messageId = requestData.message_id;
    mediaGroupId = requestData.media_group_id;
    caption = requestData.caption;

    if (!messageId || !caption) {
      throw new Error('message_id and caption are required');
    }

    console.log('Processing caption:', { messageId, mediaGroupId, caption });

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase credentials');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Update message to processing state
    const { error: updateError } = await supabase
      .from('messages')
      .update({ 
        processing_state: 'processing',
        processing_started_at: new Date().toISOString()
      })
      .eq('id', messageId);

    if (updateError) {
      throw new Error(`Failed to update message state: ${updateError.message}`);
    }

    // First try manual parsing
    let parsedContent = await manualParse(caption);
    let confidence = parsedContent.parsing_metadata?.confidence || 0;

    // If manual parsing has low confidence, try AI parsing
    if (confidence < 0.7) {
      console.log('Manual parsing had low confidence, attempting AI parsing');
      try {
        const aiResult = await aiParse(caption);
        if (aiResult.parsing_metadata?.confidence && aiResult.parsing_metadata.confidence > confidence) {
          parsedContent = aiResult;
          confidence = aiResult.parsing_metadata.confidence;
        }
      } catch (aiError) {
        console.error('AI parsing failed:', aiError);
        // Continue with manual parsing results if AI fails
      }
    }

    // Update the message with the analyzed content
    const { error: contentUpdateError } = await supabase.rpc(
      'process_media_group_analysis',
      {
        p_message_id: messageId,
        p_media_group_id: mediaGroupId,
        p_analyzed_content: parsedContent,
        p_processing_completed_at: new Date().toISOString(),
        p_correlation_id: crypto.randomUUID()
      }
    );

    if (contentUpdateError) {
      throw contentUpdateError;
    }

    return new Response(
      JSON.stringify({
        message: 'Caption analyzed successfully',
        analyzed_content: parsedContent
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error processing caption:', error);
    
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL');
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      
      if (supabaseUrl && supabaseKey && messageId) {
        const supabase = createClient(supabaseUrl, supabaseKey);
        
        // Update message error state
        await supabase
          .from('messages')
          .update({ 
            processing_state: 'error',
            error_message: error.message,
            processing_completed_at: new Date().toISOString()
          })
          .eq('id', messageId);
      }
    } catch (updateError) {
      console.error('Failed to update message error state:', updateError);
    }
    
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});