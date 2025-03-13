
import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '../integrations/supabase/types';

/**
 * Logs a single sync operation to the sync_logs table
 */
export async function xdelo_logSyncOperation(
  supabase: SupabaseClient<Database>,
  operation: string,
  details: Record<string, any>,
  success: boolean,
  error?: string
) {
  try {
    // Insert directly to the gl_sync_logs table instead of using RPC function
    await supabase.from('gl_sync_logs').insert({
      operation: operation,
      status: success ? 'success' : 'error',
      record_id: details.id || 'system',
      table_name: details.table_name || 'system',
      error_message: error || null,
      glide_id: details.glide_id || null
    });
  } catch (err) {
    console.error('Failed to log sync operation:', err);
  }
}

/**
 * Logs multiple sync operations in a single batch insert
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
    // Use batch insert for multiple operations
    const syncLogs = operations.map(op => ({
      operation: op.operation,
      status: op.success ? 'success' : 'error',
      record_id: op.details.id || 'system',
      table_name: op.details.table_name || 'system',
      error_message: op.error || null,
      glide_id: op.details.glide_id || null
    }));
    
    await supabase.from('gl_sync_logs').insert(syncLogs);
  } catch (err) {
    console.error('Failed to log sync operations batch:', err);
  }
}

/**
 * Logs a warning message to the sync_logs table
 */
export async function xdelo_logSyncWarning(
  supabase: SupabaseClient<Database>,
  message: string,
  details: Record<string, any>
) {
  await xdelo_logSyncOperation(
    supabase,
    'warning',
    { message, ...details },
    true
  );
}

// Export the old function names for backward compatibility
export const logSyncOperation = xdelo_logSyncOperation;
export const logSyncOperationBatch = xdelo_logSyncOperationBatch;
export const logSyncWarning = xdelo_logSyncWarning;
