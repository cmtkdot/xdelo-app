import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM_PROMPT = `Extract product information from captions following these rules:
1. Product Name: Text before '#' (required)
2. Product Code: Full code after '#'
3. Vendor UID: Letters at start of product code
4. Purchase Date: Convert MMDDYY or MDDYY to YYYY-MM-DD
5. Quantity: Look for numbers after 'x' or in units
6. Notes: Text in parentheses or remaining info

Important rules:
1. Use EXACTLY these lowercase field names
2. Put ANY additional information into the notes field
3. Convert any numbers in quantity to actual number type
4. Format dates as YYYY-MM-DD
5. Ensure product_name is always present
6. Move ANY information not fitting the specific fields into notes

Example input: "Blue Dream #CHAD120523 x2 (indoor) Indica dominant"
Example output:
{
  "notes": "indoor, Indica dominant",
  "quantity": 2,
  "vendor_uid": "CHAD",
  "product_code": "CHAD120523",
  "product_name": "Blue Dream",
  "purchase_date": "2023-12-05"
}`;

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { caption, message_id, media_group_id, correlation_id = crypto.randomUUID() } = await req.json();

    console.log('Processing request:', { caption, message_id, media_group_id, correlation_id });

    // Handle empty or undefined caption
    if (!caption || typeof caption !== 'string' || caption.trim() === '') {
      console.log('Empty or invalid caption received:', { caption });
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Caption is required and must be a non-empty string',
          correlation_id
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    console.log('Starting AI analysis for caption:', caption);

    // Perform AI analysis
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
    const analyzedContent = JSON.parse(data.choices[0].message.content);

    console.log('AI analysis result:', analyzedContent);

    // Ensure all field names are lowercase
    const normalizedContent = {
      product_name: analyzedContent.product_name || caption.split(/[#x]/)[0]?.trim() || 'Untitled Product',
      product_code: analyzedContent.product_code || '',
      vendor_uid: analyzedContent.vendor_uid || '',
      purchase_date: analyzedContent.purchase_date || '',
      quantity: typeof analyzedContent.quantity === 'number' ? analyzedContent.quantity : null,
      notes: analyzedContent.notes || '',
      parsing_metadata: {
        method: 'ai',
        confidence: 0.9,
        timestamp: new Date().toISOString()
      }
    };

    // If message_id is provided, update the database
    if (message_id) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL');
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      
      if (!supabaseUrl || !supabaseKey) {
        throw new Error('Missing Supabase credentials');
      }

      const supabase = createClient(supabaseUrl, supabaseKey);

      // Process media group if needed
      if (media_group_id) {
        await supabase.rpc('process_media_group_analysis', {
          p_message_id: message_id,
          p_media_group_id: media_group_id,
          p_analyzed_content: normalizedContent,
          p_processing_completed_at: new Date().toISOString(),
          p_correlation_id: correlation_id
        });
      } else {
        // Update single message
        const { error: updateError } = await supabase
          .from('messages')
          .update({
            analyzed_content: normalizedContent,
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
        analyzed_content: normalizedContent,
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