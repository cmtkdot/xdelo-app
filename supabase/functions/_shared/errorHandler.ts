
import { corsHeaders } from './cors.ts';

type ErrorHandlerFunction = (
  req: Request, 
  correlationId: string
) => Promise<Response>;

/**
 * Wraps a handler function with standardized error handling
 */
export function withErrorHandling(
  functionName: string,
  handlerFn: ErrorHandlerFunction
) {
  return async (req: Request) => {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const correlationId = crypto.randomUUID();
    const startTime = Date.now();

    try {
      console.log(`Starting ${functionName} with correlation ID: ${correlationId}`);
      
      // Call the handler with correlation ID
      const response = await handlerFn(req, correlationId);
      
      // Add performance metrics headers
      const enhancedResponse = new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: new Headers(response.headers)
      });
      
      enhancedResponse.headers.set('X-Correlation-ID', correlationId);
      enhancedResponse.headers.set('X-Processing-Time', `${Date.now() - startTime}ms`);
      enhancedResponse.headers.set('X-Function-Name', functionName);
      
      // Ensure CORS headers are applied
      Object.entries(corsHeaders).forEach(([key, value]) => {
        enhancedResponse.headers.set(key, value);
      });
      
      return enhancedResponse;
    } catch (error) {
      console.error(`Error in ${functionName}:`, error);
      
      // Create a standardized error response
      return new Response(
        JSON.stringify({
          success: false,
          error: error.message,
          errorType: error.name || 'UnknownError',
          correlation_id: correlationId,
          function: functionName
        }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
            'X-Correlation-ID': correlationId,
            'X-Processing-Time': `${Date.now() - startTime}ms`,
            'X-Function-Name': functionName
          }
        }
      );
    }
  };
}

// Log error to database
export async function logErrorToDatabase(
  supabaseClient: any,
  errorInfo: {
    messageId: string,
    errorMessage: string,
    correlationId: string,
    errorType?: string,
    functionName?: string
  }
) {
  try {
    await supabaseClient.from('unified_audit_logs').insert({
      event_type: 'function_error',
      entity_id: errorInfo.messageId,
      error_message: errorInfo.errorMessage,
      correlation_id: errorInfo.correlationId,
      metadata: {
        error_type: errorInfo.errorType || 'UnknownError',
        function_name: errorInfo.functionName || 'unspecified',
        timestamp: new Date().toISOString()
      },
      event_timestamp: new Date().toISOString()
    });
  } catch (logError) {
    console.error('Failed to log error to database:', logError);
  }
}

// Update message with error state
export async function updateMessageWithError(
  supabaseClient: any,
  messageId: string,
  errorMessage: string
) {
  try {
    await supabaseClient.from('messages').update({
      processing_state: 'error',
      error_message: errorMessage,
      last_error_at: new Date().toISOString(),
      retry_count: supabaseClient.sql`COALESCE(retry_count, 0) + 1`
    }).eq('id', messageId);
  } catch (updateError) {
    console.error('Failed to update message with error state:', updateError);
  }
}
