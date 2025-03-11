
import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '../integrations/supabase/types';

/**
 * Logs a single sync operation to the sync_logs table
 */
export async function logSyncOperation(
  supabase: SupabaseClient<Database>,
  operation: string,
  details: Record<string, any>,
  success: boolean,
  error?: string
) {
  try {
    await supabase.rpc('xdelo_log_sync_operation_new', {
      operation_type: operation,
      status_value: success ? 'success' : 'error',
      details_json: details,
      error_message: error || null
    });
  } catch (err) {
    console.error('Failed to log sync operation:', err);
  }
}

/**
 * Logs multiple sync operations in a single batch insert
 */
export async function logSyncOperationBatch(
  supabase: SupabaseClient<Database>,
  operations: Array<{
    operation: string;
    details: Record<string, any>;
    success: boolean;
    error?: string;
  }>
) {
  try {
    // Use individual calls to the RPC function since we can't batch them
    const promises = operations.map(op => 
      supabase.rpc('xdelo_log_sync_operation_new', {
        operation_type: op.operation,
        status_value: op.success ? 'success' : 'error',
        details_json: op.details,
        error_message: op.error || null
      })
    );
    
    await Promise.all(promises);
  } catch (err) {
    console.error('Failed to log sync operations batch:', err);
  }
}

/**
 * Logs a warning message to the sync_logs table
 */
export async function logSyncWarning(
  supabase: SupabaseClient<Database>,
  message: string,
  details: Record<string, any>
) {
  await logSyncOperation(
    supabase,
    'warning',
    { message, ...details },
    true
  );
}
