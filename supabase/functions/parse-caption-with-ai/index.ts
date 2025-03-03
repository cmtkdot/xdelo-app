
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

// CORS headers for the function
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Create Supabase client
const supabaseClient = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

interface RequestPayload {
  messageId: string;
  media_group_id?: string;
  caption?: string;
  correlationId: string;
  queue_id?: string;
}

const processCaption = async (
  messageId: string,
  caption: string,
  correlationId: string,
  queueId?: string,
  mediaGroupId?: string
) => {
  try {
    console.log(`Processing caption for message ${messageId} with correlation ID ${correlationId}`);
    
    if (!caption || caption.trim() === '') {
      throw new Error('Cannot process empty caption');
    }
    
    // Get existing message first
    const { data: existingMessage, error: messageError } = await supabaseClient
      .from('messages')
      .select('analyzed_content, old_analyzed_content, media_group_id')
      .eq('id', messageId)
      .single();

    if (messageError) {
      throw new Error(`Failed to retrieve message: ${messageError.message}`);
    }

    // Extract product name (text before #, line break, or x)
    const productNameMatch = caption.match(/^(.*?)(?=[#\nx]|$)/);
    const productName = productNameMatch ? productNameMatch[0].trim() : '';

    // Extract product code (text following #)
    const productCodeMatch = caption.match(/#([A-Za-z0-9-]+)/);
    const productCode = productCodeMatch ? productCodeMatch[1] : '';

    // Extract vendor UID (first 1-4 letters of product code)
    const vendorUidMatch = productCode.match(/^[A-Za-z]{1,4}/);
    const vendorUid = vendorUidMatch ? vendorUidMatch[0].toUpperCase() : '';

    // Extract purchase date
    const dateMatch = productCode.match(/\d{5,6}/);
    let purchaseDate = '';
    if (dateMatch) {
      const dateStr = dateMatch[0];
      if (dateStr.length === 5) {
        // Format: mDDyy
        const month = dateStr[0];
        const day = dateStr.substring(1, 3);
        const year = dateStr.substring(3);
        purchaseDate = `20${year}-${month.padStart(2, '0')}-${day}`;
      } else if (dateStr.length === 6) {
        // Format: mmDDyy
        const month = dateStr.substring(0, 2);
        const day = dateStr.substring(2, 4);
        const year = dateStr.substring(4);
        purchaseDate = `20${year}-${month}-${day}`;
      }
    }

    // Extract quantity (number after x)
    const quantityMatch = caption.match(/x(\d+)/i);
    const quantity = quantityMatch ? parseInt(quantityMatch[1]) : null;

    // Extract notes (text in parentheses or remaining unclassified text)
    const notesMatch = caption.match(/\((.*?)\)/);
    const notes = notesMatch ? notesMatch[1].trim() : '';

    let analyzedContent = {
      product_name: productName,
      product_code: productCode,
      vendor_uid: vendorUid,
      purchase_date: purchaseDate,
      quantity: quantity,
      notes: notes,
      caption: caption,
      parsing_metadata: {
        method: 'manual',
        timestamp: new Date().toISOString()
      }
    };

    // If product name is longer than 23 characters, use AI analysis
    if (productName.length > 23) {
      try {
        console.log(`Product name longer than 23 chars, using AI analysis: ${productName}`);
        const API_KEY = Deno.env.get('OPENAI_API_KEY');
        
        if (!API_KEY) {
          throw new Error('OpenAI API key not found');
        }
        
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: "gpt-3.5-turbo",
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
        const aiAnalysis = result.choices[0].message.content;
        console.log(`AI analysis result: ${aiAnalysis}`);

        // Update analyzed content with AI results
        analyzedContent = {
          ...analyzedContent,
          parsing_metadata: {
            method: 'ai',
            timestamp: new Date().toISOString()
          }
        };
      } catch (error) {
        console.error('AI analysis error:', error);
        // Continue with manual parsing results if AI fails
        analyzedContent.parsing_metadata = {
          ...analyzedContent.parsing_metadata,
          ai_error: error.message
        };
      }
    }

    // Prepare the update data
    const updateData = {
      old_analyzed_content: existingMessage?.analyzed_content 
        ? [...(existingMessage.old_analyzed_content || []), existingMessage.analyzed_content]
        : existingMessage?.old_analyzed_content,
      analyzed_content: analyzedContent,
      processing_state: 'completed',
      processing_completed_at: new Date().toISOString()
    };

    console.log(`Updating message with analyzed content`);
    
    // If we have a queue ID, use the complete processing function
    if (queueId) {
      await supabaseClient.rpc('xdelo_complete_message_processing', {
        p_queue_id: queueId,
        p_analyzed_content: analyzedContent
      });
    } else {
      // Direct update if no queue ID is provided
      const { error: updateError } = await supabaseClient
        .from('messages')
        .update(updateData)
        .eq('id', messageId);

      if (updateError) throw updateError;
    }

    // Make sure to sync analyzed content to other messages in the group
    const groupId = mediaGroupId || existingMessage?.media_group_id;
    if (groupId) {
      console.log(`Syncing analyzed content to media group ${groupId}`);
      try {
        await supabaseClient.rpc('xdelo_sync_media_group_content', {
          p_media_group_id: groupId,
          p_source_message_id: messageId
        });
      } catch (syncError) {
        console.error('Error syncing media group content:', syncError);
        // Continue despite sync error
      }
    }

    // Log the analysis event
    await supabaseClient.from('unified_audit_logs').insert({
      event_type: 'caption_analyzed',
      entity_id: messageId,
      previous_state: existingMessage?.analyzed_content,
      new_state: analyzedContent,
      metadata: {
        parsing_method: analyzedContent.parsing_metadata.method,
        product_name_length: productName.length,
        correlation_id: correlationId,
        media_group_id: groupId
      }
    });

    return {
      success: true,
      data: analyzedContent
    };
  } catch (error) {
    console.error('Error in processCaption:', error);
    
    // If we have a queue ID, mark the processing as failed
    if (queueId) {
      try {
        await supabaseClient.rpc('xdelo_fail_message_processing', {
          p_queue_id: queueId,
          p_error_message: error.message
        });
      } catch (markError) {
        console.error('Error marking queue item as failed:', markError);
      }
    }
    
    throw error;
  }
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    console.log('Received payload:', JSON.stringify(payload, null, 2));
    
    const { messageId, caption, correlationId, queue_id, media_group_id } = payload;

    // Validate required fields
    const missingFields = [];
    if (!messageId) missingFields.push('messageId');
    if (!caption || caption.trim() === '') missingFields.push('caption');
    
    if (missingFields.length > 0) {
      throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
    }

    console.log(`Received request to process message ${messageId} with caption: "${caption.substring(0, 50)}..."`);
    
    const result = await processCaption(
      messageId,
      caption,
      correlationId || crypto.randomUUID(),
      queue_id,
      media_group_id
    );

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error processing message caption:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
