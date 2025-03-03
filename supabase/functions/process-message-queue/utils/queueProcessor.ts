
import { supabaseClient } from "../../_shared/supabase.ts";
import { MessageQueueItem, ProcessingResults } from "../types.ts";

/**
 * Process the next batch of messages in the queue
 */
export async function processMessageQueue(limit: number = 5): Promise<ProcessingResults> {
  try {
    console.log(`Processing message queue with limit ${limit}`);
    
    const results: ProcessingResults = {
      processed: 0,
      success: 0,
      failed: 0,
      details: []
    };
    
    // Get next batch of messages to process
    const { data: queueItems, error: fetchError } = await supabaseClient.rpc(
      'xdelo_get_next_message_for_processing',
      { limit_count: limit }
    );
    
    if (fetchError) {
      console.error('Error fetching messages from queue:', fetchError);
      throw fetchError;
    }
    
    if (!queueItems || queueItems.length === 0) {
      console.log('No messages in queue to process');
      return results;
    }
    
    console.log(`Retrieved ${queueItems.length} messages for processing`);
    
    // Process each message
    for (const item of queueItems) {
      try {
        console.log(`Processing message ${item.message_id}, queue ID: ${item.queue_id}`);
        
        // Call the parse-caption-with-ai function
        const analyzeResponse = await supabaseClient.functions.invoke('parse-caption-with-ai', {
          body: {
            messageId: item.message_id,
            caption: item.caption,
            media_group_id: item.media_group_id,
            correlationId: item.correlation_id
          }
        });
        
        if (analyzeResponse.error) {
          throw new Error(`Failed to analyze message: ${analyzeResponse.error}`);
        }
        
        // Mark the message as completed in the queue
        await supabaseClient.rpc('xdelo_complete_message_processing', {
          p_queue_id: item.queue_id,
          p_analyzed_content: analyzeResponse.data.data
        });
        
        console.log(`Successfully processed message ${item.message_id}`);
        
        results.success++;
        results.details.push({
          message_id: item.message_id,
          queue_id: item.queue_id,
          status: 'success',
          result: analyzeResponse.data.data
        });
        
      } catch (error) {
        console.error(`Error processing message ${item.message_id}:`, error);
        
        // Mark the processing as failed
        await supabaseClient.rpc('xdelo_fail_message_processing', {
          p_queue_id: item.queue_id,
          p_error_message: error.message
        });
        
        results.failed++;
        results.details.push({
          message_id: item.message_id,
          queue_id: item.queue_id,
          status: 'error',
          error_message: error.message
        });
      }
      
      results.processed++;
    }
    
    return results;
  } catch (error) {
    console.error('Error in processMessageQueue:', error);
    throw error;
  }
}
