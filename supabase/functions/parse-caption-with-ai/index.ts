import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { manualParse } from "./utils/manualParser.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { caption, message_id, media_group_id, correlation_id = crypto.randomUUID() } = await req.json();

    console.log('Processing request:', { caption, message_id, media_group_id, correlation_id });

    let analyzedContent = null;
    let parsingMethod = 'pending';
    let confidence = 0;

    // Handle empty or invalid caption
    if (!caption || typeof caption !== 'string' || caption.trim() === '') {
      console.log('Empty caption received, checking media group:', { message_id, media_group_id });
      
      // Initialize Supabase client
      const supabaseUrl = Deno.env.get('SUPABASE_URL');
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      
      if (!supabaseUrl || !supabaseKey) {
        throw new Error('Missing Supabase credentials');
      }

      try {
        // Ensure valid URL format and handle potential URL errors
        const supabaseUrlObj = new URL(supabaseUrl);
        const supabase = createClient(supabaseUrlObj.toString(), supabaseKey);

        if (media_group_id) {
          // Look for any message in the group that has analyzed content
          const { data: groupMessages, error: groupError } = await supabase
            .from('messages')
            .select('analyzed_content')
            .eq('media_group_id', media_group_id)
            .not('analyzed_content', 'is', null)
            .limit(1);

          if (groupError) {
            throw groupError;
          }

          if (groupMessages && groupMessages.length > 0 && groupMessages[0].analyzed_content) {
            console.log('Found analyzed content in media group, syncing...', { media_group_id });
            analyzedContent = groupMessages[0].analyzed_content;
            parsingMethod = 'group_sync';
            confidence = analyzedContent.parsing_metadata?.confidence || 0.8;
          } else {
            console.log('No analyzed content found in group yet, marking for later analysis');
            // Create empty analyzed content for later processing
            analyzedContent = {
              product_name: 'Pending Analysis',
              product_code: '',
              vendor_uid: '',
              purchase_date: '',
              quantity: null,
              notes: '',
              parsing_metadata: {
                method: 'pending',
                confidence: 0,
                fallbacks_used: ['awaiting_group_analysis'],
                timestamp: new Date().toISOString()
              }
            };
          }
        }
      } catch (urlError) {
        console.error('Error initializing Supabase client:', urlError);
        throw new Error('Failed to initialize Supabase client');
      }
    } else {
      // First try manual parsing
      console.log('Starting manual parsing for caption:', caption);
      const manualResult = await manualParse(caption);
      console.log('Manual parsing result:', manualResult);

      analyzedContent = manualResult;
      parsingMethod = 'manual';
      confidence = manualResult.parsing_metadata?.confidence || 0;
    }

    // If we have caption and manual parsing confidence is low, try AI analysis
    if (caption && confidence < 0.75) {
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
6. Move ANY information not fitting the specific fields into notes`
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
      console.log('Raw AI response:', data.choices[0].message.content);
      
      let aiResult;
      try {
        // First try direct JSON parsing
        aiResult = JSON.parse(data.choices[0].message.content.trim());
      } catch (parseError) {
        // If direct parsing fails, try to extract JSON from markdown
        console.log('Direct parsing failed, attempting to extract from markdown');
        const jsonMatch = data.choices[0].message.content.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
        if (jsonMatch) {
          try {
            aiResult = JSON.parse(jsonMatch[1].trim());
          } catch (markdownParseError) {
            console.error('Failed to parse markdown JSON:', markdownParseError);
            throw new Error('Failed to parse AI response as JSON');
          }
        } else {
          // If no JSON block found, try to find any object-like structure
          const objectMatch = data.choices[0].message.content.match(/\{[\s\S]*?\}/);
          if (objectMatch) {
            try {
              aiResult = JSON.parse(objectMatch[0].trim());
            } catch (objectParseError) {
              console.error('Failed to parse object structure:', objectParseError);
              throw new Error('Failed to parse AI response as JSON');
            }
          } else {
            console.error('No JSON structure found in response');
            throw new Error('Failed to parse AI response as JSON');
          }
        }
      }

      console.log('Successfully parsed AI result:', aiResult);

      analyzedContent = {
        product_name: aiResult.product_name || caption.split(/[#x]/)[0]?.trim() || 'Untitled Product',
        product_code: aiResult.product_code,
        vendor_uid: aiResult.vendor_uid,
        purchase_date: aiResult.purchase_date,
        quantity: typeof aiResult.quantity === 'number' ? Math.floor(aiResult.quantity) : null,
        notes: aiResult.notes || '',
        parsing_metadata: {
          method: 'ai',
          confidence: 0.9,
          timestamp: new Date().toISOString()
        }
      };
      parsingMethod = 'ai';
      confidence = 0.9;
    }

    // If message_id is provided, update the database
    if (message_id) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL');
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      
      if (!supabaseUrl || !supabaseKey) {
        throw new Error('Missing Supabase credentials');
      }

      try {
        // Ensure valid URL format and handle potential URL errors
        const supabaseUrlObj = new URL(supabaseUrl);
        const supabase = createClient(supabaseUrlObj.toString(), supabaseKey);

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
      } catch (urlError) {
        console.error('Error initializing Supabase client:', urlError);
        throw new Error('Failed to initialize Supabase client');
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