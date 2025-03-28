
import { useState, useCallback } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { MediaProcessingState, MediaProcessingStateActions, MediaSyncOptions, RepairResult } from './types';
import { useToast } from '@/hooks/useToast';
import { hasValidCaption, isValidUuid } from './utils';

/**
 * Hook providing media utility functions for working with Telegram media messages
 */
export function useMediaUtils() {
  const [processingState, setProcessingState] = useState<MediaProcessingState>({
    isProcessing: false,
    processingMessageIds: {}
  });
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
      setProcessingState(prev => ({
        ...prev,
        isProcessing: true,
        processingMessageIds: { ...prev.processingMessageIds, [messageId]: true }
      }));

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
      setProcessingState(prev => ({
        ...prev,
        isProcessing: false,
        processingMessageIds: { ...prev.processingMessageIds, [messageId]: false }
      }));
    }
  }, [toast]);

  /**
   * Sync media group content from one message to others in the same group
   */
  const syncMediaGroup = useCallback(async (
    messageId: string,
    mediaGroupId: string,
    options?: MediaSyncOptions
  ): Promise<boolean> => {
    try {
      setProcessingState(prev => ({
        ...prev,
        isProcessing: true,
        processingMessageIds: { ...prev.processingMessageIds, [messageId]: true }
      }));

      const { data, error } = await supabase.rpc('xdelo_sync_media_group_content', {
        p_message_id: messageId,
        p_media_group_id: mediaGroupId,
        p_force_sync: options?.forceSync || false,
        p_sync_edit_history: options?.syncEditHistory || false
      });

      if (error) throw error;

      toast({
        title: "Media group synced",
        description: `Media group ${mediaGroupId} has been synced successfully`,
        variant: "default"
      });

      return true;
    } catch (error) {
      toast({
        title: "Media group sync failed",
        description: error instanceof Error ? error.message : String(error),
        variant: "destructive"
      });
      return false;
    } finally {
      setProcessingState(prev => ({
        ...prev,
        isProcessing: false,
        processingMessageIds: { ...prev.processingMessageIds, [messageId]: false }
      }));
    }
  }, [toast]);

  /**
   * Repair media files with missing or incorrect file information
   */
  const repairMediaFiles = useCallback(async (messageIds: string[]): Promise<RepairResult> => {
    try {
      if (!messageIds.length) {
        return {
          success: false,
          error: "No message IDs provided"
        };
      }

      setProcessingState(prev => ({
        ...prev,
        isProcessing: true
      }));

      const { data, error } = await supabase.functions.invoke('media-management', {
        body: {
          action: 'repair',
          messageIds: messageIds
        }
      });

      if (error) throw error;

      const result: RepairResult = data || {
        success: true,
        message: 'Repair operation completed',
        successful: messageIds.length,
        failed: 0,
        details: []
      };

      toast({
        title: result.success ? "Repair successful" : "Repair failed",
        description: result.message || (result.success ? "Media files repaired" : "Failed to repair media files"),
        variant: result.success ? "default" : "destructive"
      });

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      toast({
        title: "Repair failed",
        description: errorMessage,
        variant: "destructive"
      });
      
      return {
        success: false,
        error: errorMessage,
        details: [],
        successful: 0,
        failed: messageIds.length
      };
    } finally {
      setProcessingState(prev => ({
        ...prev,
        isProcessing: false
      }));
    }
  }, [toast]);

  // Group functions for state management
  const processingStateActions: MediaProcessingStateActions = {
    setIsProcessing: useCallback((isProcessing: boolean) => {
      setProcessingState(prev => ({ ...prev, isProcessing }));
    }, []),
    
    addProcessingMessageId: useCallback((messageId: string) => {
      setProcessingState(prev => ({
        ...prev,
        processingMessageIds: { ...prev.processingMessageIds, [messageId]: true }
      }));
    }, []),
    
    removeProcessingMessageId: useCallback((messageId: string) => {
      setProcessingState(prev => {
        const updatedIds = { ...prev.processingMessageIds };
        delete updatedIds[messageId];
        return {
          ...prev,
          processingMessageIds: updatedIds
        };
      });
    }, [])
  };

  return {
    // State
    processingState,
    
    // State actions
    processingStateActions,
    
    // Media operations
    resetMessage,
    syncMediaGroup,
    repairMediaFiles
  };
}
