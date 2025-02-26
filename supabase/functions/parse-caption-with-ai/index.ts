
import { createClient } from "@supabase/supabase-js";
import { corsHeaders } from "../_shared/cors.ts";
import { Database } from "../_shared/types.ts";
import { createHandler } from "../_shared/baseHandler.ts";

interface RequestPayload {
  messageId: string;
  media_group_id?: string;
  caption: string;
  correlationId: string;
}

const processCaption = async (
  supabase: any,
  messageId: string,
  caption: string,
  correlationId: string
) => {
  try {
    // Get existing message first
    const { data: existingMessage } = await supabase
      .from('messages')
      .select('analyzed_content, old_analyzed_content')
      .eq('id', messageId)
      .single();

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
        const API_KEY = Deno.env.get('OPENAI_API_KEY');
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
      }
    }

    // Prepare the update data
    const updateData = {
      old_analyzed_content: existingMessage?.analyzed_content 
        ? [...(existingMessage.old_analyzed_content || []), existingMessage.analyzed_content]
        : existingMessage?.old_analyzed_content,
      analyzed_content: analyzedContent,
      processing_state: 'completed' as const,
      processing_completed_at: new Date().toISOString()
    };

    // Update the message with new analyzed content
    const { error: updateError } = await supabase
      .from('messages')
      .update(updateData)
      .eq('id', messageId);

    if (updateError) throw updateError;

    // Log the analysis event
    await supabase.from('unified_audit_logs').insert({
      event_type: 'caption_analyzed',
      entity_id: messageId,
      previous_state: existingMessage?.analyzed_content,
      new_state: analyzedContent,
      metadata: {
        parsing_method: analyzedContent.parsing_metadata.method,
        product_name_length: productName.length,
        correlation_id: correlationId
      }
    });

    return {
      success: true,
      data: analyzedContent
    };
  } catch (error) {
    console.error('Error in processCaption:', error);
    throw error;
  }
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  return createHandler(req, async (supabaseClient, body: RequestPayload) => {
    const { messageId, caption, correlationId } = body;

    if (!messageId || !caption) {
      throw new Error('Missing required fields: messageId or caption');
    }

    const result = await processCaption(
      supabaseClient,
      messageId,
      caption,
      correlationId
    );

    return result;
  });
});
