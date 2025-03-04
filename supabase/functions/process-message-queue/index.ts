
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { corsHeaders } from "../_shared/cors.ts";

// Create Supabase client
const supabaseClient = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

interface MessageQueueItem {
  queue_id: string;
  message_id: string;
  correlation_id: string;
  caption: string;
  media_group_id?: string;
}

interface ProcessingDetail {
  message_id: string;
  queue_id: string;
  status: 'success' | 'error';
  result?: any;
  error_message?: string;
}

interface ProcessingResults {
  processed: number;
  success: number;
  failed: number;
  details: ProcessingDetail[];
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { limit = 5 } = await req.json();
    console.log(`Starting to process up to ${limit} messages from queue`);
    
    // Get messages from the queue using the function name
    let messagesToProcess;
    try {
      const { data, error } = await supabaseClient.rpc(
        'tg_get_next_messages',
        { limit_count: limit }
      );
      
      if (error) throw error;
      
      messagesToProcess = data;
      console.log(`Successfully retrieved ${messagesToProcess?.length || 0} messages from queue`);
    } catch (firstError) {
      console.error('Failed to get messages from primary queue function:', firstError);
      
      // Try fallback with alternate function name
      try {
        const { data, error } = await supabaseClient.rpc(
          'xdelo_get_messages_for_processing',
          { limit_count: limit }
        );
        
        if (error) throw error;
        
        messagesToProcess = data;
        console.log(`Successfully retrieved ${messagesToProcess?.length || 0} messages using fallback method`);
      } catch (fallbackError) {
        throw new Error(`Failed to get messages from queue (both methods): ${fallbackError.message}`);
      }
    }

    if (!messagesToProcess || messagesToProcess.length === 0) {
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
    const results = {
      processed: messagesToProcess.length,
      success: 0,
      failed: 0,
      details: []
    };

    for (const message of messagesToProcess) {
      try {
        console.log(`Processing message ${message.message_id} (Queue ID: ${message.queue_id})`);
        
        if (!message.caption) {
          console.error(`Message ${message.message_id} has no caption, marking as error`);
          
          // Try the appropriate function to mark as failed
          try {
            await supabaseClient.rpc('tg_fail_processing', {
              p_queue_id: message.queue_id,
              p_error_message: 'Message has no caption to analyze'
            });
          } catch (newFuncError) {
            console.error('Error with primary fail function, trying fallback:', newFuncError);
            
            // Fallback to alternate function
            await supabaseClient.rpc('xdelo_fail_message_processing', {
              p_queue_id: message.queue_id,
              p_error_message: 'Message has no caption to analyze'
            });
          }
          
          results.failed++;
          results.details.push({
            message_id: message.message_id,
            queue_id: message.queue_id,
            status: 'error',
            error_message: 'Message has no caption to analyze'
          });
          continue;
        }
        
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
              correlationId: message.correlation_id.toString(), // Ensure it's a string
              queue_id: message.queue_id
            })
          }
        );

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(`Failed to process message: ${errorData.error || response.statusText}`);
        }

        const result = await response.json();
        
        // Mark as complete using the appropriate function
        try {
          // Try primary function first
          await supabaseClient.rpc('tg_complete_processing', {
            p_queue_id: message.queue_id,
            p_analyzed_content: result.data
          });
        } catch (primaryFuncError) {
          console.error('Error with primary complete function, trying fallback:', primaryFuncError);
          
          // Fallback to alternate function
          await supabaseClient.rpc('xdelo_complete_message_processing', {
            p_queue_id: message.queue_id,
            p_analyzed_content: result.data
          });
        }
        
        // Record success
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
          error_message: error.message
        });
        
        // Mark the queue item as failed using the appropriate function
        try {
          // Try primary function first
          await supabaseClient.rpc('tg_fail_processing', {
            p_queue_id: message.queue_id,
            p_error_message: `Processing error: ${error.message}`
          });
        } catch (primaryFuncError) {
          console.error('Error with primary fail function, trying fallback:', primaryFuncError);
          
          // Fallback to alternate function
          try {
            await supabaseClient.rpc('xdelo_fail_message_processing', {
              p_queue_id: message.queue_id,
              p_error_message: `Processing error: ${error.message}`
            });
          } catch (fallbackError) {
            console.error('Both fail functions failed:', fallbackError);
          }
        }
      }
    }

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
