import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from '@supabase/supabase-js';
import { corsHeaders } from './authUtils';
import { manualParse } from './utils/manualParser';
import { analyzeWithAI } from './utils/aiAnalyzer';
import { validateContent } from './validator';

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { message_id, media_group_id, caption, correlation_id } = await req.json();
    console.log('📝 Starting caption analysis:', { message_id, media_group_id, correlation_id });

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // First try manual parsing
    console.log('🔍 Attempting manual parsing...');
    const manualResult = await manualParse(caption);
    console.log('Manual parsing result:', {
      confidence: manualResult.parsing_metadata?.confidence,
      product_name: manualResult.product_name,
      product_code: manualResult.product_code
    });

    let finalResult;
    let processingMetadata;

    // If manual parsing is good enough (confidence >= 0.75), use it
    if (manualResult.parsing_metadata?.confidence >= 0.75) {
      console.log('✅ Using manual parsing result - high confidence');
      finalResult = manualResult;
      processingMetadata = manualResult.parsing_metadata;
    } else {
      // Try AI analysis with manual context
      console.log('🤖 Manual parsing confidence low, attempting AI analysis');
      try {
        const aiResult = await analyzeWithAI(caption, media_group_id, manualResult);
        finalResult = aiResult.analyzedContent;
        processingMetadata = {
          ...aiResult.processingMetadata,
          correlation_id
        };
      } catch (aiError) {
        console.error('AI analysis failed, falling back to manual result:', aiError);
        finalResult = manualResult;
        processingMetadata = {
          ...manualResult.parsing_metadata,
          error_message: aiError.message
        };
      }
    }

    // Update the message with analyzed content
    try {
      if (media_group_id) {
        console.log('👥 Updating media group:', media_group_id);
        // Use existing media group sync logic
        const { data: syncResult, error: syncError } = await supabase.rpc(
          'process_media_group_content',
          {
            p_message_id: message_id,
            p_media_group_id: media_group_id,
            p_analyzed_content: {
              ...finalResult,
              parsing_metadata: processingMetadata
            },
            p_correlation_id: correlation_id
          }
        );

        if (syncError) throw syncError;
        console.log('✅ Media group sync completed:', { media_group_id, message_id });
      } else {
        console.log('📝 Updating single message:', message_id);
        // Single message update
        const { error: updateError } = await supabase
          .from('messages')
          .update({
            analyzed_content: {
              ...finalResult,
              parsing_metadata: processingMetadata
            },
            processing_state: 'completed',
            processing_completed_at: new Date().toISOString()
          })
          .eq('id', message_id);

        if (updateError) throw updateError;
        console.log('✅ Single message update completed:', message_id);
      }

      return new Response(
        JSON.stringify({
          success: true,
          analyzed_content: finalResult,
          processing_metadata: processingMetadata
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    } catch (dbError) {
      console.error('Database operation failed:', dbError);
      // Update message to error state
      await supabase
        .from('messages')
        .update({
          processing_state: 'error',
          error_message: dbError.message,
          retry_count: supabase.sql`retry_count + 1`
        })
        .eq('id', message_id);

      throw dbError;
    }
  } catch (error) {
    console.error('❌ Caption analysis failed:', error);
    return new Response(
      JSON.stringify({
        error: error.message,
        status: 'error'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
