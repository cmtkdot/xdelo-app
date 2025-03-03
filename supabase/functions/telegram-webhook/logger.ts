
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

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

    // Add timestamp to metadata if not present
    if (!metadata.timestamp) {
      metadata.timestamp = new Date().toISOString();
    }

    // Log to console first for immediate feedback
    console.log(`[${operation.toUpperCase()}] ${metadata.message || ''}`);
    if (metadata.error) {
      console.error(`Error details: ${metadata.error}`);
    }

    // Try to write to the database
    await supabase.from('unified_audit_logs').insert({
      event_type: `telegram_webhook_${operation}`,
      correlation_id: correlationId,
      metadata
    });
  } catch (error) {
    // Only log to console if database insert fails
    console.error('Error logging operation to database:', error);
  }
};
