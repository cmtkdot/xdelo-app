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
            content: `Extract and return ONLY a valid JSON object with these fields:
              - product_name (string, required)
              - product_code (string, optional)
              - vendor_uid (string, optional)
              - purchase_date (string, optional, YYYY-MM-DD format)
              - quantity (number, optional)
              - notes (string, optional)`
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
    
    let analyzedContent;
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
    } catch (parseError) {
      console.error('Error parsing OpenAI response:', parseError);
      throw new Error(`Failed to parse AI response: ${parseError.message}`);
    }

    // Sync the analyzed content
    const syncResponse = await fetch(
      `${Deno.env.get('SUPABASE_URL')}/functions/v1/sync-analyzed-content`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message_id,
          media_group_id,
          analyzed_content: analyzedContent
        }),
      }
    );

    if (!syncResponse.ok) {
      const errorText = await syncResponse.text();
      console.error('Error syncing analyzed content:', errorText);
      throw new Error(`Failed to sync analyzed content: ${errorText}`);
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