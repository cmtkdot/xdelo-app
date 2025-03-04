
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { parseCaption, shouldUseAI } from "./captionParser.ts";
import { aiAnalyzeCaption } from "./aiAnalyzer.ts";
import { updateMessageWithAnalyzedContent, syncMediaGroup } from "./dbOperations.ts";
import { ParsedContent } from "./types.ts";

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    const { messageId, caption, media_group_id, correlationId = crypto.randomUUID().toString(), queue_id } = await req.json();
    console.log(`Processing caption for messageId: ${messageId}, correlation: ${correlationId}`);

    if (!messageId) {
      throw new Error('messageId is required');
    }

    if (!caption) {
      throw new Error('caption is required for analysis');
    }

    // Step 1: Perform initial manual parsing
    console.log('Performing manual parsing...');
    const manualResult = parseCaption(caption);
    
    let finalResult: ParsedContent = manualResult;
    let usedAI = false;

    // Step 2: Check if AI analysis is needed
    const needsAI = shouldUseAI(manualResult.product_name);
    
    if (needsAI) {
      try {
        console.log('Caption complexity requires AI analysis...');
        const aiResult = await aiAnalyzeCaption(messageId, caption);
        
        if (aiResult) {
          console.log('AI analysis successful, merging results');
          // Merge AI results with manual results, preferring AI for complex fields
          finalResult = {
            ...manualResult,
            ...aiResult,
            parsing_metadata: {
              ...manualResult.parsing_metadata,
              method: 'hybrid',
              ai_confidence: aiResult.parsing_metadata?.ai_confidence || 0.7,
              timestamp: new Date().toISOString()
            }
          };
          usedAI = true;
        } else {
          console.log('AI analysis returned no results, using manual parsing');
        }
      } catch (error) {
        console.error('Error during AI analysis:', error);
        // Continue with manual results if AI fails
      }
    }

    // Step 3: Update the message with analyzed content
    console.log('Updating message with analyzed content...');
    const updateResult = await updateMessageWithAnalyzedContent(
      messageId,
      finalResult,
      correlationId
    );

    // Step 4: If this is part of a media group, sync the content to other messages
    if (media_group_id && updateResult.success) {
      console.log(`Syncing content to media group ${media_group_id}...`);
      await syncMediaGroup(messageId, media_group_id, correlationId);
    }

    // Return the parsed result
    return new Response(
      JSON.stringify({
        success: true,
        data: finalResult,
        usedAI,
        messageId,
        media_group_id,
        correlationId
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error processing caption:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
