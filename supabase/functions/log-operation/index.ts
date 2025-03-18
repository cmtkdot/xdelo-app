
import { 
  xdelo_createStandardizedHandler, 
  xdelo_createSuccessResponse, 
  xdelo_createErrorResponse 
} from '../_shared/standardizedHandler.ts';
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

const handleLogOperation = async (req: Request, correlationId: string): Promise<Response> => {
  // Parse request body
  const { 
    eventType, 
    entityId, 
    previousState, 
    newState, 
    metadata = {}, 
    errorMessage,
    correlationId: requestCorrelationId
  } = await req.json() as LogRequest;
  
  // Use provided correlation ID or the one from our handler
  const finalCorrelationId = requestCorrelationId || correlationId;
  
  // Validate request
  if (!eventType) {
    return xdelo_createErrorResponse('Event type is required', finalCorrelationId, 400);
  }
  
  if (!entityId) {
    return xdelo_createErrorResponse('Entity ID is required', finalCorrelationId, 400);
  }
  
  // Add correlation ID and timestamp to metadata
  const enhancedMetadata = {
    ...metadata,
    logged_at: new Date().toISOString(),
    correlation_id: finalCorrelationId,
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
        correlation_id: finalCorrelationId
      })
      .select('id')
      .single();
    
    if (error) {
      console.error('Error logging operation:', error);
      return xdelo_createErrorResponse(error.message, finalCorrelationId, 500);
    }
    
    return xdelo_createSuccessResponse({
      logId: data.id,
      timestamp: enhancedMetadata.logged_at
    }, finalCorrelationId);
  } catch (error) {
    console.error('Exception logging operation:', error);
    return xdelo_createErrorResponse(error.message, finalCorrelationId, 500);
  }
};

// Export the handler using our standardized wrapper
export default xdelo_createStandardizedHandler(handleLogOperation);
