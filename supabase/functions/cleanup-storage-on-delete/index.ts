import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
<<<<<<< HEAD
import { createCorsResponse, handleOptionsRequest } from "../_shared/cors.ts";
import {
  EventType,
  generateCorrelationId,
  logError,
  logEvent,
  logOperationComplete,
  logOperationStart
} from "../_shared/logging.ts";
import {
  deleteFromStorage,
  queueStorageDeletionRetry
} from "../_shared/storage.ts";
import { createSupabaseClient } from "../_shared/supabaseClient.ts";
=======
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Log an event to the unified audit system
 */
async function logEvent(
  supabase: any,
  eventType: string,
  entityId: string,
  metadata: Record<string, unknown> = {},
  correlationId?: string,
  errorMessage?: string
) {
  try {
    // Generate a correlation ID if not provided
    const logCorrelationId = correlationId || `storage_cleanup_${crypto.randomUUID()}`;

    // Insert the log entry
    const { error } = await supabase
      .from('unified_audit_logs')
      .insert({
        event_type: eventType,
        entity_id: entityId,
        metadata,
        correlation_id: logCorrelationId,
        error_message: errorMessage
      });

    if (error) {
      console.error('Error logging event:', error);
    }

    return logCorrelationId;
  } catch (err) {
    console.error('Failed to log event:', err);
    return null;
  }
}

/**
 * Delete a file from storage with retry logic
 */
