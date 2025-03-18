
import { supabase } from "@/integrations/supabase/client";

/**
 * Type for API responses
 */
interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  correlationId?: string;
}

/**
 * Execute a function call with error handling and consistent response format
 */
async function invokeFunctionWrapper<T = any>(
  functionName: string, 
  payload: any, 
  options?: {
    method?: 'POST' | 'GET' | 'PUT' | 'DELETE';
    headers?: Record<string, string>;
  }
): Promise<ApiResponse<T>> {
  try {
    // Generate a correlation ID for tracking
    const correlationId = crypto.randomUUID();
    
    // Set up the request
    const { data, error } = await supabase.functions.invoke(functionName, {
      method: options?.method || 'POST',
      body: payload,
      headers: {
        'X-Correlation-ID': correlationId,
        ...options?.headers
      }
    });
    
    if (error) {
      console.error(`Error invoking ${functionName}:`, error);
      return { 
        success: false, 
        error: error.message || `Error calling ${functionName}`,
        correlationId
      };
    }
    
    return { 
      success: true, 
      data: data as T,
      correlationId
    };
  } catch (error: any) {
    console.error(`Exception invoking ${functionName}:`, error);
    return { 
      success: false, 
      error: error.message || "An unexpected error occurred",
      correlationId: crypto.randomUUID()
    };
  }
}

/**
 * Redownload a file from its media group
 */
export async function xdelo_redownloadMediaFile(messageId: string, mediaGroupId?: string) {
  return invokeFunctionWrapper('redownload-from-media-group', { 
    messageId,
    mediaGroupId
  });
}

/**
 * Log an operation to the unified audit system
 */
export async function logOperation(
  eventType: string,
  entityId: string,
  metadata: Record<string, any> = {},
  previousState?: Record<string, any>,
  newState?: Record<string, any>,
  errorMessage?: string
) {
  return invokeFunctionWrapper('log-operation', {
    eventType,
    entityId,
    metadata,
    previousState,
    newState,
    errorMessage,
    correlationId: crypto.randomUUID()
  });
}

/**
 * Repair a file in storage
 */
export async function repairFile(messageId: string, options: {
  forceRedownload?: boolean;
  updateMimeType?: boolean;
  standardizePath?: boolean;
}) {
  return invokeFunctionWrapper('xdelo_file_repair', {
    messageId,
    ...options
  });
}

/**
 * Process a message caption with AI
 */
export async function analyzeWithAI(messageId: string, caption: string) {
  return invokeFunctionWrapper('analyze-with-ai', {
    messageId,
    caption
  });
}

/**
 * Manually parse a caption
 */
export async function parseCaption(messageId: string, caption?: string, isEdit = false) {
  return invokeFunctionWrapper('manual-caption-parser', {
    messageId,
    caption,
    isEdit,
    trigger_source: 'web_ui'
  });
}

/**
 * Sync a media group's content
 */
export async function syncMediaGroup(mediaGroupId: string, sourceMessageId: string) {
  return invokeFunctionWrapper('xdelo_sync_media_group', {
    mediaGroupId,
    sourceMessageId,
    forceSync: true
  });
}

/**
 * Delete a message and its associated media files
 */
export async function deleteMessage(messageId: string, cascade = true) {
  return invokeFunctionWrapper('cleanup-storage-on-delete', {
    message_id: messageId,
    cascade
  });
}

/**
 * Validate storage files
 */
export async function validateStorageFiles(options: {
  messageIds?: string[];
  limit?: number;
  fixMissingFiles?: boolean;
}) {
  return invokeFunctionWrapper('validate-storage-files', options);
}

/**
 * Standardize storage paths
 */
export async function standardizeStoragePaths(options: {
  limit?: number;
  dryRun?: boolean;
}) {
  return invokeFunctionWrapper('xdelo_standardize_storage_paths', options);
}

/**
 * Fix content disposition
 */
export async function fixContentDisposition(messageId: string) {
  return invokeFunctionWrapper('xdelo_fix_content_disposition', {
    messageId
  });
}

/**
 * Fix media URLs
 */
export async function fixMediaUrls(options: {
  limit?: number;
  fixMissingPublicUrls?: boolean;
  regenerateUrls?: boolean;
}) {
  return invokeFunctionWrapper('xdelo_fix_media_urls', options);
}

/**
 * Reprocess a message
 */
export async function reprocessMessage(messageId: string, options: {
  forceRedownload?: boolean;
  reanalyzeCaption?: boolean;
}) {
  return invokeFunctionWrapper('xdelo_reprocess_message', {
    messageId,
    ...options
  });
}
