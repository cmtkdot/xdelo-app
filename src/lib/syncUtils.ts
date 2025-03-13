
import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '../integrations/supabase/types';
import { logOperation, logSystemEvent } from './unifiedLogger';

/**
 * @deprecated Use logOperation from unifiedLogger.ts instead
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
    // First log to the new unified system
    await logOperation({
      entityId: details.id || 'system',
      eventType: success ? 'processing_completed' : 'processing_error',
      metadata: {
        ...details,
        operation,
        table_name: details.table_name || 'system',
        glide_id: details.glide_id || null,
        legacy_source: 'gl_sync_logs'
      },
      errorMessage: error
    });
    
    // Also insert to the gl_sync_logs table for backward compatibility
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
    // Try to log the failure
    try {
      await logSystemEvent('error', 'Failed to log sync operation', {
        operation,
        details,
        error: err instanceof Error ? err.message : String(err)
      });
    } catch {
      // Last resort - console log only
      console.error('Failed to log sync failure:', err);
    }
  }
}

/**
 * @deprecated Use logOperation from unifiedLogger.ts instead
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
    // Log to the new unified system
    await Promise.all(operations.map(op => 
      logOperation({
        entityId: op.details.id || 'system',
        eventType: op.success ? 'processing_completed' : 'processing_error',
        metadata: {
          ...op.details,
          operation: op.operation,
          table_name: op.details.table_name || 'system',
          glide_id: op.details.glide_id || null,
          legacy_source: 'gl_sync_logs_batch'
        },
        errorMessage: op.error
      })
    ));
    
    // Use batch insert for multiple operations to gl_sync_logs
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
    // Try to log the failure
    try {
      await logSystemEvent('error', 'Failed to log sync operations batch', {
        operations_count: operations.length,
        error: err instanceof Error ? err.message : String(err)
      });
    } catch {
      // Last resort - console log only
      console.error('Failed to log batch sync failure:', err);
    }
  }
}

/**
 * @deprecated Use logSystemEvent from unifiedLogger.ts instead
 * Logs a warning message to the sync_logs table
 */
export async function xdelo_logSyncWarning(
  supabase: SupabaseClient<Database>,
  message: string,
  details: Record<string, any>
) {
  await logSystemEvent('warning', message, {
    ...details,
    legacy_source: 'gl_sync_logs_warning'
  });
  
  // Also log to old system for backward compatibility
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
