
import { useCallback } from 'react';
import { useToast } from '@/hooks/useToast';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { RepairResult } from './types';

/**
 * Hook for batch media operations
 */
export function useBatchOperations(
  setIsProcessing: (value: boolean) => void,
  addProcessingMessageId: (id: string) => void,
  removeProcessingMessageId: (id: string) => void
) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  /**
   * Standardize storage paths for media files
   */
  const standardizeStoragePaths = useCallback(async (limit: number = 100): Promise<RepairResult> => {
    try {
      setIsProcessing(true);
      
      // Call the edge function to standardize storage paths
      const { data, error } = await supabase.functions.invoke('xdelo_standardize_storage_paths', {
        body: { limit }
      });
      
      if (error) {
        throw new Error(error.message || 'Failed to standardize storage paths');
      }
      
      // Refresh the data
      queryClient.invalidateQueries({ queryKey: ['messages'] });
      
      if (data?.success) {
        toast({
          title: 'Storage Paths Standardized',
          description: `Successfully standardized paths for ${data.successful || 0} files.`,
        });
        return data;
      } else {
        throw new Error(data?.message || 'Failed to standardize storage paths');
      }
    } catch (error) {
      console.error('Error standardizing storage paths:', error);
      
      toast({
        title: 'Error',
        description: error.message || 'Failed to standardize storage paths. Please try again.',
        variant: 'destructive',
      });
      
      return {
        success: false,
        message: error.message || 'Unknown error occurred'
      };
    } finally {
      setIsProcessing(false);
    }
  }, [queryClient, setIsProcessing, toast]);
  
  /**
   * Fix media URLs for storage files
   */
  const fixMediaUrls = useCallback(async (limit: number = 100): Promise<RepairResult> => {
    try {
      setIsProcessing(true);
      
      // Call the edge function to fix media URLs
      const { data, error } = await supabase.functions.invoke('xdelo_fix_media_urls', {
        body: { limit }
      });
      
      if (error) {
        throw new Error(error.message || 'Failed to fix media URLs');
      }
      
      // Refresh the data
      queryClient.invalidateQueries({ queryKey: ['messages'] });
      
      if (data?.success) {
        toast({
          title: 'Media URLs Fixed',
          description: `Successfully fixed ${data.successful || 0} media URLs.`,
        });
        return data;
      } else {
        throw new Error(data?.message || 'Failed to fix media URLs');
      }
    } catch (error) {
      console.error('Error fixing media URLs:', error);
      
      toast({
        title: 'Error',
        description: error.message || 'Failed to fix media URLs. Please try again.',
        variant: 'destructive',
      });
      
      return {
        success: false,
        message: error.message || 'Unknown error occurred'
      };
    } finally {
      setIsProcessing(false);
    }
  }, [queryClient, setIsProcessing, toast]);
  
  /**
   * Repair a batch of media files
   */
  const repairMediaBatch = useCallback(async (messageIds: string[]): Promise<RepairResult> => {
    try {
      setIsProcessing(true);
      
      // Mark all messages as processing
      messageIds.forEach(id => addProcessingMessageId(id));
      
      // Call the edge function to repair media batch
      const { data, error } = await supabase.functions.invoke('xdelo_repair_media_batch', {
        body: { messageIds }
      });
      
      if (error) {
        throw new Error(error.message || 'Failed to repair media batch');
      }
      
      // Refresh the data
      queryClient.invalidateQueries({ queryKey: ['messages'] });
      
      if (data?.success) {
        toast({
          title: 'Media Repair Completed',
          description: `Successfully repaired ${data.successful} of ${messageIds.length} files.`,
        });
        return data;
      } else {
        throw new Error(data?.message || 'Failed to repair media batch');
      }
    } catch (error) {
      console.error('Error repairing media batch:', error);
      
      toast({
        title: 'Media Repair Failed',
        description: error.message || 'Could not repair any files. Please try again.',
        variant: 'destructive',
      });
      
      return {
        success: false,
        message: error.message || 'Unknown error occurred'
      };
    } finally {
      // Clear processing state
      messageIds.forEach(id => removeProcessingMessageId(id));
      setIsProcessing(false);
    }
  }, [addProcessingMessageId, removeProcessingMessageId, queryClient, setIsProcessing, toast]);

  /**
   * Process all pending messages
   */
  const processAllPendingMessages = useCallback(async (): Promise<RepairResult> => {
    try {
      setIsProcessing(true);
      
      // Call the edge function to process all pending messages
      const { data, error } = await supabase.functions.invoke('xdelo_process_pending_messages', {
        body: { limit: 100 }
      });
      
      if (error) {
        throw new Error(error.message || 'Failed to process pending messages');
      }
      
      // Refresh the data
      queryClient.invalidateQueries({ queryKey: ['messages'] });
      
      if (data?.success) {
        toast({
          title: "Processing Complete",
          description: `Processed ${data.successful || 0} of ${data.total || 0} messages successfully.`
        });
        
        return {
          success: true,
          message: `Processed ${data.successful || 0} of ${data.total || 0} messages`,
          successful: data.successful,
          failed: data.failed
        };
      } else if (data?.message === "No pending messages found") {
        toast({
          title: "No Pending Messages",
          description: "There are no pending messages to process."
        });
        
        return {
          success: true,
          message: "No pending messages found"
        };
      } else {
        throw new Error(data?.message || 'Processing failed');
      }
    } catch (error) {
      console.error("Error processing pending messages:", error);
      
      toast({
        title: "Processing Failed",
        description: error.message || "Failed to process pending messages",
        variant: "destructive"
      });
      
      return {
        success: false,
        message: error.message || "Unknown error during batch processing"
      };
    } finally {
      setIsProcessing(false);
    }
  }, [queryClient, setIsProcessing, toast]);

  return {
    standardizeStoragePaths,
    fixMediaUrls,
    repairMediaBatch,
    processAllPendingMessages
  };
}
