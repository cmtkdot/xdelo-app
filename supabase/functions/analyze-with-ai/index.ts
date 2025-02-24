// @deno-types="https://deno.land/x/types/http/server.d.ts"
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @deno-types="npm:@types/supabase-js"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
// @deno-types="npm:@types/openai"
import { Configuration, OpenAIApi } from "https://esm.sh/openai@3.2.1";

declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

// Types
type ProcessingState = 'initialized' | 'pending' | 'processing' | 'completed' | 'error';

interface SyncMetadata {
  sync_source_message_id: string;
  media_group_id: string;
}

interface ParsingMetadata {
  method: 'ai';
  timestamp: string;
  confidence: number;
}

interface AnalyzedContent {
  product_name?: string;
  product_code?: string;
  vendor_uid?: string;
  purchase_date?: string;
  quantity?: number;
  notes?: string;
  parsing_metadata?: ParsingMetadata;
  sync_metadata?: SyncMetadata;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function formatFlavorList(caption: string): string {
  try {
    const lines = caption.split('\n');
    const flavorSection = lines
      .slice(lines.findIndex(line => line.toLowerCase().includes('flavor')) + 1)
      .filter(line => line.trim() && !line.toLowerCase().includes('flavor'));

    if (flavorSection.length === 0) {
      return '';
    }

    return flavorSection.join('\n').trim();
  } catch (error) {
    console.error('Error formatting flavor list:', error);
    return '';
  }
}

async function analyzeWithAI(caption: string, existingContent: AnalyzedContent | null = null): Promise<AnalyzedContent> {
  console.log('[ai-analysis] Starting AI analysis of caption:', { 
    caption_length: caption.length,
    has_existing_content: !!existingContent 
  });

  const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openAIApiKey) {
    throw new Error('OpenAI API key not configured');
  }

  const configuration = new Configuration({ apiKey: openAIApiKey });
  const openai = new OpenAIApi(configuration);

  // Enhanced system prompt with detailed parsing rules
  const systemMessage = `You are a specialized product information extractor. Extract structured information following these rules:

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
   - Flavors:
     * If flavor list is present, format as separate lines
     * Remove duplicate flavors
     * Preserve emojis

3. Validation:
   - Only product_name is required
   - All other fields nullable if not found
   - Flag validation errors in 'notes' field
   - Ensure dates are valid and not in future
   - Quantities must be positive integers

${existingContent ? `Previous manual parsing found these details: ${JSON.stringify(existingContent)}. Please validate and enhance this information.` : ''}`;

  const prompt = `Analyze this product caption and extract the following information in JSON format:
- product_name: Full product name (REQUIRED)
- product_code: Product code or SKU (format: #[vendor_uid][purchasedate])
- vendor_uid: Vendor or supplier identifier (1-4 letters)
- quantity: Numeric quantity if mentioned (positive integer)
- purchase_date: Purchase date if mentioned (format: YYYY-MM-DD)
- notes: Any additional important information, including flavor list if present

Caption: "${caption}"

Return ONLY valid JSON with these fields. Preserve all emojis in the response.`;

