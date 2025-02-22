import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

type ProcessingState = 'initialized' | 'pending' | 'processing' | 'completed' | 'error';

interface AnalyzedContent {
  product_name?: string;
  product_code?: string;
  vendor_uid?: string;
  quantity?: number;
  purchase_date?: string;
  notes?: string;
  parsing_metadata: {
    method: 'manual' | 'ai';
    timestamp: string;
    needs_ai_analysis?: boolean;
    confidence?: number;
    fallbacks_used?: string[];
  };
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function calculateConfidence(result: AnalyzedContent, fallbacks: string[], caption: string): number {
  let score = 1.0;
  
  // Structure Analysis (40% weight)
  const hasExpectedFormat = caption.match(/^[^#\n]+#[A-Z]{1,4}\d{5,6}/);
  const hasQuantityPattern = /\d+\s*(?:x|pcs|pieces|kg|g|meters|m|boxes)/i.test(caption);
  const hasLineBreaks = caption.includes('\n');
  const hasParentheses = /\(.*\)/.test(caption);
  
  if (hasExpectedFormat) score += 0.2;
  if (!hasQuantityPattern) score -= 0.3;
  if (hasLineBreaks && hasParentheses) score += 0.1;
  
  // Data Quality (40% weight)
  if (result.product_code) {
    const isValidFormat = /^[A-Z]{1,4}\d{5,6}$/.test(result.product_code);
    score += isValidFormat ? 0.2 : -0.2;
    
    if (result.vendor_uid && result.purchase_date) {
      score += 0.2;
    }
  } else {
    score -= 0.4;
  }
  
  if (result.quantity && result.quantity > 0) {
    const isReasonable = result.quantity > 0 && result.quantity < 10000;
    score += isReasonable ? 0.2 : -0.1;
  } else {
    score -= 0.3;
  }
  
  // Product Name Quality
  if (result.product_name && result.product_name !== caption) {
    const isReasonableLength = result.product_name.length > 3 && result.product_name.length < 100;
    score += isReasonableLength ? 0.1 : -0.1;
  }
  
  // Fallbacks Impact (20% weight)
  const criticalFallbacks = ['no_product_code', 'no_quantity'];
  const hasCriticalFallbacks = fallbacks.some(f => criticalFallbacks.includes(f));
  
  if (hasCriticalFallbacks) {
    score -= 0.3;
  } else {
    score -= fallbacks.length * 0.1;
  }
  
  return Math.max(0.1, Math.min(1, score));
}

function parseQuantity(caption: string): { value: number; confidence: number } | null {
  const patterns = [
    /x\s*(\d+)/i,                    // x2 or x 2
    /qty:\s*(\d+)/i,                 // qty: 2
    /quantity:\s*(\d+)/i,            // quantity: 2
    /(\d+)\s*(?:pcs|pieces)/i,       // 2 pcs or 2 pieces
    /(\d+)\s*(?:units?)/i,           // 2 unit or 2 units
    /(\d+)\s*(?=\s|$)/               // standalone number
  ];

  for (const pattern of patterns) {
    const match = caption.match(pattern);
    if (match) {
      const value = parseInt(match[1], 10);
      if (value > 0 && value < 10000) {
        return {
          value,
          confidence: 0.9
        };
      }
    }
  }

  return null;
}

function extractProductInfo(caption: string): AnalyzedContent {
  if (!caption || caption.trim().length === 0) {
    return {
      parsing_metadata: {
        method: 'manual',
        timestamp: new Date().toISOString(),
        needs_ai_analysis: true,
        confidence: 0.1
      }
    };
  }

  const fallbacks_used: string[] = [];
  const result: AnalyzedContent = {
    parsing_metadata: {
      method: 'manual',
      timestamp: new Date().toISOString()
    }
  };

  // Extract product name and code
  const hashtagMatch = caption.match(/([^#]+)\s*#([A-Za-z0-9-]+)/);
  if (hashtagMatch) {
    result.product_name = hashtagMatch[1].trim();
    result.product_code = hashtagMatch[2].trim();
  } else {
    result.product_name = caption.split('#')[0].trim();
    fallbacks_used.push('no_product_code');
  }

  // Extract quantity using enhanced parser
  const quantityResult = parseQuantity(caption);
  if (quantityResult) {
    result.quantity = quantityResult.value;
  } else {
    fallbacks_used.push('no_quantity');
  }

  // Extract vendor UID and purchase date from product code
  if (result.product_code) {
    const vendorMatch = result.product_code.match(/^([A-Za-z]{1,4})/);
    if (vendorMatch) {
      result.vendor_uid = vendorMatch[1].toUpperCase();
      
      // Extract and parse date
      const dateStr = result.product_code.substring(vendorMatch[1].length);
      if (/^\d{5,6}$/.test(dateStr)) {
        try {
          const paddedDate = dateStr.length === 5 ? '0' + dateStr : dateStr;
          const month = paddedDate.substring(0, 2);
          const day = paddedDate.substring(2, 4);
          const year = '20' + paddedDate.substring(4, 6);
          
          const date = new Date(`${year}-${month}-${day}`);
          if (!isNaN(date.getTime()) && date <= new Date()) {
            result.purchase_date = `${year}-${month}-${day}`;
          } else {
            fallbacks_used.push('invalid_date');
          }
        } catch (error) {
          console.error("Date parsing error:", error);
          fallbacks_used.push('date_parse_error');
        }
      }
    }
  }

  // Extract notes (text in parentheses or remaining text)
  const notesMatch = caption.match(/\((.*?)\)/);
  if (notesMatch) {
    result.notes = notesMatch[1].trim();
  } else {
    // If no parentheses, look for any remaining text after the product code and quantity
    const remainingText = caption
      .replace(/#[A-Za-z0-9-]+/, '') // Remove product code
      .replace(/x\s*\d+/, '')        // Remove quantity
      .replace(result.product_name || '', '')  // Remove product name
      .trim();
    
    if (remainingText) {
      result.notes = remainingText;
    }
  }

  // Calculate confidence and determine if AI analysis is needed based on product name length
  const confidence = calculateConfidence(result, fallbacks_used, caption);
  result.parsing_metadata.confidence = confidence;
  result.parsing_metadata.needs_ai_analysis = (result.product_name?.length || 0) > 20;

  if (fallbacks_used.length > 0) {
    result.parsing_metadata.fallbacks_used = fallbacks_used;
  }

  return result;
}

async function syncMediaGroup(
  supabase: SupabaseClient,
  sourceMessageId: string,
  media_group_id: string,
  analyzedContent: AnalyzedContent
): Promise<{ group_message_count: number }> {
  // Get count of messages in the group
  const { count: totalCount } = await supabase
    .from('messages')
    .select('*', { count: 'exact', head: true })
    .eq('media_group_id', media_group_id);

  // Update all messages in the group
  const { error: updateError } = await supabase
    .from('messages')
    .update({
      analyzed_content: analyzedContent,
      processing_state: 'completed',
      processing_completed_at: new Date().toISOString(),
      group_caption_synced: true,
      message_caption_id: sourceMessageId,  // Set the source message ID as the caption reference
      is_original_caption: false,  // These are not the original caption messages
      updated_at: new Date().toISOString(),
      group_message_count: totalCount || 1
    })
    .eq('media_group_id', media_group_id)
    .neq('id', sourceMessageId);

  if (updateError) throw updateError;

  return { group_message_count: totalCount || 1 };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  let sourceMessageId: string | null = null;

  try {
    const body = await req.json();
    const { messageId, caption, media_group_id } = body;
    sourceMessageId = messageId; // Store messageId in wider scope for error handling

    if (!messageId || !caption) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters' }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Parse the caption
    const parsedContent = extractProductInfo(caption);

    // Update source message first
    const { error: updateError } = await supabase
      .from('messages')
      .update({
        analyzed_content: parsedContent,
        processing_state: 'completed',
        processing_started_at: new Date().toISOString(),
        processing_completed_at: new Date().toISOString(),
        is_original_caption: true,        // This is the original caption message
        message_caption_id: messageId,    // Reference itself as the caption source
        updated_at: new Date().toISOString()
      })
      .eq('id', messageId);

    if (updateError) throw updateError;

    // If part of a media group, sync other messages
    let group_message_count;
    if (media_group_id) {
      const syncResult = await syncMediaGroup(supabase, messageId, media_group_id, parsedContent);
      group_message_count = syncResult.group_message_count;
    }

    return new Response(
      JSON.stringify({
        success: true,
        analyzed_content: parsedContent,
        needs_ai_analysis: parsedContent.parsing_metadata?.needs_ai_analysis,
        group_message_count: group_message_count || 1
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error processing message:', error);

    // Only try to update error state if we have a messageId
    if (sourceMessageId) {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      );

      try {
        await supabase
          .from('messages')
          .update({
            processing_state: 'error',
            error_message: error.message,
            processing_completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', sourceMessageId);
      } catch (stateError) {
        console.error('Error updating error state:', stateError);
      }
    }

    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
