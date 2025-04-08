import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { RepairResult } from "./types";

interface BatchOperationOptions {
  onProgress?: (progress: number) => void;
  onComplete?: () => void;
  onError?: (error: string) => void;
  batchSize?: number;
}

/**
 * Repair storage paths for messages
 */
export async function repairMessageStoragePaths(
  messageIds: string[],
  options: BatchOperationOptions = {}
): Promise<RepairResult> {
  const { onProgress, onComplete, onError, batchSize = 10 } = options;
  let successCount = 0;
  let failureCount = 0;
  const errors: Record<string, string> = {};
  const successMessages: string[] = [];

  const totalMessages = messageIds.length;
  let processedCount = 0;

  for (let i = 0; i < messageIds.length; i += batchSize) {
    const batch = messageIds.slice(i, i + batchSize);

    try {
      const { data, error } = await supabase.functions.invoke("repair-storage-path", {
        body: { messageIds: batch },
      });

      if (error) {
        batch.forEach((id) => {
          errors[id] = error.message;
          failureCount++;
        });
        onError?.(error.message);
      } else {
        if (data && data.repaired) {
          data.repaired.forEach((messageId: string) => {
            successCount++;
            successMessages.push(`Repaired storage path for message ${messageId}`);
          });
        }
        if (data && data.errors) {
          Object.entries(data.errors).forEach(([messageId, errorMessage]) => {
            errors[messageId] = errorMessage as string;
            failureCount++;
          });
        }
      }
    } catch (e: any) {
      batch.forEach((id) => {
        errors[id] = e.message;
        failureCount++;
      });
      onError?.(e.message);
    }

    processedCount += batch.length;
    const progress = (processedCount / totalMessages) * 100;
    onProgress?.(progress);
  }

  onComplete?.();

  return {
    success: successCount > 0,
    successCount,
    failureCount,
    errors,
    messages: successMessages
  };
}

/**
 * Redownload media for messages
 */
export async function redownloadMessageMedia(
  messageIds: string[],
  options: BatchOperationOptions = {}
): Promise<RepairResult> {
  const { onProgress, onComplete, onError, batchSize = 10 } = options;
  let successCount = 0;
  let failureCount = 0;
  const errors: Record<string, string> = {};
  const successMessages: string[] = [];

  const totalMessages = messageIds.length;
  let processedCount = 0;

  for (let i = 0; i < messageIds.length; i += batchSize) {
    const batch = messageIds.slice(i, i + batchSize);

    try {
      const { data, error } = await supabase.functions.invoke("redownload-media", {
        body: { messageIds: batch },
      });

      if (error) {
        batch.forEach((id) => {
          errors[id] = error.message;
          failureCount++;
        });
        onError?.(error.message);
      } else {
        if (data && data.redownloaded) {
          data.redownloaded.forEach((messageId: string) => {
            successCount++;
            successMessages.push(`Redownloaded media for message ${messageId}`);
          });
        }
        if (data && data.errors) {
          Object.entries(data.errors).forEach(([messageId, errorMessage]) => {
            errors[messageId] = errorMessage as string;
            failureCount++;
          });
        }
      }
    } catch (e: any) {
      batch.forEach((id) => {
        errors[id] = e.message;
        failureCount++;
      });
      onError?.(e.message);
    }

    processedCount += batch.length;
    const progress = (processedCount / totalMessages) * 100;
    onProgress?.(progress);
  }

  onComplete?.();

  return {
    success: successCount > 0,
    successCount,
    failureCount,
    errors,
    messages: successMessages
  };
}

/**
 * Standardize storage paths for messages
 */
export async function standardizeStoragePaths(
  messageIds: string[],
  options: BatchOperationOptions = {}
): Promise<RepairResult> {
  const { onProgress, onComplete, onError, batchSize = 10 } = options;
  let successCount = 0;
  let failureCount = 0;
  const errors: Record<string, string> = {};
  const successMessages: string[] = [];

  const totalMessages = messageIds.length;
  let processedCount = 0;

  for (let i = 0; i < messageIds.length; i += batchSize) {
    const batch = messageIds.slice(i, i + batchSize);

    try {
      const { data, error } = await supabase.functions.invoke("standardize-storage-path", {
        body: { messageIds: batch },
      });

      if (error) {
        batch.forEach((id) => {
          errors[id] = error.message;
          failureCount++;
        });
        onError?.(error.message);
      } else {
        if (data && data.standardized) {
          data.standardized.forEach((messageId: string) => {
            successCount++;
            successMessages.push(`Standardized storage path for message ${messageId}`);
          });
        }
        if (data && data.errors) {
          Object.entries(data.errors).forEach(([messageId, errorMessage]) => {
            errors[messageId] = errorMessage as string;
            failureCount++;
          });
        }
      }
    } catch (e: any) {
      batch.forEach((id) => {
        errors[id] = e.message;
        failureCount++;
      });
      onError?.(e.message);
    }

    processedCount += batch.length;
    const progress = (processedCount / totalMessages) * 100;
    onProgress?.(progress);
  }

  onComplete?.();

  return {
    success: successCount > 0,
    successCount,
    failureCount,
    errors,
    messages: successMessages
  };
}

