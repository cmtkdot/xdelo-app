import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface BatchOperationOptions {
  onProgress?: (progress: number) => void;
  onComplete?: () => void;
  onError?: (error: string) => void;
  batchSize?: number;
}

interface RepairResult {
  success: boolean;
  successCount: number;
  failureCount: number;
  errors: Record<string, string>;
  messages: string[];
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
