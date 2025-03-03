
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
      console.log(`Message ${messageId} has a long product name (${productName.length} chars), using AI analysis`);
      const aiResult = await analyzeWithAI(caption, analyzedContent);
      
      if (aiResult.success && aiResult.result) {
        // Merge AI analysis results
        console.log(`AI analysis successful for message ${messageId}`);
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
        console.warn(`AI analysis failed for message ${messageId}: ${aiResult.error}`);
        analyzedContent.parsing_metadata = {
          ...analyzedContent.parsing_metadata,
          method: 'hybrid',
          ai_error: aiResult.error
        };
      }
    }

    // Ensure media group info is added to analyzed content
    const resolvedMediaGroupId = mediaGroupId || existingMessage?.media_group_id;
    if (resolvedMediaGroupId) {
      console.log(`Adding media group info (${resolvedMediaGroupId}) to analyzed content for message ${messageId}`);
      analyzedContent.sync_metadata = {
        media_group_id: resolvedMediaGroupId,
        sync_timestamp: new Date().toISOString()
      };
    }

    // Update the message with analyzed content
    console.log(`Updating message ${messageId} with analyzed content`);
    await updateMessageWithAnalysis(messageId, analyzedContent, existingMessage, queueId);

    // Always try to sync analyzed content to media group
    let syncResult = null;
    
    if (resolvedMediaGroupId) {
      console.log(`Syncing analyzed content to media group ${resolvedMediaGroupId} from message ${messageId}`);
      try {
        syncResult = await syncMediaGroupContent(resolvedMediaGroupId, messageId);
        
        // Log detailed sync results
        if (syncResult.success) {
          console.log(`Media group sync successful: Synced ${syncResult.syncedCount} messages using method ${syncResult.method}`);
        } else {
          console.error(`Media group sync failed: ${syncResult.reason}`, syncResult);
        }
        
        // Add sync result to analyzed content for tracking
        analyzedContent.sync_metadata = {
          ...analyzedContent.sync_metadata,
          sync_result: syncResult,
          sync_timestamp: new Date().toISOString()
        };
      } catch (syncError) {
        console.error(`Error syncing media group ${resolvedMediaGroupId}:`, syncError);
        // Track the error in the analyzed content
        analyzedContent.sync_metadata = {
          ...analyzedContent.sync_metadata,
          sync_error: syncError.message,
          sync_timestamp: new Date().toISOString()
        };
      }
    } else {
      console.log(`No media group ID found for message ${messageId}, skipping group sync`);
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
        media_group_id: resolvedMediaGroupId,
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
