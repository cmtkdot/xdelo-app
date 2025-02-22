
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { Configuration, OpenAIApi } from "https://esm.sh/openai@3.2.1";

// Types
type ProcessingState = 'initialized' | 'pending' | 'processing' | 'completed' | 'error' | 'no_caption';

interface AnalyzedContent {
  product_name?: string;
  product_code?: string;
  vendor_uid?: string;
  purchase_date?: string;
  quantity?: number;
  notes?: string;
  parsing_metadata?: {
    method: 'manual' | 'ai' | 'hybrid';
    confidence: number;
    timestamp: string;
    needs_ai_analysis?: boolean;
  };
  sync_metadata?: {
    sync_source_message_id?: string;
    media_group_id?: string;
  };
}

interface MessageUpdate {
  analyzed_content: AnalyzedContent | null;
  processing_state: ProcessingState;
  processing_completed_at?: string;
  is_original_caption?: boolean;
  group_caption_synced?: boolean;
  message_caption_id?: string;
  error_message?: string;
  last_error_at?: string;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Manual parsing function
function extractProductInfo(caption: string): AnalyzedContent {
  const result: AnalyzedContent = {};
  
  // Split caption into lines
  const lines = caption.split('\n').map(line => line.trim());

  // Regular expressions for matching
  const vendorRegex = /^(?:vendor|supplier|from|by|uid):\s*(.+)/i;
  const productCodeRegex = /^(?:code|product|item|sku|id):\s*(.+)/i;
  const quantityRegex = /^(?:qty|quantity|amount|pcs):\s*(\d+)/i;
  const dateRegex = /^(?:date|purchased|bought|received):\s*(.+)/i;

  let hasFoundVendor = false;
  let hasFoundCode = false;

  for (const line of lines) {
    if (!hasFoundVendor && vendorRegex.test(line)) {
      const match = line.match(vendorRegex);
      if (match) {
        result.vendor_uid = match[1].trim();
        hasFoundVendor = true;
      }
    }
    
    if (!hasFoundCode && productCodeRegex.test(line)) {
      const match = line.match(productCodeRegex);
      if (match) {
        result.product_code = match[1].trim();
        hasFoundCode = true;
      }
    }

    const qtyMatch = line.match(quantityRegex);
    if (qtyMatch) {
      result.quantity = parseInt(qtyMatch[1], 10);
    }

    const dateMatch = line.match(dateRegex);
    if (dateMatch) {
      result.purchase_date = dateMatch[1].trim();
    }
  }

  // Store remaining lines as notes if they contain valuable information
  const notes = lines.filter(line => 
    !vendorRegex.test(line) && 
    !productCodeRegex.test(line) && 
    !quantityRegex.test(line) && 
    !dateRegex.test(line) &&
    line.length > 0
  ).join('\n');

  if (notes) {
    result.notes = notes;
  }

  return result;
}

// AI analysis function
async function analyzeWithAI(caption: string): Promise<AnalyzedContent> {
  const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openAIApiKey) {
    throw new Error('OpenAI API key not configured');
  }

  const configuration = new Configuration({ apiKey: openAIApiKey });
  const openai = new OpenAIApi(configuration);

  const prompt = `Please analyze this product caption and extract the following information in a JSON format:
- vendor_uid: Vendor or supplier identifier
- product_code: Product code or SKU
- quantity: Numeric quantity if mentioned
- purchase_date: Purchase date if mentioned
- notes: Any additional important information

Caption: "${caption}"

Respond only with valid JSON.`;

  try {
    const completion = await openai.createChatCompletion({
      model: "gpt-4o-mini",
      messages: [
        { 
          role: "system", 
          content: "You are a precise JSON extractor that analyzes product captions and returns structured data."
        },
        { 
          role: "user", 
          content: prompt 
        }
      ]
    });

    const responseText = completion.data.choices[0].message?.content || '{}';
    return JSON.parse(responseText);
  } catch (error) {
    console.error('AI Analysis error:', error);
    return {};
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messageId, caption, media_group_id, correlationId } = await req.json();
    
    if (!messageId || !caption) {
      throw new Error('Missing required parameters: messageId and caption');
    }

