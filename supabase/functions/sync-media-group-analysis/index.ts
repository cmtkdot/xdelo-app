import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SyncRequest {
  message_id: string;
  media_group_id: string;
  correlation_id?: string;
}

function parseCaption(caption: string): any {
  const result: any = {};
  
  // Extract product name (text before #)
  const hashIndex = caption.indexOf('#');
  if (hashIndex > 0) {
    result.product_name = caption.substring(0, hashIndex).trim();
  } else {
    result.product_name = caption.trim();
  }

  // Extract product code and other details
  const codeMatch = caption.match(/#([A-Za-z0-9]+)/);
  if (codeMatch) {
    const code = codeMatch[1];
    result.product_code = code;

    // Extract vendor UID (letters before numbers)
    const vendorMatch = code.match(/^([A-Za-z]+)/);
    if (vendorMatch) {
      result.vendor_uid = vendorMatch[1];
    }

    // Extract and parse date
    const dateMatch = code.match(/(\d{5,6})/);
    if (dateMatch) {
      const dateStr = dateMatch[1];
      const paddedDate = dateStr.length === 5 ? '0' + dateStr : dateStr;
      const month = paddedDate.substring(0, 2);
      const day = paddedDate.substring(2, 4);
      const year = '20' + paddedDate.substring(4, 6);
      result.purchase_date = `${year}-${month}-${day}`;
    }
  }

  // Extract quantity
  const quantityMatch = caption.match(/x(\d+)/);
  if (quantityMatch) {
    result.quantity = parseInt(quantityMatch[1]);
  }

  // Extract notes (anything in parentheses or remaining text)
  const notesMatch = caption.match(/\((.*?)\)/);
  if (notesMatch) {
    result.notes = notesMatch[1].trim();
  } else {
    // Get any remaining text after the product code as notes
    const remainingText = caption.split('#')[1]?.split(/x\d+/)[1]?.trim();
    if (remainingText) {
      result.notes = remainingText;
    }
  }

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

    const { message_id, media_group_id, correlation_id } = await req.json() as SyncRequest;
    console.log(`Processing media group analysis for message ${message_id} in group ${media_group_id}`);

    // Get the message with caption
    const { data: message, error: messageError } = await supabase
      .from('messages')
      .select('*')
      .eq('id', message_id)
      .single();

    if (messageError) throw messageError;
    if (!message?.caption) {
      throw new Error('Message has no caption to analyze');
    }

    // Parse the caption
    const analyzed_content = parseCaption(message.caption);
    const processing_completed_at = new Date().toISOString();

    // Call the database function to sync the group
    const { error: syncError } = await supabase.rpc(
      'process_media_group_analysis',
      {
        p_message_id: message_id,
        p_media_group_id: media_group_id,
        p_analyzed_content: analyzed_content,
        p_processing_completed_at: processing_completed_at,
        p_correlation_id: correlation_id
      }
    );

    if (syncError) throw syncError;

    return new Response(
      JSON.stringify({ success: true, analyzed_content }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error processing media group:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});