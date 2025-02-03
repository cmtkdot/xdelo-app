import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting caption analysis');
    const { message_id, caption } = await req.json();

    if (!message_id) {
      throw new Error('message_id is required');
    }

    if (!caption) {
      throw new Error('No caption provided for analysis');
    }

    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    console.log('Analyzing caption with OpenAI:', caption);
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
            content: `Extract product information from captions following these rules:
              1. Product Name: Text before '#' (required)
              2. Product Code: Full code after '#'
              3. Vendor UID: Letters at start of product code
              4. Purchase Date: Convert MMDDYY or MDDYY to YYYY-MM-DD
              5. Quantity: Look for numbers after 'x' or in units
              6. Notes: Text in parentheses or remaining info`
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
    console.log('OpenAI API response:', data);
    
    const analyzedContent: AnalyzedContent = JSON.parse(data.choices[0].message.content);

    // Validate quantity
    if (typeof analyzedContent.quantity === 'number') {
      analyzedContent.quantity = Math.floor(analyzedContent.quantity);
      if (analyzedContent.quantity <= 0) {
        delete analyzedContent.quantity;
      }
    }

    console.log('Final analyzed result:', analyzedContent);
    return new Response(
      JSON.stringify({
        success: true,
        analyzed_content: analyzedContent
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );

  } catch (error) {
    console.error('Error in parse-caption-with-ai:', error);
    
    return new Response(
      JSON.stringify({
        error: error.message,
        details: 'Failed to analyze caption'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});