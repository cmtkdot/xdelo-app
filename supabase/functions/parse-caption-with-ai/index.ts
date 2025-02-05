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

async function updateMediaGroupMessages(
  supabase: any,
  mediaGroupId: string,
  messageId: string,
  analyzedContent: any,
  hasCaption: boolean
) {
  try {
    console.log('Updating media group messages:', { mediaGroupId, messageId });

    // Get all messages in the group
    const { data: groupMessages, error: groupError } = await supabase
      .from('messages')
      .select('*')
      .eq('media_group_id', mediaGroupId);

    if (groupError) throw groupError;
    if (!groupMessages) return;

    // Update all messages in the group
    const updates = groupMessages.map(async (msg) => {
      // For the message with caption, mark it as original
      const isOriginalCaption = msg.id === messageId && hasCaption;
      
      // Always update processing state to completed
      const { error: updateError } = await supabase
        .from('messages')
        .update({
          analyzed_content: analyzedContent,
          processing_state: 'completed',
          processing_completed_at: new Date().toISOString(),
          is_original_caption: isOriginalCaption
        })
        .eq('id', msg.id);

      if (updateError) throw updateError;
    });

    await Promise.all(updates);
    console.log('Successfully updated all media group messages');
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

    // Initialize Supabase client early as we'll need it for both paths
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
      // Try to find existing analysis from the media group
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
      // Analyze the caption
      analyzedContent = await analyzeCaption(textToAnalyze);
    }

    console.log('Analysis completed:', {
      correlation_id,
      product_name: analyzedContent.product_name,
      confidence: analyzedContent.parsing_metadata?.confidence,
      has_caption: hasCaption
    });

    if (media_group_id) {
      // Handle media group updates
      await updateMediaGroupMessages(supabase, media_group_id, message_id, analyzedContent, hasCaption);
    } else {
      // Single message update
      const { error: updateError } = await supabase
        .from('messages')
        .update({
          analyzed_content: analyzedContent,
          processing_state: 'completed',
          processing_completed_at: new Date().toISOString(),
          is_original_caption: hasCaption
        })
        .eq('id', message_id);

      if (updateError) {
        console.error('Error updating message:', updateError);
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