async function deleteFromStorage(supabase: any, storagePath: string, correlationId: string, maxRetries = 3) {
  let retryCount = 0;
  let lastError = null;

  while (retryCount < maxRetries) {
    try {
      // Extract bucket and path from storage path
      // Format is typically: storage/bucket/path/to/file
      const parts = storagePath.split('/');
      if (parts.length < 3) {
        throw new Error(`Invalid storage path format: ${storagePath}`);
      }

      const bucket = parts[1];
      const path = parts.slice(2).join('/');

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
      return {
        success: true,
        retries: retryCount
      };
    } catch (error) {
      lastError = error;
      retryCount++;

      if (retryCount < maxRetries) {
        // Exponential backoff: 1s, 2s, 4s, etc.
        const backoff = Math.pow(2, retryCount - 1) * 1000;
        console.log(`[${correlationId}] Deletion failed, retrying in ${backoff}ms. Error: ${error.message}`);
        await new Promise(resolve => setTimeout(resolve, backoff));
      } else {
        console.error(`[${correlationId}] Failed to delete file after ${maxRetries} attempts: ${storagePath}`, error);
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
>>>>>>> 35f58cbf (refactor: improve type safety and error handling in media operations)

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return handleOptionsRequest();
  }

  // Generate a correlation ID for this operation
<<<<<<< HEAD
  const correlationId = generateCorrelationId('storage_cleanup');
=======
  const correlationId = `storage_cleanup_${crypto.randomUUID()}`;
>>>>>>> 35f58cbf (refactor: improve type safety and error handling in media operations)
  const failedOperations = [];

  try {
    const { message_id, cascade = true, retry_count = 0 } = await req.json();

    if (!message_id) {
      throw new Error('Message ID is required');
    }

    const supabaseClient = createSupabaseClient();

    // Log the start of the cleanup process
    await logOperationStart(
      EventType.STORAGE_DELETED,
      message_id,
<<<<<<< HEAD
      'cleanup',
      {
=======
      {
        operation: 'cleanup_started',
>>>>>>> 35f58cbf (refactor: improve type safety and error handling in media operations)
        cascade,
        retry_count
      },
      correlationId
    );

    // Get message details before deletion
    const { data: message, error: fetchError } = await supabaseClient
      .from('messages')
      .select('*')
      .eq('id', message_id)
      .single();

    if (fetchError) {
      await logError(
        EventType.STORAGE_DELETED,
        message_id,
<<<<<<< HEAD
        fetchError.message,
=======
        {
          error: fetchError.message,
          operation: 'cleanup_failed',
          stage: 'fetch_message',
          retry_count
        },
>>>>>>> 35f58cbf (refactor: improve type safety and error handling in media operations)
        correlationId,
        {
          operation: 'cleanup_failed',
          stage: 'fetch_message',
          retry_count
        }
      );
      throw fetchError;
    }

    // Handle case where message might have already been deleted (rare race condition)
    if (!message) {
      // Check if this is a retry attempt
      if (retry_count > 0) {
        // This could be a retry for a message that no longer exists - try to find it in deleted_messages
        const { data: archivedMessage } = await supabaseClient
          .from('deleted_messages')
          .select('storage_path')
          .eq('original_message_id', message_id)
          .single();

        if (archivedMessage?.storage_path) {
          // Found in archived messages, try to clean up storage
          console.log(`[${correlationId}] Message found in archive, attempting storage cleanup for: ${archivedMessage.storage_path}`);
          const storageResult = await deleteFromStorage(
<<<<<<< HEAD
=======
            supabaseClient,
>>>>>>> 35f58cbf (refactor: improve type safety and error handling in media operations)
            archivedMessage.storage_path,
            correlationId
          );

          await logEvent(
<<<<<<< HEAD
            EventType.STORAGE_DELETED,
=======
            supabaseClient,
            'storage_deleted',
>>>>>>> 35f58cbf (refactor: improve type safety and error handling in media operations)
            message_id,
            {
              operation: 'archive_storage_cleanup',
              storage_path: archivedMessage.storage_path,
              storage_result: storageResult,
              retry_count
            },
            correlationId
          );

<<<<<<< HEAD
          return createCorsResponse({
            success: true,
            message: 'Archived message storage cleaned up',
            storage_result: storageResult,
            correlation_id: correlationId
          });
=======
          return new Response(
            JSON.stringify({
              success: true,
              message: 'Archived message storage cleaned up',
              storage_result: storageResult,
              correlation_id: correlationId
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
>>>>>>> 35f58cbf (refactor: improve type safety and error handling in media operations)
        }
      }

      const errorMsg = 'Message not found';
      await logError(
        EventType.STORAGE_DELETED,
        message_id,
<<<<<<< HEAD
        errorMsg,
        correlationId,
        {
          operation: 'cleanup_failed',
          stage: 'message_not_found',
          retry_count
        }
=======
        {
          error: errorMsg,
          operation: 'cleanup_failed',
          stage: 'message_not_found',
          retry_count
        },
        correlationId,
        errorMsg
      );
      return new Response(
        JSON.stringify({
          error: errorMsg,
          correlation_id: correlationId
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
>>>>>>> 35f58cbf (refactor: improve type safety and error handling in media operations)
      );
      return createCorsResponse({
        error: errorMsg,
        correlation_id: correlationId
      }, { status: 404 });
    }

    // Delete the primary message's file if it has a storage path
    let primaryStorageResult = null;
    if (message.storage_path) {
      primaryStorageResult = await deleteFromStorage(
<<<<<<< HEAD
=======
        supabaseClient,
>>>>>>> 35f58cbf (refactor: improve type safety and error handling in media operations)
        message.storage_path,
        correlationId
      );

      if (!primaryStorageResult.success) {
        failedOperations.push({
          id: message_id,
          storage_path: message.storage_path,
          error: primaryStorageResult.error,
          type: 'primary_storage'
        });
<<<<<<< HEAD

        // Queue this for retry if it failed
        await queueStorageDeletionRetry(
          message.storage_path,
          correlationId
        );
      }
    }

    // If cascade is enabled, clean up related media group messages
=======
      }
    }

    // Check if this is part of a media group and we need to cascade delete
    const mediaGroupResults = [];
>>>>>>> 35f58cbf (refactor: improve type safety and error handling in media operations)
    if (cascade && message.media_group_id) {
      await logEvent(
        EventType.STORAGE_DELETED,
        message_id,
        {
<<<<<<< HEAD
          operation: 'media_group_cleanup_started',
          media_group_id: message.media_group_id
=======
          media_group_id: message.media_group_id,
          operation: 'cascade_deletion_started'
>>>>>>> 35f58cbf (refactor: improve type safety and error handling in media operations)
        },
        correlationId
      );

<<<<<<< HEAD
      // Find all related messages in the media group
=======
      // Find all related messages in the same media group
>>>>>>> 35f58cbf (refactor: improve type safety and error handling in media operations)
      const { data: groupMessages, error: groupError } = await supabaseClient
        .from('messages')
        .select('id, storage_path')
        .eq('media_group_id', message.media_group_id)
        .neq('id', message_id); // Exclude the current message

      if (groupError) {
        await logError(
          EventType.STORAGE_DELETED,
          message_id,
<<<<<<< HEAD
          groupError.message,
=======
          {
            media_group_id: message.media_group_id,
            error: groupError.message,
            operation: 'cascade_deletion_failed',
            stage: 'fetch_group_messages'
          },
>>>>>>> 35f58cbf (refactor: improve type safety and error handling in media operations)
          correlationId,
          {
            operation: 'media_group_cleanup_failed',
            stage: 'fetch_group_messages',
            media_group_id: message.media_group_id
          }
        );
      } else if (groupMessages && groupMessages.length > 0) {
        // Process each media group message
        const groupResults = [];

        for (const groupMsg of groupMessages) {
<<<<<<< HEAD
          if (groupMsg.storage_path) {
            const groupStorageResult = await deleteFromStorage(
              groupMsg.storage_path,
              correlationId
            );

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
              await queueStorageDeletionRetry(
=======
          try {
            // Delete the file from storage if it has a storage path
            let storageResult = null;
            if (groupMsg.storage_path) {
              storageResult = await deleteFromStorage(
                supabaseClient,
>>>>>>> 35f58cbf (refactor: improve type safety and error handling in media operations)
                groupMsg.storage_path,
                correlationId
              );
            }
<<<<<<< HEAD
=======

            // Delete the message from the database
            const { error: deleteError } = await supabaseClient
              .from('messages')
              .delete()
              .eq('id', groupMsg.id);

            mediaGroupResults.push({
              id: groupMsg.id,
              storage_deleted: storageResult,
              database_deleted: !deleteError,
              error: deleteError ? deleteError.message : null
            });

            // Log the result for this group message
            await logEvent(
              supabaseClient,
              'storage_deleted',
              groupMsg.id,
              {
                media_group_id: message.media_group_id,
                parent_message_id: message_id,
                storage_path: groupMsg.storage_path,
                storage_deleted: storageResult,
                database_deleted: !deleteError,
                operation: deleteError ? 'group_message_deletion_failed' : 'group_message_deleted'
              },
              correlationId,
              deleteError ? deleteError.message : null
            );
          } catch (groupMsgError) {
            console.error(`Error processing group message ${groupMsg.id}:`, groupMsgError);
            mediaGroupResults.push({
              id: groupMsg.id,
              error: groupMsgError.message
            });

            // Log the error
            await logEvent(
              supabaseClient,
              'storage_deleted',
              groupMsg.id,
              {
                media_group_id: message.media_group_id,
                parent_message_id: message_id,
                error: groupMsgError.message,
                operation: 'group_message_deletion_failed'
              },
              correlationId,
              groupMsgError.message
            );
>>>>>>> 35f58cbf (refactor: improve type safety and error handling in media operations)
          }
        }

        // Log completion of media group cleanup
        await logEvent(
          EventType.STORAGE_DELETED,
          message_id,
          {
            operation: 'media_group_cleanup_completed',
            media_group_id: message.media_group_id,
            group_results: groupResults,
            success_count: groupResults.filter(r => r.result.success).length,
            failed_count: groupResults.filter(r => !r.result.success).length,
            total_count: groupResults.length
          },
          correlationId
        );
      }
<<<<<<< HEAD
    }

    // Log completion of the entire operation
    await logOperationComplete(
      EventType.STORAGE_DELETED,
      message_id,
      'cleanup',
      {
        success: failedOperations.length === 0,
        failed_operations: failedOperations,
        cascade,
        retry_count
=======

      // Log the completion of cascading deletion
      await logEvent(
        supabaseClient,
        'storage_deleted',
        message_id,
        {
          media_group_id: message.media_group_id,
          group_results: mediaGroupResults,
          operation: 'cascade_deletion_completed'
        },
        correlationId
      );
    }

    // Delete the message from the database
    const { error: deleteError } = await supabaseClient
      .from('messages')
      .delete()
      .eq('id', message_id);

    if (deleteError) {
      await logEvent(
        supabaseClient,
        'storage_deleted',
        message_id,
        {
          error: deleteError.message,
          operation: 'database_deletion_failed'
        },
        correlationId,
        deleteError.message
      );
      throw deleteError;
    }

    // Log successful database deletion
    await logEvent(
      supabaseClient,
      'storage_deleted',
      message_id,
      {
        operation: 'database_deletion_completed',
        storage_deleted: primaryStorageResult
>>>>>>> 35f58cbf (refactor: improve type safety and error handling in media operations)
      },
      correlationId
    );

<<<<<<< HEAD
    // Return appropriate response based on success or partial success
    if (failedOperations.length === 0) {
      return createCorsResponse({
        success: true,
        message: 'Storage cleanup completed successfully',
=======
    return new Response(
      JSON.stringify({
        success: true,
        storage_deleted: primaryStorageResult,
        media_group_results: mediaGroupResults.length > 0 ? mediaGroupResults : null,
>>>>>>> 35f58cbf (refactor: improve type safety and error handling in media operations)
        correlation_id: correlationId
      });
    } else {
      return createCorsResponse({
        success: false,
        message: 'Some storage cleanup operations failed',
        failed_operations: failedOperations,
        correlation_id: correlationId,
        retry_scheduled: true
      }, { status: 207 }); // 207 Multi-Status
    }
  } catch (error) {
    console.error(`[${correlationId}] Unhandled error:`, error);

    await logError(
      EventType.STORAGE_DELETED,
      'unknown',
      error.message,
      correlationId,
      { operation: 'unhandled_error' }
    );

<<<<<<< HEAD
    return createCorsResponse({
      success: false,
      message: `An unexpected error occurred: ${error.message}`,
      correlation_id: correlationId
    }, { status: 500 });
=======
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({
        error: error.message,
        correlation_id: correlationId
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
>>>>>>> 35f58cbf (refactor: improve type safety and error handling in media operations)
  }
});
