import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AnalyzedContent {
  product_name: string;
  product_code?: string;
  vendor_uid?: string;
  purchase_date?: string;
  quantity?: number;
  notes?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message_id, media_group_id, caption } = await req.json();
    console.log('Processing caption:', { message_id, media_group_id, caption });

    if (!caption) {
      throw new Error('Caption is required');
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
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
        max_tokens: 150
      })
    });

    if (!response.ok) {
      console.error('OpenAI API error:', response.status, response.statusText);
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('OpenAI API response:', data);
    
    let analyzedContent: AnalyzedContent;
    try {
      const content = data.choices[0].message.content.trim();
      console.log('Parsing content:', content);
      
      analyzedContent = JSON.parse(content);
      
      if (!analyzedContent.product_name) {
        analyzedContent.product_name = 'Untitled Product';
      }

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

    // Create Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Update the message with analyzed content
    const { error: updateError } = await supabase
      .from('messages')
      .update({
        analyzed_content: analyzedContent,
        processing_state: 'analyzing'
      })
      .eq('id', message_id);

    if (updateError) throw updateError;

    // If this is part of a media group, sync the analysis
    if (media_group_id) {
      console.log('Syncing media group analysis');
      const { error: syncError } = await supabase.functions.invoke('sync-media-group', {
        body: { message_id, media_group_id, analyzed_content: analyzedContent }
      });

      if (syncError) {
        console.error('Error syncing media group:', syncError);
        throw syncError;
      }
    } else {
      // For single messages, mark as completed
      const { error: completeError } = await supabase
        .from('messages')
        .update({
          processing_state: 'completed',
          processing_completed_at: new Date().toISOString()
        })
        .eq('id', message_id);

      if (completeError) throw completeError;
    }

    return new Response(
      JSON.stringify({
        success: true,
        analyzed_content: analyzedContent
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in parse-caption-with-ai:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});