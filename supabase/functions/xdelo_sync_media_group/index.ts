
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { corsHeaders } from "../_shared/cors.ts";

// Create Supabase client
const supabaseClient = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { mediaGroupId, sourceMessageId, correlationId, forceSync } = await req.json();
    
    if (!mediaGroupId || !sourceMessageId) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters: mediaGroupId and sourceMessageId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Generate a correlation ID if not provided
    const trackingId = correlationId || crypto.randomUUID();
    console.log(`Processing media group sync for group ${mediaGroupId}, source ${sourceMessageId}, correlationId: ${trackingId}`);
    
    // Log the sync attempt
    await supabaseClient.from('unified_audit_logs').insert({
      event_type: 'media_group_sync_requested',
      entity_id: sourceMessageId,
      metadata: {
        media_group_id: mediaGroupId,
        correlation_id: trackingId,
        force_sync: !!forceSync
      },
      correlation_id: trackingId
    });
    
    // Get the source message and verify it has analyzed content
    const { data: sourceMessage, error: sourceError } = await supabaseClient
      .from('messages')
      .select('analyzed_content, is_original_caption, caption')
      .eq('id', sourceMessageId)
      .single();
      
    if (sourceError || !sourceMessage) {
      throw new Error(`Source message not found: ${sourceError?.message || 'Unknown error'}`);
    }
    
    if (!sourceMessage.analyzed_content) {
      throw new Error('Source message has no analyzed content to sync');
    }
    
    // Using a database function with proper transaction handling for atomic operation
    const { data: syncResult, error: syncError } = await supabaseClient.rpc(
      'xdelo_sync_media_group_content',
      {
        p_source_message_id: sourceMessageId,
        p_media_group_id: mediaGroupId,
        p_correlation_id: trackingId,
        p_force_sync: !!forceSync
      }
    );
    
    if (syncError) {
      throw new Error(`Failed to sync media group: ${syncError.message}`);
    }
    
    // Log successful sync
    await supabaseClient.from('unified_audit_logs').insert({
      event_type: 'media_group_content_synced',
      entity_id: sourceMessageId,
      metadata: {
        media_group_id: mediaGroupId,
        correlation_id: trackingId,
        result: syncResult
      },
      correlation_id: trackingId
    });
    
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Media group content synchronized successfully',
        data: syncResult
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error syncing media group:', error);
    
    // Log the error
    try {
      const { mediaGroupId, sourceMessageId, correlationId } = await req.json();
      await supabaseClient.from('unified_audit_logs').insert({
        event_type: 'media_group_sync_error',
        entity_id: sourceMessageId || 'unknown',
        error_message: error.message,
        metadata: {
          media_group_id: mediaGroupId,
          correlation_id: correlationId || crypto.randomUUID()
        },
        correlation_id: correlationId || crypto.randomUUID()
      });
    } catch (logError) {
      console.error('Error logging sync error:', logError);
    }
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
