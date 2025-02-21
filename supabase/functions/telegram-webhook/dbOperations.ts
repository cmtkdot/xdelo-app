import { SupabaseClient, ExistingMessage, ProcessingState, MessageData } from "./types.ts";
import { ParsedContent, QuantityParseResult } from "../_shared/types.ts";

export async function findExistingMessage(
  supabase: SupabaseClient,
  fileUniqueId: string
): Promise<ExistingMessage | null> {
  try {
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("file_unique_id", fileUniqueId)
      .maybeSingle();

    if (error) {
      console.error("❌ Error checking for existing message:", error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error("❌ Error in findExistingMessage:", error);
    throw error;
  }
}

export async function updateExistingMessage(
  supabase: SupabaseClient,
  message_id: string,
  updates: Partial<MessageData>
) {
  try {
    const { error } = await supabase
      .from("messages")
      .update(updates)
      .eq("id", message_id);

    if (error) throw error;
  } catch (error) {
    console.error("Error updating message:", error);
    throw error;
  }
}

export async function createNewMessage(
  supabase: SupabaseClient,
  messageData: MessageData
) {
  try {
    const { data: newMessage, error: messageError } = await supabase
      .from("messages")
      .insert({
        ...messageData,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (messageError) {
      console.error("❌ Failed to store message:", messageError);
      throw messageError;
    }

    return newMessage;
  } catch (error) {
    console.error("❌ Error in createNewMessage:", error);
    throw error;
  }
}

export async function triggerCaptionParsing(
  supabase: SupabaseClient,
  message_id: string,
  mediaGroupId: string | undefined,
  caption: string
) {
  try {
    console.log("🔄 Triggering caption parsing for message:", message_id);
    
    // Update message state to pending
    await updateExistingMessage(supabase, message_id, {
      processing_state: 'pending'
    });

    // Call parse-caption-with-ai edge function
    const { error } = await supabase.functions.invoke('parse-caption-with-ai', {
      body: {
        message_id: message_id,
        media_group_id: mediaGroupId,
        caption,
        correlation_id: crypto.randomUUID()
      }
    });

    if (error) throw error;
    console.log("✅ Caption parsing triggered successfully");
  } catch (error) {
    console.error("❌ Error triggering caption parsing:", error);
    
    // Update message state to error
    await updateExistingMessage(supabase, message_id, {
      processing_state: 'error',
      error_message: error.message
    });
    
    throw error;
  }
}

export function parseQuantity(caption: string): QuantityParseResult | null {
  // Look for patterns like "x2", "x 2", "qty: 2", "quantity: 2"
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
      if (value > 0 && value < 10000) { // Reasonable quantity range
        return {
          value,
          confidence: 0.9 // High confidence for explicit patterns
        };
      }
    }
  }

  return null;
}

function calculateConfidence(result: ParsedContent, fallbacks: string[], caption: string): number {
  let score = 1.0;
  
  // Deduct points for each missing or fallback field
  if (fallbacks.includes('no_product_name_marker')) score -= 0.2;
  if (fallbacks.includes('no_product_code')) score -= 0.3;
  if (fallbacks.includes('no_quantity')) score -= 0.2;
  if (fallbacks.includes('invalid_date')) score -= 0.15;
  if (fallbacks.includes('date_parse_error')) score -= 0.15;
  
  // Bonus for longer, more detailed captions
  if (caption.length > 50) score += 0.1;
  if (result.notes) score += 0.1;
  
  // Ensure score stays within 0-1 range
  return Math.max(0, Math.min(1, score));
}

export async function manualParse(caption: string): Promise<ParsedContent> {
  console.log("Starting manual parsing for:", caption);
  const result: ParsedContent = {};
  const fallbacks_used: string[] = [];

  // Extract product name (text before line break, dash, # or x)
  const xIndex = caption.toLowerCase().indexOf('x');
  const hashIndex = caption.indexOf('#');
  const lineBreakIndex = caption.indexOf('\n');
  const dashIndex = caption.indexOf('-');
  let endIndex = caption.length;
  
  if (xIndex > 0) endIndex = Math.min(endIndex, xIndex);
  if (hashIndex > 0) endIndex = Math.min(endIndex, hashIndex);
  if (lineBreakIndex > 0) endIndex = Math.min(endIndex, lineBreakIndex);
  if (dashIndex > 0) endIndex = Math.min(endIndex, dashIndex);
  
  const productNameMatch = caption.substring(0, endIndex).trim();
  if (productNameMatch) {
    result.product_name = productNameMatch;
  } else {
    result.product_name = caption.trim();
    fallbacks_used.push('no_product_name_marker');
  }

  // Extract product code and vendor UID
  const codeMatch = caption.match(/#([A-Za-z0-9-]+)/);
  if (codeMatch) {
    result.product_code = codeMatch[1];
    
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
  } else {
    fallbacks_used.push('no_product_code');
  }

  // Parse quantity
  const quantityResult = parseQuantity(caption);
  if (quantityResult) {
    result.quantity = quantityResult.value;
  } else {
    fallbacks_used.push('no_quantity');
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
      .replace(productNameMatch, '')  // Remove product name
      .trim();
    
    if (remainingText) {
      result.notes = remainingText;
    }
  }

  const confidence = calculateConfidence(result, fallbacks_used, caption);
  
  result.parsing_metadata = {
    method: 'manual',
    confidence,
    fallbacks_used: fallbacks_used.length ? fallbacks_used : undefined,
    timestamp: new Date().toISOString()
  };

  return result;
}

export async function updateMessageWithParsedContent(
  supabase: SupabaseClient,
  messageId: string,
  caption: string
): Promise<void> {
  try {
    const parsedContent = await manualParse(caption);
    
    const { error } = await supabase
      .from('messages')
      .update({
        analyzed_content: parsedContent,
        processing_state: 'completed',
        processing_completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', messageId);

    if (error) throw error;

  } catch (error) {
    console.error("Error updating message with parsed content:", error);
    throw error;
  }
}

export async function syncMediaGroupContent(
  supabase: SupabaseClient,
  sourceMessageId: string,
  mediaGroupId: string
): Promise<void> {
  try {
    // First sync the content across the media group
    const { error } = await supabase.rpc('xdelo_sync_media_group_content', {
      p_source_message_id: sourceMessageId,
      p_media_group_id: mediaGroupId,
      p_correlation_id: crypto.randomUUID()
    });

    if (error) throw error;

    // After successful sync, get all messages in the group
    const { data: messages, error: fetchError } = await supabase
      .from('messages')
      .select('*')
      .eq('media_group_id', mediaGroupId);

    if (fetchError) throw fetchError;
    if (!messages) return;

    // Process each message's media
    for (const message of messages) {
      const mediaInfo = extractMediaInfo(message.telegram_data);
      if (!mediaInfo) continue;

      // Download and process media
      const publicUrl = await downloadMedia(supabase, mediaInfo, message.id);
      if (!publicUrl) {
        console.error(`Failed to process media for message ${message.id}`);
      }
    }
    
  } catch (error) {
    console.error("Error in syncMediaGroupContent:", error);
    throw error;
  }
}