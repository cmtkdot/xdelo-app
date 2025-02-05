import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { analyzeCaption } from "./utils/aiAnalyzer.ts";
import { ParsedContent } from "../_shared/types.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function findMediaGroupAnalysis(supabase: any, mediaGroupId: string) {
  // First try to find any message with caption and analyzed content
  const { data: captionMessage } = await supabase
    .from('messages')
    .select('analyzed_content')
    .eq('media_group_id', mediaGroupId)
    .not('caption', 'is', null)
    .not('analyzed_content', 'is', null)
    .maybeSingle();

  if (captionMessage?.analyzed_content) {
    return captionMessage.analyzed_content;
  }

  // Fallback to any message with analyzed content
  const { data: anyMessage } = await supabase
    .from('messages')
    .select('analyzed_content')
    .eq('media_group_id', mediaGroupId)
    .not('analyzed_content', 'is', null)
    .maybeSingle();

  return anyMessage?.analyzed_content;
}

async function updateMediaGroupMessages(
  supabase: any,
  mediaGroupId: string | null,
  messageId: string,
  caption: string | null,
  analyzedContent: any,
  hasCaption: boolean
) {
  try {
    if (mediaGroupId && hasCaption) {
      // Message has caption and is part of group - sync to all
      console.log('Message has caption and group, syncing to group:', { messageId, mediaGroupId });
      await supabase
        .from('messages')
        .update({
          analyzed_content: analyzedContent,
          processing_state: 'completed',
          processing_completed_at: new Date().toISOString()
        })
        .eq('media_group_id', mediaGroupId);
        
      // Trigger resync to ensure counts are updated
      await supabase.rpc('resync', {
        p_media_group_id: mediaGroupId
      });
    } else if (mediaGroupId) {
      // Part of group but no caption - get existing analysis
      const existingAnalysis = await findMediaGroupAnalysis(supabase, mediaGroupId);
      
      if (existingAnalysis) {
        console.log('Using existing group analysis:', { messageId });
        await supabase
          .from('messages')
          .update({
            analyzed_content: existingAnalysis,
            processing_state: 'completed',
            processing_completed_at: new Date().toISOString()
          })
          .eq('id', messageId);
          
        // Trigger resync to ensure counts are updated
        await supabase.rpc('resync', {
          p_media_group_id: mediaGroupId
        });
      } else {
        // No analysis yet, just update this message
        console.log('No group analysis yet, updating message:', { messageId });
        await supabase
          .from('messages')
          .update({
            analyzed_content: analyzedContent,
            processing_state: 'completed',
            processing_completed_at: new Date().toISOString()
          })
          .eq('id', messageId);
      }
    } else {
      // For single messages, set count and mark as completed
      if (!mediaGroupId) {
        await supabase
          .from('messages')
          .update({
            analyzed_content: analyzedContent,
            processing_state: 'completed',
            processing_completed_at: new Date().toISOString(),
            // Single messages always have count=1
            group_message_count: 1
          })
          .eq('id', messageId);
        return;
      }
    }
  } catch (error) {
    console.error('Error updating messages:', error);
    throw error;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message_id, media_group_id, caption, correlation_id } = await req.json();
    
    console.log('Starting caption analysis:', {
      message_id,
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
    const textToAnalyze = caption?.trim() || '';
    const hasCaption = Boolean(textToAnalyze);

    let analyzedContent: ParsedContent;

    if (hasCaption) {
      // Has caption - analyze it
      analyzedContent = await analyzeCaption(textToAnalyze);
    } else {
      // No caption - use default values
      analyzedContent = {
        product_name: 'Untitled Product',
        parsing_metadata: {
          method: 'manual',
          confidence: 0.1,
          timestamp: new Date().toISOString()
        }
      };
    }

    // Update messages
    await updateMediaGroupMessages(supabase, media_group_id, message_id, textToAnalyze, analyzedContent, hasCaption);

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
