
import { SupabaseClient } from "@supabase/supabase-js";

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
    const supabase = new SupabaseClient(
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
