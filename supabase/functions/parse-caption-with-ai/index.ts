
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { parseCaption, shouldUseAI } from "./captionParser.ts";
import { aiAnalyzeCaption } from "./aiAnalyzer.ts";
import { updateMessageWithAnalyzedContent } from "./dbOperations.ts";
import { syncMediaGroup } from "./dbOperations.ts"; 

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
    
    let finalResult = manualResult;
    let usedAI = false;

    // Step 2: Check if AI analysis is needed
    const needsAI = shouldUseAI(manualResult.product_name);
    
    if (needsAI) {
      try {
        console.log('Caption complexity requires AI analysis...');
        const aiResult = await aiAnalyzeCaption(caption, manualResult);
        
        if (aiResult && aiResult.success && aiResult.result) {
          console.log('AI analysis successful, merging results');
          
          // Use AI result if available
          finalResult = {
            ...aiResult.result,
            parsing_metadata: {
              ...aiResult.result.parsing_metadata,
              method: 'hybrid',
              timestamp: new Date().toISOString()
            }
          };
          usedAI = true;
        } else {
          console.log('AI analysis returned no results or failed, using manual parsing');
          console.log('AI error:', aiResult?.error || 'No specific error');
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
      correlationId,
      queue_id
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
        correlationId,
        queue_id
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
