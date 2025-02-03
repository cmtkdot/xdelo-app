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
    const { message_id, caption, media_group_id, correlation_id = crypto.randomUUID() } = await req.json();
    
    if (!message_id || !caption) {
      throw new Error('message_id and caption are required');
    }

    console.log('Reanalyzing message:', { message_id, caption, correlation_id, media_group_id });

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // First, get the message to check its current state
    const { data: message, error: messageError } = await supabase
      .from('messages')
      .select('*')
      .eq('id', message_id)
      .single();

    if (messageError) {
      throw messageError;
    }

    // Update message to pending state
    await supabase
      .from('messages')
      .update({
        processing_state: 'pending',
        group_caption_synced: false,
        retry_count: (message.retry_count || 0) + 1
      })
      .eq('id', message_id);

    // Log reanalysis attempt
    await supabase
      .from('analysis_audit_log')
      .insert({
        message_id,
        media_group_id: message.media_group_id,
        event_type: 'REANALYSIS_STARTED',
        old_state: message.processing_state,
        new_state: 'pending',
        processing_details: {
          correlation_id,
          retry_count: message.retry_count,
          start_time: new Date().toISOString(),
          group_message_count: message.group_message_count,
          is_original_caption: message.is_original_caption
        }
      });

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
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `Extract product information from captions and return a JSON object with these exact fields:
- notes (string, optional)
- quantity (number, optional)
- vendor_uid (string, optional)
- product_code (string, optional)
- product_name (string, required)
- purchase_date (string in YYYY-MM-DD format, optional)
- parsing_metadata (object with method and confidence)

Example output format:
{
  "notes": "30 behind",
  "quantity": 2,
  "vendor_uid": "FISH",
  "product_code": "FISH012225",
  "product_name": "Blue Nerds",
  "purchase_date": "2025-01-22",
  "parsing_metadata": {
    "method": "ai",
    "confidence": 0.9
  }
}`
          },
          { role: 'user', content: caption }
        ],
        temperature: 0.3,
        max_tokens: 500
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const data = await response.json();
    const aiResponse = data.choices[0].message.content;
    console.log('Raw AI response:', aiResponse);
    
    let newAnalyzedContent;
    try {
      newAnalyzedContent = JSON.parse(aiResponse);
      // Ensure the parsing_metadata has the correct structure
      newAnalyzedContent.parsing_metadata = {
        method: 'ai',
        confidence: 0.9,
        reanalysis_attempted: true,
        timestamp: new Date().toISOString()
      };

      // Validate required fields
      if (!newAnalyzedContent.product_name) {
        throw new Error('Product name is required');
      }

      // Convert quantity to number if present
      if (newAnalyzedContent.quantity) {
        newAnalyzedContent.quantity = Number(newAnalyzedContent.quantity);
      }

    } catch (parseError) {
      console.error('Error parsing AI response:', parseError);
      throw new Error('Failed to parse AI response');
    }

    console.log('New analyzed content:', newAnalyzedContent);

    // Call the process_media_group_analysis function with correlation_id
    const { error: syncError } = await supabase.rpc('process_media_group_analysis', {
      p_message_id: message_id,
      p_media_group_id: media_group_id,
      p_analyzed_content: newAnalyzedContent,
      p_processing_completed_at: new Date().toISOString(),
      p_correlation_id: correlation_id
    });

    if (syncError) {
      throw syncError;
    }

    // Log successful reanalysis
    await supabase
      .from('analysis_audit_log')
      .insert({
        message_id,
        media_group_id,
        event_type: 'REANALYSIS_COMPLETED',
        old_state: 'pending',
        new_state: 'completed',
        analyzed_content: newAnalyzedContent,
        processing_details: {
          correlation_id,
          completion_time: new Date().toISOString(),
          retry_count: message.retry_count,
          group_message_count: message.group_message_count,
          is_original_caption: message.is_original_caption
        }
      });

    return new Response(
      JSON.stringify({ 
        message: 'Reanalysis completed', 
        analyzed_content: newAnalyzedContent,
        correlation_id 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in reanalyze-low-confidence function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});