
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { messageId, isForceUpdate = false } = await req.json();
    
    if (!messageId) {
      throw new Error("messageId is required");
    }

    // Get the message
    const { data: message, error: fetchError } = await supabaseClient
      .from('messages')
      .select('*')
      .eq('id', messageId)
      .single();
      
    if (fetchError) {
      throw new Error(`Error fetching message: ${fetchError.message}`);
    }
    
    // Set the message to pending state
    await supabaseClient
      .from('messages')
      .update({ 
        processing_state: 'pending',
        updated_at: new Date().toISOString()
      })
      .eq('id', messageId);
    
    // Log audit entry
    await supabaseClient
      .from('unified_audit_logs')
      .insert({
        event_type: 'manual_message_processing',
        entity_id: messageId,
        correlation_id: `manual_${crypto.randomUUID()}`,
        metadata: {
          message_id: messageId,
          is_force_update: isForceUpdate,
          trigger_source: 'direct-api',
          caption: message.caption
        },
        event_timestamp: new Date().toISOString()
      });
    
    // Call the caption parser
    const parserResponse = await fetch(
      `${Deno.env.get('SUPABASE_URL')}/functions/v1/parse-caption-with-ai`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
        },
        body: JSON.stringify({
          messageId,
          isForceUpdate
        })
      }
    );
    
    if (!parserResponse.ok) {
      const errorText = await parserResponse.text();
      throw new Error(`Caption parsing failed: ${errorText}`);
    }
    
    const result = await parserResponse.json();
    
    return new Response(
      JSON.stringify({
        success: true,
        message: "Message processed successfully",
        result
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error processing message:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
        status: 400 
      }
    );
  }
});
