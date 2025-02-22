import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { parseManually } from "./utils/manualParser.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// 1. Add request validation
const validateRequest = (data: any): AnalysisRequest => {
  if (!data?.messageId || !data?.caption) {
    throw new Error('Missing required fields: messageId and caption');
  }
  return data as AnalysisRequest;
};

// 2. Add retry handling for OpenAI calls
const callOpenAI = async (caption: string) => {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
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
    const error = await response.json().catch(() => ({}));
    throw new Error(`OpenAI API error: ${response.status} - ${error.message || response.statusText}`);
  }
  
  const aiResult = await response.json();
  if (!aiResult?.choices?.[0]?.message?.content) {
    throw new Error('Invalid AI response format');
  }
  
  try {
    return JSON.parse(aiResult.choices[0].message.content);
  } catch (e) {
    throw new Error('Failed to parse AI response as JSON');
  }
};

// 3. Add retry mechanism
const analyzeWithAI = async (caption: string, retries = 2) => {
  for (let i = 0; i <= retries; i++) {
    try {
      return await callOpenAI(caption);
    } catch (error) {
      if (i === retries) throw error;
      await new Promise(r => setTimeout(r, 1000 * Math.pow(2, i)));
    }
  }
};

// 3. Add result validation before database update
const validateAnalyzedContent = (content: AnalyzedContent): boolean => {
  // Add more validation rules as needed
  if (!content.product_name || !content.product_code) {
    return false;
  }
  
  // Validate product code format
  if (!/^[A-Z]{1,4}\d{5,6}$/.test(content.product_code)) {
    return false;
  }
  
  // Validate quantity if present
  if (content.quantity && (content.quantity < 1 || content.quantity > 10000)) {
    return false;
  }
  
  return true;
};

// 4. Add structured error handling
const handleError = async (supabase: SupabaseClient, error: Error, messageId: string) => {
  const errorData = {
    processing_state: 'error' as ProcessingState,
    error_message: error.message,
    last_error_at: new Date().toISOString()
  };
  
  await Promise.all([
    supabase.from('messages').update(errorData).eq('id', messageId),
    logParserEvent(supabase, {
      event_type: 'analysis_error',
      message_id: messageId,
      error_message: error.message
    })
  ]);
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  let requestData;
  try {
    // Clone the request before consuming the body
    requestData = await req.clone().json();
    const { messageId, caption, media_group_id, correlationId } = requestData;
    
    console.log('Starting caption analysis:', {
      messageId, 
      media_group_id,
      caption_length: caption?.length,
      correlation_id: correlationId
    });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Manual parsing attempt
    let analyzedContent;
    const manualResult = await parseManually(caption);
    
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

      if (!response.ok) throw new Error(`OpenAI API error: ${response.statusText}`);
      
      const aiResult = await response.json();
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
    }

    if (media_group_id) {
      console.log('Syncing media group:', media_group_id);
      analyzedContent = {
        ...analyzedContent,
        sync_metadata: {
          sync_source_message_id: messageId,
          media_group_id: media_group_id
        }
      };
    }

    // Insert webhook log for successful analysis
    const { error: logError } = await supabase
      .from('webhook_logs')
      .insert({
        event_type: 'analysis_complete',
        correlation_id: requestData.correlationId,
        message_id: requestData.telegram_message_id, // Use telegram_message_id instead of UUID
        metadata: JSON.stringify({
          analysis_method: analyzedContent.parsing_metadata.method,
          confidence: analyzedContent.parsing_metadata.confidence
        })
      });

    if (logError) {
      console.error('Error logging webhook event:', logError);
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

    if (!validateAnalyzedContent(analyzedContent)) {
      throw new Error('Invalid analysis result');
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        analyzed_content: analyzedContent
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in parse-caption-with-ai:', error);
    
    try {
      if (requestData?.messageId) {
        const supabase = createClient(
          Deno.env.get('SUPABASE_URL')!,
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );

        // Log error to webhook_logs using telegram_message_id
        await supabase
          .from('webhook_logs')
          .insert({
            event_type: 'analysis_error',
            message_id: requestData.telegram_message_id, // Use telegram_message_id instead of UUID
            error_message: error.message,
            correlation_id: requestData.correlationId
          });

        // Update message error state
        await supabase
          .from('messages')
          .update({
            processing_state: 'error',
            error_message: error.message,
            processing_completed_at: new Date().toISOString(),
            last_error_at: new Date().toISOString()
          })
          .eq('id', requestData.messageId);
      }
    } catch (updateError) {
      console.error('Failed to update message error state:', updateError);
    }
    
    await handleError(supabase, error, messageId);
    throw error;
  }
});
