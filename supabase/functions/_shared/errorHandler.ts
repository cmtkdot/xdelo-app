
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

interface ErrorLogParams {
  messageId: string;
  errorMessage: string;
  correlationId?: string;
  functionName?: string;
  additionalData?: Record<string, any>;
}

/**
 * Initialize Supabase client for database operations
 */
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

/**
 * Log an error to the database
 */
export async function logErrorToDatabase(params: ErrorLogParams): Promise<void> {
  const { messageId, errorMessage, correlationId, functionName, additionalData } = params;

  try {
    const metadata = {
      error_message: errorMessage,
      function_name: functionName || 'unknown',
      ...(additionalData || {})
    };

    await supabase.from('unified_audit_logs').insert({
      event_type: 'edge_function_error',
      entity_id: messageId,
      error_message: errorMessage,
      metadata,
      correlation_id: correlationId || crypto.randomUUID(),
      event_timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error logging to database:', error);
    // Cannot do much if logging fails - at least we have console logs
  }
}

/**
 * Update a message with error state
 */
export async function updateMessageWithError(messageId: string, errorMessage: string): Promise<void> {
  try {
    await supabase
      .from('messages')
      .update({
        processing_state: 'error',
        error_message: errorMessage,
        last_error_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', messageId);
  } catch (error) {
    console.error('Error updating message with error state:', error);
    // Already in error handler, just log
  }
}
