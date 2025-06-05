
import { useState, useCallback } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { MediaProcessingState, MediaSyncOptions } from './types';
import { useToast } from '@/hooks/useToast';
import { hasValidCaption, isValidUuid, withRetry, createMediaProcessingState, syncMediaGroupWithRetry } from './utils';

/**
 * Hook providing media utility functions for working with Telegram media messages
 */
export function useMediaUtils() {
  const [mediaState, mediaActions] = createMediaProcessingState();
  const { isProcessing, processingMessageIds } = mediaState;
  const { setIsProcessing, addProcessingMessageId, removeProcessingMessageId } = mediaActions;
  
  const { toast } = useToast();

  /**
   * Reset a stuck message to be reprocessed
   */
  const resetMessage = useCallback(async (messageId: string): Promise<boolean> => {
    if (!isValidUuid(messageId)) {
      toast({
        title: "Invalid message ID",
        description: "The provided message ID is not valid",
        variant: "destructive"
      });
      return false;
    }

    try {
      addProcessingMessageId(messageId);

      const { data, error } = await supabase
        .from('messages')
        .update({
          processing_state: 'pending',
          error_message: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', messageId)
        .select();

      if (error) {
        throw error;
      }

      toast({
        title: "Message reset",
        description: "Message has been reset for processing",
        variant: "default"
      });

      return true;
    } catch (error) {
      toast({
        title: "Reset failed",
        description: error instanceof Error ? error.message : String(error),
        variant: "destructive"
      });
      return false;
    } finally {
      removeProcessingMessageId(messageId);
    }
  }, [toast, addProcessingMessageId, removeProcessingMessageId]);

  /**
   * Sync media group content from one message to others in the same group
   * with improved error handling and retry mechanism
   */
  const syncMediaGroup = useCallback(async (
    messageId: string,
    mediaGroupId: string,
    options?: MediaSyncOptions
  ): Promise<boolean> => {
    try {
      setIsProcessing(true);
      addProcessingMessageId(messageId);

      // First get the source message's analyzed content
      const { data: message, error: fetchError } = await supabase
        .from('messages')
        .select('analyzed_content')
        .eq('id', messageId)
        .single();
      
      if (fetchError || !message?.analyzed_content) {
        throw new Error(fetchError?.message || 'No analyzed content to sync');
      }
      
      // Use the retry-enabled sync function
      const syncResult = await syncMediaGroupWithRetry(
        messageId,
        mediaGroupId,
        message.analyzed_content,
        {
          forceSync: options?.forceSync !== false,
          syncEditHistory: !!options?.syncEditHistory,
          maxRetries: 3 // Limit retries to prevent excessive attempts
        }
      );
      
      if (!syncResult.success) {
        throw syncResult.error || new Error('Failed to sync media group');
      }

      // Success - display updated count if available
      const updatedCount = syncResult.result?.updated_count;
      toast({
        title: "Media group synced",
        description: `Media group ${mediaGroupId} has been synced successfully${
          updatedCount !== undefined ? ` (${updatedCount} messages updated)` : ''
        }`,
        variant: "default"
      });

      return true;
    } catch (error) {
      console.error('Error in syncMediaGroup:', error);
      toast({
        title: "Media group sync failed",
        description: error instanceof Error ? error.message : String(error),
        variant: "destructive"
      });
      return false;
    } finally {
      setIsProcessing(false);
      removeProcessingMessageId(messageId);
    }
  }, [toast, setIsProcessing, addProcessingMessageId, removeProcessingMessageId]);

  return {
    // State
    isProcessing,
    processingMessageIds,
    
    // Actions
    setIsProcessing,
    addProcessingMessageId,
    removeProcessingMessageId,
    
    // Media operations
    resetMessage,
    syncMediaGroup
  };
}
