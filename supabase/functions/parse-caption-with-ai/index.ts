import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { analyzeCaption } from "./utils/aiAnalyzer.ts";
import { manualParse } from "./utils/manualParser.ts";
import { ParsedContent } from "../_shared/types.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function findMediaGroupAnalysis(supabase: SupabaseClient, mediaGroupId: string) {
  console.log('🔍 Checking media group for existing analysis:', { mediaGroupId });
  
  const { data, error } = await supabase
    .from('messages')
    .select('analyzed_content, is_original_caption')
    .eq('media_group_id', mediaGroupId)
    .eq('is_original_caption', true)
    .maybeSingle();

  if (error) {
    console.error('❌ Error finding media group analysis:', error);
    throw error;
  }

  return data?.analyzed_content;
}

async function getMediaGroupInfo(supabase: SupabaseClient, mediaGroupId: string) {
  console.log('📑 Getting media group details:', { mediaGroupId });
  
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('media_group_id', mediaGroupId);

  if (error) {
    console.error('❌ Error getting media group info:', error);
    throw error;
  }

  const totalCount = data?.length || 0;
  const uploadedCount = data?.filter(msg => msg.file_id !== null).length || 0;
  const hasCaption = data?.some(msg => msg.caption) || false;
  const isComplete = totalCount === uploadedCount && totalCount > 0 && hasCaption;

  return {
    totalCount,
    uploadedCount,
    hasCaption,
    isComplete
  };
}

async function updateMediaGroupMessages(
  supabase: SupabaseClient,
  mediaGroupId: string,
  messageId: string,
  analyzedContent: ParsedContent,
  hasCaption: boolean
) {
  try {
    if (!messageId) {
      throw new Error('Message ID is required for media group sync');
    }

    console.log('🔄 Starting media group sync:', { mediaGroupId, messageId, hasCaption });

    // Get media group completion status
    const groupInfo = await getMediaGroupInfo(supabase, mediaGroupId);
    console.log('📊 Media group status:', groupInfo);

    // Update all messages in the group via the stored procedure
    const { error: procError } = await supabase
      .rpc('xdelo_sync_media_group_content', {
        p_source_message_id: messageId,
        p_media_group_id: mediaGroupId,
        p_correlation_id: crypto.randomUUID()
      });

    if (procError) {
      console.error('❌ Error in xdelo_sync_media_group_content:', procError);
      throw procError;
    }

    console.log('✅ Successfully processed media group analysis:', groupInfo);
  } catch (error) {
    console.error('❌ Error updating media group messages:', error);
    throw error;
  }
}

