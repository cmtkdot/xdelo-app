
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

// Create the handler using the edge handler
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
    correlationId = requestCorrelationId || crypto.randomUUID().toString(),
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
  
  // Create Supabase client
  const supabase = createSupabaseClient();
  
  logger.info('Logging operation', {
    eventType, 
    entityId,
    correlationId
  });
  
  try {
    // Use the standard database function to handle UUID conversion
    const { data, error } = await supabase.rpc(
      'xdelo_logprocessingevent',
      {
        p_event_type: eventType,
        p_entity_id: entityId,
        p_correlation_id: correlationId,
        p_metadata: {
          ...metadata,
          previous_state: previousState,
          new_state: newState,
          logged_at: new Date().toISOString(),
          logged_from: 'edge_function',
          user_id: userId
        },
        p_error_message: errorMessage
      }
    );
    
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
        logId: data,
        correlationId,
        timestamp: new Date().toISOString()
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
