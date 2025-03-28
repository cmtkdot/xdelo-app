import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

// Set up CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messageIds, maxMessages = 10 } = await req.json();
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    let query = supabaseClient
      .from('messages')
      .select('id, caption, processing_state')
      .not('caption', 'is', null);
    
    // Filter to specific message IDs if provided
    if (messageIds && messageIds.length > 0) {
      query = query.in('id', messageIds);
    } else {
      // Otherwise, look for pending or error messages
      query = query.in('processing_state', ['pending', 'error'])
                  .order('processing_started_at', { ascending: true })
                  .limit(maxMessages);
    }
    
    const { data: messagesToProcess, error: queryError } = await query;
    
    if (queryError) {
      throw new Error(`Error querying messages: ${queryError.message}`);
    }
    
    console.log(`Found ${messagesToProcess?.length || 0} messages to process`);
    
    if (!messagesToProcess || messagesToProcess.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          processed: 0,
          message: "No caption messages found to process",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    
    // Process each message
    const results = await Promise.all(
      messagesToProcess.map(async (message) => {
        try {
          if (!message.caption) {
            return {
              messageId: message.id,
              success: false,
              error: "Message has no caption"
            };
          }
          
          const correlationId = crypto.randomUUID();
          console.log(`Forcing processing for message ${message.id}, state: ${message.processing_state}, correlation ID: ${correlationId}`);
          
          // Call the parse-caption function directly
          const response = await fetch(
            `${Deno.env.get('SUPABASE_URL')}/functions/v1/parse-caption`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
              },
              body: JSON.stringify({
                messageId: message.id,
                caption: message.caption,
                correlationId,
                force_reprocess: true
              })
            }
          );
          
          if (!response.ok) {
            let errorText = await response.text();
            console.error(`Error response from parse-caption: ${errorText}`);
            throw new Error(`Error calling parse-caption: ${response.status} ${response.statusText}`);
          }
          
          const parseResult = await response.json();
          console.log(`Completed forced processing for message ${message.id}, success: ${parseResult.success}`);
          
          // Log the forced processing
          await supabaseClient.from('unified_audit_logs').insert({
            event_type: 'forced_caption_processing',
            entity_id: message.id,
            correlation_id: correlationId,
            metadata: {
              previous_state: message.processing_state,
              result: parseResult.success ? 'success' : 'failure',
              force_triggered: true
            }
          });
          
          return {
            messageId: message.id,
            success: true,
            parseResult: parseResult.success,
            correlationId
          };
        } catch (error) {
          console.error(`Error processing message ${message.id}: ${error.message}`);
          return {
            messageId: message.id,
            success: false,
            error: error.message
          };
        }
      })
    );
    
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    
    return new Response(
      JSON.stringify({
        success: true,
        processed: results.length,
        successful,
        failed,
        results
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error(`Error in force-processing: ${error.message}`);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
