
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { 
  xdelo_createStandardizedHandler, 
  xdelo_createSuccessResponse, 
  xdelo_createErrorResponse 
} from "../_shared/standardizedHandler.ts";
import { createSupabaseClient } from "../_shared/supabase.ts";

// Main webhook handler function
const handleWebhook = async (req: Request, correlationId: string): Promise<Response> => {
  // Parse the webhook payload
  const payload = await req.json();
  
  // Log the webhook receipt
  console.log(JSON.stringify({
    level: 'info',
    message: 'Webhook received',
    correlation_id: correlationId,
    timestamp: new Date().toISOString(),
    payload_type: payload?.type || 'unknown',
    source: payload?.source || 'unknown'
  }));
  
  // Create Supabase client
  const supabase = createSupabaseClient();
  
  try {
    // Validate the webhook payload
    if (!payload || !payload.type) {
      return xdelo_createErrorResponse(
        'Invalid webhook payload: missing type',
        correlationId,
        400
      );
    }
    
    // Process different types of webhooks
    switch (payload.type) {
      case 'ping':
        // Simple ping/pong check
        return xdelo_createSuccessResponse(
          { 
            message: 'pong',
            received_at: new Date().toISOString()
          },
          correlationId
        );
        
      case 'event':
        // Process event type webhooks
        if (!payload.event) {
          return xdelo_createErrorResponse(
            'Missing event data',
            correlationId,
            400
          );
        }
        
        // Log the event
        const { data, error } = await supabase
          .from('webhook_logs')
          .insert({
            webhook_type: 'event',
            payload: payload,
            correlation_id: correlationId,
            created_at: new Date().toISOString()
          });
          
        if (error) {
          throw new Error(`Failed to log webhook: ${error.message}`);
        }
        
        return xdelo_createSuccessResponse(
          { 
            message: 'Event processed successfully',
            event_type: payload.event.type
          },
          correlationId
        );
        
      default:
        // Log unknown webhook types for analysis
        await supabase
          .from('webhook_logs')
          .insert({
            webhook_type: 'unknown',
            payload: payload,
            correlation_id: correlationId,
            created_at: new Date().toISOString()
          });
          
        return xdelo_createErrorResponse(
          `Unsupported webhook type: ${payload.type}`,
          correlationId,
          400
        );
    }
  } catch (error) {
    console.error(JSON.stringify({
      level: 'error',
      message: 'Error processing webhook',
      error: error.message,
      correlation_id: correlationId,
      timestamp: new Date().toISOString()
    }));
    
    // Attempt to log the error
    try {
      await supabase
        .from('unified_audit_logs')
        .insert({
          event_type: 'webhook_processing_error',
          entity_id: 'system',
          error_message: error.message,
          metadata: {
            correlation_id: correlationId,
            payload_type: payload?.type || 'unknown',
            timestamp: new Date().toISOString()
          },
          correlation_id: correlationId
        });
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }
    
    return xdelo_createErrorResponse(
      error.message,
      correlationId,
      500
    );
  }
};

// Use our standardized handler with logging options enabled
serve(xdelo_createStandardizedHandler(handleWebhook, {
  logRequests: true,
  logResponses: true
}));
