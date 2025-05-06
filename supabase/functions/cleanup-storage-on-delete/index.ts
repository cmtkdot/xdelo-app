import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
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

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Generate a correlation ID for this operation
  const correlationId = `storage_cleanup_${crypto.randomUUID()}`;
  const failedOperations = [];

  try {
    const { message_id, cascade = true, retry_count = 0 } = await req.json();

    if (!message_id) {
      throw new Error('Message ID is required');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Log the start of the cleanup process
    await logEvent(
      supabaseClient,
      'storage_deleted',
      message_id,
      {
        operation: 'cleanup_started',
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
      await logEvent(
        supabaseClient,
        'storage_deleted',
        message_id,
        {
          error: fetchError.message,
          operation: 'cleanup_failed',
          stage: 'fetch_message',
          retry_count
        },
        correlationId,
        fetchError.message
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
            supabaseClient,
            archivedMessage.storage_path,
            correlationId
          );

          await logEvent(
            supabaseClient,
            'storage_deleted',
            message_id,
            {
              operation: 'archive_storage_cleanup',
              storage_path: archivedMessage.storage_path,
              storage_result: storageResult,
              retry_count
            },
            correlationId
          );

          return new Response(
            JSON.stringify({
              success: true,
              message: 'Archived message storage cleaned up',
              storage_result: storageResult,
              correlation_id: correlationId
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      const errorMsg = 'Message not found';
      await logEvent(
        supabaseClient,
        'storage_deleted',
        message_id,
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
      );
    }

    // Delete the primary message's file if it has a storage path
    let primaryStorageResult = null;
    if (message.storage_path) {
      primaryStorageResult = await deleteFromStorage(
        supabaseClient,
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
      }
    }

    // Check if this is part of a media group and we need to cascade delete
    const mediaGroupResults = [];
    if (cascade && message.media_group_id) {
      // Log the start of cascading deletion
      await logEvent(
        supabaseClient,
        'storage_deleted',
        message_id,
        {
          media_group_id: message.media_group_id,
          operation: 'cascade_deletion_started'
        },
        correlationId
      );

      // Find all related messages in the same media group
      const { data: groupMessages, error: groupError } = await supabaseClient
        .from('messages')
        .select('id, storage_path, file_id, file_unique_id')
        .eq('media_group_id', message.media_group_id)
        .neq('id', message_id); // Exclude the current message

      if (groupError) {
        await logEvent(
          supabaseClient,
          'storage_deleted',
          message_id,
          {
            media_group_id: message.media_group_id,
            error: groupError.message,
            operation: 'cascade_deletion_failed',
            stage: 'fetch_group_messages'
          },
          correlationId,
          groupError.message
        );
      } else if (groupMessages && groupMessages.length > 0) {
        // Process each related message
        for (const groupMsg of groupMessages) {
          try {
            // Delete the file from storage if it has a storage path
            let storageResult = null;
            if (groupMsg.storage_path) {
              storageResult = await deleteFromStorage(
                supabaseClient,
                groupMsg.storage_path,
                correlationId
              );
            }

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
          }
        }
      }

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
      },
      correlationId
    );

    return new Response(
      JSON.stringify({
        success: true,
        storage_deleted: primaryStorageResult,
        media_group_results: mediaGroupResults.length > 0 ? mediaGroupResults : null,
        correlation_id: correlationId
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({
        error: error.message,
        correlation_id: correlationId
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
