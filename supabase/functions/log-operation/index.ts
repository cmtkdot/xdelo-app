
import { createHandler } from '../_shared/baseHandler.ts';
import { createSupabaseClient } from '../_shared/supabase.ts';

interface LogRequest {
  eventType: string;
  entityId: string;
  previousState?: Record<string, unknown>;
  newState?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  errorMessage?: string;
  correlationId?: string;
}

export default createHandler(async (req: Request) => {
  // Parse request body
  const { 
    eventType, 
    entityId, 
    previousState, 
    newState, 
    metadata = {}, 
    errorMessage,
    correlationId = crypto.randomUUID()
  } = await req.json() as LogRequest;
  
  // Validate request
  if (!eventType) {
    return new Response(
      JSON.stringify({ error: 'Event type is required' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }
  
  if (!entityId) {
    return new Response(
      JSON.stringify({ error: 'Entity ID is required' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }
  
  // Add correlation ID and timestamp to metadata
  const enhancedMetadata = {
    ...metadata,
    logged_at: new Date().toISOString(),
    correlation_id: correlationId,
    logged_from: 'edge_function'
  };
  
  // Add error message to metadata if provided
  if (errorMessage) {
    enhancedMetadata.error_message = errorMessage;
  }
  
  // Create Supabase client
  const supabase = createSupabaseClient();
  
  try {
    // Insert log entry
    const { data, error } = await supabase
      .from('unified_audit_logs')
      .insert({
        event_type: eventType,
        entity_id: entityId,
        previous_state: previousState,
        new_state: newState,
        metadata: enhancedMetadata,
        error_message: errorMessage,
        correlation_id: correlationId
      })
      .select('id')
      .single();
    
    if (error) {
      console.error('Error logging operation:', error);
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: error.message,
          correlationId
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    return new Response(
      JSON.stringify({
        success: true,
        logId: data.id,
        correlationId,
        timestamp: enhancedMetadata.logged_at
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Exception logging operation:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        correlationId
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