/**
 * Fix audit log UUIDs
 */
export async function fixAuditLogUuids() {
  try {
    const { data, error } = await supabase.rpc("xdelo_fix_audit_log_uuids");

    if (error) {
      toast.error(`Error fixing audit log UUIDs: ${error.message}`);
      return;
    }

    toast.success(`Successfully fixed ${data?.fixed_count || 0} audit log UUIDs`);
  } catch (e: any) {
    toast.error(`Error fixing audit log UUIDs: ${e.message}`);
  }
}

/**
 * Migrate telegram data to metadata
 */
export async function migrateTelegramDataToMetadata() {
  try {
    const { data, error } = await supabase.rpc("xdelo_migrate_telegram_data_to_metadata");

    if (error) {
      toast.error(`Error migrating telegram data to metadata: ${error.message}`);
      return;
    }

    toast.success(`Successfully migrated ${data?.migrated_count || 0} telegram records`);
  } catch (e: any) {
    toast.error(`Error migrating telegram data to metadata: ${e.message}`);
  }
}

/**
 * Fix media URLs across the database
 */
export async function fixMediaUrls(
  messageIds: string[],
  options: BatchOperationOptions = {}
): Promise<RepairResult> {
  const { onProgress, onComplete, onError, batchSize = 10 } = options;
  let successCount = 0;
  let failureCount = 0;
  const errors: Record<string, string> = {};
  const successMessages: string[] = [];

  try {
    const { data, error } = await supabase.functions.invoke("fix-media-urls", {
      body: { messageIds }
    });

    if (error) {
      throw error;
    }

    if (data && data.fixed) {
      successCount = data.fixed.length;
      data.fixed.forEach((messageId: string) => {
        successMessages.push(`Fixed URLs for message ${messageId}`);
      });
    }
    if (data && data.errors) {
      failureCount = Object.keys(data.errors).length;
      Object.entries(data.errors).forEach(([messageId, errorMessage]) => {
        errors[messageId] = errorMessage as string;
      });
    }

    onComplete?.();
    return {
      success: successCount > 0,
      successCount,
      failureCount,
      errors,
      messages: successMessages
    };
  } catch (e: any) {
    if (onError) onError(e.message);
    return {
      success: false,
      successCount: 0,
      failureCount: messageIds.length,
      errors: messageIds.reduce((acc, id) => ({ ...acc, [id]: e.message }), {}),
      messages: []
    };
  }
}

/**
 * Repair media batch
 */
export async function repairMediaBatch(
  messageIds: string[],
  options: BatchOperationOptions & {
    redownload?: boolean;
    validateMime?: boolean;
    standardizePath?: boolean;
    force?: boolean;
  } = {}
): Promise<RepairResult> {
  const { onProgress, onComplete, onError, batchSize = 10 } = options;

  try {
    const { data, error } = await supabase.functions.invoke("repair-media-batch", {
      body: { 
        messageIds,
        redownload: options.redownload,
        validateMime: options.validateMime,
        standardizePath: options.standardizePath,
        force: options.force
      }
    });

    if (error) {
      throw error;
    }

    onComplete?.();
    return data as RepairResult;
  } catch (e: any) {
    if (onError) onError(e.message);
    return {
      success: false,
      successCount: 0,
      failureCount: messageIds.length,
      errors: messageIds.reduce((acc, id) => ({ ...acc, [id]: e.message }), {}),
      messages: []
    };
  }
}

/**
 * Process all pending messages
 */
export async function processAllPendingMessages(
  options: { 
    limit?: number;
    onProgress?: (progress: number, total: number) => void;
  } = {}
): Promise<{ processed: number; errors: number; }> {
  try {
    const { data, error } = await supabase.functions.invoke("process-pending-messages", {
      body: { limit: options.limit || 50 }
    });

    if (error) {
      throw error;
    }

    return {
      processed: data.processed || 0,
      errors: data.errors || 0
    };
  } catch (e: any) {
    toast.error(`Failed to process pending messages: ${e.message}`);
    return {
      processed: 0,
      errors: 1
    };
  }
}
