import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM_PROMPT = `You are a specialized product information extractor. Extract structured information following these rules:

1. Product Name (REQUIRED):
   - Text before '#' or 'x' marker
   - Remove any trailing spaces
   - Example: "Blue Dream x2" -> "Blue Dream"

2. Product Code:
   - Full code after '#' including vendor and date
   - Format: #[vendor_uid][date]
   - Example: "#CHAD120523" -> "CHAD120523"

3. Vendor UID:
   - 1-4 letters after '#' before any numbers
   - Example: "#CHAD120523" -> "CHAD"

4. Purchase Date:
   - Convert date formats:
   - 6 digits (mmDDyy) -> YYYY-MM-DD
   - 5 digits (mDDyy) -> YYYY-MM-DD (add leading zero)
   - Example: "120523" -> "2023-12-05"

5. Quantity:
   - Look for numbers after 'x' or 'qty:'
   - Must be positive integer
   - Common formats: "x2", "x 2", "qty: 2"

6. Notes:
   - Text in parentheses
   - Any additional unstructured text
   - Example: "(indoor grown)" -> "indoor grown"
   - Include ANY information not fitting in other fields

Return ONLY valid JSON with these exact fields:
{
  "product_name": string,
  "product_code": string,
  "vendor_uid": string,
  "purchase_date": string,
  "quantity": number,
  "notes": string
}`;

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { caption, message_id, media_group_id, correlation_id = crypto.randomUUID() } = await req.json();
    
    console.log('Processing request:', { caption, message_id, media_group_id, correlation_id });

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase credentials');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify message exists and is original caption holder
    const { data: message, error: messageError } = await supabase
      .from('messages')
      .select('*')
      .eq('id', message_id)
      .single();

    if (messageError) {
      console.error('Error fetching message:', messageError);
      throw messageError;
    }

    // Skip if not original caption holder for media group
    if (media_group_id && (!message.is_original_caption || !message.caption)) {
      console.log('Skipping - not original caption holder:', {
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

    // Use message caption if none provided
    const captionToAnalyze = caption || message.caption;

    if (!captionToAnalyze || typeof captionToAnalyze !== 'string' || captionToAnalyze.trim() === '') {
      console.log('Invalid or empty caption');
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Invalid or empty caption',
          correlation_id
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    let analyzedContent;
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    
    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAIApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: captionToAnalyze }
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

      // Add metadata to analyzed content
      analyzedContent = {
        ...analyzedContent,
        parsing_metadata: {
          method: 'ai',
          confidence: 0.9,
          timestamp: new Date().toISOString(),
          correlation_id
        }
      };

      // Update the message and its media group
      if (media_group_id) {
        const { error: syncError } = await supabase.rpc('process_media_group_analysis', {
          p_message_id: message_id,
          p_media_group_id: media_group_id,
          p_analyzed_content: analyzedContent,
          p_processing_completed_at: new Date().toISOString(),
          p_correlation_id: correlation_id
        });

        if (syncError) {
          console.error('Error syncing media group:', syncError);
          throw syncError;
        }
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

        if (updateError) {
          console.error('Error updating message:', updateError);
          throw updateError;
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          analyzed_content: analyzedContent,
          correlation_id
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } catch (error) {
      console.error('Error in AI analysis:', error);
      
      // Log the error in the audit log
      await supabase
        .from('analysis_audit_log')
        .insert({
          message_id,
          media_group_id,
          event_type: 'AI_ANALYSIS_ERROR',
          error_message: error.message,
          processing_details: {
            error_time: new Date().toISOString(),
            correlation_id
          }
        });

      throw error;
    }

  } catch (error) {
    console.error('Error processing request:', error);
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