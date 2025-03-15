
import { useState, useCallback } from 'react';
import { Message } from '@/types/entities/Message';
import { useToast } from '@/hooks/useToast';
import {
  fixContentDisposition,
  reuploadMediaFromTelegram,
  standardizeStoragePaths,
  fixMediaUrls,
  repairMediaBatch,
  processMessage,
  reanalyzeMessageCaption,
  RepairResult
} from '@/lib/mediaOperations';

/**
 * Unified hook for all media operations
 */
export function useMediaUtils() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingMessageIds, setProcessingMessageIds] = useState<Record<string, boolean>>({});
  const { toast } = useToast();

  // Add a message ID to the processing state
  const addProcessingMessageId = useCallback((id: string) => {
    setProcessingMessageIds(prev => ({ ...prev, [id]: true }));
  }, []);

  // Remove a message ID from the processing state
  const removeProcessingMessageId = useCallback((id: string) => {
    setProcessingMessageIds(prev => {
      const updated = { ...prev };
      delete updated[id];
      return updated;
    });
  }, []);

  // Fix content disposition for a single message with UI feedback
  const fixContentDispositionForMessage = useCallback(async (messageId: string): Promise<RepairResult> => {
    try {
      addProcessingMessageId(messageId);
      
      const result = await fixContentDisposition(messageId);
      
      if (result.success) {
        toast({
          title: 'Content Disposition Fixed',
          description: 'File metadata has been updated successfully.',
        });
      } else {
        toast({
          title: 'Error',
          description: result.message || 'Failed to fix content disposition. Please try again.',
          variant: 'destructive',
        });
      }
      
      return result;
    } finally {
      removeProcessingMessageId(messageId);
    }
  }, [addProcessingMessageId, removeProcessingMessageId, toast]);

  // Reupload media from Telegram with UI feedback
  const reuploadMedia = useCallback(async (messageId: string): Promise<RepairResult> => {
    try {
      addProcessingMessageId(messageId);
      
      const result = await reuploadMediaFromTelegram(messageId);
      
      if (result.success) {
        toast({
          title: 'Media Reuploaded',
          description: 'File has been successfully reuploaded from Telegram.',
        });
      } else {
        toast({
          title: 'Error',
          description: result.message || 'Failed to reupload media. Please try again.',
          variant: 'destructive',
        });
      }
      
      return result;
    } finally {
      removeProcessingMessageId(messageId);
    }
  }, [addProcessingMessageId, removeProcessingMessageId, toast]);

  // Standardize storage paths with UI feedback
  const standardizePaths = useCallback(async (limit: number = 100): Promise<RepairResult> => {
    try {
      setIsProcessing(true);
      
      const result = await standardizeStoragePaths(limit);
      
      if (result.success) {
        toast({
          title: 'Storage Paths Standardized',
          description: `Successfully standardized paths for ${result.successful || 0} files.`,
        });
      } else {
        toast({
          title: 'Error',
          description: result.message || 'Failed to standardize storage paths. Please try again.',
          variant: 'destructive',
        });
      }
      
      return result;
    } finally {
      setIsProcessing(false);
    }
  }, [toast]);
  
  // Fix media URLs with UI feedback
  const fixUrls = useCallback(async (limit: number = 100): Promise<RepairResult> => {
    try {
      setIsProcessing(true);
      
      const result = await fixMediaUrls(limit);
      
      if (result.success) {
        toast({
          title: 'Media URLs Fixed',
          description: `Successfully fixed ${result.successful || 0} media URLs.`,
        });
      } else {
        toast({
          title: 'Error',
          description: result.message || 'Failed to fix media URLs. Please try again.',
          variant: 'destructive',
        });
      }
      
      return result;
    } finally {
      setIsProcessing(false);
    }
  }, [toast]);
  
  // Repair multiple messages with UI feedback
  const repairMessages = useCallback(async (messageIds: string[]): Promise<RepairResult> => {
    try {
      setIsProcessing(true);
      
      // Mark all messages as processing
      messageIds.forEach(id => addProcessingMessageId(id));
      
      const result = await repairMediaBatch(messageIds);
      
      if (result.success && result.successful && result.successful > 0) {
        toast({
          title: 'Media Repair Completed',
          description: `Successfully repaired ${result.successful} of ${messageIds.length} files.`,
        });
      } else {
        toast({
          title: 'Media Repair Failed',
          description: result.message || 'Could not repair any files. Please try again.',
          variant: 'destructive',
        });
      }
      
      return result;
    } finally {
      // Clear processing state
      messageIds.forEach(id => removeProcessingMessageId(id));
      setIsProcessing(false);
    }
  }, [addProcessingMessageId, removeProcessingMessageId, toast]);

  // Process a message with UI feedback
  const processMessageWithFeedback = useCallback(async (messageId: string): Promise<RepairResult> => {
    try {
      addProcessingMessageId(messageId);
      
      const result = await processMessage(messageId);
      
      if (result.success) {
        toast({
          title: "Message Processed",
          description: result.message || "Message has been processed successfully."
        });
      } else {
        toast({
          title: "Processing Failed",
          description: result.message || "Failed to process message",
          variant: "destructive"
        });
      }
      
      return result;
    } finally {
      removeProcessingMessageId(messageId);
    }
  }, [addProcessingMessageId, removeProcessingMessageId, toast]);

  // Reanalyze message caption with UI feedback
  const reanalyzeCaption = useCallback(async (message: Message): Promise<RepairResult> => {
    try {
      addProcessingMessageId(message.id);
      
      const result = await reanalyzeMessageCaption(message);
      
      if (result.success) {
        toast({
          title: "Analysis Complete",
          description: result.message || "The message has been analyzed successfully."
        });
      } else {
        toast({
          title: "Analysis Failed",
          description: result.message || "Failed to analyze message",
          variant: "destructive"
        });
      }
      
      return result;
    } finally {
      removeProcessingMessageId(message.id);
    }
  }, [addProcessingMessageId, removeProcessingMessageId, toast]);

  return {
    // Processing state
    isProcessing,
    processingMessageIds,
    
    // Single message operations
    fixContentDispositionForMessage,
    reuploadMediaFromTelegram: reuploadMedia,
    processMessage: processMessageWithFeedback,
    reanalyzeMessageCaption: reanalyzeCaption,
    
    // Batch operations
    standardizeStoragePaths: standardizePaths,
    fixMediaUrls: fixUrls,
    repairMediaBatch: repairMessages,
  };
}
