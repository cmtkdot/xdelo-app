import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/useToast';
import { MediaProcessingStateActions, RepairResult } from './types';
import { withRetry } from './utils';
import { syncMediaGroup } from '@/lib/mediaGroupSync';

/**
 * Hook for batch media operations
 */
export function useBatchOperations(
  setIsProcessing: MediaProcessingStateActions['setIsProcessing'],
  addProcessingMessageId: MediaProcessingStateActions['addProcessingMessageId'],
  removeProcessingMessageId: MediaProcessingStateActions['removeProcessingMessageId']
) {
  const { toast } = useToast();
  
  /**
   * Standardize storage paths for multiple messages
   */
  const standardizeStoragePaths = async (messageIds?: string[]): Promise<boolean> => {
    try {
      setIsProcessing(true);
      
      // If no specific message IDs were provided, standardize all paths
      const { data, error } = await supabase.functions.invoke('media-management', {
        body: { 
          action: 'standardize-paths',
          messageIds 
        }
      });
      
      if (error) {
        console.error('Error standardizing storage paths:', error);
        toast({
          title: 'Operation Failed',
          description: error.message,
          variant: 'destructive',
        });
        return false;
      }
      
      toast({
        title: 'Paths Standardized',
        description: data.message || `Processed ${data.count || 0} messages`,
      });
      
      return true;
    } catch (err) {
      console.error('Error in standardizeStoragePaths:', err);
      toast({
        title: 'Operation Error',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
      return false;
    } finally {
      setIsProcessing(false);
    }
  };
  
  /**
   * Fix media URLs for multiple messages
   */
  const fixMediaUrls = async (messageIds?: string[]): Promise<boolean> => {
    try {
      setIsProcessing(true);
      
      const { data, error } = await supabase.functions.invoke('media-management', {
        body: { 
          action: 'fix-urls',
          messageIds 
        }
      });
      
      if (error) {
        console.error('Error fixing media URLs:', error);
        toast({
          title: 'Operation Failed',
          description: error.message,
          variant: 'destructive',
        });
        return false;
      }
      
      toast({
        title: 'Media URLs Fixed',
        description: data.message || `Fixed URLs for ${data.count || 0} messages`,
      });
      
      return true;
    } catch (err) {
      console.error('Error in fixMediaUrls:', err);
      toast({
        title: 'Operation Error',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
      return false;
    } finally {
      setIsProcessing(false);
    }
  };
  
  /**
   * Repair media batch issues
   */
  const repairMediaBatch = async (limit = 10): Promise<RepairResult> => {
    try {
      setIsProcessing(true);
      
      // Get media groups that need repair
      const result = await withRetry(
        () => supabase.functions.invoke('media-management', {
          body: { 
            action: 'repair-media-groups',
            limit
          }
        }),
        { maxAttempts: 3, delay: 1000 }
      );
      
      if (result.error) {
        throw new Error(result.error.message);
      }
      
      const repairResult: RepairResult = result.data;
      
      if (repairResult.success) {
        toast({
          title: 'Repair Completed',
          description: repairResult.message || `Repaired ${repairResult.repaired} media groups`,
        });
      } else {
        toast({
          title: 'Repair Issues',
          description: repairResult.error || 'Problems occurred during repair',
          variant: 'destructive',
        });
      }
      
      return repairResult;
    } catch (err) {
      console.error('Error in repairMediaBatch:', err);
      toast({
        title: 'Repair Error',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
      
      return {
        success: false,
        repaired: 0,
        error: err instanceof Error ? err.message : 'Unknown error'
      };
    } finally {
      setIsProcessing(false);
    }
  };
  
  /**
   * Process all pending messages
   */
  const processAllPendingMessages = async (): Promise<boolean> => {
    try {
      setIsProcessing(true);
      
      const { data: pendingMessages, error: fetchError } = await supabase
        .from('messages')
        .select('id, media_group_id')
        .eq('processing_state', 'pending')
        .limit(50);
      
      if (fetchError) {
        throw new Error(`Failed to fetch pending messages: ${fetchError.message}`);
      }
      
      if (!pendingMessages || pendingMessages.length === 0) {
        toast({
          title: 'No Pending Messages',
          description: 'No messages found that need processing',
        });
        return true;
      }
      
      // Process each message
      const results = [];
      let successCount = 0;
      
      for (const message of pendingMessages) {
        try {
          addProcessingMessageId(message.id);
          
          // For media group messages, try to sync from existing content
          if (message.media_group_id) {
            const result = await syncMediaGroup(message.media_group_id);
            if (result.success) {
              successCount++;
            }
            results.push(result);
          } else {
            // For non-media group messages, trigger caption analysis
            const { data, error } = await supabase.rpc('xdelo_process_caption_workflow', {
              p_message_id: message.id,
              p_correlation_id: crypto.randomUUID(),
              p_force: true
            });
            
            if (error) {
              results.push({
                message_id: message.id,
                success: false,
                error: error.message
              });
            } else {
              successCount++;
              results.push({
                message_id: message.id,
                success: true,
                result: data
              });
            }
          }
        } catch (err) {
          results.push({
            message_id: message.id,
            success: false,
            error: err instanceof Error ? err.message : String(err)
          });
        } finally {
          removeProcessingMessageId(message.id);
        }
      }
      
      toast({
        title: 'Processing Completed',
        description: `Successfully processed ${successCount} of ${pendingMessages.length} messages`,
        variant: successCount === pendingMessages.length ? 'default' : 'destructive',
      });
      
      return successCount > 0;
    } catch (err) {
      console.error('Error in processAllPendingMessages:', err);
      toast({
        title: 'Processing Error',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
      return false;
    } finally {
      setIsProcessing(false);
    }
  };
  
  return {
    standardizeStoragePaths,
    fixMediaUrls,
    repairMediaBatch,
    processAllPendingMessages
  };
}
