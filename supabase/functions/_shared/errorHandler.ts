
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { SecurityLevel, JwtVerificationOptions, verifyJWT } from './jwt-verification.ts';

export interface ErrorLoggingOptions {
  messageId?: string;
  entityId?: string;
  errorMessage: string;
  correlationId?: string;
  functionName: string;
  metadata?: Record<string, any>;
}

// Helper function to log errors to database
export async function logErrorToDatabase(
  supabaseClient: any,
  options: ErrorLoggingOptions
) {
  try {
    await supabaseClient.from('unified_audit_logs').insert({
      event_type: `${options.functionName}_error`,
      entity_id: options.messageId || options.entityId,
      correlation_id: options.correlationId,
      error_message: options.errorMessage,
      metadata: {
        ...(options.metadata || {}),
        timestamp: new Date().toISOString(),
        function_name: options.functionName
      },
      event_timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error(`Failed to log error to database: ${error.message}`);
  }
}

// Helper function to update message with error
export async function updateMessageWithError(
  supabaseClient: any,
  messageId: string,
  errorMessage: string,
  correlationId?: string
) {
  try {
    await supabaseClient
      .from('messages')
      .update({
        processing_state: 'error',
        error_message: errorMessage,
        last_error_at: new Date().toISOString(),
        retry_count: supabaseClient.rpc('increment', { row_id: messageId, table_name: 'messages', column_name: 'retry_count' })
      })
      .eq('id', messageId);
  } catch (error) {
    console.error(`Failed to update message with error: ${error.message}`);
    
    try {
      await logErrorToDatabase(supabaseClient, {
        messageId,
        errorMessage: `Error updating message status: ${error.message}`,
        correlationId,
        functionName: 'message_status_update'
      });
    } catch (logError) {
      console.error(`Failed to log message update error: ${logError.message}`);
    }
  }
}

// Error handling wrapper for edge functions
export function withErrorHandling(
  functionName: string, 
  handler: Function, 
  jwtOptions?: Partial<JwtVerificationOptions>
) {
  return async (req: Request) => {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
    };
    
    // CORS preflight
    if (req.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }
    
    const correlationId = crypto.randomUUID();
    
    // If JWT verification is enabled, perform it
    if (jwtOptions) {
      const { isAuthorized, error } = await verifyJWT(req, jwtOptions);
      
      if (!isAuthorized) {
        console.error(`Unauthorized access attempt to ${functionName}:`, error);
        
        // Create Supabase client for error logging
        const supabaseClient = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );
        
        // Log the unauthorized access attempt
        try {
          await supabaseClient.from('unified_audit_logs').insert({
            event_type: 'unauthorized_access_attempt',
            error_message: error,
            correlation_id: correlationId,
            metadata: {
              function_name: functionName,
              request_method: req.method,
              request_url: req.url
            },
            event_timestamp: new Date().toISOString()
          });
        } catch (logError) {
          console.error('Failed to log unauthorized access:', logError);
        }
        
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Unauthorized',
            message: error,
            correlation_id: correlationId
          }),
          { 
            status: 401, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }
    }
    
    try {
      return await handler(req, correlationId);
    } catch (error) {
      console.error(`Error in ${functionName}:`, error);
      
      // Create Supabase client for error logging
      const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );
      
      // Log the error to database
      try {
        await supabaseClient.from('unified_audit_logs').insert({
          event_type: `${functionName}_error`,
          error_message: error.message,
          correlation_id: correlationId,
          metadata: {
            error_stack: error.stack,
            request_method: req.method,
            request_url: req.url
          },
          event_timestamp: new Date().toISOString()
        });
      } catch (logError) {
        console.error('Failed to log error:', logError);
      }
      
      // Return error response
      return new Response(
        JSON.stringify({
          success: false,
          error: error.message,
          correlation_id: correlationId
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
  };
}
