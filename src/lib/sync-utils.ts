import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/types/supabase';

// Operation types for sync logging
export type SyncOperationType = 
  | 'product_sync' 
  | 'message_sync' 
  | 'manual_sync' 
  | 'product_match' 
  | 'bulk_sync';

// Status types for sync operations
export type SyncStatus = 'success' | 'error' | 'warning' | 'pending';

// Interface for sync operation metadata
export interface SyncOperationMetadata {
  userId?: string;
  source?: string;
  correlationId?: string;
  duration?: number;
  logged_at?: string;
}

// Interface for sync operation details
export interface SyncOperationResult {
  success: boolean;
  entityId?: string;
  details?: Record<string, unknown>;
  error?: string;
  metadata?: SyncOperationMetadata;
}

const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1000;

/**
 * Log a single sync operation result
 */
export async function logSyncOperation(
  operation: SyncOperationType,
  result: SyncOperationResult
): Promise<void> {
  const startTime = Date.now();
  let attempts = 0;

  const logEntry: Database['public']['Tables']['sync_logs']['Insert'] = {
    operation_type: operation,
    status: result.success ? 'success' : 'error',
    entity_id: result.entityId || null,
    details: result.details || null,
    error_message: result.error || null,
    metadata: {
      ...result.metadata,
      logged_at: new Date().toISOString(),
      duration: result.metadata?.duration || Date.now() - startTime
    }
  };

  while (attempts < MAX_RETRY_ATTEMPTS) {
    try {
      const { error } = await supabase
        .from('sync_logs')
        .insert(logEntry);

      if (error) throw error;
      return;
    } catch (error) {
      attempts++;
      if (attempts === MAX_RETRY_ATTEMPTS) {
        console.error('Failed to log sync operation after retries:', error);
        return;
      }
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS * attempts));
    }
  }
}

/**
 * Log multiple sync operations in batch
 */
export async function logSyncOperationBatch(
  operations: Array<{
    operation: SyncOperationType;
    result: SyncOperationResult;
  }>
): Promise<void> {
  const startTime = Date.now();
  let attempts = 0;

  const logEntries: Database['public']['Tables']['sync_logs']['Insert'][] = operations.map(({ operation, result }) => ({
    operation_type: operation,
    status: result.success ? 'success' : 'error',
    entity_id: result.entityId || null,
    details: result.details || null,
    error_message: result.error || null,
    metadata: {
      ...result.metadata,
      logged_at: new Date().toISOString(),
      duration: result.metadata?.duration || Date.now() - startTime
    }
  }));

  while (attempts < MAX_RETRY_ATTEMPTS) {
    try {
      const { error } = await supabase
        .from('sync_logs')
        .insert(logEntries);

      if (error) throw error;
      return;
    } catch (error) {
      attempts++;
      if (attempts === MAX_RETRY_ATTEMPTS) {
        console.error('Failed to log sync operations batch after retries:', error);
        return;
      }
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS * attempts));
    }
  }
}

/**
 * Create a warning log entry for sync operations
 */
export async function logSyncWarning(
  operation: SyncOperationType,
  message: string,
  metadata?: SyncOperationMetadata
): Promise<void> {
  await logSyncOperation(operation, {
    success: true,
    details: { warning: message },
    metadata
  });
}
