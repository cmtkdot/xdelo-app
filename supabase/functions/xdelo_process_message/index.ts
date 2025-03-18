
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { createSupabaseClient } from "../_shared/supabase.ts";

// Create Supabase client
const supabase = createSupabaseClient();

serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Parse request body
    const { messageId, options = {} } = await req.json();
    
    if (!messageId) {
      throw new Error("messageId is required");
    }
    
    // Get the message details
    const { data: message, error: fetchError } = await supabase
      .from('messages')
      .select('*')
      .eq('id', messageId)
      .single();
      
    if (fetchError) {
      throw new Error(`Error fetching message: ${fetchError.message}`);
    }
    
    if (!message) {
      throw new Error(`Message not found: ${messageId}`);
    }
    
    // Update message processing state to 'processing'
    await supabase
      .from('messages')
      .update({ 
        processing_state: 'processing',
        processing_started_at: new Date().toISOString()
      })
      .eq('id', messageId);
    
    // Log the operation
    await supabase.from('unified_audit_logs').insert({
      event_type: 'message_processing_started',
      entity_id: messageId,
      metadata: {
        processor: 'xdelo_process_message',
        options: options
      }
    });
    
    // This is a placeholder implementation - in a real function you would:
    // 1. Process the message caption, media, etc.
    // 2. Update the message record with results
    
    return new Response(
      JSON.stringify({
        success: true,
        message: "Message processing started",
        messageId
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      }
    );
  } catch (error) {
    console.error("Error processing request:", error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        },
        status: 400
      }
    );
  }
});