async function analyzeWithFallback(caption: string): Promise<ParsedContent> {
  // Try manual parsing first
  const manualResult = await manualParse(caption);
  
  // If manual parsing is confident enough, use it
  if (!manualResult.parsing_metadata?.needs_ai_analysis) {
    console.log('Manual parsing successful, skipping AI');
    return manualResult;
  }

  // Try AI analysis if manual parsing needs help
  try {
    console.log('Manual parsing needs help, trying AI analysis');
    const aiResult = await analyzeCaption(caption);
    
    // Merge results, preferring AI for uncertain fields
    return {
      product_name: aiResult.product_name || manualResult.product_name,
      product_code: manualResult.product_code || aiResult.product_code,
      vendor_uid: manualResult.vendor_uid || aiResult.vendor_uid,
      purchase_date: manualResult.purchase_date || aiResult.purchase_date,
      quantity: manualResult.quantity || aiResult.quantity,
      notes: aiResult.notes || manualResult.notes,
      parsing_metadata: {
        method: 'hybrid',
        confidence: Math.max(
          manualResult.parsing_metadata?.confidence || 0,
          aiResult.parsing_metadata?.confidence || 0
        ),
        manual_confidence: manualResult.parsing_metadata?.confidence,
        ai_confidence: aiResult.parsing_metadata?.confidence,
        timestamp: new Date().toISOString()
      }
    };
  } catch (error) {
    console.error('AI analysis failed, using manual result:', error);
    return manualResult;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  let requestData;
  try {
    const rawBody = await req.text();
    console.log('📝 Raw request body:', rawBody);
    
    try {
      requestData = JSON.parse(rawBody);
    } catch (e) {
      console.error('❌ Failed to parse JSON:', e);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Invalid JSON in request body'
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        }
      );
    }

    console.log('📥 Parsed request data:', {
      messageId: requestData.messageId,
      media_group_id: requestData.media_group_id,
      caption_length: requestData.caption?.length || 0,
      correlation_id: requestData.correlation_id
    });

    const { messageId, media_group_id, caption, correlation_id } = requestData;

    if (!messageId) {
      console.error('❌ Missing message ID in request');
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Message ID is required'
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        }
      );
    }

    console.log('🔄 Starting caption analysis:', {
      messageId,
      media_group_id,
      caption_length: caption?.length || 0,
      correlation_id
    });

    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL');
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      
      if (!supabaseUrl || !supabaseKey) {
        throw new Error('Missing Supabase credentials');
      }

      const supabase = createClient(supabaseUrl, supabaseKey);

      // Initialize empty caption handling
      const textToAnalyze = caption?.trim() || '';
      let analyzedContent: ParsedContent;
      const hasCaption = Boolean(textToAnalyze);

      if (!hasCaption && media_group_id) {
        console.log('⚠️ Empty caption received, checking media group');
        const { data: existingAnalysis, error: groupError } = await supabase
          .from('messages')
          .select('analyzed_content')
          .eq('media_group_id', media_group_id)
          .eq('is_original_caption', true)
          .maybeSingle();

        if (groupError) {
          console.error('❌ Error checking media group:', groupError);
          throw groupError;
        }
        
        if (existingAnalysis?.analyzed_content) {
          console.log('✅ Found existing group analysis:', {
            method: existingAnalysis.analyzed_content.parsing_metadata?.method,
            confidence: existingAnalysis.analyzed_content.parsing_metadata?.confidence
          });
          analyzedContent = existingAnalysis.analyzed_content;
        } else {
          console.log('ℹ️ No existing analysis, using default');
          analyzedContent = {
            product_name: 'Untitled Product',
            parsing_metadata: {
              method: 'manual',
              confidence: 0.1,
              timestamp: new Date().toISOString()
            }
          };
        }
      } else if (!hasCaption) {
        console.log('ℹ️ No caption provided, using default');
        analyzedContent = {
          product_name: 'Untitled Product',
          parsing_metadata: {
            method: 'manual',
            confidence: 0.1,
            timestamp: new Date().toISOString()
          }
        };
      } else {
        // Try manual parsing first
        console.log('🤖 Attempting manual parsing');
        const manualResult = await manualParse(caption);
        
        console.log('📊 Manual parsing results:', {
          confidence: manualResult.parsing_metadata?.confidence,
          needs_ai: manualResult.parsing_metadata?.needs_ai_analysis,
          product_name: manualResult.product_name?.substring(0, 30) + '...',
          has_product_code: !!manualResult.product_code,
          has_quantity: !!manualResult.quantity,
          fallbacks: manualResult.parsing_metadata?.fallbacks_used
        });
        
        // If manual parsing needs help, try AI
        if (manualResult.parsing_metadata?.needs_ai_analysis) {
          console.log('🤖 Manual parsing needs help, trying AI');
          try {
            const aiResult = await analyzeCaption(caption);
            
            console.log('📊 AI analysis results:', {
              confidence: aiResult.parsing_metadata?.confidence,
              product_name: aiResult.product_name?.substring(0, 30) + '...',
              has_product_code: !!aiResult.product_code,
              has_quantity: !!aiResult.quantity
            });
            
            // Merge results
            analyzedContent = {
              product_name: aiResult.product_name || manualResult.product_name,
              product_code: manualResult.product_code || aiResult.product_code,
              vendor_uid: manualResult.vendor_uid || aiResult.vendor_uid,
              purchase_date: manualResult.purchase_date || aiResult.purchase_date,
              quantity: manualResult.quantity || aiResult.quantity,
              notes: aiResult.notes || manualResult.notes,
              parsing_metadata: {
                method: 'hybrid',
                confidence: Math.max(
                  manualResult.parsing_metadata?.confidence || 0,
                  aiResult.parsing_metadata?.confidence || 0
                ),
                manual_confidence: manualResult.parsing_metadata?.confidence,
                ai_confidence: aiResult.parsing_metadata?.confidence,
                timestamp: new Date().toISOString()
              }
            };

            console.log('✨ Merged analysis results:', {
              method: analyzedContent.parsing_metadata?.method || 'unknown',
              final_confidence: analyzedContent.parsing_metadata?.confidence || 0,
              manual_confidence: analyzedContent.parsing_metadata?.manual_confidence || 0,
              ai_confidence: analyzedContent.parsing_metadata?.ai_confidence || 0
            });
          } catch (aiError) {
            console.error('❌ AI analysis failed:', aiError);
            console.log('⚠️ Falling back to manual results');
            analyzedContent = manualResult;
          }
        } else {
          console.log('✅ Manual parsing sufficient');
          analyzedContent = manualResult;
        }
      }

      console.log('💾 Updating message:', {
        messageId,
        method: analyzedContent.parsing_metadata?.method,
        confidence: analyzedContent.parsing_metadata?.confidence,
        has_caption: hasCaption
      });

      const { error: updateError } = await supabase
        .from('messages')
        .update({
          analyzed_content: analyzedContent,
          processing_state: 'completed',
          processing_completed_at: new Date().toISOString(),
          is_original_caption: hasCaption,
          processing_correlation_id: correlation_id
        })
        .eq('id', messageId);

      if (updateError) {
        console.error('❌ Error updating message:', updateError);
        throw updateError;
      }

      console.log('✅ Successfully updated message');

      return new Response(
        JSON.stringify({
          success: true,
          analyzed_content: analyzedContent,
          correlation_id,
          messageId
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } catch (error) {
      console.error('❌ Error in parse-caption-with-ai:', {
        error: error.message,
        stack: error.stack,
        messageId,
        correlation_id
      });
      
      try {
        console.log('🔄 Updating message state to error');
        const { error: stateError } = await createClient(
          Deno.env.get('SUPABASE_URL') || '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
        )
          .rpc('xdelo_update_message_processing_state', {
            p_message_id: messageId,
            p_state: 'error',
            p_error: error.message
          });
        
        if (stateError) {
          console.error('❌ Error updating message state:', stateError);
        }
      } catch (updateError) {
        console.error('❌ Error updating message state:', updateError);
      }
      
      return new Response(
        JSON.stringify({
          success: false,
          error: error.message,
          messageId,
          correlation_id: correlation_id || crypto.randomUUID(),
          timestamp: new Date().toISOString()
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500
        }
      );
    }
  } catch (error) {
    console.error('❌ Fatal error:', {
      error: error.message,
      stack: error.stack
    });
    return new Response(
      JSON.stringify({ 
        status: 'error', 
        message: error.message,
        stack: error.stack 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
