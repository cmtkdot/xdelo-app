
import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '../types';

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
      details,
      error_message: error || null,
      created_at: new Date().toISOString()
    });
  } catch (err) {
    console.error('Failed to log sync operation:', err);
  }
}

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
    const logs = operations.map(op => ({
      operation_type: op.operation,
      status: op.success ? 'success' : 'error',
      details: op.details,
      error_message: op.error || null,
      created_at: new Date().toISOString()
    }));
    
    await supabase.from('sync_logs').insert(logs);
  } catch (err) {
    console.error('Failed to log sync operations batch:', err);
  }
}

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
