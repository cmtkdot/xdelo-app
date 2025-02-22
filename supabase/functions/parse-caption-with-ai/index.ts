
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { parseManually } from "./utils/manualParser.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messageId, caption, media_group_id, correlationId } = await req.json();
    
    console.log('Starting caption analysis:', {
      messageId, 
      media_group_id,
      caption_length: caption?.length,
      correlation_id: correlationId
    });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Manual parsing attempt
    let analyzedContent;
    const manualResult = await parseManually(caption);
    
    if (manualResult && manualResult.product_code) {
      console.log('Manual parsing successful');
      analyzedContent = {
        ...manualResult,
        parsing_metadata: {
          method: 'manual',
          confidence: 1.0,
          timestamp: new Date().toISOString()
        }
      };
    } else {
      console.log('Manual parsing incomplete, attempting AI analysis...');
      const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
      if (!openAIApiKey) {
        throw new Error('OpenAI API key not configured');
      }

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAIApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4',
          messages: [
            {
              role: 'system',
              content: `Extract product information from captions using this format:
                - product_name (before #)
                - product_code (after #)
                - vendor_uid (letters at start of code)
                - quantity (number after x)
                - purchase_date (if found, in YYYY-MM-DD)
                - notes (additional info)`
            },
            { role: 'user', content: caption }
          ]
        })
      });

      if (!response.ok) throw new Error(`OpenAI API error: ${response.statusText}`);
      
      const aiResult = await response.json();
      const aiAnalysis = JSON.parse(aiResult.choices[0].message.content);
      analyzedContent = {
        ...aiAnalysis,
        parsing_metadata: {
          method: 'ai',
          confidence: 0.7,
          timestamp: new Date().toISOString()
        }
      };
      console.log('AI analysis successful');
    }

    // Update message with analyzed content
    const { error: updateError } = await supabase
      .from('messages')
      .update({
        analyzed_content: analyzedContent,
        processing_state: 'completed',
        processing_completed_at: new Date().toISOString()
      })
      .eq('id', messageId);

    if (updateError) throw updateError;

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in parse-caption-with-ai:', error);
    
    try {
      const { messageId } = await req.json();
      if (messageId) {
        const supabase = createClient(
          Deno.env.get('SUPABASE_URL')!,
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );

        await supabase
          .from('messages')
          .update({
            processing_state: 'error',
            error_message: error.message,
            processing_completed_at: new Date().toISOString(),
            last_error_at: new Date().toISOString()
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
