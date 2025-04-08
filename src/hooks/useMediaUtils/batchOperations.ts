import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/useToast';
import { LogEventType } from './types';
import { RepairResult } from './types';

/**
 * Standardize storage paths for batch of media files
 */
export async function standardizeStoragePaths(
  limit: number = 100
): Promise<RepairResult> {
  try {
    console.log(`Standardizing storage paths for up to ${limit} messages`);
    
    // Call the edge function to standardize storage paths
    const { data, error } = await supabase.functions.invoke('xdelo_standardize_storage_paths', {
      body: { limit }
    });
    
    if (error) {
      throw new Error(error.message || 'Failed to standardize storage paths');
    }
    
    if (data?.success) {
      return {
        success: true,
        message: `Successfully standardized paths for ${data.successful || 0} files.`,
        successful: data.successful,
        failed: data.failed
      };
    } else {
      throw new Error(data?.message || 'Failed to standardize storage paths');
    }
  } catch (error) {
    console.error('Error standardizing storage paths:', error);
    
    return {
      success: false,
      message: error.message || 'Unknown error occurred',
      error: error.message
    };
  }
}

/**
 * Fix media URLs for storage files
 */
export async function fixMediaUrls(
  limit: number = 100
): Promise<RepairResult> {
  try {
    console.log(`Fixing media URLs for up to ${limit} messages`);
    
    // Call the edge function to fix media URLs
    const { data, error } = await supabase.functions.invoke('xdelo_fix_media_urls', {
      body: { limit }
    });
    
    if (error) {
      throw new Error(error.message || 'Failed to fix media URLs');
    }
    
    if (data?.success) {
      return {
        success: true,
        message: `Successfully fixed ${data.successful || 0} media URLs.`,
        successful: data.successful,
        failed: data.failed
      };
    } else {
      throw new Error(data?.message || 'Failed to fix media URLs');
    }
  } catch (error) {
    console.error('Error fixing media URLs:', error);
    
    return {
      success: false,
      message: error.message || 'Unknown error occurred',
      error: error.message
    };
  }
}

/**
 * Repair media batch with various fixes
 */
export async function repairMediaBatch(
  messageIds: string[]
): Promise<RepairResult> {
  try {
    console.log(`Repairing media batch for ${messageIds.length} messages`);
    
    // Call the edge function to repair media batch
    const { data, error } = await supabase.functions.invoke('xdelo_repair_media_batch', {
      body: { messageIds }
    });
    
    if (error) {
      throw new Error(error.message || 'Failed to repair media batch');
    }
    
    if (data?.success) {
      return {
        success: true,
        message: `Successfully repaired ${data.successful} of ${messageIds.length} files.`,
        successful: data.successful,
        failed: data.failed
      };
    } else {
      throw new Error(data?.message || 'Failed to repair media batch');
    }
  } catch (error) {
    console.error('Error repairing media batch:', error);
    
    return {
      success: false,
      message: error.message || 'Unknown error occurred',
      error: error.message
    };
  }
}

/**
 * Process all pending messages
 */
export async function processAllPendingMessages(
  limit: number = 50
): Promise<RepairResult> {
  try {
    console.log(`Processing up to ${limit} pending messages`);
    
    // Call the edge function to process all pending messages
    const { data, error } = await supabase.functions.invoke('xdelo_process_pending_messages', {
      body: { limit }
    });
    
    if (error) {
      throw new Error(error.message || 'Failed to process pending messages');
    }
    
    if (data?.success) {
      return {
        success: true,
        message: `Processed ${data.successful || 0} of ${data.total || 0} messages`,
        successful: data.successful,
        failed: data.failed
      };
    } else if (data?.message === "No pending messages found") {
      return {
        success: true,
        message: "No pending messages found"
      };
    } else {
      throw new Error(data?.message || 'Processing failed');
    }
  } catch (error) {
    console.error("Error processing pending messages:", error);
    
    return {
      success: false,
      message: error.message || "Unknown error during batch processing",
      error: error.message
    };
  }
}
