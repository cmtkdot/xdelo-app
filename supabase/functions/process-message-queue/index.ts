
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Initialize Supabase client
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

async function validateStoragePath(messageId: string, fileUniqueId: string, storagePath: string | null, mimeType: string | null): Promise<{ isValid: boolean, newPath?: string }> {
  // If storage path is missing, generate one
  if (!storagePath || storagePath.trim() === '') {
    const extension = mimeType ? mimeType.split('/')[1] : 'jpeg';
    const newPath = `${fileUniqueId}.${extension}`;
    
    return { isValid: false, newPath };
  }
  
  // Check if the storage path contains the file_unique_id
  if (!storagePath.includes(fileUniqueId)) {
    const extension = mimeType ? mimeType.split('/')[1] : 'jpeg';
    const newPath = `${fileUniqueId}.${extension}`;
    
    return { isValid: false, newPath };
  }
  
  return { isValid: true };
}

async function processMessageQueue(limit: number = 1): Promise<any> {
  try {
    console.log(`Processing message queue with limit ${limit}`);
    const results = {
      processed: 0,
      success: 0,
      failed: 0,
      details: []
    };
    
    // Get next message for processing from database function
    for (let i = 0; i < limit; i++) {
      const { data: nextMessage, error: queueError } = await supabase.rpc('xdelo_get_next_message_for_processing');
      
      if (queueError) {
        console.error('Error getting next message for processing:', queueError);
        break;
      }
      
      // No more messages to process
      if (!nextMessage || nextMessage.length === 0) {
        console.log('No more messages in queue');
        break;
      }
      
      console.log('Processing message:', nextMessage);
      const { queue_id, message_id, correlation_id, caption, media_group_id } = nextMessage[0];
      
      try {
        results.processed++;
        
        // Get full message details
        const { data: messageData, error: messageError } = await supabase
          .from('messages')
          .select('*')
          .eq('id', message_id)
          .single();
          
        if (messageError) throw new Error(`Failed to retrieve message: ${messageError.message}`);
        
        // Validate storage path
        const storageValidation = await validateStoragePath(
          message_id, 
          messageData.file_unique_id, 
          messageData.storage_path, 
          messageData.mime_type
        );
        
        // If storage path is invalid, fix it
        if (!storageValidation.isValid && storageValidation.newPath) {
          console.log(`Fixing invalid storage path for message ${message_id}: ${storageValidation.newPath}`);
          
          // Update the message with the correct path
          const { error: updateError } = await supabase
            .from('messages')
            .update({
              storage_path: storageValidation.newPath,
              needs_redownload: true,
              redownload_reason: 'Invalid storage path',
              redownload_flagged_at: new Date().toISOString()
            })
            .eq('id', message_id);
            
          if (updateError) {
            console.error(`Error updating storage path: ${updateError.message}`);
          }
        }
        
        // Call the analyze function
        const analyzeResponse = await fetch(
          `${Deno.env.get('SUPABASE_URL')}/functions/v1/parse-caption-with-ai`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
            },
            body: JSON.stringify({
              messageId: message_id,
              caption: caption,
              media_group_id: media_group_id,
              correlationId: correlation_id
            })
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
        
        const analyzeResult = await analyzeResponse.json();
        
        // Complete the message processing
        const { error: completeError } = await supabase.rpc('xdelo_complete_message_processing', {
          p_queue_id: queue_id,
          p_analyzed_content: analyzeResult.data
        });
        
        if (completeError) {
          throw new Error(`Failed to complete processing: ${completeError.message}`);
        }
        
        results.success++;
        results.details.push({
          message_id,
          queue_id,
          status: 'success',
          result: analyzeResult.data
        });
        
      } catch (error) {
        console.error(`Error processing message ${message_id}:`, error);
        
        // Mark the processing as failed
        const { error: failError } = await supabase.rpc('xdelo_fail_message_processing', {
          p_queue_id: queue_id,
          p_error: error.message
        });
        
        if (failError) {
          console.error(`Error marking processing as failed: ${failError.message}`);
        }
        
        results.failed++;
        results.details.push({
          message_id,
          queue_id,
          status: 'error',
          error: error.message
        });
      }
    }
    
    return results;
  } catch (error) {
    console.error('Error processing message queue:', error);
    throw error;
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    const { limit = 1 } = await req.json();
    
    const results = await processMessageQueue(limit);
    
    // Return success response
    return new Response(
      JSON.stringify({
        success: true,
        data: results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    
    // Return error response
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
