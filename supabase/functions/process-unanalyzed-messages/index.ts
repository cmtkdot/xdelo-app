
import { serve } from 'https://deno.land/std@0.170.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Create a Supabase client with the auth context of the function
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting process-unanalyzed-messages function');
    
    // Find messages with captions that need processing
    const { data: messages, error: messagesError } = await supabase
      .from('messages')
      .select('id, caption, media_group_id')
      .is('analyzed_content', null)
      .not('caption', 'is', null)
      .eq('processing_state', 'pending')
      .limit(5);  // Process in small batches
    
    if (messagesError) {
      throw new Error(`Error fetching messages: ${messagesError.message}`);
    }
    
    console.log(`Found ${messages?.length || 0} unanalyzed messages to process`);
    
    const results = [];
    
    // Process each message
    for (const message of messages || []) {
      const correlationId = crypto.randomUUID();

      try {
        // Request analysis for this message
        const response = await fetch(
          `${Deno.env.get('SUPABASE_URL')}/functions/v1/create-analyze-message-caption`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
            },
            body: JSON.stringify({
              messageId: message.id,
              caption: message.caption || "",
              mediaGroupId: message.media_group_id,
              correlationId
            })
          }
        );
        
        if (!response.ok) {
          throw new Error(`Analysis request failed: ${response.statusText}`);
        }
        
        const result = await response.json();
        results.push({
          messageId: message.id,
          success: true,
          correlationId
        });
        
        // Log successful processing request
        await supabase
          .from('unified_audit_logs')
          .insert({
            event_type: 'cron_message_processing',
            entity_id: message.id,
            metadata: {
              success: true,
              correlation_id: correlationId,
              caption_length: message.caption?.length || 0
            }
          });
      } catch (processError: any) {
        console.error(`Error processing message ${message.id}:`, processError);
        
        results.push({
          messageId: message.id,
          success: false,
          error: processError.message
        });
        
        // Log error
        await supabase
          .from('unified_audit_logs')
          .insert({
            event_type: 'cron_message_processing',
            entity_id: message.id,
            error_message: processError.message,
            metadata: {
              success: false,
              correlation_id: correlationId,
              error_details: processError.toString()
            }
          });
      }
      
      // Pause briefly between requests to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    return new Response(
      JSON.stringify({
        success: true,
        processed: results.length,
        results
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );
  } catch (error: any) {
    console.error('Error in process-unanalyzed-messages function:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      { 
        status: 500,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );
  }
});
