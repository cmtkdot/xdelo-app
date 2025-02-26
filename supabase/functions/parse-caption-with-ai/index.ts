
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";
import { corsHeaders } from "../_shared/cors.ts";

interface AnalysisRequest {
  messageId: string;
  caption: string;
  media_group_id?: string;
  correlationId?: string;
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Parse request body and validate required fields
    const body = await req.json() as AnalysisRequest;
    const { messageId, caption, media_group_id, correlationId } = body;

    console.log('Received analysis request:', {
      messageId,
      caption: caption?.substring(0, 50) + '...',
      media_group_id,
      correlationId
    });

    if (!messageId || !caption) {
      throw new Error(`Missing required fields: ${!messageId ? 'messageId' : ''} ${!caption ? 'caption' : ''}`);
    }

    // Manual parsing first
    const productNameMatch = caption.match(/^(.*?)(?=[#\nx]|$)/);
    const productName = productNameMatch ? productNameMatch[0].trim() : '';
    const productCodeMatch = caption.match(/#([A-Za-z0-9-]+)/);
    const productCode = productCodeMatch ? productCodeMatch[1] : '';
    const vendorUidMatch = productCode.match(/^[A-Za-z]{1,4}/);
    const vendorUid = vendorUidMatch ? vendorUidMatch[0].toUpperCase() : '';
    const quantityMatch = caption.match(/x(\d+)/i);
    const quantity = quantityMatch ? parseInt(quantityMatch[1]) : null;
    const notesMatch = caption.match(/\((.*?)\)/);
    const notes = notesMatch ? notesMatch[1].trim() : '';

    console.log('Initial manual parsing results:', {
      productName,
      productCode,
      vendorUid,
      quantity,
      notes
    });

    let analyzedContent = {
      product_name: productName,
      product_code: productCode,
      vendor_uid: vendorUid,
      quantity,
      notes,
      caption,
      parsing_metadata: {
        method: 'manual',
        timestamp: new Date().toISOString(),
        correlation_id: correlationId
      }
    };

    // If product name is longer than 23 characters, use AI analysis
    if (productName.length > 23) {
      try {
        console.log('Product name exceeds 23 characters, initiating AI analysis');
        
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
            messages: [{
              role: "system",
              content: "You are a product information extractor. Extract product details from the given caption."
            }, {
              role: "user",
              content: `Extract product name, product code, vendor ID, purchase date, and quantity from this caption: ${caption}`
            }],
            temperature: 0.3,
          }),
        });

        if (!response.ok) {
          throw new Error(`OpenAI API error: ${response.statusText}`);
        }

        const result = await response.json();
        console.log('AI analysis completed:', result.choices[0].message.content);

        analyzedContent.parsing_metadata.method = 'ai';
      } catch (error) {
        console.error('AI analysis error:', error);
        // Continue with manual parsing results if AI fails
      }
    }

    // Get existing message first
    const { data: existingMessage, error: fetchError } = await supabaseClient
      .from('messages')
      .select('analyzed_content, processing_state')
      .eq('id', messageId)
      .single();

    if (fetchError) {
      console.error('Error fetching existing message:', fetchError);
      throw fetchError;
    }

    // Update message with new analyzed content
    const { error: updateError } = await supabaseClient
      .from('messages')
      .update({
        analyzed_content: analyzedContent,
        processing_state: 'completed',
        processing_completed_at: new Date().toISOString(),
        old_analyzed_content: existingMessage?.analyzed_content 
          ? [existingMessage.analyzed_content]
          : []
      })
      .eq('id', messageId);

    if (updateError) {
      console.error('Error updating message:', updateError);
      throw updateError;
    }

    // If this is part of a media group, sync the analyzed content
    if (media_group_id) {
      console.log('Syncing analyzed content to media group:', media_group_id);
      
      const { error: syncError } = await supabaseClient
        .rpc('xdelo_sync_media_group_content', {
          p_media_group_id: media_group_id,
          p_message_id: messageId
        });

      if (syncError) {
        console.error('Error syncing media group:', syncError);
        throw syncError;
      }
    }

    // Log the analysis completion
    await supabaseClient.rpc('xdelo_log_event', {
      p_event_type: 'caption_analyzed',
      p_entity_id: messageId,
      p_telegram_message_id: null,
      p_chat_id: null,
      p_previous_state: existingMessage?.analyzed_content,
      p_new_state: analyzedContent,
      p_metadata: {
        parsing_method: analyzedContent.parsing_metadata.method,
        product_name_length: productName.length,
        correlation_id: correlationId
      }
    });

    console.log('Analysis completed successfully');

    return new Response(
      JSON.stringify({ success: true, data: analyzedContent }),
      { 
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    );

  } catch (error) {
    console.error('Error in parse-caption-with-ai function:', error);
    
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    );
  }
});
