import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { manualParse } from "./manualParser.ts";
import { aiParse } from "./aiParser.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const correlationId = crypto.randomUUID();
  let messageId: string;
  let mediaGroupId: string | null;
  let caption: string;
  let retryCount = 0;

  try {
    const requestData = await req.json();
    messageId = requestData.message_id;
    mediaGroupId = requestData.media_group_id;
    caption = requestData.caption;

    if (!messageId || !caption) {
      throw new Error('message_id and caption are required fields');
    }

    console.log('Processing caption:', { messageId, mediaGroupId, caption, correlationId });

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase credentials');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: existingMessage, error: messageError } = await supabase
      .from('messages')
      .select('id, processing_state, analyzed_content, is_original_caption, retry_count')
      .eq('id', messageId)
      .maybeSingle();

    if (messageError || !existingMessage) {
      throw new Error(`Message not found or error: ${messageError?.message || 'Not found'}`);
    }

    if (existingMessage.retry_count && existingMessage.retry_count >= MAX_RETRIES) {
      throw new Error(`Maximum retry attempts (${MAX_RETRIES}) reached for message ${messageId}`);
    }

    const { error: updateError } = await supabase
      .from('messages')
      .update({ 
        processing_state: 'processing',
        processing_started_at: new Date().toISOString(),
        retry_count: (existingMessage.retry_count || 0) + 1
      })
      .eq('id', messageId);

    if (updateError) {
      throw new Error(`Failed to update message state: ${updateError.message}`);
    }

    // First try manual parsing
    let parsedContent = await manualParse(caption);
    let confidence = parsedContent.parsing_metadata?.confidence || 0;

    // Log manual parsing attempt
    await supabase.from("analysis_audit_log").insert({
      message_id: messageId,
      media_group_id: mediaGroupId,
      event_type: "MANUAL_PARSE_COMPLETED",
      old_state: existingMessage.processing_state,
      analyzed_content: parsedContent,
      processing_details: {
        correlation_id: correlationId,
        confidence,
        method: "manual",
        original_caption: caption,
        message_id: messageId,
        retry_count: existingMessage.retry_count || 0
      }
    });

    // If manual parsing has low confidence (< 0.5), try AI parsing
    if (confidence < 0.5) {
      console.log('Manual parsing had low confidence, attempting AI parsing');
      try {
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
                content: `Analyze the product caption and return a JSON object with these EXACT lowercase field names:
{
  "notes": string (optional),
  "quantity": number (optional),
  "vendor_uid": string (optional),
  "product_code": string (optional),
  "product_name": string (required),
  "purchase_date": string (YYYY-MM-DD format, optional)
}

Example output:
{
  "notes": "30 behind",
  "quantity": 2,
  "vendor_uid": "FISH",
  "product_code": "FISH012225",
  "product_name": "Blue Nerds",
  "purchase_date": "2025-01-22"
}

Important:
- Use EXACTLY these lowercase field names
- Return ONLY these fields
- Ensure product_name is always present
- Convert any numbers in quantity to actual number type
- Format dates as YYYY-MM-DD`
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
        
        const aiResult = JSON.parse(data.choices[0].message.content);
        
        // Ensure correct field names and structure
        parsedContent = {
          notes: aiResult.notes || "",
          quantity: aiResult.quantity ? Number(aiResult.quantity) : null,
          vendor_uid: aiResult.vendor_uid || "",
          product_code: aiResult.product_code || "",
          product_name: aiResult.product_name || caption.split(/[#x]/)[0]?.trim() || 'Untitled Product',
          purchase_date: aiResult.purchase_date || "",
          parsing_metadata: {
            method: "ai",
            confidence: 0.9,
            reanalysis_attempted: true
          }
        };

        console.log('Structured AI content:', parsedContent);

        // Log AI parsing success
        await supabase.from("analysis_audit_log").insert({
          message_id: messageId,
          media_group_id: mediaGroupId,
          event_type: "AI_PARSE_COMPLETED",
          old_state: "processing",
          analyzed_content: parsedContent,
          processing_details: {
            correlation_id: correlationId,
            confidence: 0.9,
            method: "ai",
            original_caption: caption,
            message_id: messageId,
            retry_count: existingMessage.retry_count || 0
          }
        });
      } catch (aiError) {
        console.error('AI parsing failed:', aiError);
        
        await supabase.from("analysis_audit_log").insert({
          message_id: messageId,
          media_group_id: mediaGroupId,
          event_type: "AI_PARSE_FAILED",
          error_message: aiError.message,
          processing_details: {
            correlation_id: correlationId,
            error: aiError.message,
            original_caption: caption,
            message_id: messageId,
            retry_count: existingMessage.retry_count || 0
          }
        });
      }
    }

    // Update the message and sync with media group
    const { error: contentUpdateError } = await supabase.rpc(
      'process_media_group_analysis',
      {
        p_message_id: messageId,
        p_media_group_id: mediaGroupId,
        p_analyzed_content: parsedContent,
        p_processing_completed_at: new Date().toISOString(),
        p_correlation_id: correlationId
      }
    );

    if (contentUpdateError) {
      throw contentUpdateError;
    }

    return new Response(
      JSON.stringify({
        message: 'Caption analyzed successfully',
        analyzed_content: parsedContent,
        correlation_id: correlationId
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error processing caption:', error);
    
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL');
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      
      if (supabaseUrl && supabaseKey && messageId) {
        const supabase = createClient(supabaseUrl, supabaseKey);
        
        await supabase
          .from('messages')
          .update({ 
            processing_state: 'error',
            error_message: error.message,
            processing_completed_at: new Date().toISOString(),
            last_error_at: new Date().toISOString()
          })
          .eq('id', messageId);

        await supabase.from("analysis_audit_log").insert({
          message_id: messageId,
          media_group_id: mediaGroupId,
          event_type: "PARSING_ERROR",
          old_state: "processing",
          new_state: "error",
          error_message: error.message,
          processing_details: {
            correlation_id: correlationId,
            error: error.message,
            original_caption: caption,
            message_id: messageId,
            retry_count: retryCount
          }
        });
      }
    } catch (updateError) {
      console.error('Failed to update message error state:', updateError);
    }
    
    return new Response(
      JSON.stringify({ 
        error: error.message,
        correlation_id: correlationId 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});