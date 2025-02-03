import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ParseRequest {
  message_id: string;
  media_group_id?: string;
}

function parseCaption(caption: string) {
  console.log("Parsing caption:", caption);
  const result: Record<string, any> = {};

  // Extract product name (everything before #)
  const productNameMatch = caption.split('#')[0].trim();
  if (productNameMatch) {
    result.product_name = productNameMatch;
  }

  // Extract product code and parse vendor/date
  const codeMatch = caption.match(/#([A-Za-z0-9-]+)/);
  if (codeMatch) {
    const code = codeMatch[1];
    result.product_code = code;

    // Extract vendor UID (1-4 letters at start)
    const vendorMatch = code.match(/^([A-Za-z]{1,4})/);
    if (vendorMatch) {
      result.vendor_uid = vendorMatch[1];

      // Extract and parse date
      const dateStr = code.substring(vendorMatch[1].length);
      if (/^\d{5,6}$/.test(dateStr)) {
        try {
          // Pad with leading zero if 5 digits
          const paddedDate = dateStr.length === 5 ? '0' + dateStr : dateStr;
          const month = paddedDate.substring(0, 2);
          const day = paddedDate.substring(2, 4);
          const year = '20' + paddedDate.substring(4, 6);
          
          const date = new Date(`${year}-${month}-${day}`);
          if (!isNaN(date.getTime())) {
            result.purchase_date = `${year}-${month}-${day}`;
          }
        } catch (error) {
          console.error("Date parsing error:", error);
        }
      } else if (dateStr) {
        // If invalid date format, append with hyphen
        result.product_code = `${result.vendor_uid}-${dateStr}`;
      }
    }
  }

  // Extract quantity (x followed by number)
  const quantityMatch = caption.match(/x\s*(\d+)/i);
  if (quantityMatch) {
    result.quantity = parseInt(quantityMatch[1]);
  }

  // Extract notes (text in parentheses or remaining text)
  const notesMatch = caption.match(/\((.*?)\)/);
  if (notesMatch) {
    result.notes = notesMatch[1].trim();
  } else {
    // If no parentheses, look for any remaining text
    const remainingText = caption
      .replace(/#[A-Za-z0-9-]+/, '') // Remove product code
      .replace(/x\s*\d+/, '')       // Remove quantity
      .replace(productNameMatch, '') // Remove product name
      .trim();
    
    if (remainingText) {
      result.notes = remainingText;
    }
  }

  console.log("Parsed result:", result);
  return result;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { message_id, media_group_id } = await req.json() as ParseRequest;
    console.log(`Processing caption parsing for message ${message_id}`);

    // Get message with synced caption
    const { data: message, error: messageError } = await supabase
      .from('messages')
      .select('*')
      .eq('id', message_id)
      .single();

    if (messageError) throw messageError;
    if (!message?.synced_caption) {
      throw new Error('No synced caption found for parsing');
    }

    // Parse the caption
    const caption = message.synced_caption.caption;
    const parsedContent = parseCaption(caption);

    // Update the message with parsed content
    const { error: updateError } = await supabase
      .from('messages')
      .update({
        parsed_content: parsedContent,
        processing_state: 'completed'
      })
      .eq('id', message_id);

    if (updateError) throw updateError;

    // If part of a media group, update all related messages
    if (media_group_id) {
      const { error: groupUpdateError } = await supabase
        .from('messages')
        .update({
          parsed_content: parsedContent,
          processing_state: 'completed'
        })
        .eq('media_group_id', media_group_id)
        .neq('id', message_id);

      if (groupUpdateError) throw groupUpdateError;
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        parsed_content: parsedContent 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error parsing caption:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});