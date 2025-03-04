
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { corsHeaders } from "../_shared/cors.ts";

// Create Supabase client
const supabaseClient = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

// Main handler
serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { limit = 10 } = await req.json();
    console.log(`Starting to repair processing flow for up to ${limit} messages`);
    
    // Find messages that are in a 'pending' state without analyzed content
    const { data: pendingMessages, error: queryError } = await supabaseClient
      .from('messages')
      .select('id, caption, media_group_id, correlation_id')
      .eq('processing_state', 'pending')
      .is('analyzed_content', null)
      .not('caption', 'is', null)
      .not('caption', 'eq', '')
      .limit(limit);
    
    if (queryError) {
      throw new Error(`Error finding pending messages: ${queryError.message}`);
    }
    
    if (!pendingMessages || pendingMessages.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No pending messages found that need repair',
          data: { processed: 0 }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log(`Found ${pendingMessages.length} messages to repair`);
    
    // Process each message directly
    const results = [];
    for (const message of pendingMessages) {
      try {
        // First try to sync from media group
        if (message.media_group_id) {
          const { data: syncResult, error: syncError } = await supabaseClient.rpc(
            'xdelo_check_media_group_content',
            {
              p_media_group_id: message.media_group_id,
              p_message_id: message.id,
              p_correlation_id: message.correlation_id || crypto.randomUUID()
            }
          );
          
          if (!syncError && syncResult.success) {
            results.push({
              message_id: message.id,
              status: 'synced',
              result: syncResult
            });
            continue;
          }
        }
        
        // If media group sync didn't work or no media group, analyze directly
        // Call the parse-caption-with-ai endpoint
        const response = await fetch(
          `${Deno.env.get('SUPABASE_URL')}/functions/v1/parse-caption-with-ai`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
            },
            body: JSON.stringify({
              messageId: message.id,
              caption: message.caption,
              media_group_id: message.media_group_id,
              correlationId: message.correlation_id || crypto.randomUUID()
            })
          }
        );
        
        if (!response.ok) {
          throw new Error(`Error calling parse-caption-with-ai: ${response.statusText}`);
        }
        
        const result = await response.json();
        
        // Update the message directly
        const { error: updateError } = await supabaseClient
          .from('messages')
          .update({
            analyzed_content: result.data,
            processing_state: 'completed',
            processing_completed_at: new Date().toISOString()
          })
          .eq('id', message.id);
        
        if (updateError) {
          throw new Error(`Error updating message: ${updateError.message}`);
        }
        
        results.push({
          message_id: message.id,
          status: 'analyzed',
          result: result
        });
        
      } catch (error) {
        console.error(`Error processing message ${message.id}:`, error);
        
        // Update error state
        await supabaseClient
          .from('messages')
          .update({
            processing_state: 'error',
            error_message: error.message,
            last_error_at: new Date().toISOString(),
            retry_count: supabaseClient.rpc('increment', { row_id: message.id, table: 'messages', column: 'retry_count' })
          })
          .eq('id', message.id);
        
        results.push({
          message_id: message.id,
          status: 'error',
          error: error.message
        });
      }
    }
    
    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${results.length} messages`,
        data: { processed: results.length, results }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('Error in repair-processing-flow:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
