import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { ParsedContent } from "./types.ts";

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

    if (!message_id || !caption) {
      throw new Error('message_id and caption are required');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase credentials');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Update message to processing state
    const { error: updateError } = await supabase
      .from('messages')
      .update({ 
        processing_state: 'processing',
        processing_started_at: new Date().toISOString()
      })
      .eq('id', message_id);

    if (updateError) {
      throw new Error(`Failed to update message state: ${updateError.message}`);
    }

    // Parse the caption using OpenAI
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

    const aiData = await response.json();
    const parsedContent: ParsedContent = JSON.parse(aiData.choices[0].message.content);

    // Add metadata to the parsed content
    const analyzedContent = {
      ...parsedContent,
      parsing_metadata: {
        method: 'ai',
        confidence: 0.8,
        timestamp: new Date().toISOString()
      }
    };

    // Update the message with the analyzed content
    const { error: contentUpdateError } = await supabase.rpc(
      'process_media_group_analysis',
      {
        p_message_id: message_id,
        p_media_group_id: media_group_id,
        p_analyzed_content: analyzedContent,
        p_processing_completed_at: new Date().toISOString(),
        p_correlation_id: crypto.randomUUID()
      }
    );

    if (contentUpdateError) {
      throw contentUpdateError;
    }

    return new Response(
      JSON.stringify({
        message: 'Caption analyzed successfully',
        analyzed_content: analyzedContent
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error processing caption:', error);
    
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL');
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      const supabase = createClient(supabaseUrl, supabaseKey);
      
      // Update message error state
      await supabase
        .from('messages')
        .update({ 
          processing_state: 'error',
          error_message: error.message,
          processing_completed_at: new Date().toISOString()
        })
        .eq('id', message_id);
    } catch (updateError) {
      console.error('Failed to update message error state:', updateError);
    }
    
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});