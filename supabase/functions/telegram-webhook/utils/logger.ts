
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

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
 * Logs a message operation to the unified_audit_logs table
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

    // Add timestamp to metadata if not present
    const logMetadata = {
      ...metadata,
      timestamp: metadata.timestamp || new Date().toISOString()
    };

    // Always log to console for debugging
    console.log(`[${operation.toUpperCase()}] ${metadata.message || ''}`);
    if (metadata.error) {
      console.error(`Error details: ${metadata.error}`);
    }

    // Attempt to write to the database, but don't fail if it doesn't work
    try {
      await supabase.from('unified_audit_logs').insert({
        event_type: `telegram_webhook_${operation}`,
        correlation_id: correlationId,
        metadata: logMetadata
      });
    } catch (dbError) {
      // Just log it to console and continue, don't throw
      console.error('Failed to write to audit logs:', dbError);
    }
  } catch (error) {
    // Fail silently but log to console
    console.error('Error in logMessageOperation:', error);
  }
};

// Helper to create a logger with a correlation ID
export const getLogger = (correlationId: string) => {
  return {
    info: (message: string, metadata: Record<string, any> = {}) => {
      xdelo_logMessageOperation('info', correlationId, { message, ...metadata });
    },
    error: (message: string, error: any = null) => {
      xdelo_logMessageOperation('error', correlationId, { message, error: error?.message || JSON.stringify(error) });
    },
    success: (message: string, metadata: Record<string, any> = {}) => {
      xdelo_logMessageOperation('success', correlationId, { message, ...metadata });
    }
  };
};

// For backward compatibility
export const logMessageOperation = xdelo_logMessageOperation;
