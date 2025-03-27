import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

// Set up CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
    const { messageIds, limit = 10, correlationId = crypto.randomUUID() } = await req.json();
    
    console.log(`Processing redownload request (${correlationId}): ${messageIds?.length || limit} messages`);
    
    let query = supabaseClient
      .from('messages')
      .select('id, file_id, telegram_data');
    
    // If specific message IDs were provided, use those
    if (messageIds && messageIds.length > 0) {
      query = query.in('id', messageIds);
    } else {
      // Otherwise, get messages that need redownload
      query = query
        .eq('needs_redownload', true)
        .is('redownload_failed', false)
        .order('redownload_attempts', { ascending: true })
        .limit(limit);
    }
    
    const { data: messages, error } = await query;
    
    if (error) {
      throw new Error(`Error querying messages: ${error.message}`);
    }
    
    if (!messages || messages.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "No messages found needing redownload",
          processed: 0
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Flag these messages for redownload in a background process
    const updates = messages.map(message => ({
      id: message.id,
      redownload_attempts: (message.redownload_attempts || 0) + 1,
      redownload_flagged_at: new Date().toISOString(),
      correlation_id: correlationId
    }));
    
    const { error: updateError } = await supabaseClient
      .from('messages')
      .upsert(updates);
    
    if (updateError) {
      throw new Error(`Error updating messages: ${updateError.message}`);
    }
    
    // Log the operation
    await supabaseClient.from('unified_audit_logs').insert({
      event_type: 'redownload_batch_queued',
      entity_id: null,
      correlation_id: correlationId,
      metadata: {
        message_count: messages.length,
        message_ids: messages.map(m => m.id),
        timestamp: new Date().toISOString()
      }
    });
    
    return new Response(
      JSON.stringify({
        success: true,
        message: `Queued ${messages.length} messages for redownload`,
        queued: messages.length,
        correlation_id: correlationId
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error('Error in redownload-missing-files function:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Unknown error'
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500
      }
    );
  }
});
