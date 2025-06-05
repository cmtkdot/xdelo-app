import { serve } from "https://deno.land/std@0.168.0/http/server.ts"; // Keep for serve
import { logProcessingEvent } from "../_shared/auditLogger.ts"; // Import from dedicated module
import { xdelo_getExtensionFromMimeType } from "../_shared/mediaUtils.ts"; // For path repair
import { supabaseClient } from "../_shared/supabase.ts"; // Use singleton client
import {
  createHandler,
  createSuccessResponse,
  RequestMetadata,
  SecurityLevel,
} from "../_shared/unifiedHandler.ts";

// Removed local Supabase client creation

interface ValidateRequestBody {
  action?: 'validate' | 'repair';
  limit?: number;
  onlyNewest?: boolean;
}

// --- Helper Functions (Refactored) ---

async function checkFileExists(bucketName: string, filePath: string, correlationId: string): Promise<boolean> {
  const logMeta = { bucketName, filePath };
  try {
    // Attempt download - more reliable than getSignedUrl for existence check in edge functions sometimes
    const { data, error } = await supabaseClient
      .storage
      .from(bucketName)
      .download(filePath); // Using download might be heavy, consider list() if performance is an issue

    if (error) {
        // Specifically check for 'Not Found' error, others might be transient
        if (error.message.includes('Not Found') || error.message.includes('does not exist')) {
            console.log(`[${correlationId}] File not found: ${filePath}`);
            return false;
        }
        // Log other errors but potentially treat as temporary failure?
        console.warn(`[${correlationId}] Storage download check error for ${filePath}: ${error.message}`);
        // Depending on policy, maybe return true/false or throw? Let's assume false for now.
        await logProcessingEvent('storage_check_error', filePath, correlationId, logMeta, error.message);
        return false;
    }

    // If data is returned (even if null/empty for zero-byte files), it exists
    return data !== null;

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[${correlationId}] Exception checking file existence for ${filePath}:`, errorMessage);
    await logProcessingEvent('storage_check_exception', filePath, correlationId, logMeta, errorMessage);
    return false; // Assume non-existent on exception
  }
}

async function validateMessageFiles(correlationId: string, limit = 100, onlyNewest = true) {
  const action = 'validate';
  console.log(`[${correlationId}] Running action: ${action}. Limit: ${limit}, OnlyNewest: ${onlyNewest}`);
  await logProcessingEvent('validate_files_started', correlationId, correlationId, { limit, onlyNewest });

  try {
    let query = supabaseClient
      .from('messages')
      .select('id, file_unique_id, storage_path, mime_type') // Select needed fields
      .not('file_unique_id', 'is', null); // Only messages that should have files

    if (onlyNewest) {
      query = query.order('created_at', { ascending: false });
    }
    // Add filter for messages not recently checked? e.g., .lt('storage_last_validated_at', some_timestamp)

    const { data: messages, error: queryError } = await query.limit(limit);

    if (queryError) throw new Error(`Database query error: ${queryError.message}`);
    if (!messages) throw new Error("No messages found to validate.");

    console.log(`[${correlationId}] Found ${messages.length} messages to validate.`);

    const results = {
      processed: 0,
      valid: 0,
      invalid: 0,
      repaired_path: 0, // Renamed from 'repaired'
      flagged_for_redownload: 0,
      errors: 0,
      details: [] as any[] // Add type later if needed
    };

    for (const message of messages) {
      results.processed++;
      const logMeta = { messageId: message.id, file_unique_id: message.file_unique_id, storage_path: message.storage_path };
      let needsRedownload = false;
      let redownloadReason: string | null = null;

      try {
        // --- Repair missing/incorrect storage path ---
        let currentStoragePath = message.storage_path;
        if (!currentStoragePath || !currentStoragePath.startsWith(message.file_unique_id)) {
           const extension = xdelo_getExtensionFromMimeType(message.mime_type || 'application/octet-stream');
           const expectedPath = `${message.file_unique_id}.${extension}`;
           console.warn(`[${correlationId}] Message ${message.id} has missing or incorrect storage path (${currentStoragePath}). Expected: ${expectedPath}`);

           const { error: repairError } = await supabaseClient
             .from('messages')
             .update({ storage_path: expectedPath, updated_at: new Date().toISOString() })
             .eq('id', message.id);

           if (repairError) {
               console.error(`[${correlationId}] Error repairing storage path for message ${message.id}:`, repairError);
               results.details.push({ ...logMeta, status: 'repair_failed', error: repairError.message });
               results.errors++;
               await logProcessingEvent('storage_path_repair_failed', message.id, correlationId, logMeta, repairError.message);
               continue; // Skip further validation if repair failed
           } else {
               results.repaired_path++;
               currentStoragePath = expectedPath; // Use repaired path for existence check
               results.details.push({ ...logMeta, status: 'repaired_path', new_path: currentStoragePath });
               await logProcessingEvent('storage_path_repaired', message.id, correlationId, { ...logMeta, new_path: currentStoragePath });
               // Don't necessarily flag for redownload yet, check if the repaired path exists
           }
        }

        // --- Check file existence ---
        if (!currentStoragePath) {
            // Should not happen if repair logic is correct, but as safeguard
            console.error(`[${correlationId}] No storage path available for message ${message.id} after repair check.`);
            results.details.push({ ...logMeta, status: 'error', error: 'No storage path after repair check' });
            results.errors++;
            await logProcessingEvent('validate_files_error', message.id, correlationId, logMeta, 'No storage path after repair check');
            continue;
        }

        const exists = await checkFileExists('telegram-media', currentStoragePath, correlationId);

        // --- Update validation status in separate table ---
        // Consider batching these updates if performance is an issue
        await supabaseClient
          .from('storage_validations') // Ensure this table exists
          .upsert({
            file_unique_id: message.file_unique_id, // Primary key?
            storage_path: currentStoragePath,
            last_checked_at: new Date().toISOString(),
            is_valid: exists,
            error_message: exists ? null : 'File not found in storage'
          }, { onConflict: 'file_unique_id' }); // Adjust onConflict if needed

        if (exists) {
          results.valid++;
          // Only push detail if needed, maybe only for invalid/repaired?
          // results.details.push({ ...logMeta, status: 'valid' });
          await logProcessingEvent('storage_validation_ok', message.id, correlationId, logMeta);
        } else {
          results.invalid++;
          needsRedownload = true;
          redownloadReason = 'File not found in storage';
          results.details.push({ ...logMeta, status: 'invalid', flagged_for_redownload: true }); // Assume flag will succeed
          await logProcessingEvent('storage_validation_invalid', message.id, correlationId, logMeta, redownloadReason);
        }

      } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.error(`[${correlationId}] Exception validating message ${message.id}:`, errorMessage);
          results.details.push({ ...logMeta, status: 'error', error: errorMessage });
          results.errors++;
          await logProcessingEvent('validate_files_exception', message.id, correlationId, logMeta, errorMessage);
          // Optionally flag for redownload on generic error?
          // needsRedownload = true;
          // redownloadReason = `Validation exception: ${errorMessage.substring(0, 100)}`;
      }

      // --- Flag for redownload if needed ---
      if (needsRedownload) {
          const { error: flagError } = await supabaseClient
            .from('messages')
            .update({
              needs_redownload: true,
              redownload_reason: redownloadReason,
              redownload_flagged_at: new Date().toISOString(),
              // Optionally increment attempts here or let redownload handler do it
            })
            .eq('id', message.id);

          if (flagError) {
              console.error(`[${correlationId}] Error flagging message ${message.id} for redownload:`, flagError);
              // Update status in results if needed
              const detail = results.details.find(d => d.message_id === message.id);
              if (detail) detail.flagged_for_redownload = false;
              await logProcessingEvent('redownload_flag_failed', message.id, correlationId, logMeta, flagError.message);
          } else {
              results.flagged_for_redownload++;
              // Log success? Event already logged for invalid status.
          }
      }
    } // End for loop

    const summary = `Processed: ${results.processed}, Valid: ${results.valid}, Invalid: ${results.invalid}, Repaired Paths: ${results.repaired_path}, Flagged: ${results.flagged_for_redownload}, Errors: ${results.errors}`;
    console.log(`[${correlationId}] Action ${action} finished. ${summary}`);
    await logProcessingEvent('validate_files_finished', correlationId, correlationId, { summary: results });

    return { // Return structured data
        summary,
        ...results
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : `Unknown error in ${action}`;
    console.error(`[${correlationId}] Error in ${action}:`, errorMessage);
    // Log and re-throw for the main handler
    await logProcessingEvent('validate_files_error', correlationId, correlationId, {}, errorMessage);
    throw new Error(errorMessage);
  }
}

async function repairStoragePaths(correlationId: string) {
  const action = 'repair';
  console.log(`[${correlationId}] Running action: ${action}`);
  await logProcessingEvent('repair_paths_started', correlationId, correlationId);
  try {
    // Call the database function to repair storage paths
    const { data, error: rpcError } = await supabaseClient.rpc('xdelo_repair_storage_paths'); // Use singleton client

    if (rpcError) {
        console.error(`[${correlationId}] RPC xdelo_repair_storage_paths error:`, rpcError);
        await logProcessingEvent('repair_paths_failed', correlationId, correlationId, {}, rpcError.message);
        throw new Error(`RPC error: ${rpcError.message}`);
    }

    const summary = `Repaired paths for ${data?.length || 0} messages.`;
    console.log(`[${correlationId}] Action ${action} finished. ${summary}`);
    await logProcessingEvent('repair_paths_finished', correlationId, correlationId, { repairedCount: data?.length || 0 });

    return { // Return structured data
      summary,
      repaired: data?.length || 0,
      details: data // Assuming RPC returns details
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : `Unknown error in ${action}`;
    console.error(`[${correlationId}] Error in ${action}:`, errorMessage);
    // Log if not already logged by RPC error handling
    if (!errorMessage.startsWith('RPC error')) {
        await logProcessingEvent('repair_paths_exception', correlationId, correlationId, {}, errorMessage);
    }
    throw new Error(errorMessage); // Re-throw
  }
}

// --- Main Handler (Refactored) ---
async function handleValidateStorage(req: Request, metadata: RequestMetadata): Promise<Response> {
  const { correlationId } = metadata;
  console.log(`[${correlationId}] Processing validate-storage-files request`);

  let requestBody: ValidateRequestBody = {}; // Default empty object
  try {
      // Allow GET requests for simple validation or POST with body
      if (req.method === 'POST' && req.headers.get('content-type')?.includes('application/json')) {
          requestBody = await req.json();
      } else if (req.method === 'GET') {
          // Extract params from URL for GET requests if needed, e.g., /validate-storage-files?action=validate&limit=50
          const url = new URL(req.url);
          requestBody.action = url.searchParams.get('action') as 'validate' | 'repair' || 'validate';
          requestBody.limit = parseInt(url.searchParams.get('limit') || '100', 10);
          requestBody.onlyNewest = url.searchParams.get('onlyNewest') !== 'false'; // Default true
      }
  } catch (parseError: unknown) {
    const errorMessage = parseError instanceof Error ? parseError.message : "Invalid JSON body";
    console.error(`[${correlationId}] Failed to parse request body: ${errorMessage}`);
    throw new Error(`Invalid request: ${errorMessage}`);
  }

  const { action = 'validate', limit = 100, onlyNewest = true } = requestBody;

  await logProcessingEvent('storage_validation_request', action, correlationId, { action, limit, onlyNewest });

  try {
    let resultData;
    switch (action) {
      case 'validate':
        resultData = await validateMessageFiles(correlationId, limit, onlyNewest);
        break;
      case 'repair':
        resultData = await repairStoragePaths(correlationId);
        break;
      default:
        await logProcessingEvent('storage_validation_failed', action, correlationId, { reason: 'Unknown action' }, `Unknown action: ${action}`);
        throw new Error(`Unknown action: ${action}`);
    }

    await logProcessingEvent('storage_validation_completed', action, correlationId, { action, summary: resultData?.summary || 'OK' });
    return createSuccessResponse({ success: true, action, ...resultData }, correlationId);

  } catch (error: unknown) {
     const errorMessage = error instanceof Error ? error.message : "Unknown error during storage validation/repair";
     console.error(`[${correlationId}] Error during action '${action}': ${errorMessage}`);
     // Log if not already logged within helpers
     await logProcessingEvent('storage_validation_failed', action, correlationId, { action }, errorMessage);
     throw error; // Re-throw for unifiedHandler
  }
}


// --- Server Setup ---
const handler = createHandler(handleValidateStorage)
  .withMethods(['GET', 'POST']) // Allow GET for simple validation, POST for specific actions/params
  .withSecurity(SecurityLevel.AUTHENTICATED) // Assume validation/repair requires auth
  .build();

// Serve the handler
serve(handler);

console.log("validate-storage-files function deployed and listening.");
