
import { 
  xdelo_createStandardizedHandler, 
  xdelo_createSuccessResponse
} from '../_shared/standardizedHandler.ts';
import { createSupabaseClient } from '../_shared/supabase.ts';

// Define the main handler function
const handleExample = async (req: Request, correlationId: string): Promise<Response> => {
  // Parse request body
  const body = await req.json();
  console.log(`Request with correlationId ${correlationId} received with body:`, body);
  
  // Create Supabase client
  const supabase = createSupabaseClient();
  
  // Example database operation
  const { data, error } = await supabase
    .from('unified_audit_logs')
    .insert({
      event_type: 'example_handler_called',
      entity_id: 'system',
      correlation_id: correlationId,
      metadata: {
        request_body: body,
        timestamp: new Date().toISOString()
      }
    });
  
  if (error) {
    throw new Error(`Database error: ${error.message}`);
  }
  
  // Return a success response
  return xdelo_createSuccessResponse(
    {
      message: 'Request processed successfully',
      timestamp: new Date().toISOString()
    },
    correlationId
  );
};

// Export the handler using our standardized wrapper
export default xdelo_createStandardizedHandler(handleExample);
