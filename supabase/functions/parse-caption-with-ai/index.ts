
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { corsHeaders } from '../_shared/cors.ts';
import { parseCaption } from './captionParser.ts';
import { analyzeWithAI } from './aiAnalyzer.ts';
import { 
  getMessage, 
  updateMessageWithAnalysis, 
  markQueueItemAsFailed,
  syncMediaGroupContent,
  logAnalysisEvent
} from './dbOperations.ts';
import { ParsedContent } from './types.ts';

// Create Supabase client for any additional operations
const supabaseClient = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messageId, caption, media_group_id, correlationId, queue_id } = await req.json();
    console.log(`Processing caption for message ${messageId}, correlation_id: ${correlationId}`);

    if (!messageId || !caption) {
      throw new Error("Required parameters missing: messageId and caption are required");
    }

    // First, get the current message state
    console.log(`Fetching current state for message ${messageId}`);
    const existingMessage = await getMessage(messageId);
    console.log(`Current message state:`, existingMessage);

    // Perform manual parsing
    console.log(`Performing manual parsing on caption: ${caption.substring(0, 50)}...`);
    let parsedContent: ParsedContent = parseCaption(caption);
    console.log(`Manual parsing result:`, parsedContent);

    // Check if the product name is long (complex) and needs AI analysis
    const needsAIAnalysis = parsedContent.product_name && parsedContent.product_name.length > 23;
    
    if (needsAIAnalysis) {
      console.log(`Product name is complex, performing AI analysis`);
      try {
        const aiResult = await analyzeWithAI(caption, parsedContent);
        console.log(`AI analysis complete:`, aiResult);
        
        // Merge AI results with manual parsing results, AI takes precedence
        parsedContent = {
          ...parsedContent,
          ...aiResult,
          parsing_metadata: {
            method: 'ai',
            timestamp: new Date().toISOString(),
            original_manual_parse: parsedContent
          }
        };
      } catch (aiError) {
        console.error('AI analysis failed, using manual parsing fallback:', aiError);
        parsedContent.parsing_metadata = {
          method: 'manual',
          timestamp: new Date().toISOString(),
          ai_error: aiError.message
        };
      }
    } else {
      // Set parsing metadata for manual method
      parsedContent.parsing_metadata = {
        method: 'manual',
        timestamp: new Date().toISOString()
      };
    }

    // Save additional metadata
    parsedContent.caption = caption;
    
    if (media_group_id) {
      parsedContent.sync_metadata = {
        media_group_id: media_group_id
      };
    }

    // Log the analysis in the audit trail
    await logAnalysisEvent(
      messageId,
      correlationId,
      { analyzed_content: existingMessage?.analyzed_content },
      { analyzed_content: parsedContent },
      {
        source: 'parse-caption-with-ai',
        caption: caption,
        media_group_id: media_group_id,
        method: needsAIAnalysis ? 'ai' : 'manual'
      }
    );

    // Update the message with the analyzed content
    console.log(`Updating message ${messageId} with analyzed content`);
    await updateMessageWithAnalysis(messageId, parsedContent, existingMessage, queue_id);

    // Always attempt to sync content to media group
    if (media_group_id) {
      console.log(`Starting media group content sync for group ${media_group_id}, message ${messageId}`);
      const syncResult = await syncMediaGroupContent(media_group_id, messageId, correlationId);
      console.log(`Media group sync result:`, syncResult);
    } else {
      console.log(`No media_group_id provided, skipping group sync`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Caption analyzed successfully for message ${messageId}`,
        data: parsedContent
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in parse-caption-with-ai:', error);
    
    // Extract queue_id from request if available for error handling
    try {
      const { queue_id } = await req.json();
      if (queue_id) {
        await markQueueItemAsFailed(queue_id, error.message);
      }
    } catch (reqError) {
      console.error('Error extracting queue_id from request:', reqError);
    }
    
    return new Response(
      JSON.stringify({
        success: false,
        error: `Error processing caption: ${error.message}`,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
