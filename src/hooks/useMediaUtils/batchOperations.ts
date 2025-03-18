
import { supabase } from "@/integrations/supabase/client";
import { Message } from "@/types/MessagesTypes";
import { RepairResult, SyncCaptionResult, StandardizeResult } from "./types";
import { toast } from "sonner";

export const useBatchOperations = (
  setIsProcessing: (isProcessing: boolean) => void,
  addProcessingMessageId: (id: string) => void,
  removeProcessingMessageId: (id: string) => void
) => {
  /**
   * Check for missing files in storage
   */
  const checkMissingFiles = async (): Promise<RepairResult> => {
    try {
      setIsProcessing(true);
      
      const { data: result, error } = await supabase.functions.invoke('xdelo_check_files', {
        body: { limit: 100 }
      });
      
      if (error) throw error;
      
      toast.success(`Found ${result.missing_count} missing files`);
      
      return {
        success: true,
        message: `Found ${result.missing_count} missing files`,
        data: result
      };
    } catch (error) {
      console.error('Error checking missing files:', error);
      toast.error('Failed to check missing files');
      return {
        success: false,
        error: error.message || 'Unknown error occurred'
      };
    } finally {
      setIsProcessing(false);
    }
  };

  /**
   * Fix all content dispositions for files
   */
  const fixAllContentDispositions = async (): Promise<RepairResult> => {
    try {
      setIsProcessing(true);
      
      const { data: result, error } = await supabase.functions.invoke('xdelo_fix_all_dispositions', {
        body: { limit: 50 }
      });
      
      if (error) throw error;
      
      toast.success(`Fixed ${result.fixed_count} file dispositions`);
      
      return {
        success: true,
        message: `Fixed ${result.fixed_count} file dispositions`,
        data: result
      };
    } catch (error) {
      console.error('Error fixing all content dispositions:', error);
      toast.error('Failed to fix content dispositions');
      return {
        success: false,
        error: error.message || 'Unknown error occurred'
      };
    } finally {
      setIsProcessing(false);
    }
  };

  /**
   * Process all pending messages
   */
  const processAllPendingMessages = async (): Promise<RepairResult> => {
    try {
      setIsProcessing(true);
      
      const { data: result, error } = await supabase.functions.invoke('xdelo_process_pending', {
        body: { limit: 50 }
      });
      
      if (error) throw error;
      
      toast.success(`Processed ${result.processed_count} pending messages`);
      
      return {
        success: true,
        message: `Processed ${result.processed_count} pending messages`,
        data: result
      };
    } catch (error) {
      console.error('Error processing pending messages:', error);
      toast.error('Failed to process pending messages');
      return {
        success: false,
        error: error.message || 'Unknown error occurred'
      };
    } finally {
      setIsProcessing(false);
    }
  };

  /**
   * Reanalyze all captions
   */
  const reanalyzeAllCaptions = async (): Promise<RepairResult> => {
    try {
      setIsProcessing(true);
      
      const { data: result, error } = await supabase.functions.invoke('xdelo_reanalyze_all', {
        body: { limit: 50 }
      });
      
      if (error) throw error;
      
      toast.success(`Reanalyzed ${result.processed_count} captions`);
      
      return {
        success: true,
        message: `Reanalyzed ${result.processed_count} captions`,
        data: result
      };
    } catch (error) {
      console.error('Error reanalyzing captions:', error);
      toast.error('Failed to reanalyze captions');
      return {
        success: false,
        error: error.message || 'Unknown error occurred'
      };
    } finally {
      setIsProcessing(false);
    }
  };

  /**
   * Standardize storage paths for all media
   */
  const standardizeStoragePaths = async (limit: number = 100): Promise<StandardizeResult> => {
    try {
      setIsProcessing(true);
      
      const { data, error } = await supabase.functions.invoke('xdelo_standardize_storage_paths', {
        body: { limit }
      });
      
      if (error) throw error;
      
      toast.success(`Standardized ${data.successful} storage paths`);
      
      return {
        success: true,
        message: `Standardized ${data.successful} storage paths`,
        successful: data.successful,
        failed: data.failed
      };
    } catch (error) {
      console.error('Error standardizing storage paths:', error);
      toast.error('Failed to standardize storage paths');
      return {
        success: false,
        error: error.message || 'Unknown error occurred'
      };
    } finally {
      setIsProcessing(false);
    }
  };

  /**
   * Fix media URLs for all media
   */
  const fixMediaUrls = async (limit: number = 100): Promise<RepairResult> => {
    try {
      setIsProcessing(true);
      
      const { data, error } = await supabase.functions.invoke('xdelo_fix_media_urls', {
        body: { limit }
      });
      
      if (error) throw error;
      
      toast.success(`Fixed ${data.fixed_count} media URLs`);
      
      return {
        success: true,
        message: `Fixed ${data.fixed_count} media URLs`,
        data
      };
    } catch (error) {
      console.error('Error fixing media URLs:', error);
      toast.error('Failed to fix media URLs');
      return {
        success: false,
        error: error.message || 'Unknown error occurred'
      };
    } finally {
      setIsProcessing(false);
    }
  };

  /**
   * Repair a batch of media files
   */
  const repairMediaBatch = async (messageIds: string[]): Promise<RepairResult> => {
    if (!messageIds.length) {
      return {
        success: false,
        error: "No messages selected"
      };
    }

    try {
      setIsProcessing(true);
      
      // Mark all messages as processing
      messageIds.forEach(id => addProcessingMessageId(id));
      
      const { data, error } = await supabase.functions.invoke('xdelo_repair_media_batch', {
        body: { messageIds }
      });
      
      if (error) throw error;
      
      toast.success(`Repaired ${data.successful} of ${messageIds.length} media files`);
      
      return {
        success: true,
        message: `Repaired ${data.successful} of ${messageIds.length} media files`,
        successful: data.successful,
        failed: data.failed
      };
    } catch (error) {
      console.error('Error repairing media batch:', error);
      toast.error('Failed to repair media batch');
      return {
        success: false,
        error: error.message || 'Unknown error occurred'
      };
    } finally {
      // Remove all message IDs from processing state
      messageIds.forEach(id => removeProcessingMessageId(id));
      setIsProcessing(false);
    }
  };

  return {
    standardizeStoragePaths,
    fixMediaUrls,
    repairMediaBatch,
    processAllPendingMessages,
    checkMissingFiles,
    fixAllContentDispositions,
    reanalyzeAllCaptions
  };
};
