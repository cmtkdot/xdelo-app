import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { analyzeCaption } from "./utils/aiAnalyzer.ts";
import { ParsedContent } from "../_shared/types.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function findMediaGroupAnalysis(supabase: any, mediaGroupId: string) {
  // Find any message with analyzed content, prioritizing ones with captions
  const { data: message } = await supabase
    .from('messages')
    .select('analyzed_content, caption')
    .eq('media_group_id', mediaGroupId)
    .not('analyzed_content', 'is', null)
    .order('caption', { ascending: false }) // Messages with captions first
    .maybeSingle();

  return message?.analyzed_content;
}

async function updateMediaGroupMessages(
  supabase: any,
  mediaGroupId: string,
  messageId: string,
  analyzedContent: any,
  hasCaption: boolean
) {
  try {
    // If this message has a caption, always sync to group
    if (hasCaption) {
      console.log('Message has caption, syncing to group:', { messageId, mediaGroupId });
      await supabase
        .from('messages')
        .update({
          analyzed_content: analyzedContent,
          processing_state: 'completed',
          processing_completed_at: new Date().toISOString()
        })
        .eq('media_group_id', mediaGroupId);
    } else {
      // No caption - find if there's any analyzed content in the group
      const existingAnalysis = await findMediaGroupAnalysis(supabase, mediaGroupId);
      
      if (existingAnalysis) {
        // Use existing analysis for this message
        console.log('Using existing group analysis for message:', { messageId });
        await supabase
          .from('messages')
          .update({
            analyzed_content: existingAnalysis,
            processing_state: 'completed',
            processing_completed_at: new Date().toISOString()
          })
          .eq('id', messageId);
      } else {
        // No existing analysis, just update this message
        console.log('No group analysis found, updating single message:', { messageId });
        await supabase
          .from('messages')
          .update({
            analyzed_content: analyzedContent,
            processing_state: 'completed',
            processing_completed_at: new Date().toISOString()
          })
          .eq('id', messageId);
      }
    }
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

    if (media_group_id) {
      await updateMediaGroupMessages(supabase, media_group_id, message_id, analyzedContent, hasCaption);
    } else {
      const { error: updateError } = await supabase
        .from('messages')
        .update({
          analyzed_content: analyzedContent,
          processing_state: 'completed',
          processing_completed_at: new Date().toISOString()
        })
        .eq('id', message_id);

      if (updateError) throw updateError;
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
