import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM_PROMPT = `Analyze product captions and return a JSON object with these EXACT lowercase field names:
{
  "notes": string,
  "quantity": number,
  "vendor_uid": string,
  "product_code": string,
  "product_name": string,
  "purchase_date": string (YYYY-MM-DD format)
}

Important rules:
1. Use EXACTLY these lowercase field names
2. Put ANY additional information or details not fitting in other fields into the notes field
3. Include flavor descriptions, strain types, and any other product details in notes
4. Convert any numbers in quantity to actual number type
5. Format dates as YYYY-MM-DD
6. Ensure product_name is always present
7. Move ANY information not fitting the specific fields into notes, including:
   - Strain information
   - Flavor descriptions
   - Product characteristics
   - Additional details
   - Text in parentheses
   - Any unstructured information

Example input: "Blue Dream #CHAD120523 x2 (indoor) Indica dominant, THC: 24%"
Example output:
{
  "notes": "indoor, Indica dominant, THC: 24%",
  "quantity": 2,
  "vendor_uid": "CHAD",
  "product_code": "CHAD120523",
  "product_name": "Blue Dream",
  "purchase_date": "2023-12-05"
}`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { caption, message_id, media_group_id, correlation_id = crypto.randomUUID() } = await req.json();

    if (!caption) {
      throw new Error('Caption is required');
    }

    console.log('Processing caption:', { caption, correlation_id });

    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    // Attempt AI analysis
    console.log('Starting AI analysis');
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
    console.log('Raw AI response:', data.choices[0].message.content);
    
    const aiResult = JSON.parse(data.choices[0].message.content);
    
    // Ensure correct field names and structure with explicit lowercase mapping
    const parsedContent = {
      notes: aiResult.notes || "",
      quantity: aiResult.quantity ? Number(aiResult.quantity) : null,
      vendor_uid: aiResult.vendor_uid || "",
      product_code: aiResult.product_code || "",
      product_name: aiResult.product_name || caption.split(/[#x]/)[0]?.trim() || 'Untitled Product',
      purchase_date: aiResult.purchase_date || "",
      parsing_metadata: {
        method: "ai",
        confidence: 0.9,
        reanalysis_attempted: false,
        timestamp: new Date().toISOString()
      }
    };

    console.log('Structured AI content:', parsedContent);

    // Update message and sync group if needed
    if (message_id) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL');
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      
      if (!supabaseUrl || !supabaseKey) {
        throw new Error('Missing Supabase credentials');
      }

      const supabase = createClient(supabaseUrl, supabaseKey);

      // Log analysis attempt
      await supabase.from('analysis_audit_log').insert({
        message_id,
        media_group_id,
        event_type: 'ANALYSIS_STARTED',
        processing_details: {
          correlation_id,
          method: 'ai',
          timestamp: new Date().toISOString(),
          caption
        }
      });

      // Process media group if needed
      if (media_group_id) {
        await supabase.rpc('process_media_group_analysis', {
          p_message_id: message_id,
          p_media_group_id: media_group_id,
          p_analyzed_content: parsedContent,
          p_processing_completed_at: new Date().toISOString(),
          p_correlation_id: correlation_id
        });
      } else {
        // Update single message
        const { error: updateError } = await supabase
          .from('messages')
          .update({
            analyzed_content: parsedContent,
            processing_state: 'completed',
            processing_completed_at: new Date().toISOString()
          })
          .eq('id', message_id);

        if (updateError) throw updateError;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        analyzed_content: parsedContent,
        correlation_id
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in parse-caption-with-ai function:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message,
        correlation_id: crypto.randomUUID()
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});