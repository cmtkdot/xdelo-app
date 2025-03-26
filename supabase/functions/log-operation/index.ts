
import { createEdgeHandler, HandlerContext } from '../_shared/edgeHandler.ts';
import { createSupabaseClient } from '../_shared/supabase.ts';

interface LogRequest {
  eventType: string;
  entityId: string;
  previousState?: Record<string, unknown>;
  newState?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  errorMessage?: string;
  correlationId?: string;
  userId?: string;
}

// Create the handler using the new edge handler
const handler = createEdgeHandler(async (req: Request, context: HandlerContext) => {
  const { logger, correlationId: requestCorrelationId } = context;
  
  // Parse request body
  const { 
    eventType, 
    entityId, 
    previousState, 
    newState, 
    metadata = {}, 
    errorMessage,
    correlationId = requestCorrelationId || crypto.randomUUID(),
    userId
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
  
  // Ensure entityId is a valid UUID, if not, generate one and include the original ID in metadata
  let validEntityId: string;
  let enhancedMetadata = { ...metadata };

  try {
    // Try to parse as UUID to validate
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (entityId && uuidRegex.test(entityId)) {
      validEntityId = entityId;
    } else {
      // Not a valid UUID, generate one and store original in metadata
      validEntityId = crypto.randomUUID();
      // Add the original ID to metadata
      enhancedMetadata.original_entity_id = entityId;
    }
  } catch (e) {
    // Any error, use a new UUID
    validEntityId = crypto.randomUUID();
    enhancedMetadata.original_entity_id = entityId;
  }
  
  // Add correlation ID and timestamp to metadata
  enhancedMetadata = {
    ...enhancedMetadata,
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
  
  logger.info('Logging operation', {
    eventType, 
    entityId: validEntityId,
    correlationId
  });
  
  try {
    // Insert log entry
    const { data, error } = await supabase
      .from('unified_audit_logs')
      .insert({
        event_type: eventType,
        entity_id: validEntityId,
        previous_state: previousState,
        new_state: newState,
        metadata: enhancedMetadata,
        error_message: errorMessage,
        correlation_id: correlationId,
        user_id: userId
      })
      .select('id')
      .single();
    
    if (error) {
      logger.error('Error logging operation', error);
      
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
    logger.error('Exception logging operation', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : String(error),
        correlationId
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});

export default handler;
