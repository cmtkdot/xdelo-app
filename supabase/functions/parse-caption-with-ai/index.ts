import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';
import { parseManually } from "./utils/manualParser";
import { logParserEvent } from "./utils/webhookLogs";
import { AnalyzedContent } from './types';

// Add error helper at the top
function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  return 'Unknown error occurred';
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Enhanced system prompt for better AI analysis
const SYSTEM_PROMPT = `Extract product information from captions using this detailed format:
{
  "product_name": "Full name before #",
  "product_code": "Code after #",
  "vendor_uid": "Letters at start of code",
  "purchase_date": "YYYY-MM-DD if found",
  "quantity": "Number after x",
  "notes": "Additional info",
  "analysis": {
    "strain_type": "indica/sativa/hybrid/unknown",
    "thc_percentage": "number or null",
    "cbd_percentage": "number or null",
    "flavor_profile": ["array of flavors"],
    "effects": ["array of effects"]
  }
}

Rules:
- Preserve all emojis in product name
- Convert dates: mmDDyy → YYYY-MM-DD (e.g. 120523 → 2023-12-05)
- Extract THC/CBD percentages if present
- Identify strain type from context
- Collect flavor descriptors and effects`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Initialize variables
  let correlationId = crypto.randomUUID();
  let messageId: string | undefined;
  let chatId: number | undefined;
  let analyzedContent: AnalyzedContent = {}; // Initialize empty object
  
  const startTime = performance.now();
  
  try {
    const payload = await req.json();
    messageId = payload.messageId;
    chatId = payload.chat_id;
    const { caption, media_group_id, correlation_id } = payload;
    
    if (correlation_id) {
      correlationId = correlation_id;
    }

    // Ensure messageId exists
    if (!messageId) {
      throw new Error('Message ID is required');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Manual parsing attempt
    const manualResult = await parseManually(caption);
    
    if (manualResult && manualResult.product_code) {
      analyzedContent = {
        ...manualResult,
        parsing_metadata: {
          method: 'manual',
          confidence: 1.0,
          timestamp: new Date().toISOString()
        }
      };
    } else {
      // AI Analysis
      const aiResult = await performAIAnalysis(caption);
      
      // Merge manual and AI results
      analyzedContent = {
        ...aiResult,
        product_code: manualResult?.product_code || aiResult.product_code,
        vendor_uid: manualResult?.vendor_uid || aiResult.vendor_uid,
        parsing_metadata: {
          method: 'hybrid',
          confidence: 0.9,
          timestamp: new Date().toISOString(),
          manual_success: Boolean(manualResult?.product_code)
        }
      };
    }

    // Add sync metadata if part of media group
    if (media_group_id) {
      analyzedContent = {
        ...analyzedContent,
        sync_metadata: {
          sync_source_message_id: messageId,
          media_group_id,
          synced_at: new Date().toISOString()
        }
      };
    }

    // Update message with analyzed content
    const { error: updateError } = await supabase
      .from('messages')
      .update({
        analyzed_content: analyzedContent,
        processing_state: 'completed',
        processing_completed_at: new Date().toISOString()
      })
      .eq('id', messageId);

    if (updateError) throw updateError;

    return new Response(
      JSON.stringify({ 
        success: true,
        correlation_id: correlationId,
        analyzed_content: analyzedContent
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    const errorMessage = getErrorMessage(err);
    console.error('Error in parse-caption-with-ai:', {
      error: errorMessage,
      correlation_id: correlationId,
      message_id: messageId
    });
    
    try {
      if (messageId) {
        const supabase = createClient(
          Deno.env.get('SUPABASE_URL')!,
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );

        await supabase
          .from('messages')
          .update({
            processing_state: 'error',
            error_message: errorMessage,
            processing_completed_at: new Date().toISOString(),
            last_error_at: new Date().toISOString(),
            processing_correlation_id: correlationId
          })
          .eq('id', messageId);
      }
    } catch (updateErr) {
      const updateErrorMsg = getErrorMessage(updateErr);
      console.error('Failed to update message error state:', {
        error: updateErrorMsg,
        correlation_id: correlationId,
        message_id: messageId
      });
    }
    
    // Log error
    await logParserEvent(supabase, {
      event_type: 'analysis_error',
      chat_id: chatId,
      message_id: parseInt(messageId || '0'),
      correlation_id: correlationId,
      error_message: errorMessage,
      duration_ms: Math.round(performance.now() - startTime),
      processing_state: 'error',
      metadata: {
        error_type: 'AnalysisError',
        error_details: errorMessage
      }
    });

    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        correlation_id: correlationId 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

// Helper function for AI analysis
async function performAIAnalysis(caption: string): Promise<AnalyzedContent> {
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
      model: 'gpt-4',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: caption }
      ],
      temperature: 0.3,
    })
  });

  if (!response.ok) throw new Error(`OpenAI API error: ${response.statusText}`);
  
  const result = await response.json();
  return JSON.parse(result.choices[0].message.content);
}
