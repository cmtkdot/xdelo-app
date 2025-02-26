import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { Configuration, OpenAIApi } from "https://esm.sh/openai@3.2.1";import { corsHeaders } from "../_shared/cors.ts";
import { AnalyzedContent, ProcessingState } from "../_shared/types.ts";
import { validateAnalyzedContent } from "../_shared/validators.ts";
import { getLogger } from "../telegram-webhook/logger.ts";  // <-- Adjust path as needed
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
type LogData = Record<string, string | number | boolean | null | undefined | string[] | number[] | Record<string, unknown>>;

interface Logger {
  info: (message: string, data?: LogData) => void;
  error: (message: string, data?: LogData) => void;
  warn: (message: string, data?: LogData) => void;
}

const SYSTEM_PROMPT = `You are a specialized product information extractor. Extract structured information following these rules:

1. Required Structure:
   - product_name: Text before '#', REQUIRED, must always be present
   - product_code: Value after '#' (format: #[vendor_uid][purchasedate])
   - vendor_uid: 1-4 letters after '#' before numeric date
   - purchase_date: Convert mmDDyy/mDDyy to YYYY-MM-DD format (add leading zero for 5-digit dates)
   - quantity: Integer after 'x'
   - notes: Any other values (in parentheses or remaining text)

2. Parsing Rules:
   - Dates: 
     * 6 digits: mmDDyy (120523 → 2023-12-05)
     * 5 digits: mDDyy (31524 → 2024-03-15)
   - Vendor IDs:
     * First 1-4 letters followed by optional valid date digits
     * If invalid date digits, append with hyphen (CHAD123 → CHAD-123)

3. Validation:
   - Only product_name is required
   - All other fields nullable if not found
   - Flag validation errors in 'notes' field

Example Input: "Blue Dream #CHAD120523 x2"
Expected Output: {
  "product_name": "Blue Dream",
  "product_code": "CHAD120523",
  "vendor_uid": "CHAD",
  "purchase_date": "2023-12-05",
  "quantity": 2
}`;

// Quantity parser function
function parseQuantity(caption: string): { value: number } | null {
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
        return { value };
      }
    }
  }
  return null;
}

// Manual parser function
function manualParse(caption: string, logger: Logger): AnalyzedContent {
  logger.info("Starting manual parsing");
  const result: AnalyzedContent = {};
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

  // Check if product name exceeds 23 characters - if so, flag for AI analysis
  const needsAiAnalysis = result.product_name && result.product_name.length > 23;
  
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
          logger.error("Date parsing error", { error: error.message });
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

  result.parsing_metadata = {
    method: 'manual',
    timestamp: new Date().toISOString(),
    fallbacks_used: fallbacks_used.length ? fallbacks_used : undefined,
    needs_ai_analysis: needsAiAnalysis || !result.product_code || !result.quantity
  };

  logger.info("Manual parsing result", {
    product_name: result.product_name,
    product_code: result.product_code,
    quantity: result.quantity,
    needs_ai_analysis: result.parsing_metadata.needs_ai_analysis,
    fallbacks: fallbacks_used
  });

  return result;
}

// AI analysis function
async function analyzeWithAI(caption: string, logger: Logger): Promise<AnalyzedContent> {
  logger.info("Starting AI analysis");
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
          { role: 'system', content: SYSTEM_PROMPT },
          { 
            role: 'user', 
            content: `Please analyze this product caption, preserving all emojis:\n${caption}`
          }
        ],
        temperature: 0.3,
        max_tokens: 500
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const data = await response.json();
    const result = JSON.parse(data.choices[0].message.content);

    // Clean up and validate the result
    const cleanResult: AnalyzedContent = {
      product_name: result.product_name?.trim() || caption.split('\n')[0]?.trim() || 'Untitled Product',
      product_code: result.product_code || '',
      vendor_uid: result.vendor_uid || '',
      purchase_date: result.purchase_date || '',
      quantity: typeof result.quantity === 'number' ? Math.max(0, Math.floor(result.quantity)) : undefined,
      notes: result.notes || '',
      parsing_metadata: {
        method: 'ai',
        timestamp: new Date().toISOString()
      }
    };

    logger.info('AI analysis completed', {
      product_name: cleanResult.product_name,
      product_code: cleanResult.product_code,
      quantity: cleanResult.quantity
    });
    
    return cleanResult;
  } catch (error) {
    logger.error('Error in AI analysis', { error: error.message });
    
    // Return basic info even if analysis fails
    return {
      product_name: caption.split('\n')[0]?.trim() || 'Untitled Product',
      notes: '',
      parsing_metadata: {
        method: 'ai',
        timestamp: new Date().toISOString(),
        fallbacks_used: ['ai_error']
      }
    };
  }
}

