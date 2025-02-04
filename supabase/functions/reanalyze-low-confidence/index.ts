import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM_PROMPT = `You are a specialized product information extractor. Extract structured information following these rules:

1. Product Name (REQUIRED):
   - Text before '#' or 'x' marker
   - Remove any trailing spaces
   - Example: "Blue Dream x2" -> "Blue Dream"

2. Product Code:
   - Full code after '#' including vendor and date
   - Format: #[vendor_uid][date]
   - Example: "#CHAD120523" -> "CHAD120523"

3. Vendor UID:
   - 1-4 letters after '#' before any numbers
   - Example: "#CHAD120523" -> "CHAD"

4. Purchase Date:
   - Convert date formats:
   - 6 digits (mmDDyy) -> YYYY-MM-DD
   - 5 digits (mDDyy) -> YYYY-MM-DD (add leading zero)
   - Example: "120523" -> "2023-12-05"

5. Quantity:
   - Look for numbers after 'x' or 'qty:'
   - Must be positive integer
   - Common formats: "x2", "x 2", "qty: 2"

6. Notes:
   - Text in parentheses
   - Any additional unstructured text
   - Example: "(indoor grown)" -> "indoor grown"

Return ONLY a JSON object with these fields, no additional text.`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message_id, caption, media_group_id, analyzed_content, correlation_id = crypto.randomUUID() } = await req.json();
    
    if (!message_id || !caption) {
      throw new Error('message_id and caption are required');
    }

    console.log('Starting reanalysis:', { 
      message_id, 
      caption, 
      correlation_id,
      media_group_id 
    });

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: message, error: messageError } = await supabase
      .from('messages')
      .select('*')
      .eq('id', message_id)
      .maybeSingle();

    if (messageError) {
      console.error('Error fetching message:', messageError);
      throw messageError;
    }

    if (!message) {
      console.error('Message not found:', message_id);
      throw new Error(`Message with ID ${message_id} not found`);
    }

    // Updated confidence threshold to 0.5
    const isAutoTriggered = analyzed_content?.parsing_metadata?.confidence < 0.5 && 
                           analyzed_content?.parsing_metadata?.method === 'manual' &&
                           !analyzed_content?.parsing_metadata?.reanalysis_attempted;

    if (!isAutoTriggered && !correlation_id) {
      console.log('Skipping reanalysis - confidence threshold not met:', {
        confidence: analyzed_content?.parsing_metadata?.confidence,
        method: analyzed_content?.parsing_metadata?.method,
        reanalysis_attempted: analyzed_content?.parsing_metadata?.reanalysis_attempted
      });
      return new Response(
        JSON.stringify({ 
          message: 'Reanalysis not needed',
          analyzed_content,
          correlation_id 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    await supabase
      .from('messages')
      .update({
        processing_state: 'pending',
        group_caption_synced: false,
        retry_count: (message.retry_count || 0) + 1
      })
      .eq('id', message_id);

    await supabase
      .from('analysis_audit_log')
      .insert({
        message_id,
        media_group_id: message.media_group_id,
        event_type: isAutoTriggered ? 'AUTO_REANALYSIS_STARTED' : 'MANUAL_REANALYSIS_STARTED',
        old_state: message.processing_state,
        new_state: 'pending',
        processing_details: {
          correlation_id,
          retry_count: message.retry_count,
          start_time: new Date().toISOString(),
          group_message_count: message.group_message_count,
          is_original_caption: message.is_original_caption,
          is_auto_triggered: isAutoTriggered,
          original_confidence: analyzed_content?.parsing_metadata?.confidence
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
          { role: 'system', content: SYSTEM_PROMPT },
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
    console.log('Raw OpenAI response:', data);

    if (!data.choices?.[0]?.message?.content) {
      throw new Error('Invalid OpenAI response format');
    }

    const aiResponse = data.choices[0].message.content;
    console.log('AI response content:', aiResponse);
    
    let newAnalyzedContent;
    try {
      let parsedResponse = JSON.parse(aiResponse);

      if (!parsedResponse.product_name) {
        throw new Error('Parsed response missing required product_name field');
      }
      
      newAnalyzedContent = {
        notes: parsedResponse.notes || "",
        quantity: parsedResponse.quantity ? Number(parsedResponse.quantity) : null,
        vendor_uid: parsedResponse.vendor_uid || "",
        product_code: parsedResponse.product_code || "",
        product_name: parsedResponse.product_name || caption.split(/[#x]/)[0]?.trim() || 'Untitled Product',
        purchase_date: parsedResponse.purchase_date || "",
        parsing_metadata: {
          method: "ai",
          confidence: 0.9,
          reanalysis_attempted: true,
          timestamp: new Date().toISOString(),
          original_confidence: analyzed_content?.parsing_metadata?.confidence,
          is_auto_triggered: isAutoTriggered
        }
      };

      console.log('New analyzed content:', newAnalyzedContent);

    } catch (parseError) {
      console.error('Error parsing AI response:', parseError);
      throw new Error(`Failed to parse AI response: ${parseError.message}`);
    }

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

    await supabase
      .from('analysis_audit_log')
      .insert({
        message_id,
        media_group_id,
        event_type: isAutoTriggered ? 'AUTO_REANALYSIS_COMPLETED' : 'MANUAL_REANALYSIS_COMPLETED',
        old_state: 'pending',
        new_state: 'completed',
        analyzed_content: newAnalyzedContent,
        processing_details: {
          correlation_id,
          completion_time: new Date().toISOString(),
          retry_count: message.retry_count,
          group_message_count: message.group_message_count,
          is_original_caption: message.is_original_caption,
          is_auto_triggered: isAutoTriggered
        }
      });

    return new Response(
      JSON.stringify({ 
        message: 'Reanalysis completed', 
        analyzed_content: newAnalyzedContent,
        correlation_id,
        is_auto_triggered: isAutoTriggered
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