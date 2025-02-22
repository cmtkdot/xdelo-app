
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { parseManually } from "./utils/manualParser.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function logError(supabase: any, error: any, messageId: string | null, context: string, metadata: any = {}) {
  console.error(`Error in ${context}:`, error);
  try {
    await supabase.rpc('xdelo_log_webhook_event', {
      p_event_type: 'CAPTION_ANALYSIS_ERROR',
      p_chat_id: null,
      p_message_id: null,
      p_media_type: 'caption',
      p_error_message: `${context}: ${error.message}`,
      p_raw_data: {
        error_stack: error.stack,
        error_details: error.details || null,
        message_id: messageId,
        context,
        ...metadata
      }
    });
  } catch (logError) {
    console.error('Failed to log error:', logError);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  let messageId: string | null = null;
  const startTime = Date.now();

  try {
    const { messageId: reqMessageId, caption, correlationId } = await req.json();
    messageId = reqMessageId;

    console.log('Starting caption analysis:', {
      messageId,
      caption_length: caption?.length,
      correlation_id: correlationId
    });

    if (!messageId || !caption) {
      throw new Error('Missing required parameters: messageId or caption');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Log analysis start
    await supabase.rpc('xdelo_log_webhook_event', {
      p_event_type: 'CAPTION_ANALYSIS_START',
      p_chat_id: null,
      p_message_id: null,
      p_media_type: 'caption',
      p_raw_data: {
        message_id: messageId,
        correlation_id: correlationId,
        caption_length: caption.length,
        start_time: new Date().toISOString()
      }
    });

    // Manual parsing attempt
    console.log('Attempting manual parsing...');
    const manualResult = await parseManually(caption);
    
    let analyzedContent;
    if (manualResult && manualResult.product_code) {
      console.log('Manual parsing successful');
      analyzedContent = {
        ...manualResult,
        parsing_metadata: {
          method: 'manual',
          confidence: 1.0,
          timestamp: new Date().toISOString()
        }
      };
    } else {
      console.log('Manual parsing incomplete, attempting AI analysis...');
      const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
      if (!openAIApiKey) {
        throw new Error('OpenAI API key not configured');
      }

      try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openAIApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4',
            messages: [
              {
                role: 'system',
                content: `Extract product information from captions using this format:
                  - product_name (before #)
                  - product_code (after #)
                  - vendor_uid (letters at start of code)
                  - quantity (number after x)
                  - purchase_date (if found, in YYYY-MM-DD)
                  - notes (additional info)`
              },
              { role: 'user', content: caption }
            ]
          })
        });

        if (!response.ok) {
          const errorBody = await response.text();
          throw new Error(`OpenAI API error (${response.status}): ${errorBody}`);
        }

        const aiResult = await response.json();
        if (!aiResult.choices?.[0]?.message?.content) {
          throw new Error('Invalid AI response format');
        }

        const aiAnalysis = JSON.parse(aiResult.choices[0].message.content);
        analyzedContent = {
          ...aiAnalysis,
          parsing_metadata: {
            method: 'ai',
            confidence: 0.7,
            timestamp: new Date().toISOString()
          }
        };
        console.log('AI analysis successful');
      } catch (aiError) {
        await logError(supabase, aiError, messageId, 'AI_ANALYSIS', {
          caption_length: caption.length,
          correlation_id: correlationId
        });
        throw aiError;
      }
    }

    // Update message with analyzed content
    console.log('Updating message with analyzed content...');
    const { error: updateError } = await supabase
      .from('messages')
      .update({
        analyzed_content: analyzedContent,
        processing_state: 'completed',
        processing_completed_at: new Date().toISOString()
      })
      .eq('id', messageId);

    if (updateError) {
      await logError(supabase, updateError, messageId, 'DATABASE_UPDATE', {
        analyzed_content: analyzedContent
      });
      throw updateError;
    }

    const processingTime = Date.now() - startTime;
    console.log(`Analysis completed in ${processingTime}ms`);

    // Log successful completion
    await supabase.rpc('xdelo_log_webhook_event', {
      p_event_type: 'CAPTION_ANALYSIS_COMPLETE',
      p_chat_id: null,
      p_message_id: null,
      p_media_type: 'caption',
      p_raw_data: {
        message_id: messageId,
        processing_time_ms: processingTime,
        parsing_method: analyzedContent.parsing_metadata.method,
        confidence: analyzedContent.parsing_metadata.confidence
      }
    });

    return new Response(
      JSON.stringify({ 
        success: true,
        processing_time_ms: processingTime,
        analyzed_content: analyzedContent
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error('Fatal error in parse-caption-with-ai:', error);

    // Attempt to update message to error state
    if (messageId) {
      try {
        const supabase = createClient(
          Deno.env.get('SUPABASE_URL')!,
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );

        await supabase
          .from('messages')
          .update({
            processing_state: 'error',
            error_message: error.message,
            processing_completed_at: new Date().toISOString(),
            last_error_at: new Date().toISOString()
          })
          .eq('id', messageId);

        await logError(supabase, error, messageId, 'FATAL_ERROR', {
          processing_time_ms: processingTime
        });
      } catch (updateError) {
        console.error('Failed to update message error state:', updateError);
      }
    }

    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: error.details || null,
        processing_time_ms: processingTime
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