// Main handler
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  let sourceMessageId: string | null = null;

  try {
    // 2) Parse the request body
    const body = await req.json();

    // 3) Use metadata?.correlationId or generate a new one
    const correlationId = body.metadata?.correlationId || `log_${crypto.randomUUID()}`;

    // 4) Extract other fields, including any webhookCorrelationId
    const { 
      messageId, 
      caption, 
      media_group_id, 
      correlation_id: webhookCorrelationId, 
      is_edit, 
      is_channel_post 
    } = body;

    // 5) Decide final correlation ID and create logger
    const requestCorrelationId = webhookCorrelationId || correlationId;
    const logger = getLogger(requestCorrelationId);

    sourceMessageId = messageId; // For error handling fallback

    logger.info('Received caption analysis request', { 
      messageId, 
      captionLength: caption?.length,
      hasMediaGroup: !!media_group_id,
      is_edit: !!is_edit,
      is_channel_post: !!is_channel_post
    });

    if (!messageId || !caption) {
      logger.error('Missing required parameters', { 
        hasMessageId: !!messageId, 
        hasCaption: !!caption 
      });
      
      return new Response(
        JSON.stringify({ 
          error: 'Missing required parameters',
          correlation_id: requestCorrelationId
        }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 6) Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // 7) Parse caption manually
    logger.info('Parsing caption', { captionLength: caption.length });
    const manualResult = manualParse(caption, logger);
    
    // 8) Check if AI analysis is needed
    let finalAnalyzedContent: AnalyzedContent = manualResult;
    
    if (manualResult.parsing_metadata?.needs_ai_analysis) {
      logger.info('Caption requires AI analysis', { 
        product_name: manualResult.product_name,
        product_name_length: manualResult.product_name?.length
      });
      
      try {
        const aiResult = await analyzeWithAI(caption, logger);
        // Merge results, preferring AI for complex scenarios
        finalAnalyzedContent = {
          ...aiResult,
          parsing_metadata: {
            method: 'hybrid',
            timestamp: new Date().toISOString()
          }
        };
        
        logger.info('AI analysis successful', {
          product_name: finalAnalyzedContent.product_name,
          product_code: finalAnalyzedContent.product_code
        });
      } catch (aiError) {
        logger.error('Error in AI analysis, using manual results', { 
          error: aiError.message 
        });
        // Continue with manual parsing results
      }
    }

    // 9) Fetch the current message state from DB
    const { data: currentMessage, error: fetchError } = await supabase
      .from('messages')
      .select('*')
      .eq('id', messageId)
      .single();
      
    if (fetchError) {
      logger.error('Error fetching current message state', { error: fetchError.message });
      throw fetchError;
    }
    
    // 10) Prepare new state
    const newState = {
      analyzed_content: finalAnalyzedContent,
      processing_state: 'completed',
      processing_started_at: new Date().toISOString(),
      processing_completed_at: new Date().toISOString(),
      is_original_caption: true,
      message_caption_id: messageId,
      processing_correlation_id: requestCorrelationId,
      updated_at: new Date().toISOString()
    };
    
    // 11) Update message in DB
    logger.info('Updating message with analyzed content', { 
      messageId, 
      hasMediaGroup: !!media_group_id 
    });
    
    const { error: updateError } = await supabase
      .from('messages')
      .update(newState)
      .eq('id', messageId);

    if (updateError) {
      logger.error('Error updating message', { error: updateError.message });
      throw updateError;
    }
    
    // 12) Log analysis event via RPC
    await supabase.rpc('xdelo_log_event', {
      p_event_type: 'message_analyzed',
      p_entity_id: messageId,
      p_telegram_message_id: currentMessage.telegram_message_id,
      p_chat_id: currentMessage.chat_id,
      p_previous_state: { processing_state: currentMessage.processing_state },
      p_new_state: { 
        processing_state: 'completed',
        analyzed_content: finalAnalyzedContent
      },
      p_metadata: {
        analysis_method: finalAnalyzedContent.parsing_metadata?.method || 'unknown',
        has_media_group: !!media_group_id,
        is_edit: !!is_edit,
        is_channel_post: !!is_channel_post
      },
      p_correlation_id: requestCorrelationId,
      p_user_id: currentMessage.user_id
    });
    
    // 13) Let DB trigger handle media group syncing
    if (media_group_id) {
      logger.info('Message is part of a media group, database trigger will sync', { 
        media_group_id 
      });
    }

    logger.info('Caption analysis completed successfully');
    return new Response(
      JSON.stringify({
        success: true,
        analyzed_content: finalAnalyzedContent,
        correlation_id: requestCorrelationId,
        is_edit: !!is_edit,
        is_channel_post: !!is_channel_post
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    // Use the top-level logger since we might fail before building the requestLogger
    console.error('❌ Error processing message', { 
      error: error.message,
      stack: error.stack
    });

    // 14) Update error state if we have a messageId
    if (sourceMessageId) {
      console.log('ℹ️ Updating message to error state', { messageId: sourceMessageId });
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      );

      try {
        // Get current message
        const { data: currentMessage, error: fetchError } = await supabase
          .from('messages')
          .select('*')
          .eq('id', sourceMessageId)
          .single();
          
        if (!fetchError && currentMessage) {
          await supabase
            .from('messages')
            .update({
              processing_state: 'error',
              error_message: error.message,
              processing_completed_at: new Date().toISOString(),
              // Use the fallback correlationId if requestLogger wasn't established
              processing_correlation_id: sourceMessageId, 
              updated_at: new Date().toISOString()
            })
            .eq('id', sourceMessageId);
            
          await supabase.rpc('xdelo_log_event', {
            p_event_type: 'message_analyzed',
            p_entity_id: sourceMessageId,
            p_telegram_message_id: currentMessage.telegram_message_id,
            p_chat_id: currentMessage.chat_id,
            p_previous_state: { processing_state: currentMessage.processing_state },
            p_new_state: { processing_state: 'error' },
            p_metadata: {
              error_message: error.message,
              stack_trace: error.stack,
              has_media_group: !!currentMessage.media_group_id
            },
            p_correlation_id: sourceMessageId,
            p_user_id: currentMessage.user_id,
            p_error_message: error.message
          });
        }
      } catch (stateError) {
        console.error('❌ Error updating error state', { error: stateError.message });
      }
    }

    return new Response(
      JSON.stringify({ 
        error: error.message,
        correlation_id: sourceMessageId || "unknown_correlation_id"
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
