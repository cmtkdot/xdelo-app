
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { corsHeaders } from "../_shared/cors.ts";

// Allowed unified event types
type UnifiedEventType = 
  | "message_created"
  | "message_updated" 
  | "message_deleted"
  | "message_analyzed"
  | "processing_started"
  | "processing_completed"
  | "processing_error"
  | "processing_state_changed"
  | "media_group_synced"
  | "caption_synced"
  | "file_uploaded"
  | "file_deleted"
  | "storage_repaired"
  | "user_action"
  | "system_error"
  | "system_warning"
  | "system_info";

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

    const { 
      event_type,
      entity_id,
      metadata = {},
      error_message,
      previous_state,
      new_state,
      correlation_id = `log_${crypto.randomUUID()}`,
      user_id
    } = await req.json();
    
    // Generate a correlation ID if not provided
    const requestCorrelationId = correlation_id;
    
    // Map legacy operation types to unified event types
    let eventType: UnifiedEventType;
    
    if (event_type) {
      // Direct event type mapping (new approach)
      eventType = event_type as UnifiedEventType;
    } else {
      // For backward compatibility, also accept old format
      const { operation, messageId, source, action } = await req.json();
      
      // Map the operation to an event type for the unified_audit_logs table
      switch (operation) {
        case 'deletion':
          eventType = 'message_deleted';
          break;
        case 'create':
          eventType = 'message_created';
          break;
        case 'update':
          eventType = 'message_updated';
          break;
        case 'analyze':
          eventType = 'message_analyzed';
          break;
        case 'sync':
          eventType = 'media_group_synced';
          break;
        case 'user_action':
          eventType = 'user_action';
          break;
        default:
          eventType = 'system_info'; // Default fallback
      }
      
      // Add legacy conversion info to metadata
      metadata.legacy_operation = operation;
      metadata.legacy_conversion = true;
      entity_id = messageId || entity_id || user_id;
    }
    
    // Ensure metadata has timestamp and source
    metadata.timestamp = metadata.timestamp || new Date().toISOString();
    metadata.logged_from = metadata.source || 'frontend';
    
    // Insert the log entry into the unified_audit_logs table
    const { data, error } = await supabaseClient
      .from('unified_audit_logs')
      .insert({
        event_type: eventType,
        entity_id: entity_id,
        metadata: metadata,
        error_message: error_message,
        previous_state: previous_state,
        new_state: new_state,
        correlation_id: requestCorrelationId,
        user_id: user_id
      });
    
    if (error) {
      console.error('Error logging operation:', error);
      throw error;
    }
    
    return new Response(
      JSON.stringify({ success: true, correlation_id: requestCorrelationId }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
