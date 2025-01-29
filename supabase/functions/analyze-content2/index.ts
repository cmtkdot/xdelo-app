import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

  try {
    const { message_id } = await req.json();

    // Fetch the message from the database
    const { data: message, error: messageError } = await supabase
      .from('messages')
      .select('*')
      .eq('id', message_id)
      .single();

    if (messageError) throw messageError;
    if (!message?.caption) {
      return new Response(
        JSON.stringify({ error: 'No caption found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Processing message:', message_id);
    console.log('Caption:', message.caption);

    // Prepare the prompt for OpenAI
    const systemPrompt = `You are a product information parser. Extract the following information from the given text:
    - product_name (text before #)
    - product_code (everything after # until space)
    - vendor_uid (letters after # before numbers)
    - purchase_date (numbers after vendor_uid in format YYYY-MM-DD, assuming mmddyy format)
    - quantity (number after 'x' if present)
    - notes (anything in parentheses)
    
    Return ONLY a JSON object with these fields. If a field cannot be extracted, set it to null.`;

    // Call OpenAI API
    const openAIResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message.caption }
        ],
      }),
    });

    const aiData = await openAIResponse.json();
    if (!aiData.choices?.[0]?.message?.content) {
      throw new Error('Invalid response from OpenAI');
    }

    console.log('AI Response:', aiData.choices[0].message.content);

    const analyzedContent = JSON.parse(aiData.choices[0].message.content);

    // Update the message with the analyzed content
    const { error: updateError } = await supabase
      .from('messages')
      .update({ 
        analyzed_content: analyzedContent,
        processing_state: 'analysis_synced'
      })
      .eq('id', message_id);

    if (updateError) throw updateError;

    console.log('Successfully updated message:', message_id);

    return new Response(
      JSON.stringify({ success: true, analyzed_content: analyzedContent }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in analyze-content2 function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});