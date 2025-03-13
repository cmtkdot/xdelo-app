
import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '../integrations/supabase/types';
import { logEvent, LogEventType } from './logUtils';

/**
 * @deprecated Use logEvent from logUtils.ts instead
 * This function is maintained for backward compatibility
 */
export async function xdelo_logSyncOperation(
  _supabase: any, // Changed to any to avoid TS errors with old references
  operation: string,
  details: Record<string, any>,
  success: boolean,
  error?: string
) {
  try {
    // Map string operation to LogEventType when possible
    let eventType: LogEventType | string;
    
    // Try to convert string operation to LogEventType
    if (operation.toUpperCase() in LogEventType) {
      eventType = operation.toUpperCase() as keyof typeof LogEventType;
    } else {
      // Fallback to system warning if conversion fails
      eventType = LogEventType.SYSTEM_WARNING;
    }
    
    // Use the new consolidated logging system
    await logEvent(
      eventType,
      details.id || 'system',
      {
        operation,
        details,
        table_name: details.table_name || 'system',
        glide_id: details.glide_id || null
      },
      {
        error_message: error
      }
    );
  } catch (err) {
    console.error('Failed to log sync operation:', err);
  }
}

/**
 * @deprecated Use logEvent from logUtils.ts instead
 * This function is maintained for backward compatibility
 */
export async function xdelo_logSyncOperationBatch(
  _supabase: any, // Changed to any to avoid TS errors with old references
  operations: Array<{
    operation: string;
    details: Record<string, any>;
    success: boolean;
    error?: string;
  }>
) {
  try {
    // Process each operation individually using the new system
    for (const op of operations) {
      await xdelo_logSyncOperation(_supabase, op.operation, op.details, op.success, op.error);
    }
  } catch (err) {
    console.error('Failed to log sync operations batch:', err);
  }
}

/**
 * @deprecated Use logEvent from logUtils.ts instead
 * This function is maintained for backward compatibility
 */
export async function xdelo_logSyncWarning(
  _supabase: any, // Changed to any to avoid TS errors with old references
  message: string,
  details: Record<string, any>
) {
  await logEvent(
    LogEventType.SYSTEM_WARNING,
    details.id || 'system',
    {
      message,
      ...details
    },
    {
      error_message: message
    }
  );
}

// Export the old function names for backward compatibility
export const logSyncOperation = xdelo_logSyncOperation;
export const logSyncOperationBatch = xdelo_logSyncOperationBatch;
export const logSyncWarning = xdelo_logSyncWarning;

// Re-export the new LogEventType for convenience
export { LogEventType };
