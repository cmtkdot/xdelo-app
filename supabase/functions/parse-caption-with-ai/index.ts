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
    const requestData = await req.json();
    const { caption, correlation_id = crypto.randomUUID() } = requestData;

    if (!caption) {
      throw new Error('Caption is required');
    }

    console.log('Processing caption:', { caption, correlation_id });

    // First try manual parsing
    let parsedContent = await manualParse(caption);
    let confidence = parsedContent.parsing_metadata?.confidence || 0;

    // If manual parsing has low confidence (< 0.8), try AI parsing
    if (confidence < 0.8) {
      console.log('Manual parsing had low confidence, attempting AI parsing:', { confidence });
      try {
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
        console.log('Raw AI response:', data.choices[0].message.content);
        
        const aiResult = JSON.parse(data.choices[0].message.content);
        
        // Ensure correct field names and structure with explicit lowercase mapping
        parsedContent = {
          notes: aiResult.notes || "",
          quantity: aiResult.quantity ? Number(aiResult.quantity) : null,
          vendor_uid: aiResult.vendor_uid || "",
          product_code: aiResult.product_code || "",
          product_name: aiResult.product_name || caption.split(/[#x]/)[0]?.trim() || 'Untitled Product',
          purchase_date: aiResult.purchase_date || "",
          parsing_metadata: {
            method: "ai",
            confidence: 0.9,
            reanalysis_attempted: true,
            timestamp: new Date().toISOString()
          }
        };

        console.log('Structured AI content:', parsedContent);

      } catch (aiError) {
        console.error('AI parsing failed:', aiError);
        // Keep the manual parsing result if AI fails
        parsedContent.parsing_metadata = {
          ...parsedContent.parsing_metadata,
          ai_error: aiError.message,
          reanalysis_attempted: true
        };
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
        correlation_id: requestData?.correlation_id || crypto.randomUUID()
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
