
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { corsHeaders } from "../_shared/cors.ts";
import { MessageQueueItem, ProcessingResults, ProcessingDetail } from "./types.ts";

// Create Supabase client
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
    const { limit = 5 } = await req.json();
    console.log(`Starting to process up to ${limit} messages from queue`);
    
    // Get messages from the queue
    const messagesToProcess = await getMessagesFromQueue(limit);

    if (!messagesToProcess.length) {
      return new Response(
        JSON.stringify({
          success: true,
          data: {
            processed: 0,
            success: 0,
            failed: 0,
            details: []
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Process each message
    const results = await processMessages(messagesToProcess);

    console.log(`Processing completed: ${results.success} succeeded, ${results.failed} failed`);
    
    return new Response(
      JSON.stringify({
        success: true,
        data: results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error processing message queue:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Get messages from queue with consistent error handling
async function getMessagesFromQueue(limit: number): Promise<MessageQueueItem[]> {
  try {
    console.log(`Fetching up to ${limit} messages for processing using xdelo_get_next_message_for_processing`);
    
    // Use the correct function name with xdelo_ prefix
    const { data, error } = await supabaseClient.rpc(
      'xdelo_get_next_message_for_processing',
      { limit_count: limit }
    );
    
    if (error) {
      console.error('Error getting messages from queue:', error);
      return [];
    }
    
    console.log(`Retrieved ${data?.length || 0} messages from queue`);
    return data || [];
  } catch (error) {
    console.error('Error in getMessagesFromQueue:', error);
    return [];
  }
}

// Mark queue item as failed with proper error handling
async function markQueueItemAsFailed(queueId: string, errorMessage: string): Promise<boolean> {
  try {
    console.log(`Marking queue item ${queueId} as failed: ${errorMessage}`);
    const { error } = await supabaseClient.rpc('xdelo_fail_message_processing', {
      p_queue_id: queueId,
      p_error_message: errorMessage
    });
    
    if (error) {
      console.error('Error marking queue item as failed:', error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Exception marking queue item as failed:', error);
    return false;
  }
}

// Process a batch of messages
async function processMessages(messages: MessageQueueItem[]): Promise<ProcessingResults> {
  const results: ProcessingResults = {
    processed: messages.length,
    success: 0,
    failed: 0,
    details: []
  };

  for (const message of messages) {
    try {
      console.log(`Processing message ${message.message_id} (Queue ID: ${message.queue_id})`);
      
      if (!message.caption) {
        console.error(`Message ${message.message_id} has no caption, marking as error`);
        
        await markQueueItemAsFailed(
          message.queue_id, 
          'Message has no caption to analyze'
        );
        
        results.failed++;
        results.details.push({
          message_id: message.message_id,
          queue_id: message.queue_id,
          status: 'error',
          error_message: 'Message has no caption to analyze'
        });
        continue;
      }
      
      // Ensure correlation_id is a string
      const safeCorrelationId = message.correlation_id ? 
        String(message.correlation_id) : 
        crypto.randomUUID().toString();
      
      // Call the parse-caption-with-ai function
      const response = await fetch(
        `${Deno.env.get('SUPABASE_URL')}/functions/v1/parse-caption-with-ai`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
          },
          body: JSON.stringify({
            messageId: message.message_id,
            caption: message.caption,
            media_group_id: message.media_group_id,
            correlationId: safeCorrelationId,
            queue_id: message.queue_id
          })
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to process message (${response.status}): ${errorText}`);
      }

      const result = await response.json();
      
      // Record success - the queue item was already marked complete by the parsing function
      results.success++;
      results.details.push({
        message_id: message.message_id,
        queue_id: message.queue_id,
        status: 'success',
        result: result
      });
    } catch (error) {
      console.error(`Error processing message ${message.message_id}:`, error);
      
      // Record failure
      results.failed++;
      results.details.push({
        message_id: message.message_id,
        queue_id: message.queue_id,
        status: 'error',
        error_message: error instanceof Error ? error.message : String(error)
      });
      
      // Mark the queue item as failed
      await markQueueItemAsFailed(
        message.queue_id,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  return results;
}
