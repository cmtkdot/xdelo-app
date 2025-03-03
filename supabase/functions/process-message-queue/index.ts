
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

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
    // Create a Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('Starting message queue processing');

    // Get the next message for processing
    const { data: nextMessage, error: queueError } = await supabase
      .rpc('xdelo_get_next_message_for_processing');

    if (queueError) {
      console.error('Error getting next message:', queueError);
      throw queueError;
    }

    // If no messages to process
    if (!nextMessage || nextMessage.length === 0) {
      console.log('No messages in the queue to process');
      return new Response(
        JSON.stringify({ success: true, message: 'No messages to process' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const {
      queue_id: queueId,
      message_id: messageId,
      correlation_id: correlationId,
      caption,
      media_group_id: mediaGroupId
    } = nextMessage[0];

    console.log('Processing message from queue:', {
      queueId,
      messageId, 
      correlationId,
      captionLength: caption?.length || 0,
      mediaGroupId
    });

    try {
      // Process the message using the same logic from parse-caption-with-ai
      const parsedContent = await processMessageCaption(caption, correlationId);
      
      // Mark as completed with the analyzed content
      const { error: completeError } = await supabase
        .rpc('xdelo_complete_message_processing', {
          p_queue_id: queueId,
          p_analyzed_content: parsedContent
        });

      if (completeError) {
        throw completeError;
      }

      console.log('Successfully processed message:', { messageId, queueId });

      return new Response(
        JSON.stringify({ 
          success: true, 
          messageId, 
          queueId,
          analyzedContent: parsedContent
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } catch (processingError) {
      console.error('Error processing message:', processingError);
      
      // Mark as failed
      const { error: failError } = await supabase
        .rpc('xdelo_fail_message_processing', {
          p_queue_id: queueId,
          p_error: processingError.message || 'Unknown error during processing'
        });

      if (failError) {
        console.error('Error marking message as failed:', failError);
      }

      throw processingError;
    }
  } catch (error) {
    console.error('Error in process-message-queue function:', error);
    
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

// Function to process message caption using AI
async function processMessageCaption(caption: string, correlationId: string): Promise<any> {
  if (!caption) {
    throw new Error('Caption cannot be empty');
  }

  console.log('Processing caption:', caption.substring(0, 50) + '...');

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

  return analyzedContent;
}
