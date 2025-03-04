
/**
 * Shared error handling utilities for edge functions
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { corsHeaders } from './cors.ts';

// Create Supabase client for error logging
const supabaseClient = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

/**
 * Structured error response builder
 */
export function createErrorResponse(
  error: Error,
  status = 500,
  additionalInfo: Record<string, any> = {}
): Response {
  console.error('Error in edge function:', error);
  
  return new Response(
    JSON.stringify({
      success: false,
      error: error.message,
      errorType: error.name,
      ...additionalInfo
    }),
    { 
      status, 
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'application/json' 
      } 
    }
  );
}

/**
 * Log an error to the database for tracking
 */
export async function logErrorToDatabase(
  functionName: string,
  error: Error,
  correlationId: string | null = null,
  metadata: Record<string, any> = {}
): Promise<void> {
  try {
    await supabaseClient.from('unified_audit_logs').insert({
      event_type: 'edge_function_error',
      error_message: error.message,
      metadata: {
        function_name: functionName,
        error_stack: error.stack,
        error_name: error.name,
        ...metadata
      },
      correlation_id: correlationId,
      event_timestamp: new Date().toISOString()
    });
  } catch (logError) {
    // Just log to console if we can't log to database
    console.error('Failed to log error to database:', logError);
  }
}

/**
 * Helper to update message with error state
 */
export async function updateMessageWithError(
  messageId: string, 
  error: Error,
  retry = true
): Promise<void> {
  if (!messageId) return;
  
  try {
    await supabaseClient
      .from('messages')
      .update({
        processing_state: retry ? 'pending' : 'error',
        error_message: error.message,
        last_error_at: new Date().toISOString(),
        retry_count: supabaseClient.sql`COALESCE(retry_count, 0) + 1`
      })
      .eq('id', messageId);
  } catch (updateError) {
    console.error('Error updating message with error state:', updateError);
  }
}

/**
 * Wraps an edge function with standardized error handling
 */
export function withErrorHandling(
  functionName: string,
  handler: (req: Request, correlationId: string) => Promise<Response>
): (req: Request) => Promise<Response> {
  return async (req: Request) => {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }
    
    const correlationId = crypto.randomUUID();
    let clonedReq: Request | null = null;
    
    try {
      // Clone request to ensure we can access the body multiple times if needed
      clonedReq = req.clone();
      
      // Call the handler with correlation ID for tracing
      return await handler(clonedReq, correlationId);
    } catch (error) {
      // Log the error to the database
      await logErrorToDatabase(functionName, error, correlationId, {
        url: req.url,
        method: req.method,
        headers: Object.fromEntries(req.headers.entries())
      });
      
      try {
        // Try to parse the request body for error handling if we haven't consumed it yet
        let messageId = null;
        if (clonedReq) {
          try {
            const body = await clonedReq.json();
            messageId = body.messageId;
            
            // Update message with error if messageId is available
            if (messageId) {
              await updateMessageWithError(messageId, error);
            }
          } catch (bodyError) {
            // Request body already consumed or not valid JSON
            console.error('Could not parse request body for error handling:', bodyError);
          }
        }
        
        return createErrorResponse(error, 500, { correlation_id: correlationId });
      } catch (secondaryError) {
        // Fallback error handling if everything else fails
        console.error('Error in error handler:', secondaryError);
        return createErrorResponse(
          error,
          500, 
          { 
            correlation_id: correlationId,
            additional_error: secondaryError.message
          }
        );
      }
    }
  };
}
