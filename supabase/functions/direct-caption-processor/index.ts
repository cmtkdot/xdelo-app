
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

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
    const { maxMessages = 5 } = await req.json();
    console.log(`Processing batch of pending caption messages, max: ${maxMessages}`);

    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Find pending messages with captions
    const { data: pendingMessages, error: queryError } = await supabaseClient
      .from('messages')
      .select('id, caption')
      .eq('processing_state', 'pending')
      .not('caption', 'is', null)
      .order('processing_started_at', { ascending: true })
      .limit(maxMessages);

    if (queryError) {
      throw new Error(`Error querying pending messages: ${queryError.message}`);
    }

    console.log(`Found ${pendingMessages?.length || 0} pending messages to process`);

    if (!pendingMessages || pendingMessages.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          processed: 0,
          message: "No pending caption messages found",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Process each message
    const results = await Promise.all(
      pendingMessages.map(async (message) => {
        try {
          const correlationId = crypto.randomUUID();
          console.log(`Processing message ${message.id} with correlation ID ${correlationId}`);

          // Update to processing state
          await supabaseClient
            .from('messages')
            .update({
              processing_state: 'processing',
              updated_at: new Date().toISOString(),
              correlation_id: correlationId
            })
            .eq('id', message.id);

          // Log the processing start
          await supabaseClient.from('unified_audit_logs').insert({
            event_type: 'caption_processing_started',
            entity_id: message.id,
            correlation_id: correlationId,
            metadata: {
              source: 'direct-caption-processor',
              caption_length: message.caption?.length || 0
            }
          });

          // Call the parse-caption function
          if (!message.caption) {
            throw new Error('Message has no caption to process');
          }

          console.log(`Calling parse-caption for message ${message.id}, correlation ID: ${correlationId}, caption length: ${message.caption.length}`);
          
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
              })
            }
          );

          if (!response.ok) {
            let errorText = await response.text();
            console.error(`Error response from parse-caption: ${errorText}`);
            throw new Error(`Error calling parse-caption: ${response.status} ${response.statusText}`);
          }

          const parseResult = await response.json();
          console.log(`Completed processing for message ${message.id}, success: ${parseResult.success}`);

          return {
            messageId: message.id,
            success: true,
            correlationId
          };
        } catch (error) {
          console.error(`Error processing message ${message.id}: ${error.message}`);
          
          // Mark as error
          await supabaseClient
            .from('messages')
            .update({
              processing_state: 'error',
              error_message: error.message,
              updated_at: new Date().toISOString()
            })
            .eq('id', message.id);
            
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
    console.error(`Error in direct-caption-processor: ${error.message}`);
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
