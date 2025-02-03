import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

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
  parsing_metadata?: {
    method: string;
    confidence: number;
    fallbacks_used?: string[];
    reanalysis_attempted?: boolean;
    previous_analysis?: any;
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message_id, caption, analyzed_content } = await req.json();
    console.log('Reanalyzing message:', { message_id, caption, confidence: analyzed_content?.parsing_metadata?.confidence });

    // Skip if no caption or already high confidence
    if (!caption || (analyzed_content?.parsing_metadata?.confidence || 0) > 0.7) {
      return new Response(
        JSON.stringify({ message: 'Skipped reanalysis', analyzed_content }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Call OpenAI for reanalysis with enhanced prompt
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
            content: `You are a specialized product information extractor. Extract structured information from captions following these rules:

1. Product Name (REQUIRED):
   - Text before '#' or 'x' marker
   - Remove any trailing spaces
   - Capitalize first letter of each word
   - Example: "blue dream x2" -> "Blue Dream"

2. Product Code:
   - Full code after '#'
   - Format: [vendor_uid][date]
   - Example: "#CHAD120523"

3. Vendor UID:
   - 1-4 letters at start of product code
   - Example: "CHAD" from "#CHAD120523"

4. Purchase Date:
   - Convert date formats:
   - 6 digits (mmDDyy) -> YYYY-MM-DD
   - 5 digits (mDDyy) -> YYYY-MM-DD
   - Example: "120523" -> "2023-12-05"

5. Quantity:
   - Number after 'x' or 'qty:'
   - Must be positive integer
   - Example: "x2" or "qty: 2"

6. Notes:
   - Text in parentheses or remaining info
   - Example: "(indoor grown)"

Return a JSON object with these fields. Include null for missing values.`
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
    let newAnalyzedContent: AnalyzedContent;

    try {
      const aiResponse = data.choices[0].message.content;
      console.log('AI response:', aiResponse);
      newAnalyzedContent = JSON.parse(aiResponse);
    } catch (parseError) {
      console.error('Error parsing AI response:', parseError);
      throw new Error('Failed to parse AI response');
    }

    // Add metadata
    newAnalyzedContent.parsing_metadata = {
      method: 'ai_enhanced',
      confidence: 0.9,
      reanalysis_attempted: true,
      previous_analysis: analyzed_content?.parsing_metadata
    };

    console.log('New analyzed content:', newAnalyzedContent);

    // Update the message with new analysis
    const { error: updateError } = await supabase
      .from('messages')
      .update({
        analyzed_content: newAnalyzedContent,
        processing_state: 'completed'
      })
      .eq('id', message_id);

    if (updateError) {
      console.error('Error updating message:', updateError);
      throw updateError;
    }

    return new Response(
      JSON.stringify({ message: 'Reanalysis completed', analyzed_content: newAnalyzedContent }),
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