
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { LogEventType } from '@/types/api/LogEventType';
import logUtils from '@/lib/logUtils';
import { RepairResult } from './types';

export function useBatchOperations(
  setIsProcessing: (value: boolean) => void,
  addProcessingMessageId: (id: string) => void,
  removeProcessingMessageId: (id: string) => void
) {
  const [isRepairing, setIsRepairing] = useState(false);

  /**
   * Standardize storage paths for multiple messages
   */
  const standardizeStoragePaths = async (
    messageIds: string[]
  ): Promise<{ success: boolean; standardizedCount: number; error?: string }> => {
    if (!messageIds.length) return { success: true, standardizedCount: 0 };
    
    try {
      setIsProcessing(true);
      
      // Call the repair media edge function
      const { data, error } = await supabase.functions.invoke('repair-media', {
        body: {
          action: 'standardize_paths',
          messageIds
        }
      });
      
      if (error) {
        throw new Error(`Failed to standardize paths: ${error.message}`);
      }
      
      // Log the repair operation
      await logUtils.logEvent(
        LogEventType.MEDIA_REPAIR_COMPLETED,
        'batch',
        {
          operation: 'standardize_storage_paths',
          messageCount: messageIds.length,
          standardizedCount: data.standardizedCount
        }
      );
      
      return {
        success: true,
        standardizedCount: data.standardizedCount
      };
    } catch (error) {
      console.error('Error standardizing storage paths:', error);
      
      // Log the error
      await logUtils.logEvent(
        LogEventType.MEDIA_REPAIR_FAILED,
        'batch',
        {
          operation: 'standardize_storage_paths',
          messageCount: messageIds.length,
          error: error.message
        }
      );
      
      return {
        success: false,
        standardizedCount: 0,
        error: error.message
      };
    } finally {
      setIsProcessing(false);
    }
  };

  /**
   * Fix public URLs for media files
   */
  const fixMediaUrls = async (
    messageIds: string[]
  ): Promise<{ success: boolean; fixedCount: number; error?: string }> => {
    if (!messageIds.length) return { success: true, fixedCount: 0 };
    
    try {
      setIsProcessing(true);
      
      // Mark all messages as processing
      messageIds.forEach(id => addProcessingMessageId(id));
      
      // Call the repair media edge function
      const { data, error } = await supabase.functions.invoke('repair-media', {
        body: {
          action: 'fix_public_urls',
          messageIds
        }
      });
      
      if (error) {
        throw new Error(`Failed to fix media URLs: ${error.message}`);
      }
      
      // Log the repair operation
      await logUtils.logEvent(
        LogEventType.MEDIA_REPAIR_COMPLETED,
        'batch',
        {
          operation: 'fix_media_urls',
          messageCount: messageIds.length,
          fixedCount: data.fixedCount
        }
      );
      
      return {
        success: true,
        fixedCount: data.fixedCount
      };
    } catch (error) {
      console.error('Error fixing media URLs:', error);
      
      // Log the error
      await logUtils.logEvent(
        LogEventType.MEDIA_REPAIR_FAILED,
        'batch',
        {
          operation: 'fix_media_urls',
          messageCount: messageIds.length,
          error: error.message
        }
      );
      
      return {
        success: false,
        fixedCount: 0,
        error: error.message
      };
    } finally {
      // Remove all messages from processing state
      messageIds.forEach(id => removeProcessingMessageId(id));
      setIsProcessing(false);
    }
  };

  /**
   * Fully repair a batch of messages 
   */
  const repairMediaBatch = async (
    messageIds: string[],
    options: {
      redownload?: boolean;
      force?: boolean;
    } = {}
  ): Promise<RepairResult> => {
    if (!messageIds.length) {
      return { 
        success: true, 
        processedCount: 0,
        successCount: 0,
        failedCount: 0,
        skippedCount: 0
      };
    }
    
    try {
      setIsRepairing(true);
      setIsProcessing(true);
      
      // Mark all messages as processing
      messageIds.forEach(id => addProcessingMessageId(id));
      
      // Call the repair media edge function
      const { data, error } = await supabase.functions.invoke('repair-media', {
        body: {
          action: 'repair_batch',
          messageIds,
          redownload: options.redownload || false,
          force: options.force || false
        }
      });
      
      if (error) {
        throw new Error(`Failed to repair media batch: ${error.message}`);
      }
      
      // Log the repair operation
      await logUtils.logEvent(
        LogEventType.MEDIA_REPAIR_COMPLETED,
        'batch',
        {
          operation: 'repair_media_batch',
          messageCount: messageIds.length,
          successCount: data.successCount,
          failedCount: data.failedCount,
          skippedCount: data.skippedCount,
          redownload: options.redownload,
          force: options.force
        }
      );
      
      return {
        success: true,
        processedCount: data.processedCount,
        successCount: data.successCount,
        failedCount: data.failedCount,
        skippedCount: data.skippedCount,
        results: data.results
      };
    } catch (error) {
      console.error('Error repairing media batch:', error);
      
      // Log the error
      await logUtils.logEvent(
        LogEventType.MEDIA_REPAIR_FAILED,
        'batch',
        {
          operation: 'repair_media_batch',
          messageCount: messageIds.length,
          error: error.message,
          redownload: options.redownload,
          force: options.force
        }
      );
      
      return {
        success: false,
        processedCount: 0,
        successCount: 0,
        failedCount: messageIds.length,
        skippedCount: 0,
        error: error.message
      };
    } finally {
      // Remove all messages from processing state
      messageIds.forEach(id => removeProcessingMessageId(id));
      setIsRepairing(false);
      setIsProcessing(false);
    }
  };

  /**
   * Process all pending messages, including media sync
   */
  const processAllPendingMessages = async (): Promise<{
    success: boolean;
    processedCount: number;
    error?: string;
  }> => {
    try {
      setIsProcessing(true);
      
      // Call the process-pending edge function
      const { data, error } = await supabase.functions.invoke('process-pending', {
        body: {
          action: 'process_all',
          syncMediaGroups: true,
          batchSize: 50
        }
      });
      
      if (error) {
        throw new Error(`Failed to process pending messages: ${error.message}`);
      }
      
      // Log the batch processing
      await logUtils.logEvent(
        LogEventType.BATCH_OPERATION,
        'system',
        {
          operation: 'process_all_pending',
          processedCount: data.processedCount,
          successCount: data.successCount,
          failedCount: data.failedCount
        }
      );
      
      return {
        success: true,
        processedCount: data.processedCount
      };
    } catch (error) {
      console.error('Error processing pending messages:', error);
      
      // Log the error
      await logUtils.logEvent(
        LogEventType.SYSTEM_ERROR,
        'system',
        {
          operation: 'process_all_pending',
          error: error.message
        }
      );
      
      return {
        success: false,
        processedCount: 0,
        error: error.message
      };
    } finally {
      setIsProcessing(false);
    }
  };

  return {
    standardizeStoragePaths,
    fixMediaUrls,
    repairMediaBatch,
    processAllPendingMessages,
    isRepairing
  };
}
