
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { corsHeaders } from "../_shared/cors.ts";

// Create a Supabase client
const supabaseClient = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

interface RequestPayload {
  messageId: string;
  caption?: string;
  media_group_id?: string;
  correlationId?: string;
  retrieveFromDb?: boolean;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messageId, caption, media_group_id, correlationId = crypto.randomUUID().toString(), retrieveFromDb = false } = await req.json() as RequestPayload;
    
    if (!messageId) {
      throw new Error('Message ID is required');
    }

    console.log(`Processing message: ${messageId}, correlation ID: ${correlationId}`);
    
    // Get the message data if we need to retrieve it from the database
    let captionToAnalyze = caption;
    let messageGroupId = media_group_id;

    if (retrieveFromDb) {
      const { data: message, error: messageError } = await supabaseClient
        .from('messages')
        .select('caption, media_group_id')
        .eq('id', messageId)
        .single();
      
      if (messageError) {
        throw new Error(`Error retrieving message: ${messageError.message}`);
      }
      
      captionToAnalyze = message.caption;
      messageGroupId = message.media_group_id;
      
      if (!captionToAnalyze) {
        throw new Error('Message has no caption to analyze');
      }
    }

    // Get existing message data
    const { data: existingMessage, error: fetchError } = await supabaseClient
      .from('messages')
      .select('analyzed_content, old_analyzed_content')
      .eq('id', messageId)
      .single();

    if (fetchError) {
      console.error('Error fetching existing message:', fetchError);
      throw fetchError;
    }

    // Extract product name (text before #, line break, or x)
    const productNameMatch = captionToAnalyze.match(/^(.*?)(?=[#\nx]|$)/);
    const productName = productNameMatch ? productNameMatch[0].trim() : '';

    // Extract product code (text following #)
    const productCodeMatch = captionToAnalyze.match(/#([A-Za-z0-9-]+)/);
    const productCode = productCodeMatch ? productCodeMatch[1] : '';

    // Extract vendor UID (first 1-4 letters of product code)
    const vendorUidMatch = productCode.match(/^[A-Za-z]{1,4}/);
    const vendorUid = vendorUidMatch ? vendorUidMatch[0].toUpperCase() : '';

    // Extract purchase date
    let purchaseDate = null;
    if (productCode) {
      // Remove vendor UID to get date portion
      const dateString = productCode.replace(/^[A-Za-z]{1,4}/, '');
      if (/^\d{5,6}$/.test(dateString)) {
        try {
          // Handle both 5 and 6 digit formats
          const isSixDigits = dateString.length === 6;
          const monthStr = isSixDigits ? dateString.substring(0, 2) : '0' + dateString.substring(0, 1);
          const dayStr = isSixDigits ? dateString.substring(2, 4) : dateString.substring(1, 3);
          const yearStr = isSixDigits ? dateString.substring(4, 6) : dateString.substring(3, 5);
          
          const month = parseInt(monthStr);
          const day = parseInt(dayStr);
          const year = 2000 + parseInt(yearStr);
          
          if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
            purchaseDate = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
          }
        } catch (e) {
          console.error('Error parsing date:', e);
        }
      }
    }

    // Extract quantity (number after x)
    const quantityMatch = captionToAnalyze.match(/x(\d+)/i);
    const quantity = quantityMatch ? parseInt(quantityMatch[1]) : null;

    // Extract notes (text in parentheses)
    const notesMatch = captionToAnalyze.match(/\((.*?)\)/);
    const notes = notesMatch ? notesMatch[1].trim() : '';

    let analyzedContent = {
      product_name: productName,
      product_code: productCode,
      vendor_uid: vendorUid,
      purchase_date: purchaseDate,
      quantity,
      notes,
      caption: captionToAnalyze,
      parsing_metadata: {
        method: 'manual',
        timestamp: new Date().toISOString()
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
            model: 'gpt-3.5-turbo',
            messages: [{
              role: "system",
              content: "You are a product information extractor. Extract product details from the given caption."
            }, {
              role: "user",
              content: `Extract product name, product code, vendor ID, purchase date, and quantity from this caption: ${captionToAnalyze}`
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
        
        // We could further process AI response here to extract structured fields
        // For now, we just log it and continue with manual parsing
      } catch (error) {
        console.error('AI analysis error:', error);
        // Continue with manual parsing results if AI fails
      }
    }

    // Update message with new analyzed content
    const { error: updateError } = await supabaseClient
      .from('messages')
      .update({
        analyzed_content: analyzedContent,
        processing_state: 'completed',
        processing_completed_at: new Date().toISOString(),
        old_analyzed_content: existingMessage?.analyzed_content 
          ? [...(existingMessage.old_analyzed_content || []), existingMessage.analyzed_content]
          : []
      })
      .eq('id', messageId);

    if (updateError) {
      console.error('Error updating message:', updateError);
      throw updateError;
    }

    // If this is part of a media group, sync the analyzed content
    if (messageGroupId) {
      console.log('Syncing analyzed content to media group:', {
        media_group_id: messageGroupId,
        message_id: messageId
      });
      
      const { error: syncError } = await supabaseClient
        .rpc('xdelo_sync_media_group_content', {
          p_source_message_id: messageId,
          p_media_group_id: messageGroupId,
          p_correlation_id: correlationId
        });

      if (syncError) {
        console.error('Error syncing media group:', {
          error: syncError,
          media_group_id: messageGroupId,
          message_id: messageId
        });
        throw syncError;
      }

      console.log('Media group sync completed successfully');
    }

    // Log the analysis completion
    await supabaseClient.from('unified_audit_logs').insert({
      event_type: 'caption_analyzed',
      entity_id: messageId,
      previous_state: existingMessage?.analyzed_content,
      new_state: analyzedContent,
      metadata: {
        parsing_method: analyzedContent.parsing_metadata.method,
        product_name_length: productName.length,
        correlation_id: correlationId
      },
      event_timestamp: new Date().toISOString()
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
