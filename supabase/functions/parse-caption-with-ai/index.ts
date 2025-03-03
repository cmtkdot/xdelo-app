
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { RequestPayload, ParsedContent, ParseResult } from './types.ts';
import { parseCaption, shouldUseAI } from './captionParser.ts';
import { analyzeWithAI } from './aiAnalyzer.ts';
import { 
  getMessage, 
  updateMessageWithAnalysis, 
  markQueueItemAsFailed, 
  syncMediaGroupContent,
  logAnalysisEvent
} from './dbOperations.ts';

// CORS headers for the function
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function processCaption(
  messageId: string,
  caption: string,
  correlationId: string,
  queueId?: string,
  mediaGroupId?: string
): Promise<ParseResult> {
  try {
    console.log(`Processing caption for message ${messageId} with correlation ID ${correlationId}`);
    
    if (!caption || caption.trim() === '') {
      throw new Error('Cannot process empty caption');
    }
    
    // Get existing message
    const existingMessage = await getMessage(messageId);

    // Parse caption using manual extraction
    const { 
      productName, 
      productCode, 
      vendorUid, 
      purchaseDate, 
      quantity, 
      notes 
    } = parseCaption(caption);

    // Prepare analyzed content with manual parsing results
    let analyzedContent: ParsedContent = {
      product_name: productName,
      product_code: productCode,
      vendor_uid: vendorUid,
      purchase_date: purchaseDate,
      quantity: quantity,
      notes: notes,
      caption: caption,
      parsing_metadata: {
        method: 'manual',
        timestamp: new Date().toISOString()
      }
    };

    // If product name is longer than 23 characters, use AI analysis
    if (shouldUseAI(productName)) {
      const aiResult = await analyzeWithAI(caption, analyzedContent);
      
      if (aiResult.success && aiResult.result) {
        // Merge AI analysis results
        analyzedContent = {
          ...analyzedContent,
          ...aiResult.result,
          parsing_metadata: {
            method: 'ai',
            timestamp: new Date().toISOString()
          }
        };
      } else {
        // Continue with manual parsing but record the AI error
        analyzedContent.parsing_metadata = {
          ...analyzedContent.parsing_metadata,
          method: 'hybrid',
          ai_error: aiResult.error
        };
      }
    }

    // Add media group info to analyzed content if available
    if (mediaGroupId || existingMessage?.media_group_id) {
      analyzedContent.sync_metadata = {
        media_group_id: mediaGroupId || existingMessage?.media_group_id,
        sync_timestamp: new Date().toISOString()
      };
    }

    // Update the message with analyzed content
    await updateMessageWithAnalysis(messageId, analyzedContent, existingMessage, queueId);

    // Always try to sync analyzed content to media group
    // We do this after message update to ensure the message has been processed
    const groupId = mediaGroupId || existingMessage?.media_group_id;
    let syncResult = null;
    
    if (groupId) {
      console.log(`Syncing analyzed content to media group ${groupId} from message ${messageId}`);
      try {
        syncResult = await syncMediaGroupContent(groupId, messageId);
        console.log('Media group sync result:', syncResult);
        
        // Add sync result to analyzed content for tracking
        analyzedContent.sync_metadata = {
          ...analyzedContent.sync_metadata,
          sync_result: syncResult,
          sync_timestamp: new Date().toISOString()
        };
      } catch (syncError) {
        console.error('Error syncing media group:', syncError);
        // Continue processing even if sync fails
      }
    } else {
      console.log(`No media group ID found for message ${messageId}`);
    }

    // Log the analysis event
    await logAnalysisEvent(
      messageId,
      correlationId,
      existingMessage?.analyzed_content,
      analyzedContent,
      {
        parsing_method: analyzedContent.parsing_metadata.method,
        product_name_length: productName.length,
        media_group_id: groupId,
        sync_result: syncResult
      }
    );

    return {
      success: true,
      data: analyzedContent,
      sync_result: syncResult
    };
  } catch (error) {
    console.error('Error in processCaption:', error);
    
    // If we have a queue ID, mark the processing as failed
    if (queueId) {
      await markQueueItemAsFailed(queueId, error.message);
    }
    
    throw error;
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload = await req.json() as RequestPayload;
    console.log('Received payload:', JSON.stringify(payload, null, 2));
    
    const { messageId, caption, correlationId, queue_id, media_group_id } = payload;

    // Validate required fields
    const missingFields = [];
    if (!messageId) missingFields.push('messageId');
    if (!caption || caption.trim() === '') missingFields.push('caption');
    
    if (missingFields.length > 0) {
      throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
    }

    console.log(`Processing message ${messageId} with caption: "${caption.substring(0, 50)}..."`);
    
    const result = await processCaption(
      messageId,
      caption,
      correlationId || crypto.randomUUID(),
      queue_id,
      media_group_id
    );

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error processing message caption:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
