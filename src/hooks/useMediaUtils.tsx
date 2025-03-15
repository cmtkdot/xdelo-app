
import { useState, useCallback } from 'react';
import { Message } from '@/types/entities/Message';
import { useToast } from '@/hooks/useToast';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
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
import { logEvent, LogEventType } from '@/lib/logUtils';

/**
 * Unified hook for all media operations with improved error handling
 */
export function useMediaUtils() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingMessageIds, setProcessingMessageIds] = useState<Record<string, boolean>>({});
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Helper functions for tracking processing state
  const addProcessingMessageId = useCallback((id: string) => {
    setProcessingMessageIds(prev => ({ ...prev, [id]: true }));
  }, []);

  const removeProcessingMessageId = useCallback((id: string) => {
    setProcessingMessageIds(prev => {
      const updated = { ...prev };
      delete updated[id];
      return updated;
    });
  }, []);

  // Process a message with improved error handling and retry logic
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
        const retryInfo = result.retryCount ? ` after ${result.retryCount} attempts` : '';
        
        toast({
          title: "Processing Failed",
          description: `${result.message || "Failed to process message"}${retryInfo}`,
          variant: "destructive"
        });
      }
      
      return result;
    } finally {
      removeProcessingMessageId(messageId);
    }
  }, [addProcessingMessageId, removeProcessingMessageId, toast]);

  // Reupload media from Telegram with improved error handling
  const reuploadMedia = useCallback(async (messageId: string): Promise<RepairResult> => {
    try {
      addProcessingMessageId(messageId);
      
      // First check if the message exists
      const { data: messageData, error: messageError } = await supabase
        .from('messages')
        .select('*')
        .eq('id', messageId)
        .single();
      
      if (messageError || !messageData) {
        throw new Error(`Could not find message: ${messageError?.message || 'Not found'}`);
      }
      
      // Update message state to show processing
      await supabase
        .from('messages')
        .update({
          processing_state: 'processing',
          updated_at: new Date().toISOString()
        })
        .eq('id', messageId);
      
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
    } catch (error) {
      console.error('Error reuploading media:', error);
      
      // Update message state to show error
      try {
        await supabase
          .from('messages')
          .update({
            processing_state: 'error',
            error_message: error.message || 'Reupload failed',
            updated_at: new Date().toISOString()
          })
          .eq('id', messageId);
      } catch (updateError) {
        console.error('Failed to update message error state:', updateError);
      }
      
      toast({
        title: 'Error',
        description: error.message || 'Failed to reupload media. Please try again.',
        variant: 'destructive',
      });
      
      return { 
        success: false, 
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    } finally {
      removeProcessingMessageId(messageId);
    }
  }, [addProcessingMessageId, removeProcessingMessageId, toast]);

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

  // Sync caption to all messages in the same media group
  const syncMessageCaption = useCallback(async ({ messageId }: { messageId: string }): Promise<RepairResult> => {
    try {
      addProcessingMessageId(messageId);
      
      // Get the message first
      const { data: message, error: messageError } = await supabase
        .from('messages')
        .select('*')
        .eq('id', messageId)
        .single();
      
      if (messageError || !message) {
        throw new Error(`Could not find message: ${messageError?.message || 'Not found'}`);
      }
      
      const mediaGroupId = message.media_group_id;
      
      if (!mediaGroupId) {
        return {
          success: false,
          message: "Message is not part of a media group"
        };
      }
      
      // Call the edge function to sync the media group
      const { data, error } = await supabase.functions.invoke('xdelo_sync_media_group', {
        body: { 
          message_id: messageId,
          media_group_id: mediaGroupId,
          force: true
        }
      });
      
      if (error) {
        throw new Error(`Failed to sync media group: ${error.message}`);
      }
      
      // Log the operation and refresh data
      await logEvent(
        LogEventType.SYNC_COMPLETED,
        messageId,
        {
          operation: 'caption_sync',
          media_group_id: mediaGroupId,
          result: data
        }
      );
      
      queryClient.invalidateQueries({ queryKey: ['messages'] });
      queryClient.invalidateQueries({ queryKey: ['media-groups'] });
      
      toast({
        title: "Caption Synced",
        description: "Caption has been synced to all messages in the media group"
      });
      
      return {
        success: true,
        message: "Caption synced successfully",
        data
      };
      
    } catch (error) {
      console.error("Error syncing caption:", error);
      
      toast({
        title: "Sync Failed",
        description: error.message || "Failed to sync caption to media group",
        variant: "destructive"
      });
      
      return {
        success: false,
        message: error.message || "Unknown error during caption sync"
      };
    } finally {
      removeProcessingMessageId(messageId);
    }
  }, [addProcessingMessageId, removeProcessingMessageId, queryClient, toast]);

  // Process all pending messages
  const processAllPendingMessages = useCallback(async (): Promise<RepairResult> => {
    try {
      setIsProcessing(true);
      
      // Fetch all pending messages
      const { data: pendingMessages, error: pendingMessagesError } = await supabase
        .from('messages')
        .select('id')
        .eq('processing_state', 'pending')
        .limit(100);
      
      if (pendingMessagesError) {
        throw new Error(`Failed to fetch pending messages: ${pendingMessagesError.message}`);
      }
      
      const messageIds = pendingMessages?.map(m => m.id) || [];
      
      if (messageIds.length === 0) {
        toast({
          title: "No Pending Messages",
          description: "There are no pending messages to process."
        });
        
        return {
          success: true,
          message: "No pending messages found"
        };
      }
      
      // Mark all messages as processing
      messageIds.forEach(id => addProcessingMessageId(id));
      
      // Process each message in sequence
      let successful = 0;
      let failed = 0;
      
      for (const id of messageIds) {
        try {
          const result = await processMessage(id);
          if (result.success) {
            successful++;
          } else {
            failed++;
          }
        } catch (err) {
          console.error(`Error processing message ${id}:`, err);
          failed++;
        }
      }
      
      // Log the batch processing operation
      await logEvent(
        LogEventType.BATCH_OPERATION,
        'batch_process',
        {
          operation: 'process_pending',
          total: messageIds.length,
          successful,
          failed
        }
      );
      
      queryClient.invalidateQueries({ queryKey: ['messages'] });
      
      toast({
        title: "Processing Complete",
        description: `Processed ${successful} of ${messageIds.length} messages successfully. ${failed} failed.`
      });
      
      return {
        success: true,
        message: `Processed ${successful} of ${messageIds.length} messages`,
        successful,
        failed
      };
      
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
      setProcessingMessageIds({});
    }
  }, [setIsProcessing, addProcessingMessageId, queryClient, toast]);

  return {
    // State
    isProcessing,
    processingMessageIds,
    
    // Single message operations
    fixContentDispositionForMessage,
    reuploadMediaFromTelegram: reuploadMedia,
    processMessage: processMessageWithFeedback,
    reanalyzeMessageCaption: reanalyzeCaption,
    syncMessageCaption,
    
    // Batch operations
    standardizeStoragePaths: standardizePaths,
    fixMediaUrls: fixUrls,
    repairMediaBatch: repairMessages,
    processAllPendingMessages,
  };
}
