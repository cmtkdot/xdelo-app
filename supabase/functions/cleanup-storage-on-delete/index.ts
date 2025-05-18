import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createCorsResponse, handleOptionsRequest } from "../_shared/cors.ts";
import { EventType, generateCorrelationId, logError, logEvent, logOperationComplete, logOperationStart } from "../_shared/logging.ts";
import { deleteFromStorage, queueStorageDeletionRetry } from "../_shared/storage.ts";
import { createSupabaseClient } from "../_shared/supabaseClient.ts";
serve(async (req)=>{
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return handleOptionsRequest();
  }
  // Generate a correlation ID for this operation
  const correlationId = generateCorrelationId('storage_cleanup');
  const failedOperations = [];
  try {
    const { message_id, cascade = true, retry_count = 0 } = await req.json();
    if (!message_id) {
      throw new Error('Message ID is required');
    }
    const supabaseClient = createSupabaseClient();
    // Log the start of the cleanup process
    await logOperationStart(EventType.STORAGE_DELETED, message_id, 'cleanup', {
      cascade,
      retry_count
    }, correlationId);
    // Get message details before deletion
    const { data: message, error: fetchError } = await supabaseClient.from('messages').select('*').eq('id', message_id).single();
    if (fetchError) {
      await logError(EventType.STORAGE_DELETED, message_id, fetchError.message, correlationId, {
        operation: 'cleanup_failed',
        stage: 'fetch_message',
        retry_count
      });
      throw fetchError;
    }
    // Handle case where message might have already been deleted (rare race condition)
    if (!message) {
      // Check if this is a retry attempt
      if (retry_count > 0) {
        // This could be a retry for a message that no longer exists - try to find it in deleted_messages
        const { data: archivedMessage } = await supabaseClient.from('deleted_messages').select('storage_path').eq('original_message_id', message_id).single();
        if (archivedMessage?.storage_path) {
          // Found in archived messages, try to clean up storage
          console.log(`[${correlationId}] Message found in archive, attempting storage cleanup for: ${archivedMessage.storage_path}`);
          const storageResult = await deleteFromStorage(archivedMessage.storage_path, correlationId);
          await logEvent(EventType.STORAGE_DELETED, message_id, {
            operation: 'archive_storage_cleanup',
            storage_path: archivedMessage.storage_path,
            storage_result: storageResult,
            retry_count
          }, correlationId);
          return createCorsResponse({
            success: true,
            message: 'Archived message storage cleaned up',
            storage_result: storageResult,
            correlation_id: correlationId
          });
        }
      }
      const errorMsg = 'Message not found';
      await logError(EventType.STORAGE_DELETED, message_id, errorMsg, correlationId, {
        operation: 'cleanup_failed',
        stage: 'message_not_found',
        retry_count
      });
      return createCorsResponse({
        error: errorMsg,
        correlation_id: correlationId
      }, {
        status: 404
      });
    }
    // Delete the primary message's file if it has a storage path
    let primaryStorageResult = null;
    if (message.storage_path) {
      primaryStorageResult = await deleteFromStorage(message.storage_path, correlationId);
      if (!primaryStorageResult.success) {
        failedOperations.push({
          id: message_id,
          storage_path: message.storage_path,
          error: primaryStorageResult.error,
          type: 'primary_storage'
        });
        // Queue this for retry if it failed
        await queueStorageDeletionRetry(message.storage_path, correlationId);
      }
    }
    // If cascade is enabled, clean up related media group messages
    if (cascade && message.media_group_id) {
      await logEvent(EventType.STORAGE_DELETED, message_id, {
        operation: 'media_group_cleanup_started',
        media_group_id: message.media_group_id
      }, correlationId);
      // Find all related messages in the media group
      const { data: groupMessages, error: groupError } = await supabaseClient.from('messages').select('id, storage_path').eq('media_group_id', message.media_group_id).neq('id', message_id); // Exclude the current message
      if (groupError) {
        await logError(EventType.STORAGE_DELETED, message_id, groupError.message, correlationId, {
          operation: 'media_group_cleanup_failed',
          stage: 'fetch_group_messages',
          media_group_id: message.media_group_id
        });
      } else if (groupMessages && groupMessages.length > 0) {
        // Process each media group message
        const groupResults = [];
        for (const groupMsg of groupMessages){
          if (groupMsg.storage_path) {
            const groupStorageResult = await deleteFromStorage(groupMsg.storage_path, correlationId);
            groupResults.push({
              id: groupMsg.id,
              storage_path: groupMsg.storage_path,
              result: groupStorageResult
            });
            if (!groupStorageResult.success) {
              failedOperations.push({
                id: groupMsg.id,
                storage_path: groupMsg.storage_path,
                error: groupStorageResult.error,
                type: 'group_storage'
              });
              // Queue this for retry if it failed
              await queueStorageDeletionRetry(groupMsg.storage_path, correlationId);
            }
          }
        }
        // Log completion of media group cleanup
        await logEvent(EventType.STORAGE_DELETED, message_id, {
          operation: 'media_group_cleanup_completed',
          media_group_id: message.media_group_id,
          group_results: groupResults,
          success_count: groupResults.filter((r)=>r.result.success).length,
          failed_count: groupResults.filter((r)=>!r.result.success).length,
          total_count: groupResults.length
        }, correlationId);
      }
    }
    // Log completion of the entire operation
    await logOperationComplete(EventType.STORAGE_DELETED, message_id, 'cleanup', {
      success: failedOperations.length === 0,
      failed_operations: failedOperations,
      cascade,
      retry_count
    }, correlationId);
    // Return appropriate response based on success or partial success
    if (failedOperations.length === 0) {
      return createCorsResponse({
        success: true,
        message: 'Storage cleanup completed successfully',
        correlation_id: correlationId
      });
    } else {
      return createCorsResponse({
        success: false,
        message: 'Some storage cleanup operations failed',
        failed_operations: failedOperations,
        correlation_id: correlationId,
        retry_scheduled: true
      }, {
        status: 207
      }); // 207 Multi-Status
    }
  } catch (error) {
    console.error(`[${correlationId}] Unhandled error:`, error);
    await logError(EventType.STORAGE_DELETED, 'unknown', error.message, correlationId, {
      operation: 'unhandled_error'
    });
    return createCorsResponse({
      success: false,
      message: `An unexpected error occurred: ${error.message}`,
      correlation_id: correlationId
    }, {
      status: 500
    });
  }
});
