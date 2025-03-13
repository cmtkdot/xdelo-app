
import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '../integrations/supabase/types';

// Import the consolidated logging functions
import { logMessageOperation, LogEventType } from './syncLogger';

/**
 * @deprecated Use logMessageOperation from syncLogger.ts instead
 * This function is maintained for backward compatibility
 */
export async function xdelo_logSyncOperation(
  supabase: SupabaseClient<Database>,
  operation: string,
  details: Record<string, any>,
  success: boolean,
  error?: string
) {
  try {
    // Use the new consolidated logging system
    const eventType = success ? LogEventType.SYNC_COMPLETED : LogEventType.SYNC_ERROR;
    await logMessageOperation(eventType, details.id || 'system', {
      operation,
      details,
      error_message: error,
      table_name: details.table_name || 'system',
      glide_id: details.glide_id || null
    });
  } catch (err) {
    console.error('Failed to log sync operation:', err);
  }
}

/**
 * @deprecated Use logMessageOperation from syncLogger.ts instead
 * This function is maintained for backward compatibility
 */
export async function xdelo_logSyncOperationBatch(
  supabase: SupabaseClient<Database>,
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
      await xdelo_logSyncOperation(supabase, op.operation, op.details, op.success, op.error);
    }
  } catch (err) {
    console.error('Failed to log sync operations batch:', err);
  }
}

/**
 * @deprecated Use logMessageOperation from syncLogger.ts instead
 * This function is maintained for backward compatibility
 */
export async function xdelo_logSyncWarning(
  supabase: SupabaseClient<Database>,
  message: string,
  details: Record<string, any>
) {
  await logMessageOperation('warning', details.id || 'system', {
    message,
    ...details
  });
}

// Export the old function names for backward compatibility
export const logSyncOperation = xdelo_logSyncOperation;
export const logSyncOperationBatch = xdelo_logSyncOperationBatch;
export const logSyncWarning = xdelo_logSyncWarning;
