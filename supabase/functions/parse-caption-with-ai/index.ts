import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { manualParse } from "./utils/manualParser.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { caption, message_id, media_group_id, correlation_id = crypto.randomUUID() } = await req.json();

    console.log('Processing request:', { caption, message_id, media_group_id, correlation_id });

    // First verify this is the original caption holder for the media group
    if (message_id) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL');
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      
      if (!supabaseUrl || !supabaseKey) {
        throw new Error('Missing Supabase credentials');
      }

      const supabase = createClient(supabaseUrl, supabaseKey);

      // Check if this message is the original caption holder
      const { data: message, error: messageError } = await supabase
        .from('messages')
        .select('*')
        .eq('id', message_id)
        .single();

      if (messageError) throw messageError;

      // If this is part of a media group, verify it's the original caption holder
      if (media_group_id && (!message.is_original_caption || !message.caption)) {
        console.log('Skipping analysis - not original caption holder:', {
          message_id,
          media_group_id,
          is_original_caption: message.is_original_caption
        });
        
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Message is not the original caption holder',
            correlation_id
          }),
          { 
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }

      // Use the message's caption if none was provided
      if (!caption && message.caption) {
        console.log('Using caption from message:', message.caption);
        caption = message.caption;
      }
    }

    // Handle empty or invalid caption
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

    // First try manual parsing
    console.log('Starting manual parsing for caption:', caption);
    const manualResult = await manualParse(caption);
    console.log('Manual parsing result:', manualResult);

    let analyzedContent;
    let parsingMethod = 'manual';
    let confidence = manualResult.parsing_metadata?.confidence || 0;

    // If manual parsing confidence is low, try AI analysis
    if (confidence < 0.75) {
      console.log('Low confidence in manual parsing, attempting AI analysis:', confidence);
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

Important rules:
1. Use EXACTLY these lowercase field names
2. Put ANY additional information into the notes field
3. Convert any numbers in quantity to actual number type
4. Format dates as YYYY-MM-DD
5. Ensure product_name is always present
6. Move ANY information not fitting the specific fields into notes
7. Return ONLY valid JSON with these exact fields:
{
  "product_name": string,
  "product_code": string,
  "vendor_uid": string,
  "purchase_date": string,
  "quantity": number,
  "notes": string
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
      const aiContent = data.choices[0].message.content;
      
      try {
        // First try direct parsing
        analyzedContent = JSON.parse(aiContent);
        console.log('AI analysis result:', analyzedContent);
      } catch (e) {
        // If direct parsing fails, try to extract JSON from markdown
        const jsonMatch = aiContent.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
        if (jsonMatch) {
          analyzedContent = JSON.parse(jsonMatch[1]);
          console.log('Extracted JSON from markdown:', analyzedContent);
        } else {
          throw new Error('Failed to parse AI response as JSON');
        }
      }

      analyzedContent = {
        ...analyzedContent,
        parsing_metadata: {
          method: 'ai',
          confidence: 0.9,
          timestamp: new Date().toISOString()
        }
      };
      parsingMethod = 'ai';
      confidence = 0.9;
    } else {
      console.log('Using manual parsing result, confidence:', confidence);
      analyzedContent = manualResult;
    }

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
          p_analyzed_content: analyzedContent,
          p_processing_completed_at: new Date().toISOString(),
          p_correlation_id: correlation_id
        });
      } else {
        // Update single message
        const { error: updateError } = await supabase
          .from('messages')
          .update({
            analyzed_content: analyzedContent,
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
        analyzed_content: analyzedContent,
        parsing_method: parsingMethod,
        confidence,
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