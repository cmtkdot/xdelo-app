
import { supabaseClient } from "../_shared/supabase.ts";
import { ParsedContent } from './types.ts';

/**
 * Process a caption using AI
 */
export async function processCaption(caption: string): Promise<ParsedContent> {
  // Use the direct caption processing function instead of OpenAI
  const { data, error } = await supabaseClient.rpc(
    'xdelo_direct_caption_processing',
    {
      p_caption: caption
    }
  );
  
  if (error) {
    throw new Error(`Error processing caption: ${error.message}`);
  }
  
  // Validate the result
  if (!data) {
    throw new Error("No result returned from caption processing");
  }
  
  return data as ParsedContent;
}

/**
 * Update a message with the parsed data
 */
export async function updateMessageWithParsedData(
  messageId: string, 
  parsedData: ParsedContent
): Promise<void> {
  // Call the RPC function to update the message
  const { error } = await supabaseClient.rpc(
    'xdelo_update_message_with_analyzed_content',
    {
      p_message_id: messageId,
      p_analyzed_content: parsedData,
      p_processing_state: 'completed'
    }
  );
  
  if (error) {
    throw new Error(`Failed to update message with analyzed content: ${error.message}`);
  }
}

/**
 * Get an unprocessed message from the queue
 */
export async function getMessageFromQueue() {
  const { data, error } = await supabaseClient
    .from('caption_processing_queue')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(1)
    .single();
    
  if (error) {
    // No message found is not an error
    if (error.code === 'PGRST116') {
      return null;
    }
    throw new Error(`Error getting message from queue: ${error.message}`);
  }
  
  return data;
}

/**
 * Mark a queue item as processed
 */
export async function markQueueItemAsProcessed(queueId: string): Promise<void> {
  const { error } = await supabaseClient
    .from('caption_processing_queue')
    .update({
      status: 'processed',
      processed_at: new Date().toISOString()
    })
    .eq('id', queueId);
    
  if (error) {
    console.error(`Error marking queue item as processed: ${error.message}`);
  }
}

/**
 * Mark a queue item as failed
 */
export async function markQueueItemAsFailed(queueId: string, errorMessage: string): Promise<void> {
  const { error } = await supabaseClient
    .from('caption_processing_queue')
    .update({
      status: 'failed',
      processed_at: new Date().toISOString(),
      error_message: errorMessage
    })
    .eq('id', queueId);
    
  if (error) {
    console.error(`Error marking queue item as failed: ${error.message}`);
  }
}
