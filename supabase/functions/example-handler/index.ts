
import { createHandler } from '../_shared/baseHandler.ts';
import { createSupabaseClient } from '../_shared/supabase.ts';

// Define the main handler function
export default createHandler(async (req: Request, correlationId: string) => {
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
  return new Response(
    JSON.stringify({
      success: true,
      message: 'Request processed successfully',
      correlation_id: correlationId,
      timestamp: new Date().toISOString()
    }),
    { 
      status: 200, 
      headers: { 'Content-Type': 'application/json' }
    }
  );
});
