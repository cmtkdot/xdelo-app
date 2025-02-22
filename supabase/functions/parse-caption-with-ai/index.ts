
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { analyzeCaption } from "./utils/aiAnalyzer.ts";
import { ParsedContent } from "../_shared/types.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function findMediaGroupAnalysis(supabase: any, mediaGroupId: string) {
  const { data, error } = await supabase
    .from('messages')
    .select('analyzed_content, is_original_caption')
    .eq('media_group_id', mediaGroupId)
    .eq('is_original_caption', true)
    .maybeSingle();

  if (error) {
    console.error('Error finding media group analysis:', error);
    throw error;
  }

  return data?.analyzed_content;
}

async function getMediaGroupInfo(supabase: any, mediaGroupId: string) {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('media_group_id', mediaGroupId);

  if (error) {
    console.error('Error getting media group info:', error);
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
  supabase: any,
  mediaGroupId: string,
  message_id: string,
  analyzedContent: any,
  hasCaption: boolean
) {
  try {
    console.log('Starting media group sync:', { mediaGroupId, message_id, hasCaption });

    // Get media group completion status
    const groupInfo = await getMediaGroupInfo(supabase, mediaGroupId);
    console.log('Media group info:', groupInfo);

    // Update all messages in the group via the stored procedure
    const { error: procError } = await supabase
      .rpc('xdelo_sync_media_group_content', {
        p_source_message_id: message_id,
        p_media_group_id: mediaGroupId,
        p_correlation_id: crypto.randomUUID()
      });

    if (procError) {
      console.error('Error in xdelo_sync_media_group_content:', procError);
      throw procError;
    }

    console.log('Successfully processed media group analysis:', {
      groupSize: groupInfo.totalCount,
      uploadedCount: groupInfo.uploadedCount,
      isComplete: groupInfo.isComplete,
      hasCaption: groupInfo.hasCaption
    });
  } catch (error) {
    console.error('Error updating media group messages:', error);
    throw error;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messageId, media_group_id, caption, correlation_id } = await req.json();
    
    console.log('Starting caption analysis:', {
      messageId,
      media_group_id,
      caption_length: caption?.length || 0,
      correlation_id
    });

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
      console.log('Empty caption received, checking media group for analysis');
      const existingAnalysis = await findMediaGroupAnalysis(supabase, media_group_id);
      
      if (existingAnalysis) {
        console.log('Found existing media group analysis, using it');
        analyzedContent = existingAnalysis;
      } else {
        console.log('No existing analysis found, using default values');
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
      console.log('No caption or media group ID, using default values');
      analyzedContent = {
        product_name: 'Untitled Product',
        parsing_metadata: {
          method: 'manual',
          confidence: 0.1,
          timestamp: new Date().toISOString()
        }
      };
    } else {
      analyzedContent = await analyzeCaption(textToAnalyze);
    }

    console.log('Analysis completed:', {
      correlation_id,
      product_name: analyzedContent.product_name,
      confidence: analyzedContent.parsing_metadata?.confidence,
      has_caption: hasCaption
    });

    if (media_group_id) {
      await updateMediaGroupMessages(supabase, media_group_id, messageId, analyzedContent, hasCaption);
    } else {
      const { error: updateError } = await supabase
        .from('messages')
        .update({
          analyzed_content: analyzedContent,
          processing_state: 'completed',
          processing_completed_at: new Date().toISOString(),
          is_original_caption: hasCaption
        })
        .eq('id', messageId);

      if (updateError) {
        console.error('Error updating single message:', updateError);
        throw updateError;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        analyzed_content: analyzedContent,
        correlation_id
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in parse-caption-with-ai:', error);
    
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL');
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      const supabase = createClient(supabaseUrl, supabaseKey);

      // Update message state to error
      const { messageId } = await req.json();
      if (messageId) {
        await supabase.rpc('xdelo_update_message_processing_state', {
          p_message_id: messageId,
          p_state: 'error',
          p_error: error.message
        });
      }
    } catch (updateError) {
      console.error('Error updating message state:', updateError);
    }
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        correlation_id: crypto.randomUUID(),
        timestamp: new Date().toISOString()
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});
