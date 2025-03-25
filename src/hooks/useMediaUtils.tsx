import { useState, useCallback } from 'react';
import { Message } from '@/types/entities/Message';
import { useToast } from '@/hooks/useToast';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { LogEventType, logEvent } from '@/lib/logUtils';

/**
 * Result type for media operations
 */
export interface RepairResult {
  success: boolean;
  message?: string;
  successful?: number;
  failed?: number;
  error?: string;
  data?: any;
}

/**
 * A consolidated hook for media operations with improved organization
 */
export function useMediaUtils() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingMessageIds, setProcessingMessageIds] = useState<Record<string, boolean>>({});
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // --- State Management Helpers ---

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

  // --- Core Media Operations ---

  /**
   * Process a message to extract and analyze its content
   */
  const processMessage = useCallback(async (messageId: string): Promise<RepairResult> => {
    try {
      addProcessingMessageId(messageId);
      
      // Call the edge function to process the message
      const { data, error } = await supabase.functions.invoke('xdelo_process_message', {
        body: { messageId }
      });
      
      if (error) {
        throw new Error(error.message || 'Failed to process message');
      }
      
      if (data?.success) {
        toast({
          title: "Message Processed",
          description: data.message || "Message has been processed successfully."
        });
        
        // Refresh data
        queryClient.invalidateQueries({ queryKey: ['messages'] });
        
        return {
          success: true,
          message: data.message,
          data
        };
      } else {
        throw new Error(data?.message || 'Processing failed');
      }
    } catch (error) {
      console.error('Error processing message:', error);
      
      toast({
        title: "Processing Failed",
        description: error.message || "Failed to process message",
        variant: "destructive"
      });
      
      return {
        success: false,
        message: error.message || 'Unknown error'
      };
    } finally {
      removeProcessingMessageId(messageId);
    }
  }, [addProcessingMessageId, removeProcessingMessageId, queryClient, toast]);

  /**
   * Reupload media from Telegram for a specific message
   */
  const reuploadMediaFromTelegram = useCallback(async (messageId: string): Promise<RepairResult> => {
    try {
      addProcessingMessageId(messageId);
      
      // Call the edge function to reupload media
      const { data, error } = await supabase.functions.invoke('xdelo_reupload_media', {
        body: { messageId }
      });
      
      if (error) {
        throw new Error(error.message || 'Failed to reupload media');
      }
      
      // Refresh the data
      queryClient.invalidateQueries({ queryKey: ['messages'] });
      
      if (data?.success) {
        toast({
          title: 'Media Reuploaded',
          description: 'File has been successfully reuploaded from Telegram.',
        });
        return data;
      } else {
        throw new Error(data?.message || 'Reupload failed');
      }
    } catch (error) {
      console.error('Error reuploading media:', error);
      
      toast({
        title: 'Error',
        description: error.message || 'Failed to reupload media. Please try again.',
        variant: 'destructive',
      });
      
      return { 
        success: false, 
        message: error.message || 'Unknown error occurred'
      };
    } finally {
      removeProcessingMessageId(messageId);
    }
  }, [addProcessingMessageId, removeProcessingMessageId, queryClient, toast]);

  /**
   * Fix content disposition for a single message
   */
  const fixContentDispositionForMessage = useCallback(async (messageId: string): Promise<RepairResult> => {
    try {
      addProcessingMessageId(messageId);
      
      // Call the edge function to fix content disposition
      const { data, error } = await supabase.functions.invoke('xdelo_fix_content_disposition', {
        body: { messageId }
      });
      
      if (error) {
        throw new Error(error.message || 'Failed to fix content disposition');
      }
      
      // Refresh the data
      queryClient.invalidateQueries({ queryKey: ['messages'] });
      
      if (data?.success) {
        toast({
          title: 'Content Disposition Fixed',
          description: 'File metadata has been updated successfully.',
        });
        return data;
      } else {
        throw new Error(data?.message || 'Failed to fix content disposition');
      }
    } catch (error) {
      console.error('Error fixing content disposition:', error);
      
      toast({
        title: 'Error',
        description: error.message || 'Failed to fix content disposition. Please try again.',
        variant: 'destructive',
      });
      
      return {
        success: false,
        message: error.message || 'Unknown error occurred'
      };
    } finally {
      removeProcessingMessageId(messageId);
    }
  }, [addProcessingMessageId, removeProcessingMessageId, queryClient, toast]);

  /**
   * Reanalyze a message caption
   */
  const reanalyzeMessageCaption = useCallback(async (message: Message): Promise<RepairResult> => {
    try {
      addProcessingMessageId(message.id);
      
      // Call the edge function to reanalyze caption
      const { data, error } = await supabase.functions.invoke('xdelo_analyze_caption', {
        body: { 
          messageId: message.id,
          caption: message.caption
        }
      });
      
      if (error) {
        throw new Error(error.message || 'Failed to analyze caption');
      }
      
      // Refresh the data
      queryClient.invalidateQueries({ queryKey: ['messages'] });
      
      if (data?.success) {
        toast({
          title: "Analysis Complete",
          description: data.message || "The message has been analyzed successfully."
        });
        return data;
      } else {
        throw new Error(data?.message || 'Analysis failed');
      }
    } catch (error) {
      console.error('Error analyzing caption:', error);
      
      toast({
        title: "Analysis Failed",
        description: error.message || "Failed to analyze message",
        variant: "destructive"
      });
      
      return {
        success: false,
        message: error.message || 'Unknown error occurred'
      };
    } finally {
      removeProcessingMessageId(message.id);
    }
  }, [addProcessingMessageId, removeProcessingMessageId, queryClient, toast]);

  /**
   * Sync caption across all messages in a media group
   */
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

  // --- Batch Operations ---

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
  }, [queryClient, toast]);
  
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
  }, [queryClient, toast]);
  
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
  }, [addProcessingMessageId, removeProcessingMessageId, queryClient, toast]);

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
  }, [queryClient, toast]);

  const logSyncCompletion = async (entityId: string, details: any) => {
    try {
      await logEvent(
        LogEventType.SYNC_COMPLETED,
        entityId,
        {
          ...details,
          timestamp: new Date().toISOString()
        }
      );
    } catch (error) {
      console.error("Failed to log sync completion:", error);
    }
  };

  return {
    // State
    isProcessing,
    processingMessageIds,
    
    // Single message operations
    fixContentDispositionForMessage,
    reuploadMediaFromTelegram,
    processMessage,
    reanalyzeMessageCaption,
    syncMessageCaption,
    
    // Batch operations
    standardizeStoragePaths,
    fixMediaUrls,
    repairMediaBatch,
    processAllPendingMessages,
  };
}
