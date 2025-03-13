
import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Message } from '@/types/MessagesTypes';
import { useToast } from '@/hooks/useToast';

// Define common return types for repair operations
interface RepairResult {
  success: boolean;
  successful?: number;
  failed?: number;
  errors?: string[];
  message?: string;
}

export function useMediaOperations() {
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

  // Fix content disposition for a single message
  const fixContentDispositionForMessage = useCallback(async (messageId: string): Promise<RepairResult> => {
    try {
      addProcessingMessageId(messageId);
      
      const { data, error } = await supabase.functions.invoke('xdelo_fix_content_disposition', {
        body: { messageId }
      });
      
      if (error) throw new Error(error.message);
      
      toast({
        title: 'Content Disposition Fixed',
        description: 'File metadata has been updated successfully.',
      });
      
      return { success: true, message: 'Content disposition fixed successfully' };
    } catch (error) {
      console.error('Error fixing content disposition:', error);
      
      toast({
        title: 'Error',
        description: 'Failed to fix content disposition. Please try again.',
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

  // Reupload media from Telegram
  const reuploadMediaFromTelegram = useCallback(async (messageId: string): Promise<RepairResult> => {
    try {
      addProcessingMessageId(messageId);
      
      const { data, error } = await supabase.functions.invoke('xdelo_reprocess_message', {
        body: { messageId, force: true }
      });
      
      if (error) throw new Error(error.message);
      
      toast({
        title: 'Media Reuploaded',
        description: 'File has been successfully reuploaded from Telegram.',
      });
      
      return { success: true, message: 'Media reuploaded successfully' };
    } catch (error) {
      console.error('Error reuploading media:', error);
      
      toast({
        title: 'Error',
        description: 'Failed to reupload media. Please try again.',
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

  // Standardize storage paths for multiple messages
  const standardizeStoragePaths = useCallback(async (limit: number = 100): Promise<RepairResult> => {
    try {
      setIsProcessing(true);
      
      const { data, error } = await supabase.functions.invoke('xdelo_standardize_storage_paths', {
        body: { limit }
      });
      
      if (error) throw new Error(error.message);
      
      toast({
        title: 'Storage Paths Standardized',
        description: `Successfully standardized paths for ${data?.processed || 0} files.`,
      });
      
      return { 
        success: true, 
        successful: data?.processed || 0,
        message: 'Storage paths standardized successfully'
      };
    } catch (error) {
      console.error('Error standardizing storage paths:', error);
      
      toast({
        title: 'Error',
        description: 'Failed to standardize storage paths. Please try again.',
        variant: 'destructive',
      });
      
      return { 
        success: false, 
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    } finally {
      setIsProcessing(false);
    }
  }, [toast]);
  
  // Fix media URLs
  const fixMediaUrls = useCallback(async (limit: number = 100): Promise<RepairResult> => {
    try {
      setIsProcessing(true);
      
      const { data, error } = await supabase.functions.invoke('xdelo_fix_media_urls', {
        body: { limit }
      });
      
      if (error) throw new Error(error.message);
      
      toast({
        title: 'Media URLs Fixed',
        description: `Successfully fixed ${data?.processed || 0} media URLs.`,
      });
      
      return { 
        success: true, 
        successful: data?.processed || 0,
        message: 'Media URLs fixed successfully'
      };
    } catch (error) {
      console.error('Error fixing media URLs:', error);
      
      toast({
        title: 'Error',
        description: 'Failed to fix media URLs. Please try again.',
        variant: 'destructive',
      });
      
      return { 
        success: false, 
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    } finally {
      setIsProcessing(false);
    }
  }, [toast]);
  
  // Repair a batch of media messages
  const repairMediaBatch = useCallback(async (messageIds: string[]): Promise<RepairResult> => {
    if (!messageIds.length) {
      return { 
        success: false, 
        message: 'No messages to repair'
      };
    }
    
    try {
      setIsProcessing(true);
      
      // Group messageIds into batches of 10 to avoid timeout issues
      const batchSize = 10;
      const batches = [];
      for (let i = 0; i < messageIds.length; i += batchSize) {
        batches.push(messageIds.slice(i, i + batchSize));
      }
      
      let successful = 0;
      let failed = 0;
      const errors: string[] = [];
      
      // Process each batch sequentially
      for (const batch of batches) {
        for (const messageId of batch) {
          addProcessingMessageId(messageId);
        }
        
        try {
          const { data, error } = await supabase.functions.invoke('xdelo_file_repair', {
            body: { messageIds: batch }
          });
          
          if (error) throw new Error(error.message);
          
          successful += data?.results?.successful || 0;
          failed += data?.results?.failed || 0;
          
          if (data?.results?.errors && data.results.errors.length) {
            errors.push(...data.results.errors);
          }
        } catch (error) {
          console.error(`Error processing batch:`, error);
          failed += batch.length;
          errors.push(error instanceof Error ? error.message : 'Unknown batch error');
        } finally {
          // Clear processing state for the batch
          for (const messageId of batch) {
            removeProcessingMessageId(messageId);
          }
        }
      }
      
      if (successful > 0) {
        toast({
          title: 'Media Repair Completed',
          description: `Successfully repaired ${successful} of ${messageIds.length} files.`,
          variant: failed > 0 ? 'default' : 'default',
        });
      } else {
        toast({
          title: 'Media Repair Failed',
          description: 'Could not repair any files. Please try again.',
          variant: 'destructive',
        });
      }
      
      return {
        success: successful > 0,
        successful,
        failed,
        errors,
        message: `Repaired ${successful} of ${messageIds.length} files`
      };
    } catch (error) {
      console.error('Error repairing media batch:', error);
      
      toast({
        title: 'Error',
        description: 'Failed to repair media. Please try again.',
        variant: 'destructive',
      });
      
      return { 
        success: false,
        failed: messageIds.length,
        errors: [error instanceof Error ? error.message : 'Unknown error occurred'],
        message: 'Failed to repair media batch'
      };
    } finally {
      setIsProcessing(false);
    }
  }, [addProcessingMessageId, removeProcessingMessageId, toast]);

  return {
    // State
    isProcessing,
    processingMessageIds,
    
    // Single message operations
    fixContentDispositionForMessage,
    reuploadMediaFromTelegram,
    
    // Batch operations
    standardizeStoragePaths,
    fixMediaUrls,
    repairMediaBatch,
  };
}
