import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { parseManually } from "./utils/manualParser.ts";
import { AnalysisRequest, AnalyzedContent } from "./types";
import { logParserEvent } from "./utils/webhookLogs.ts";
import { ProcessingState } from "../telegram-webhook/types";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RequestData {
  messageId: string;
  caption: string;
  correlationId: string;
  media_group_id?: string;
}

// 1. Add request validation
const validateRequest = (data: unknown): RequestData => {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid request data');
  }

  const request = data as Partial<RequestData>;
  
  if (!request.messageId || !request.caption || !request.correlationId) {
    throw new Error('Missing required fields: messageId, caption, and correlationId');
  }

  return {
    messageId: request.messageId,
    caption: request.caption,
    correlationId: request.correlationId,
    media_group_id: request.media_group_id
  };
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
const handleError = async (supabase: any, error: Error, messageId: string) => {
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
      error_message: error.message,
      metadata: {
        stack: error.stack
      }
    })
  ]);
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  let requestData;
  try {
    requestData = await req.clone().json();
    const { messageId, caption, media_group_id, correlationId } = requestData;
    
    console.log('🎯 Starting caption analysis:', {
      message_id: messageId, 
      media_group_id,
      caption_length: caption?.length,
      correlation_id: correlationId
    });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Manual parsing attempt
    console.log('🔍 Attempting manual parsing...');
    let analyzedContent;
    const manualResult = await parseManually(caption);
    
    if (manualResult && manualResult.product_code) {
      console.log('✅ Manual parsing successful:', {
        correlation_id: correlationId,
        product_code: manualResult.product_code,
        confidence: manualResult.parsing_metadata?.confidence
      });
      
      analyzedContent = {
        ...manualResult,
        parsing_metadata: {
          method: 'manual',
          confidence: 1.0,
          timestamp: new Date().toISOString(),
          correlation_id: correlationId
        }
      };
    } else {
      console.log('⚠️ Manual parsing incomplete, attempting AI analysis...', {
        correlation_id: correlationId,
        manual_result: manualResult
      });

      const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
      if (!openAIApiKey) {
        throw new Error('OpenAI API key not configured');
      }

      console.log('🤖 Calling OpenAI API...', {
        correlation_id: correlationId,
        caption_length: caption?.length
      });

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
        console.error('❌ OpenAI API error:', {
          correlation_id: correlationId,
          status: response.status,
          statusText: response.statusText
        });
        throw new Error(`OpenAI API error: ${response.statusText}`);
      }
      
      const aiResult = await response.json();
      console.log('✨ Received AI response:', {
        correlation_id: correlationId,
        response_length: JSON.stringify(aiResult).length
      });

      try {
        const aiAnalysis = JSON.parse(aiResult.choices[0].message.content);
        analyzedContent = {
          ...aiAnalysis,
          parsing_metadata: {
            method: 'ai',
            confidence: 0.7,
            timestamp: new Date().toISOString(),
            correlation_id: correlationId
          }
        };
        console.log('✅ AI analysis successful:', {
          correlation_id: correlationId,
          product_code: aiAnalysis.product_code
        });
      } catch (parseError) {
        console.error('❌ Failed to parse AI response:', {
          correlation_id: correlationId,
          error: parseError.message,
          ai_response: aiResult.choices[0].message.content
        });
        throw new Error('Failed to parse AI response');
      }
    }

    if (media_group_id) {
      console.log('🔄 Syncing media group:', {
        correlation_id: correlationId,
        media_group_id
      });
      analyzedContent = {
        ...analyzedContent,
        sync_metadata: {
          sync_source_message_id: messageId,
          media_group_id: media_group_id
        }
      };
    }

    // Update message with analyzed content
    console.log('💾 Updating message with analysis:', {
      correlation_id: correlationId,
      message_id: messageId,
      analysis_method: analyzedContent.parsing_metadata.method
    });

    const { error: updateError } = await supabase
      .from('messages')
      .update({
        analyzed_content: analyzedContent,
        processing_state: 'completed',
        processing_completed_at: new Date().toISOString()
      })
      .eq('id', messageId);

    if (updateError) {
      console.error('❌ Error updating message:', {
        correlation_id: correlationId,
        error: updateError.message
      });
      throw updateError;
    }

    console.log('✅ Analysis completed successfully:', {
      correlation_id: correlationId,
      message_id: messageId,
      product_code: analyzedContent.product_code
    });

    return new Response(
      JSON.stringify({ 
        success: true,
        analyzed_content: analyzedContent
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Analysis failed:', {
      correlation_id: requestData?.correlationId,
      error: error.message,
      stack: error.stack
    });
    
    try {
      if (requestData?.messageId) {
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
          .eq('id', requestData.messageId);

        console.log('⚠️ Updated message with error state:', {
          correlation_id: requestData.correlationId,
          message_id: requestData.messageId
        });
      }
    } catch (updateError) {
      console.error('❌ Failed to update error state:', {
        correlation_id: requestData?.correlationId,
        error: updateError.message
      });
    }
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        correlation_id: requestData?.correlationId 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