  try {
    console.log('[ai-analysis] Sending request to OpenAI');

    const completion = await openai.createChatCompletion({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemMessage },
        { role: "user", content: prompt }
      ],
      temperature: 0.3 // Lower temperature for more consistent results
    });

    const responseText = completion.data.choices[0].message?.content || '{}';
    console.log('[ai-analysis] Received response from OpenAI:', { response_length: responseText.length });

    let aiResult;
    try {
      aiResult = JSON.parse(responseText);
      
      // Validate required fields
      if (!aiResult.product_name) {
        throw new Error('AI response missing required product_name field');
      }
    } catch (parseError) {
      console.error('[ai-analysis] Failed to parse AI response:', parseError);
      throw new Error(`Invalid AI response format: ${parseError.message}`);
    }

    // Calculate AI confidence based on response quality
    let confidence = 0.8; // Base confidence
    
    // Adjust confidence based on field presence and validity
    if (aiResult.product_code && /^[A-Z]{1,4}\d{5,6}$/.test(aiResult.product_code)) {
      confidence += 0.1;
    }
    if (aiResult.vendor_uid && aiResult.vendor_uid === aiResult.product_code?.substring(0, 3)) {
      confidence += 0.05;
    }
    if (aiResult.quantity && aiResult.quantity > 0 && aiResult.quantity < 10000) {
      confidence += 0.05;
    }
    if (aiResult.purchase_date && /^\d{4}-\d{2}-\d{2}$/.test(aiResult.purchase_date)) {
      confidence += 0.05;
    }

    // Format flavor list if present in notes
    if (aiResult.notes && aiResult.notes.toLowerCase().includes('flavor')) {
      aiResult.notes = formatFlavorList(aiResult.notes);
    }

    // Merge with existing content if available
    if (existingContent) {
      aiResult = {
        ...existingContent,
        ...aiResult,
        notes: [existingContent.notes, aiResult.notes]
          .filter(Boolean)
          .join('\n')
      };
    }

    // Add AI metadata
    const result: AnalyzedContent = {
      ...aiResult,
      parsing_metadata: {
        method: 'ai',
        timestamp: new Date().toISOString(),
        confidence: Math.min(1, confidence) // Cap at 1.0
      }
    };

    console.log('[ai-analysis] Analysis completed:', {
      has_product_code: !!result.product_code,
      has_vendor: !!result.vendor_uid,
      has_quantity: !!result.quantity
    });

    return result;
  } catch (error) {
    console.error('[ai-analysis] OpenAI API error:', error);
    throw error;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messageId, caption, existingContent, correlationId, media_group_id } = await req.json();
    
    if (!messageId || !caption) {
      throw new Error('Missing required parameters: messageId and caption');
    }

    console.log('[ai-analysis] Starting analysis:', { 
      messageId, 
      caption_length: caption?.length,
      has_existing_content: !!existingContent,
      correlationId,
      media_group_id
    });

    const supabaseUrl = Deno.env.get('SUPABASE_URL') as string;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') as string;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Update state to processing
    const { error: stateError } = await supabase
      .from('messages')
      .update({ 
        processing_state: 'processing',
        processing_started_at: new Date().toISOString(),
        processing_correlation_id: correlationId
      })
      .eq('id', messageId);

    if (stateError) {
      throw new Error(`Failed to update processing state: ${stateError.message}`);
    }

    // Perform AI analysis
    const analyzedContent = await analyzeWithAI(caption, existingContent);

    if (media_group_id) {
      // Get count of messages in the group
      const { count: totalCount } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('media_group_id', media_group_id);

      // Call xdelo_sync_media_group_content function with group count
      const { error: syncError } = await supabase.rpc(
        'xdelo_sync_media_group_content',
        {
          p_source_message_id: messageId,
          p_media_group_id: media_group_id,
          p_analyzed_content: {
            ...analyzedContent,
            group_message_count: totalCount || 1
          }
        }
      );

      if (syncError) {
        throw new Error(`Failed to sync media group content: ${syncError.message}`);
      }

      // Update source message with group count
      await supabase
        .from('messages')
        .update({ group_message_count: totalCount || 1 })
        .eq('id', messageId);

      console.log('[ai-analysis] Successfully synced media group content:', { group_message_count: totalCount || 1 });
    }

    // Update the message with AI results
    const { error: updateError } = await supabase
      .from('messages')
      .update({
        analyzed_content: analyzedContent,
        processing_state: 'completed',
        processing_completed_at: new Date().toISOString(),
        processing_correlation_id: correlationId
      })
      .eq('id', messageId);

    if (updateError) {
      throw new Error(`Failed to update message with AI analysis: ${updateError.message}`);
    }

    console.log('[ai-analysis] Successfully updated message with AI analysis');

    return new Response(
      JSON.stringify({ 
        success: true,
        analyzed_content: analyzedContent
      }), 
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[ai-analysis] Error:', error);
    
    // Update message to error state
    try {
      const { messageId, correlationId } = await req.json();
      if (messageId) {
        const supabaseUrl = Deno.env.get('SUPABASE_URL') as string;
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') as string;
        const supabase = createClient(supabaseUrl, supabaseKey);

        await supabase
          .from('messages')
          .update({
            processing_state: 'error',
            error_message: error.message,
            processing_completed_at: new Date().toISOString(),
            last_error_at: new Date().toISOString(),
            processing_correlation_id: correlationId
          })
          .eq('id', messageId);

        console.log('[ai-analysis] Updated message to error state:', { 
          messageId, 
          error: error.message,
          correlationId 
        });
      }
    } catch (updateError) {
      console.error('[ai-analysis] Error updating error state:', updateError);
    }
    
    return new Response(
      JSON.stringify({ error: error.message }), 
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
