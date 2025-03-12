
// This file provides compatibility with older code but uses the standardized logging approach
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

type OperationType = 'edit' | 'skip' | 'duplicate' | 'reupload' | 'success' | 'error' | 'info';

interface LogMetadata {
  message?: string;
  error?: string;
  telegram_message_id?: number;
  chat_id?: number;
  file_unique_id?: string;
  existing_message_id?: string;
  [key: string]: any;
}

/**
 * Maps old operation types to standardized event types
 */
function xdelo_mapOperationToEventType(operation: OperationType): string {
  switch (operation) {
    case 'edit':
      return 'message_edited';
    case 'error':
      return 'message_processing_failed';
    case 'duplicate':
      return 'duplicate_file_detected';
    case 'success':
      return 'message_created';
    case 'info':
      return 'webhook_received';
    default:
      return 'webhook_processing';
  }
}

/**
 * Legacy function that logs a message operation to the unified_audit_logs table
 * using standardized event types
 */
export const xdelo_logMessageOperation = async (
  operation: OperationType,
  correlationId: string,
  metadata: LogMetadata
) => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false
        }
      }
    );

    // Map old operation types to standardized event types
    const eventType = xdelo_mapOperationToEventType(operation);

    // Add timestamp to metadata if not present
    const logMetadata = {
      ...metadata,
      timestamp: metadata.timestamp || new Date().toISOString(),
      legacy_operation_type: operation // Keep track of original operation type
    };

    // Always log to console for debugging
    console.log(`[${correlationId}][${operation.toUpperCase()}] ${metadata.message || ''}`);
    if (metadata.error) {
      console.error(`[${correlationId}] Error details: ${metadata.error}`);
    }

    // Attempt to write to the database, but don't fail if it doesn't work
    try {
      await supabase.from('unified_audit_logs').insert({
        event_type: eventType,
        entity_id: metadata.existing_message_id,
        error_message: metadata.error,
        correlation_id: correlationId,
        metadata: logMetadata
      });
    } catch (dbError) {
      // Just log it to console and continue, don't throw
      console.error(`[${correlationId}] Failed to write to audit logs:`, dbError);
    }
  } catch (error) {
    // Fail silently but log to console
    console.error(`[${correlationId}] Error in logMessageOperation:`, error);
  }
};

// Helper to create a logger with a correlation ID
export const getLogger = (correlationId: string) => {
  return {
    info: (message: string, metadata: Record<string, any> = {}) => {
      xdelo_logMessageOperation('info', correlationId, { message, ...metadata });
    },
    error: (message: string, error: any = null) => {
      xdelo_logMessageOperation('error', correlationId, { 
        message, 
        error: error?.message || JSON.stringify(error) 
      });
    },
    success: (message: string, metadata: Record<string, any> = {}) => {
      xdelo_logMessageOperation('success', correlationId, { message, ...metadata });
    }
  };
};

// For backward compatibility
export const logMessageOperation = xdelo_logMessageOperation;
