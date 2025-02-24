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
  product_sku?: string;
  purchase_order_uid?: string;
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

1. Product Name Extraction Rules:
   - Product name is the first part of the text before any line breaks, dashes, or special markers
   - Remove strength/potency (e.g., "750MG", "450MG") from product name unless it's part of the brand name
   - Keep brand names intact (e.g., "DEVOUR EDIBLES", "NUGZ MEDICATED")
   - For crystalline/concentrate products, keep full name (e.g., "Pure THCA White Diamonds")

2. Notes Handling:
   - Capture all content after the product name in notes
   - Format flavor lists with bullet points:
     * Keep "FLAVORS:" as a header if present
     * Each flavor on a new line with "-" or "•"
   - Include potency/strength information
   - Preserve lab test results and COA information
   - Maintain original formatting for lists

3. Special Cases:
   - For edibles: Include potency in notes (e.g., "750MG", "450MG")
   - For concentrates: Include purity/lab test results in notes
   - Preserve emojis and special characters
   - Keep multi-line formatting in notes

4. Validation:
   - Product name should be clear and concise
   - Notes should be well-formatted and readable
   - Preserve important technical details
   - Keep original capitalization

${existingContent ? `Previous parsing found these details: ${JSON.stringify(existingContent)}. Please validate and enhance this information.` : ''}`;

  const prompt = `Analyze this product caption and extract the following information in JSON format:
- product_name: Main product name without strength/potency unless part of brand name
- notes: All additional information including:
  * Strength/potency
  * Flavor lists
  * Lab test results
  * Technical details
  * Keep original formatting

Caption: "${caption}"

Return ONLY valid JSON with these fields. Preserve all emojis and formatting in the response.`;

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
      
      // Validate and clean product name
      if (!aiResult.product_name) {
        throw new Error('AI response missing required product_name field');
      }

      // Clean up product name and notes
      aiResult.product_name = aiResult.product_name.trim();
      
      if (aiResult.notes) {
        // Format notes to preserve line breaks and structure
        aiResult.notes = aiResult.notes
          .split('\n')
          .map(line => line.trim())
          .filter(line => line)
          .join('\n');
      }

      // Handle flavor lists specially
      if (aiResult.notes && aiResult.notes.toLowerCase().includes('flavor')) {
        const lines = aiResult.notes.split('\n');
        const flavorIndex = lines.findIndex(line => 
          line.toLowerCase().includes('flavor'));
        
        if (flavorIndex !== -1) {
          // Reorganize notes to keep flavors properly formatted
          const beforeFlavors = lines.slice(0, flavorIndex).join('\n');
          const flavors = lines
            .slice(flavorIndex)
            .filter(line => line.trim())
            .map(line => line.startsWith('-') ? line : line.startsWith('•') ? line : `- ${line}`)
            .join('\n');
          
          aiResult.notes = [beforeFlavors, flavors]
            .filter(section => section.trim())
            .join('\n\n');
        }
      }

    } catch (parseError) {
      console.error('[ai-analysis] Failed to parse AI response:', parseError);
      throw new Error(`Invalid AI response format: ${parseError.message}`);
    }

    // Calculate AI confidence based on response quality
    let confidence = 0.8; // Base confidence
    
    // Adjust confidence based on content quality
    if (aiResult.product_name && aiResult.product_name.length > 3) {
      confidence += 0.1;
    }
    if (aiResult.notes && aiResult.notes.length > 10) {
      confidence += 0.1;
    }

    // Merge with existing content if available
    if (existingContent) {
      aiResult = {
        ...existingContent,
        ...aiResult,
        notes: [existingContent.notes, aiResult.notes]
          .filter(Boolean)
          .join('\n\n')
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
      product_name_length: result.product_name?.length,
      has_notes: !!result.notes
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
