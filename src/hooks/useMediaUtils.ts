
import { useState, useCallback } from 'react';
import { 
  fixContentDisposition, 
  fixMediaUrls, 
  standardizeStoragePaths,
  repairFile,
  repairMediaBatch as apiRepairMediaBatch
} from '@/lib/api';
import { useToast } from './useToast';
import { Message } from '@/types/MessagesTypes';

export interface RepairResult {
  success: boolean;
  message?: string;
  successful?: number;
}

export function useMediaUtils() {
  // Use a record to track processing state of multiple messages
  const [processingMessageIds, setProcessingMessageIds] = useState<Record<string, boolean>>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  // Fix content disposition for a message
  const fixContentDispositionForMessage = useCallback(async (messageId: string): Promise<RepairResult> => {
    try {
      setProcessingMessageIds(prev => ({ ...prev, [messageId]: true }));
      
      const { success, error } = await fixContentDisposition(messageId);
      
      if (!success) {
        throw new Error(error || 'Failed to fix content disposition');
      }
      
      toast({
        title: "Display Fixed",
        description: "Content display settings updated successfully."
      });
      
      return {
        success: true,
        message: "Content display settings updated"
      };
    } catch (error: any) {
      console.error('Error fixing content disposition:', error);
      
      toast({
        title: "Display Fix Failed",
        description: error.message || "Failed to update content display settings",
        variant: "destructive"
      });
      
      return {
        success: false,
        message: error.message || "Unknown error occurred"
      };
    } finally {
      setProcessingMessageIds(prev => {
        const updated = { ...prev };
        delete updated[messageId];
        return updated;
      });
    }
  }, [toast]);

  // Reupload media from Telegram
  const reuploadMediaFromTelegram = useCallback(async (messageId: string): Promise<RepairResult> => {
    try {
      setProcessingMessageIds(prev => ({ ...prev, [messageId]: true }));
      
      const { success, error } = await repairFile(messageId, {
        forceRedownload: true
      });
      
      if (!success) {
        throw new Error(error || 'Failed to reupload media');
      }
      
      toast({
        title: "Media Reuploaded",
        description: "Media file was successfully reuploaded from Telegram."
      });
      
      return {
        success: true,
        message: "Media file reuploaded"
      };
    } catch (error: any) {
      console.error('Error reuploading media:', error);
      
      toast({
        title: "Reupload Failed",
        description: error.message || "Failed to reupload media file",
        variant: "destructive"
      });
      
      return {
        success: false,
        message: error.message || "Unknown error occurred"
      };
    } finally {
      setProcessingMessageIds(prev => {
        const updated = { ...prev };
        delete updated[messageId];
        return updated;
      });
    }
  }, [toast]);

  // Fix media URLs in batch
  const fixMediaUrlsInBatch = useCallback(async (limit: number = 100): Promise<RepairResult> => {
    try {
      setIsProcessing(true);
      
      const { success, data, error } = await fixMediaUrls({
        limit,
        fixMissingPublicUrls: true
      });
      
      if (!success) {
        throw new Error(error || 'Failed to fix media URLs');
      }
      
      const fixCount = data?.fixed_count || 0;
      
      toast({
        title: "Media URLs Fixed",
        description: `Fixed ${fixCount} URLs in the database.`
      });
      
      return {
        success: true,
        successful: fixCount,
        message: `Fixed ${fixCount} URLs`
      };
    } catch (error: any) {
      console.error('Error fixing media URLs:', error);
      
      toast({
        title: "URL Fix Failed",
        description: error.message || "Failed to fix media URLs",
        variant: "destructive"
      });
      
      return {
        success: false,
        message: error.message || "Unknown error occurred"
      };
    } finally {
      setIsProcessing(false);
    }
  }, [toast]);

  // Standardize storage paths
  const standardizeStoragePathsForAll = useCallback(async (limit: number = 100): Promise<RepairResult> => {
    try {
      setIsProcessing(true);
      
      const { success, data, error } = await standardizeStoragePaths({
        limit,
        dryRun: false
      });
      
      if (!success) {
        throw new Error(error || 'Failed to standardize storage paths');
      }
      
      toast({
        title: "Storage Paths Standardized",
        description: `Updated ${data?.updated_count || 0} storage paths.`
      });
      
      return {
        success: true,
        successful: data?.updated_count || 0,
        message: `Standardized ${data?.updated_count || 0} storage paths`
      };
    } catch (error: any) {
      console.error('Error standardizing storage paths:', error);
      
      toast({
        title: "Standardization Failed",
        description: error.message || "Failed to standardize storage paths",
        variant: "destructive"
      });
      
      return {
        success: false,
        message: error.message || "Unknown error occurred"
      };
    } finally {
      setIsProcessing(false);
    }
  }, [toast]);

  // Repair a batch of media files
  const repairMediaBatch = useCallback(async (messageIds: string[]): Promise<RepairResult> => {
    try {
      if (messageIds.length === 0) {
        return {
          success: true,
          message: "No messages to repair",
          successful: 0
        };
      }
      
      // Mark all messages as processing
      setProcessingMessageIds(prev => {
        const updated = { ...prev };
        messageIds.forEach(id => {
          updated[id] = true;
        });
        return updated;
      });
      
      const { success, data, error } = await apiRepairMediaBatch(messageIds, {
        forceRedownload: false,
        fixContentDisposition: true,
        fixMimeTypes: true
      });
      
      if (!success) {
        throw new Error(error || 'Failed to repair media batch');
      }
      
      toast({
        title: "Media Repair Complete",
        description: `Repaired ${messageIds.length} media files.`
      });
      
      return {
        success: true,
        successful: messageIds.length,
        message: `Repaired ${messageIds.length} media files`
      };
    } catch (error: any) {
      console.error('Error repairing media batch:', error);
      
      toast({
        title: "Media Repair Failed",
        description: error.message || "Failed to repair media files",
        variant: "destructive"
      });
      
      return {
        success: false,
        message: error.message || "Unknown error occurred"
      };
    } finally {
      // Clear all processing states
      setProcessingMessageIds(prev => {
        const updated = { ...prev };
        messageIds.forEach(id => {
          delete updated[id];
        });
        return updated;
      });
    }
  }, [toast]);

  return {
    processingMessageIds,
    isProcessing,
    fixContentDispositionForMessage,
    reuploadMediaFromTelegram,
    fixMediaUrls: fixMediaUrlsInBatch,
    standardizeStoragePaths: standardizeStoragePathsForAll,
    repairMediaBatch
  };
}
