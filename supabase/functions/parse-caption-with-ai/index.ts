// @deno-types="https://deno.land/x/types/http/server.d.ts"
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @deno-types="npm:@types/supabase-js"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { parseManually } from "./utils/manualParser.ts";
import { AnalyzedContent } from "./types";
import { logParserEvent } from "./utils/webhookLogs.ts";
import { ProcessingStateType } from "../telegram-webhook/types";
import {
  corsHeaders,
  validateRequest,
  analyzeWithAI,
  validateAnalyzedContent,
  handleError
} from "./utils/aiAnalysis";

// Add Deno type declaration
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  let requestData;
  try {
    const data = await req.clone().json();
    requestData = validateRequest(data);
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

      const aiAnalysis = await analyzeWithAI(caption, openAIApiKey);
      analyzedContent = {
        ...aiAnalysis,
        parsing_metadata: {
          method: 'ai',
          confidence: 0.7,
          timestamp: new Date().toISOString(),
          correlation_id: correlationId
        }
      };

      if (!validateAnalyzedContent(analyzedContent)) {
        throw new Error('Invalid AI analysis result');
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
    const { error: updateError } = await supabase
      .from('messages')
      .update({
        analyzed_content: analyzedContent,
        processing_state: 'completed' as ProcessingStateType,
        processing_completed_at: new Date().toISOString()
      })
      .eq('id', messageId);

    if (updateError) {
      throw updateError;
    }

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
    
    if (requestData?.messageId) {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      );
      await handleError(supabase, error, requestData.messageId);
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
