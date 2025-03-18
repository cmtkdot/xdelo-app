
// Supabase Edge Function to reprocess a message
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { corsHeaders } from "../_shared/cors.ts";

// Initialize Supabase client
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') || '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
);

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders, status: 204 });
  }

  // Only accept POST requests
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
      status: 405 
    });
  }

  try {
    const { messageId, force = false } = await req.json();
    
    if (!messageId) {
      throw new Error('Message ID is required');
    }

    console.log(`Reprocessing message: ${messageId}, force: ${force}`);

    // Get the message first to check if we should continue
    const { data: message, error: messageError } = await supabase
      .from('messages')
      .select('*')
      .eq('id', messageId)
      .single();
    
    if (messageError) {
      throw new Error(`Failed to get message: ${messageError.message}`);
    }
    
    if (!message) {
      throw new Error(`Message with ID ${messageId} not found`);
    }

    // Only allow reprocessing if there's a caption
    if (!message.caption) {
      throw new Error('Cannot reprocess a message without a caption');
    }

    // Check if we're already in a good state and don't need to reprocess
    if (!force && message.processing_state === 'completed' && message.analyzed_content) {
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Message already processed successfully',
        alreadyProcessed: true
      }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Mark as processing
    const { error: updateError } = await supabase
      .from('messages')
      .update({
        processing_state: 'pending',
        processing_started_at: new Date().toISOString(),
        error_message: null,
        retry_count: (message.retry_count || 0) + 1
      })
      .eq('id', messageId);
    
    if (updateError) {
      throw new Error(`Failed to update message state: ${updateError.message}`);
    }

    // Trigger direct caption processor (if available)
    try {
      const { data: processorResponse, error: processorError } = await supabase.functions.invoke('direct-caption-processor', {
        body: { messageId }
      });
      
      if (processorError) {
        console.error('Error calling direct-caption-processor:', processorError);
      } else {
        console.log('Direct caption processor response:', processorResponse);
      }
    } catch (err) {
      console.error('Failed to call direct caption processor:', err);
      // Continue anyway - the message is in pending state and will be picked up by scheduler
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Message successfully queued for reprocessing'
    }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  } catch (error) {
    console.error('Error reprocessing message:', error);
    
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400
    });
  }
});
