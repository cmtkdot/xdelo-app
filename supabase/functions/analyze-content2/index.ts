import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AnalyzedContent {
  product_name?: string;
  product_code?: string;
  vendor_uid?: string;
  purchase_date?: string;
  quantity?: number;
  notes?: string;
}

serve(async (req) => {
  const startTime = Date.now();
  const correlationId = crypto.randomUUID();

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message_id, media_group_id } = await req.json();
    console.log(`[${correlationId}] Starting analysis for message ${message_id}, group ${media_group_id || 'none'}`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Fetch message details
    const { data: message, error: messageError } = await supabase
      .from('messages')
      .select('*')
      .eq('id', message_id)
      .single();

    if (messageError) {
      throw messageError;
    }

    if (!message) {
      throw new Error(`Message not found: ${message_id}`);
    }

    console.log(`[${correlationId}] Processing caption: ${message.caption}`);

    // Analyze caption using OpenAI
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a specialized product information extractor. Extract the following from the caption:
              - product_name: Text before '#' (required)
              - product_code: Full code after '#'
              - vendor_uid: 1-4 letters after '#' before any numbers
              - purchase_date: Convert date format (mmDDyy or mDDyy to YYYY-MM-DD)
              - quantity: Number after 'x'
              - notes: Additional info in parentheses
              
              Respond with ONLY a JSON object containing these fields.`
          },
          { role: 'user', content: message.caption || '' }
        ],
        temperature: 0.3,
        max_tokens: 500
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const data = await response.json();
    const analyzedContent: AnalyzedContent = JSON.parse(data.choices[0].message.content);
    console.log(`[${correlationId}] Analyzed content:`, analyzedContent);

    // Update message with analyzed content
    const { error: updateError } = await supabase
      .from('messages')
      .update({
        analyzed_content: analyzedContent,
        processing_state: media_group_id ? 'analysis_synced' : 'completed',
        processing_completed_at: new Date().toISOString(),
      })
      .eq('id', message_id);

    if (updateError) {
      throw updateError;
    }

    // If part of a media group, sync the content
    if (media_group_id) {
      console.log(`[${correlationId}] Syncing media group ${media_group_id}`);
      
      const { error: groupUpdateError } = await supabase
        .rpc('process_media_group_analysis', {
          p_message_id: message_id,
          p_media_group_id: media_group_id,
          p_analyzed_content: analyzedContent,
          p_processing_completed_at: new Date().toISOString(),
          p_correlation_id: correlationId
        });

      if (groupUpdateError) {
        throw groupUpdateError;
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[${correlationId}] Analysis completed in ${duration}ms`);

    return new Response(
      JSON.stringify({
        success: true,
        analyzed_content: analyzedContent,
        processing_time_ms: duration,
        correlation_id: correlationId,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in analyze-content function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});