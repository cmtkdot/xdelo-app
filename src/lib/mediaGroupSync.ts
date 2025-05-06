
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/useToast";

interface SyncResult {
  success: boolean;
  updated_count?: number;
  message?: string;
  error?: string;
}

/**
 * Syncs captions and metadata within a media group
 * @param mediaGroupId The media group ID to sync
 * @param sourceMessageId The message ID to use as the source of truth
 * @returns A promise that resolves to the result of the sync operation
 */
export async function syncMediaGroup(mediaGroupId: string, sourceMessageId: string): Promise<SyncResult> {
  if (!mediaGroupId || !sourceMessageId) {
    console.error("Media group ID and source message ID are required");
    return { 
      success: false, 
      error: "Media group ID and source message ID are required"
    };
  }

  try {
    // Use edge function instead of direct RPC
    const { data, error } = await supabase.functions.invoke('sync-media-group', {
      body: {
        mediaGroupId,
        sourceMessageId
      }
    });

    if (error) {
      console.error("Error syncing media group:", error);
      return { 
        success: false,
        error: error.message
      };
    }

    // Type cast the result to SyncResult or create a default response
    return data as SyncResult || { 
      success: true, 
      message: "Media group synced successfully" 
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error("Exception during media group sync:", errorMessage);
    return {
      success: false,
      error: errorMessage
    };
  }
}

/**
 * Sync all media group captions
 * @returns A promise that resolves to the result of the operation
 */
export async function syncAllMediaGroups(): Promise<SyncResult> {
  try {
    const { data, error } = await supabase.functions.invoke('sync-all-media-groups');

    if (error) {
      console.error("Error syncing all media groups:", error);
      return {
        success: false,
        error: error.message
      };
    }

    // Type cast the result to SyncResult
    return data as SyncResult || { 
      success: true, 
      message: "All media groups synced successfully" 
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error("Exception during syncing all media groups:", errorMessage);
    return {
      success: false,
      error: errorMessage
    };
  }
}

/**
 * Shows a toast notification with the result of a sync operation
 * @param result The result of the sync operation
 */
export function showSyncResult(result: SyncResult): void {
  // Using imported useToast hook
  const { toast } = useToast();

  if (result.success) {
    const updatedCount = result.updated_count || 0;
    toast({
      title: "Sync Successful",
      description: result.message || `Updated ${updatedCount} messages`,
      variant: "default"
    });
  } else {
    toast({
      title: "Sync Failed",
      description: result.error || "An unknown error occurred",
      variant: "destructive"
    });
  }
}
