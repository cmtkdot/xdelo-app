import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { Configuration, OpenAIApi } from "https://esm.sh/openai@3.2.1";

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

  // Construct system message with existing content context if available
  let systemMessage = 'You are a precise product information extractor.';
  if (existingContent) {
    systemMessage += ' Previous manual parsing found these details: ' + 
      JSON.stringify(existingContent) + 
      '. Please validate and enhance this information.';
  }

  const prompt = `Analyze this product caption and extract the following information in JSON format:
- product_name: Full product name
- product_code: Product code or SKU (if any)
- vendor_uid: Vendor or supplier identifier
- quantity: Numeric quantity if mentioned
- purchase_date: Purchase date if mentioned (format: YYYY-MM-DD)
- notes: Any additional important information

Caption: "${caption}"

Return ONLY valid JSON with these fields.`;

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

    let aiResult = JSON.parse(responseText);

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
        confidence: 0.8
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
      // Call xdelo_sync_media_group_content function
      const { error: syncError } = await supabase.rpc(
        'xdelo_sync_media_group_content',
        {
          p_source_message_id: messageId,
          p_media_group_id: media_group_id,
          p_analyzed_content: analyzedContent
        }
      );

      if (syncError) {
        throw new Error(`Failed to sync media group content: ${syncError.message}`);
      }

      console.log('[ai-analysis] Successfully synced media group content');
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
