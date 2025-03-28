import { serve } from "https://deno.land/std@0.168.0/http/server.ts"; // Keep for serve
import {
  createHandler,
  createSuccessResponse,
  RequestMetadata,
  SecurityLevel,
} from "../_shared/unifiedHandler.ts";
import { supabaseClient } from "../_shared/supabase.ts"; // Use singleton client
import { logProcessingEvent } from "../_shared/consolidatedMessageUtils.ts"; // Use standard logging

// Removed local logEvent function

interface CleanupRequestBody {
  message_id: string; // DB message UUID
  cascade?: boolean;
}

/**
 * Delete a file from storage. Throws error on failure.
 */
async function deleteFromStorage(storagePath: string, correlationId: string, messageIdForLog: string) {
  const logMeta = { storagePath, messageId: messageIdForLog };
  console.log(`[${correlationId}] Attempting to delete from storage: ${storagePath}`);
  try {
    // Extract bucket and path
    // Assuming format: bucket/path/to/file (relative to bucket root in DB)
    // Or maybe just path/to/file if bucket is implicit? Adjust based on actual storage_path content.
    // Let's assume storage_path is just the path within a default bucket (e.g., 'telegram-media')
    const bucket = 'telegram-media'; // Make configurable if needed
    const path = storagePath; // Assuming storage_path is the path within the bucket

    if (!path) {
        throw new Error(`Invalid storage path provided: ${storagePath}`);
    }

    const { error } = await supabaseClient
      .storage
      .from(bucket)
      .remove([path]);

    if (error) {
      // Throw specific error to be caught by caller
      throw new Error(`Storage deletion error: ${error.message}`);
    }

    console.log(`[${correlationId}] Successfully deleted from storage: ${storagePath}`);
    await logProcessingEvent('storage_file_deleted', messageIdForLog, correlationId, logMeta);
    // No return needed on success, absence of error implies success

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[${correlationId}] Error deleting file ${storagePath} from storage:`, errorMessage);
    await logProcessingEvent('storage_file_delete_failed', messageIdForLog, correlationId, logMeta, errorMessage);
    // Re-throw the error for the main handler to catch
    throw new Error(`Storage deletion failed for ${storagePath}: ${errorMessage}`);
  }
}

// Core logic for cleaning up storage and DB entries
async function handleCleanupStorage(req: Request, metadata: RequestMetadata): Promise<Response> {
  const { correlationId } = metadata;
  console.log(`[${correlationId}] Processing cleanup-storage-on-delete request`);

  // --- Request Body Parsing and Validation ---
  let requestBody: CleanupRequestBody;
  try {
    requestBody = await req.json();
  } catch (parseError: unknown) {
    const errorMessage = parseError instanceof Error ? parseError.message : "Invalid JSON body";
    console.error(`[${correlationId}] Failed to parse request body: ${errorMessage}`);
    throw new Error(`Invalid request: ${errorMessage}`);
  }

  const { message_id, cascade = true } = requestBody; // Default cascade to true
  if (!message_id) {
    console.error(`[${correlationId}] Missing required field message_id`);
    throw new Error("Invalid request: Message ID (message_id) is required.");
  }

  await logProcessingEvent('storage_cleanup_started', message_id, correlationId, { cascade });
  console.log(`[${correlationId}] Starting cleanup for message ${message_id}, cascade: ${cascade}`);

  let mainMessageStoragePath: string | null = null;
  let mediaGroupId: string | null = null;
  const mediaGroupResults = [];
  let mainStorageDeleted = false; // Track main file deletion status
  let mainDbDeleted = false; // Track main DB deletion status

  try {
    // --- Fetch Main Message Details ---
    const { data: message, error: fetchError } = await supabaseClient
      .from('messages')
      .select('id, storage_path, media_group_id') // Select only needed fields
      .eq('id', message_id)
      .single();

    if (fetchError) {
      // Log and throw specific error
      await logProcessingEvent('storage_cleanup_failed', message_id, correlationId, { stage: 'fetch_message' }, fetchError.message);
      throw new Error(`Database error fetching message: ${fetchError.message}`);
    }
    if (!message) {
      // Message already deleted or never existed, maybe return success? Or specific error?
      console.warn(`[${correlationId}] Message ${message_id} not found during cleanup.`);
      await logProcessingEvent('storage_cleanup_skipped', message_id, correlationId, { reason: 'message_not_found' });
      // Return success as the goal (message deleted) is achieved.
      return createSuccessResponse({ success: true, message: "Message not found, cleanup skipped.", storage_deleted: false, db_deleted: false }, correlationId);
    }

    mainMessageStoragePath = message.storage_path;
    mediaGroupId = message.media_group_id;

    // --- Cascade Deletion for Media Group ---
    if (cascade && mediaGroupId) {
      console.log(`[${correlationId}] Starting cascade deletion for media group ${mediaGroupId}`);
      await logProcessingEvent('cascade_delete_started', mediaGroupId, correlationId, { parent_message_id: message_id });

      const { data: groupMessages, error: groupError } = await supabaseClient
        .from('messages')
        .select('id, storage_path') // Select needed fields
        .eq('media_group_id', mediaGroupId)
        .neq('id', message_id); // Exclude the main message

      if (groupError) {
        // Log error but continue, main message deletion is primary goal
        console.error(`[${correlationId}] Error fetching group messages for ${mediaGroupId}:`, groupError.message);
        await logProcessingEvent('cascade_delete_failed', mediaGroupId, correlationId, { stage: 'fetch_group' }, groupError.message);
      } else if (groupMessages && groupMessages.length > 0) {
        console.log(`[${correlationId}] Found ${groupMessages.length} other messages in group ${mediaGroupId}.`);
        for (const groupMsg of groupMessages) {
          let groupStorageDeleted = false;
          let groupDbDeleted = false;
          let groupErrorMsg: string | null = null;
          try {
            // Delete storage file
            if (groupMsg.storage_path) {
              await deleteFromStorage(groupMsg.storage_path, correlationId, groupMsg.id);
              groupStorageDeleted = true; // Assumes deleteFromStorage throws on error
            }
            // Delete DB record
            const { error: deleteDbError } = await supabaseClient
              .from('messages')
              .delete()
              .eq('id', groupMsg.id);
            if (deleteDbError) throw new Error(`DB delete error: ${deleteDbError.message}`);
            groupDbDeleted = true;
            await logProcessingEvent('cascade_message_deleted', groupMsg.id, correlationId, { parent_message_id: message_id, media_group_id: mediaGroupId });
          } catch (groupMsgError: unknown) {
            groupErrorMsg = groupMsgError instanceof Error ? groupMsgError.message : String(groupMsgError);
            console.error(`[${correlationId}] Error processing group message ${groupMsg.id}:`, groupErrorMsg);
            // Log specific error for this message
            await logProcessingEvent('cascade_message_failed', groupMsg.id, correlationId, { parent_message_id: message_id, media_group_id: mediaGroupId }, groupErrorMsg);
          } finally {
            mediaGroupResults.push({
              id: groupMsg.id,
              storage_deleted: groupStorageDeleted,
              database_deleted: groupDbDeleted,
              error: groupErrorMsg
            });
          }
        }
        await logProcessingEvent('cascade_delete_finished', mediaGroupId, correlationId, { parent_message_id: message_id, results_count: mediaGroupResults.length });
      } else {
         console.log(`[${correlationId}] No other messages found in group ${mediaGroupId}.`);
         await logProcessingEvent('cascade_delete_skipped', mediaGroupId, correlationId, { parent_message_id: message_id, reason: 'no_other_messages'});
      }
    }

    // --- Delete Main Message Storage File ---
    if (mainMessageStoragePath) {
      try {
        await deleteFromStorage(mainMessageStoragePath, correlationId, message_id);
        mainStorageDeleted = true; // Assumes deleteFromStorage throws on error
      } catch (storageError: unknown) {
         // Log the error but proceed to delete the DB record
         console.error(`[${correlationId}] Failed to delete main storage file ${mainMessageStoragePath}:`, storageError instanceof Error ? storageError.message : String(storageError));
         // Error already logged within deleteFromStorage
      }
    } else {
        console.log(`[${correlationId}] No storage path for main message ${message_id}, skipping storage deletion.`);
        await logProcessingEvent('storage_cleanup_skipped', message_id, correlationId, { reason: 'no_storage_path' });
    }

    // --- Delete Main Message DB Record ---
    const { error: deleteMainDbError } = await supabaseClient
      .from('messages')
      .delete()
      .eq('id', message_id);

    if (deleteMainDbError) {
      // Log and throw, as this is a critical failure
      await logProcessingEvent('storage_cleanup_failed', message_id, correlationId, { stage: 'delete_main_db' }, deleteMainDbError.message);
      throw new Error(`Database error deleting main message: ${deleteMainDbError.message}`);
    }
    mainDbDeleted = true;
    await logProcessingEvent('storage_cleanup_completed', message_id, correlationId, { main_storage_deleted: mainStorageDeleted, cascade_results_count: mediaGroupResults.length });

    // --- Success Response ---
    return createSuccessResponse({
        success: true,
        message: "Cleanup completed.",
        storage_deleted: mainStorageDeleted,
        database_deleted: mainDbDeleted,
        media_group_results: cascade && mediaGroupId ? mediaGroupResults : null, // Only include if cascade was attempted
      }, correlationId);

  } catch (error: unknown) {
    // Catch errors thrown from steps above
    const errorMessage = error instanceof Error ? error.message : "Unknown error during cleanup";
    // Avoid double logging if already logged
    if (!errorMessage.includes('error:')) {
        console.error(`[${correlationId}] Top-level error during cleanup for message ${message_id}: ${errorMessage}`);
        // Log here if not already logged by specific steps
        await logProcessingEvent('storage_cleanup_failed', message_id || 'unknown', correlationId, { stage: 'top_level' }, errorMessage);
    }
    throw error; // Re-throw for unifiedHandler
  }
}

// Create and configure the handler
const handler = createHandler(handleCleanupStorage)
  .withMethods(['POST'])
  .withSecurity(SecurityLevel.AUTHENTICATED) // Cleanup should require auth
  .build();

// Serve the handler
serve(handler);

console.log("cleanup-storage-on-delete function deployed and listening.");
