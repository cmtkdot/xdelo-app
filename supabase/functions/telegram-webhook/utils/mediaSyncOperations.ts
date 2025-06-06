/**
 * mediaSyncOperations.ts
 * 
 * Database operations for syncing media group captions using PostgreSQL functions.
 * This provides a more efficient approach to caption synchronization compared to
 * the previous TypeScript-based implementation.
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { Database } from "../../_shared/types.ts";
import { logWithCorrelation } from "./logger.ts";
import { ProcessingState } from "./dbOperations.ts";

// Define Json type that was missing
type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

// Define DbOperationResult interface
export interface DbOperationResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  errorCode?: string;
}

// Import the logProcessingEvent function directly since it's not properly exported
async function logProcessingEvent(supabaseClient: any, event_type: string, entity_id: string, correlation_id: string, metadata: any = {}, error?: string): Promise<void> {
  try {
    await supabaseClient.from('unified_audit_logs').insert({
      event_type,
      entity_id,
      correlation_id,
      metadata,
      error_message: error,
      event_timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error(`Failed to log processing event: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Input parameters for syncing media group captions using the database function.
 * This replaces the old TypeScript-based approach with a more efficient PostgreSQL function.
 */
export interface SyncMediaGroupCaptionsParams {
  /** Initialized Supabase client */
  supabaseClient: SupabaseClient;
  /** Media group ID to sync */
  mediaGroupId: string;
  /** Message ID to exclude from updates (usually the one that triggered the update) */
  excludeMessageId: string;
  /** New caption text to apply to all messages */
  caption: string | null;
  /** New parsed caption data to apply to all messages */
  captionData: Json | null;
  /** New processing state for updated messages */
  processingState?: ProcessingState;
  /** Correlation ID for request tracking */
  correlationId: string;
}

/**
 * Syncs caption and analyzed content across all messages in a media group using a database function.
 * This is more efficient than the previous TypeScript-based approach as it:
 * 1. Requires only a single database call
 * 2. Ensures atomicity and consistency at the database level
 * 3. Properly handles analyzed_content archiving
 * 4. Maintains edit history and timestamp records
 *
 * @param params - Parameters for the sync operation
 * @returns Operation result with array of updated message IDs
 * @example
 * const result = await syncMediaGroupCaptionsDb({
 *   supabaseClient,
 *   mediaGroupId: "AAB123XYZ",
 *   excludeMessageId: "550e8400-e29b-41d4-a716-446655440000",
 *   caption: "Updated caption for all media",
 *   captionData: { parsed: { tags: ["travel", "nature"] } },
 *   processingState: "pending_analysis",
 *   correlationId: "corr-123"
 * });
 *
 * if (result.success) {
 *   console.log(`Updated ${result.data.length} related media messages`);
 * } else {
 *   console.error(`Failed to sync media group: ${result.error}`);
 * }
 */
export async function syncMediaGroupCaptionsDb(
  params: SyncMediaGroupCaptionsParams
): Promise<DbOperationResult<string[]>> {
  const { 
    supabaseClient, 
    mediaGroupId, 
    excludeMessageId, 
    caption, 
    captionData, 
    processingState = 'pending_analysis',
    correlationId 
  } = params;
  const functionName = 'syncMediaGroupCaptionsDb';

  logWithCorrelation(
    correlationId,
    `Syncing captions for media group ${mediaGroupId} using database function`,
    'info',
    functionName
  );

  try {
    // Call the database function that handles the syncing
    const { data, error } = await supabaseClient
      .rpc('sync_media_group_captions', {
        p_media_group_id: mediaGroupId,
        p_exclude_message_id: excludeMessageId,
        p_caption: caption,
        p_caption_data: captionData,
        p_processing_state: processingState
      });

    if (error) {
      logWithCorrelation(
        correlationId,
        `Failed to sync media group captions: ${error.message}`,
        'error',
        functionName
      );
      return {
        success: false,
        error: error.message,
        errorCode: error.code
      };
    }

    // Log success details
    const updatedCount = Array.isArray(data) ? data.length : 0;
    logWithCorrelation(
      correlationId,
      `Successfully synced captions for ${updatedCount} messages in media group ${mediaGroupId}`,
      'info',
      functionName
    );

    // Log the operation to audit logs
    await logProcessingEvent(
      supabaseClient,
      'media_group_captions_synced',
      excludeMessageId,
      correlationId,
      {
        media_group_id: mediaGroupId,
        caption_updated: caption !== null,
        updated_message_count: updatedCount,
        processing_state: processingState
      }
    );

    return {
      success: true,
      data: data || []
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logWithCorrelation(
      correlationId,
      `Exception syncing media group captions: ${errorMessage}`,
      'error',
      functionName
    );
    return {
      success: false,
      error: errorMessage
    };
  }
}