    console.log('[parse-caption] Starting analysis:', { 
      messageId, 
      media_group_id, 
      caption_length: caption?.length,
      correlation_id: correlationId 
    });

    const supabaseUrl = Deno.env.get('SUPABASE_URL') as string;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') as string;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Set state to processing
    await supabase
      .from('messages')
      .update({ 
        processing_state: 'processing',
        processing_started_at: new Date().toISOString()
      })
      .eq('id', messageId);

    // First try manual parsing
    let parsedContent = extractProductInfo(caption);
    let method: 'manual' | 'ai' | 'hybrid' = 'manual';
    let confidence = 1.0;

    // If manual parsing doesn't find critical info, use AI
    if (!parsedContent.product_code || !parsedContent.vendor_uid) {
      console.log('[parse-caption] Manual parsing insufficient, trying AI');
      const aiContent = await analyzeWithAI(caption);
      
      // Merge AI results with manual parsing, preferring AI results for missing fields
      parsedContent = {
        ...parsedContent,
        ...aiContent,
        notes: [parsedContent.notes, aiContent.notes].filter(Boolean).join('\n')
      };
      
      method = parsedContent.product_code && parsedContent.vendor_uid ? 'hybrid' : 'ai';
      confidence = 0.8; // Adjusted based on AI usage
    }

    // Add metadata
    const analyzedContent: AnalyzedContent = {
      ...parsedContent,
      parsing_metadata: {
        method,
        confidence,
        timestamp: new Date().toISOString()
      }
    };

    // Base message update
    const baseUpdate: MessageUpdate = {
      analyzed_content: analyzedContent,
      processing_state: 'completed',
      processing_completed_at: new Date().toISOString(),
      is_original_caption: true
    };

    // Update the message
    const { error: updateError } = await supabase
      .from('messages')
      .update(baseUpdate)
      .eq('id', messageId);

    if (updateError) {
      throw updateError;
    }

    // Handle media group synchronization if needed
    if (media_group_id) {
      const { data: existingAnalyzed } = await supabase
        .from('messages')
        .select('analyzed_content, id')
        .eq('media_group_id', media_group_id)
        .neq('id', messageId)
        .not('analyzed_content', 'is', null)
        .limit(1)
        .maybeSingle();

      if (existingAnalyzed?.analyzed_content) {
        // Sync this message with existing analyzed content
        const syncedContent: AnalyzedContent = {
          ...existingAnalyzed.analyzed_content,
          sync_metadata: {
            sync_source_message_id: existingAnalyzed.id,
            media_group_id
          }
        };

        await supabase
          .from('messages')
          .update({
            analyzed_content: syncedContent,
            processing_state: 'completed',
            processing_completed_at: new Date().toISOString(),
            is_original_caption: false,
            group_caption_synced: true,
            message_caption_id: existingAnalyzed.id
          })
          .eq('id', messageId);
      } else {
        // This is the first analyzed content, sync others to this one
        const syncedContent: AnalyzedContent = {
          ...analyzedContent,
          sync_metadata: {
            sync_source_message_id: messageId,
            media_group_id
          }
        };

        await supabase
          .from('messages')
          .update({
            analyzed_content: syncedContent,
            processing_state: 'completed',
            processing_completed_at: new Date().toISOString(),
            is_original_caption: false,
            group_caption_synced: true,
            message_caption_id: messageId
          })
          .eq('media_group_id', media_group_id)
          .neq('id', messageId);
      }
    }

    return new Response(
      JSON.stringify({ success: true }), 
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[parse-caption] Error:', error);
    
    // Try to update message to error state
    try {
      const { messageId } = await req.json();
      if (messageId) {
        const supabaseUrl = Deno.env.get('SUPABASE_URL') as string;
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') as string;
        const supabase = createClient(supabaseUrl, supabaseKey);

        const errorUpdate: MessageUpdate = {
          analyzed_content: null,
          processing_state: 'error',
          error_message: error.message,
          processing_completed_at: new Date().toISOString(),
          last_error_at: new Date().toISOString()
        };

        await supabase
          .from('messages')
          .update(errorUpdate)
          .eq('id', messageId);
      }
    } catch (updateError) {
      console.error('[parse-caption] Error updating error state:', updateError);
    }
    
    return new Response(
      JSON.stringify({ error: error.message }), 
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
