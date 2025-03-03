
import { supabaseClient } from "../../_shared/supabase.ts";
import { validateStoragePath, constructPublicUrl } from "./storageValidator.ts";
import { MessageQueueItem, ProcessingResults, MessageData, StorageValidationResult } from "../types.ts";

/**
 * Process the next batch of messages in the queue
 */
export async function processMessageQueue(limit: number = 1): Promise<ProcessingResults> {
  try {
    console.log(`Processing message queue with limit ${limit}`);
    
    const results: ProcessingResults = {
      processed: 0,
      success: 0,
      failed: 0,
      details: []
    };
    
    // Process specified number of messages
    for (let i = 0; i < limit; i++) {
      // Get next message to process
      const nextMessage = await getNextMessage();
      
      if (!nextMessage) {
        console.log('No more messages in queue');
        break;
      }
      
      // Process the message
      const processingResult = await processMessage(nextMessage);
      
      // Update results
      results.processed++;
      if (processingResult.status === 'success') {
        results.success++;
      } else {
        results.failed++;
      }
      
      results.details.push(processingResult);
    }
    
    return results;
  } catch (error) {
    console.error('Error processing message queue:', error);
    throw error;
  }
}

/**
 * Get the next message from the queue
 */
async function getNextMessage(): Promise<MessageQueueItem | null> {
  const { data: nextMessage, error: queueError } = await supabaseClient.rpc('xdelo_get_next_message_for_processing');
  
  if (queueError) {
    console.error('Error getting next message for processing:', queueError);
    return null;
  }
  
  if (!nextMessage || nextMessage.length === 0) {
    return null;
  }
  
  return nextMessage[0] as MessageQueueItem;
}

/**
 * Process a single message
 */
async function processMessage(queueItem: MessageQueueItem): Promise<{
  message_id: string;
  queue_id: string;
  status: 'success' | 'error';
  result?: any;
  error?: string;
}> {
  const { queue_id, message_id, correlation_id, caption, media_group_id } = queueItem;
  
  try {
    console.log('Processing message:', { message_id, queue_id });
    
    // Get full message details
    const messageData = await getMessageData(message_id);
    
    // Validate storage path and update if needed
    const storageValidation = await validateAndUpdateStoragePath(messageData);
    
    // If the file needs redownload, flag it but continue with processing
    if (storageValidation.needsRedownload) {
      await flagForRedownload(messageData, storageValidation);
    }
    
    // Call the analyze function with updated storage information
    const analyzeResult = await analyzeMessage({
      messageId: message_id,
      caption: caption,
      media_group_id: media_group_id,
      correlationId: correlation_id,
      fileInfo: {
        file_unique_id: messageData.file_unique_id,
        public_url: storageValidation.publicUrl,
        storage_path: storageValidation.storagePath
      }
    });
    
    // Complete the message processing
    await completeProcessing(queue_id, analyzeResult.data);
    
    return {
      message_id,
      queue_id,
      status: 'success',
      result: analyzeResult.data
    };
    
  } catch (error) {
    console.error(`Error processing message ${message_id}:`, error);
    
    // Mark the processing as failed
    await failProcessing(queue_id, error.message);
    
    return {
      message_id,
      queue_id,
      status: 'error',
      error: error.message
    };
  }
}

/**
 * Get message data from the database
 */
async function getMessageData(messageId: string): Promise<MessageData> {
  const { data, error } = await supabaseClient
    .from('messages')
    .select('*')
    .eq('id', messageId)
    .single();
    
  if (error) throw new Error(`Failed to retrieve message: ${error.message}`);
  
  return data as MessageData;
}

/**
 * Validate and update storage path if needed
 */
async function validateAndUpdateStoragePath(messageData: MessageData): Promise<StorageValidationResult> {
  const { id, file_unique_id, storage_path, mime_type } = messageData;
  
  // Validate the storage path
  const { storagePath, needsUpdate } = validateStoragePath(file_unique_id, storage_path, mime_type);
  
  // Generate the public URL
  const publicUrl = constructPublicUrl(storagePath);
  
  // Determine if the file needs redownload - we'll simplify by just checking if storage path needs update
  // In a more comprehensive implementation, we would try to check if file actually exists
  const needsRedownload = needsUpdate;
  
  // If storage path needs update, update it (but don't flag for redownload yet)
  if (needsUpdate) {
    console.log(`Updating storage path for message ${id}: ${storagePath}`);
    
    // Update the message with the correct path
    const { error: updateError } = await supabaseClient
      .from('messages')
      .update({
        storage_path: storagePath,
        public_url: publicUrl,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);
      
    if (updateError) {
      console.error(`Error updating storage path: ${updateError.message}`);
    }
  }
  
  return {
    isValid: !needsRedownload,
    storagePath,
    publicUrl,
    needsRedownload
  };
}

/**
 * Flag a message for redownload
 */
async function flagForRedownload(messageData: MessageData, storageInfo: StorageValidationResult): Promise<void> {
  const { id, media_group_id } = messageData;
  
  // Determine the best redownload strategy
  let redownloadStrategy = 'telegram_api';
  
  // If in a media group, prefer recovering from group
  if (media_group_id) {
    redownloadStrategy = 'media_group';
  }
  
  // Update the message with redownload flag
  const { error: updateError } = await supabaseClient
    .from('messages')
    .update({
      needs_redownload: true,
      redownload_reason: 'Invalid or missing storage path',
      redownload_flagged_at: new Date().toISOString(),
      redownload_strategy,
      storage_path: storageInfo.storagePath,
      public_url: storageInfo.publicUrl
    })
    .eq('id', id);
    
  if (updateError) {
    console.error(`Error flagging for redownload: ${updateError.message}`);
  }
}

/**
 * Analyze a message using the parse-caption-with-ai function
 */
async function analyzeMessage(params: {
  messageId: string;
  caption: string;
  media_group_id?: string;
  correlationId: string;
  fileInfo?: {
    file_unique_id: string;
    public_url: string;
    storage_path: string;
  };
}): Promise<any> {
  const analyzeResponse = await fetch(
    `${Deno.env.get('SUPABASE_URL')}/functions/v1/parse-caption-with-ai`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
      },
      body: JSON.stringify(params)
    }
  );
  
  if (!analyzeResponse.ok) {
    let errorMessage = `HTTP error: ${analyzeResponse.status}`;
    try {
      const errorData = await analyzeResponse.json();
      errorMessage = errorData.error || errorMessage;
    } catch (e) {
      // Use the HTTP status text if we can't parse the response
      errorMessage = `${analyzeResponse.status} ${analyzeResponse.statusText}`;
    }
    
    throw new Error(`Failed to analyze message: ${errorMessage}`);
  }
  
  return await analyzeResponse.json();
}

/**
 * Mark message processing as completed
 */
async function completeProcessing(queueId: string, analyzedContent: any): Promise<void> {
  const { error } = await supabaseClient.rpc('xdelo_complete_message_processing', {
    p_queue_id: queueId,
    p_analyzed_content: analyzedContent
  });
  
  if (error) {
    throw new Error(`Failed to complete processing: ${error.message}`);
  }
}

/**
 * Mark message processing as failed
 */
async function failProcessing(queueId: string, errorMessage: string): Promise<void> {
  const { error } = await supabaseClient.rpc('xdelo_fail_message_processing', {
    p_queue_id: queueId,
    p_error: errorMessage
  });
  
  if (error) {
    console.error(`Error marking processing as failed: ${error.message}`);
  }
}
