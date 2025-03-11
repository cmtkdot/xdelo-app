
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
    await supabase.from('sync_logs').insert({
      operation_type: operation,
      status: success ? 'success' : 'error',
      details: details,
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
    // Use batch insert into the sync_logs table
    const records = operations.map(op => ({
      operation_type: op.operation,
      status: op.success ? 'success' : 'error',
      details: op.details,
      error_message: op.error || null
    }));
    
    await supabase.from('sync_logs').insert(records);
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
