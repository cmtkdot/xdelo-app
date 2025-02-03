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
    const { message_id, caption } = await req.json();
    console.log('Reanalyzing message:', { message_id, caption });

    if (!caption) {
      return new Response(
        JSON.stringify({ message: 'Skipped reanalysis - no caption provided' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

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
            content: `Extract product information from captions following these rules:
1. Product Name: Text before '#' (required)
2. Product Code: Full code after '#'
3. Vendor UID: Letters at start of product code
4. Purchase Date: Convert MMDDYY or MDDYY to YYYY-MM-DD
5. Quantity: Look for numbers after 'x' or in units
6. Notes: Text in parentheses or remaining info

Return a clean JSON object with these fields, no markdown formatting.
Example Input: "Blue Widget #ABC12345 x5 (new stock)"
Example Output: {
  "product_name": "Blue Widget",
  "product_code": "ABC12345",
  "vendor_uid": "ABC",
  "purchase_date": "2023-12-34",
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
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const data = await response.json();
    const aiResponse = data.choices[0].message.content;
    console.log('Raw AI response:', aiResponse);
    
    let newAnalyzedContent: AnalyzedContent;
    try {
      newAnalyzedContent = JSON.parse(aiResponse);
      newAnalyzedContent.parsing_metadata = {
        method: 'ai_enhanced',
        confidence: 0.9,
        reanalysis_attempted: true
      };
    } catch (parseError) {
      console.error('Error parsing AI response:', parseError);
      throw new Error('Failed to parse AI response');
    }

    console.log('New analyzed content:', newAnalyzedContent);

    // Get the message to find its media group
    const { data: message, error: messageError } = await supabase
      .from('messages')
      .select('media_group_id')
      .eq('id', message_id)
      .single();

    if (messageError) {
      throw messageError;
    }

    if (message.media_group_id) {
      // Update all messages in the media group
      const { error: groupError } = await supabase.rpc('process_media_group_analysis', {
        p_message_id: message_id,
        p_media_group_id: message.media_group_id,
        p_analyzed_content: newAnalyzedContent,
        p_processing_completed_at: new Date().toISOString()
      });

      if (groupError) {
        throw groupError;
      }
    } else {
      // Update single message
      const { error: updateError } = await supabase
        .from('messages')
        .update({
          analyzed_content: newAnalyzedContent,
          processing_state: 'completed'
        })
        .eq('id', message_id)
        .eq('is_original_caption', true);

      if (updateError) {
        throw updateError;
      }
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