
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

type OperationType = 'edit' | 'skip' | 'duplicate' | 'reupload' | 'success' | 'error';

interface LogMetadata {
  message?: string;
  error?: string;
  telegram_message_id?: number;
  chat_id?: number;
  file_unique_id?: string;
  existing_message_id?: string;
  [key: string]: any;
}

export const logMessageOperation = async (
  operation: OperationType,
  correlationId: string,
  metadata: LogMetadata
) => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    await supabase.from('unified_audit_logs').insert({
      event_type: `telegram_webhook_${operation}`,
      correlation_id: correlationId,
      metadata: {
        ...metadata,
        timestamp: new Date().toISOString()
      }
    });

    // Also log to console for debugging
    console.log(`[${operation.toUpperCase()}] ${metadata.message || ''}`);
    if (metadata.error) {
      console.error(`Error details: ${metadata.error}`);
    }
  } catch (error) {
    // Fail silently but log to console
    console.error('Error logging operation:', error);
  }
};

export const getLogger = (correlationId: string) => {
  return {
    info: (message: string, data?: any) => {
      console.log(`[INFO] [${correlationId.substring(0, 8)}] ${message}`, data || '');
      logMessageOperation('success', correlationId, { message, level: 'info', ...data });
    },
    error: (message: string, error?: any) => {
      console.error(`[ERROR] [${correlationId.substring(0, 8)}] ${message}`, error || '');
      logMessageOperation('error', correlationId, { message, error: error?.message || error, level: 'error' });
    },
    warn: (message: string, data?: any) => {
      console.warn(`[WARN] [${correlationId.substring(0, 8)}] ${message}`, data || '');
      logMessageOperation('success', correlationId, { message, level: 'warn', ...data });
    },
    debug: (message: string, data?: any) => {
      console.debug(`[DEBUG] [${correlationId.substring(0, 8)}] ${message}`, data || '');
    }
  };
};
