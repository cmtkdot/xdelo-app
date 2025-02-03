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
            content: `You are a product information extractor. Extract and return ONLY a JSON object with these fields:
              - product_name (string, required): Text before '#'
              - product_code (string, optional): Full code after '#'
              - vendor_uid (string, optional): Letters at start of product code
              - purchase_date (string, optional): Date in YYYY-MM-DD format
              - quantity (number, optional): Numbers after 'x' or in units
              - notes (string, optional): Text in parentheses or remaining info
              
              Example input: "Blue Widget #ABC12345 x5 (new stock)"
              Example output: {
                "product_name": "Blue Widget",
                "product_code": "ABC12345",
                "vendor_uid": "ABC",
                "quantity": 5,
                "notes": "new stock"
              }`
          },
          { role: 'user', content: caption }
        ],
        temperature: 0.3,
        max_tokens: 500
      }),
    });

    if (!response.ok) {
      console.error('OpenAI API error:', response.status, response.statusText);
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('OpenAI API response:', data);
    
    let analyzedContent: AnalyzedContent;
    try {
      // Extract the content from the message
      const content = data.choices[0].message.content.trim();
      console.log('Parsing content:', content);
      
      // Try to parse the JSON response
      analyzedContent = JSON.parse(content);
      
      // Validate required fields
      if (!analyzedContent.product_name) {
        analyzedContent.product_name = 'Untitled Product';
      }

      // Validate quantity
      if (typeof analyzedContent.quantity === 'number') {
        analyzedContent.quantity = Math.floor(analyzedContent.quantity);
        if (analyzedContent.quantity <= 0) {
          delete analyzedContent.quantity;
        }
      }

      console.log('Final analyzed result:', analyzedContent);
    } catch (parseError) {
      console.error('Error parsing OpenAI response:', parseError);
      throw new Error(`Failed to parse AI response: ${parseError.message}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        analyzed_content: analyzedContent
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
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