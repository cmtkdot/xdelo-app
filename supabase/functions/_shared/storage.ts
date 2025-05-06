/**
 * Shared storage utilities for edge functions
 */
import { logEvent } from './logging.ts';
import { createSupabaseClient } from './supabaseClient.ts';

/**
 * Default configuration for storage operations
 */
export const StorageConfig = {
  MAX_RETRIES: 3,         // Maximum number of retry attempts
  INITIAL_DELAY: 1000,    // Initial delay in ms before first retry
  MAX_DELAY: 10000,       // Maximum delay in ms between retries
  BACKOFF_FACTOR: 2       // Exponential backoff multiplier
};

/**
 * Parse a storage path into bucket and file path components
 * @param storagePath Full storage path in format: storage/bucket/path/to/file
 * @returns Object with bucket and path components
 */
export function parseStoragePath(storagePath: string): { bucket: string; path: string } {
  const parts = storagePath.split('/');
  if (parts.length < 3) {
    throw new Error(`Invalid storage path format: ${storagePath}`);
  }

  const bucket = parts[1];
  const path = parts.slice(2).join('/');

  return { bucket, path };
}

/**
 * Delete a file from storage with retry logic
 * @param storagePath Full storage path in format: storage/bucket/path/to/file
 * @param correlationId Correlation ID for tracking the operation
 * @param maxRetries Maximum number of retry attempts
 * @returns Object with operation result details
 */
export async function deleteFromStorage(
  storagePath: string,
  correlationId: string,
  maxRetries = StorageConfig.MAX_RETRIES
) {
  const supabase = createSupabaseClient();
  let retryCount = 0;
  let lastError = null;

  while (retryCount < maxRetries) {
    try {
      // Parse the storage path
      const { bucket, path } = parseStoragePath(storagePath);

      // Log attempt
      console.log(`[${correlationId}] Attempting to delete file (attempt ${retryCount + 1}/${maxRetries}): ${bucket}/${path}`);

      // Delete the file from storage
      const { error } = await supabase
        .storage
        .from(bucket)
        .remove([path]);

      if (error) {
        throw error;
      }

      // Success - log and return
      console.log(`[${correlationId}] Successfully deleted file: ${bucket}/${path}`);

      // Log the successful deletion
      await logEvent(
        'storage_deleted',
        storagePath,
        {
          operation: 'delete_successful',
          bucket,
          path,
          retries: retryCount
        },
        correlationId
      );

      return {
        success: true,
        retries: retryCount,
        bucket,
        path
      };
    } catch (error) {
      lastError = error;
      retryCount++;

      if (retryCount < maxRetries) {
        // Exponential backoff: 1s, 2s, 4s, etc. capped at MAX_DELAY
        const backoff = Math.min(
          StorageConfig.MAX_DELAY,
          StorageConfig.INITIAL_DELAY * Math.pow(StorageConfig.BACKOFF_FACTOR, retryCount - 1)
        );

        console.log(`[${correlationId}] Deletion failed, retrying in ${backoff}ms. Error: ${error.message}`);

        // Log the retry attempt
        await logEvent(
          'storage_deleted',
          storagePath,
          {
            operation: 'delete_retry',
            retry_count: retryCount,
            next_retry_delay_ms: backoff,
            error: error.message
          },
          correlationId
        );

        await new Promise(resolve => setTimeout(resolve, backoff));
      } else {
        console.error(`[${correlationId}] Failed to delete file after ${maxRetries} attempts: ${storagePath}`, error);

        // Log the final failure
        await logEvent(
          'storage_deleted',
          storagePath,
          {
            operation: 'delete_failed',
            retry_count: retryCount,
            error: error.message
          },
          correlationId,
          error.message
        );
      }
    }
  }

  // All retries failed
  return {
    success: false,
    error: lastError?.message || 'Unknown error',
    retries: retryCount
  };
}

/**
 * Queue a storage deletion operation for retry
 * @param supabase Supabase client instance
 * @param storagePath The storage path to delete
 * @param correlationId Correlation ID for tracking
 * @param retryDelaySec Seconds to delay before retry (default 60s)
 * @returns Result of the queue operation
 */
export async function queueStorageDeletionRetry(
  storagePath: string,
  correlationId: string,
  retryDelaySec = 60,
  maxRetries = 5
) {
  const supabase = createSupabaseClient();

  try {
    // Check if there's already a pending retry for this storage path
    const { data: existing } = await supabase
      .from('storage_deletion_retries')
      .select('*')
      .eq('storage_path', storagePath)
      .maybeSingle();

    if (existing) {
      // Update the existing retry record
      const { error } = await supabase
        .from('storage_deletion_retries')
        .update({
          retry_count: existing.retry_count + 1,
          next_retry_at: new Date(Date.now() + retryDelaySec * 1000).toISOString(),
          last_error: `Previous error, retrying in ${retryDelaySec}s`,
          updated_at: new Date().toISOString(),
          correlation_id: correlationId // Update with the latest correlation ID
        })
        .eq('id', existing.id);

      if (error) {
        console.error(`[${correlationId}] Error updating retry record:`, error);
        return { success: false, error: error.message };
      }

      return {
        success: true,
        message: 'Updated existing retry record',
        retryId: existing.id
      };
    } else {
      // Create a new retry record
      const { data, error } = await supabase
        .from('storage_deletion_retries')
        .insert({
          storage_path: storagePath,
          retry_count: 0,
          max_retries: maxRetries,
          next_retry_at: new Date(Date.now() + retryDelaySec * 1000).toISOString(),
          correlation_id: correlationId,
          status: 'pending'
        })
        .select()
        .single();

      if (error) {
        console.error(`[${correlationId}] Error creating retry record:`, error);
        return { success: false, error: error.message };
      }

      return {
        success: true,
        message: 'Created new retry record',
        retryId: data.id
      };
    }
  } catch (error) {
    console.error(`[${correlationId}] Error queuing storage deletion retry:`, error);
    return { success: false, error: error.message };
  }
}
