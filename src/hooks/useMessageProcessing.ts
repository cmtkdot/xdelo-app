
import { useState, useCallback } from 'react';
import { Message, ProcessingState } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { logMessageOperation } from '@/lib/syncLogger';
import { useToast } from '@/hooks/useToast';

interface MessageProcessingState {
  isProcessing: boolean;
  error?: string;
}

/**
 * Hook for handling message processing operations
 * Provides functions for reanalyzing messages and saving captions
 * with standardized logging and error handling
 */
export function useMessageProcessing() {
  const [processingState, setProcessingState] = useState<Record<string, MessageProcessingState>>({});
  const { toast } = useToast();

  const updateProcessingState = useCallback((messageId: string, isProcessing: boolean, error?: string) => {
    setProcessingState(prev => ({
      ...prev,
      [messageId]: { isProcessing, error }
    }));
  }, []);

  /**
   * Updates a message's processing state in the database
   */
  const updateMessageState = useCallback(async (
    messageId: string, 
    state: ProcessingState, 
    additionalFields: Partial<Message> = {}
  ) => {
    const { error } = await supabase
      .from('messages')
      .update({
        processing_state: state,
        ...additionalFields,
      })
      .eq('id', messageId);
    
    return { error };
  }, []);

  /**
   * Triggers reanalysis of a message's caption
   */
  const handleReanalyze = useCallback(async (message: Message) => {
    if (processingState[message.id]?.isProcessing) return;
    
    const correlationId = crypto.randomUUID();
    updateProcessingState(message.id, true);
    
    try {
      // Log the operation start
      await logMessageOperation('analyze', message.id, {
        correlationId,
        operation: 'reanalyze_started',
        messageType: message.mime_type || 'unknown',
        hasCaption: !!message.caption,
        mediaGroupId: message.media_group_id
      });

      // First update message state to pending
      const { error: updateError } = await updateMessageState(message.id, 'pending' as ProcessingState, {
        error_message: null,
        retry_count: (message.retry_count || 0) + 1,
        processing_started_at: new Date().toISOString(),
        processing_correlation_id: correlationId
      });

      if (updateError) throw updateError;

      // Call the Edge Function directly instead of using RPC
      const { data: invokeData, error: invokeError } = await supabase.functions.invoke('create-analyze-message-caption', {
        body: {
          messageId: message.id,
          correlationId,
          caption: message.caption,
          mediaGroupId: message.media_group_id
        }
      });

      if (invokeError) throw invokeError;

      // Log successful operation
      await logMessageOperation('analyze', message.id, {
        correlationId,
        operation: 'reanalyze_requested',
        success: true,
        result: invokeData
      });

      toast({
        title: "Analysis requested",
        description: "Message has been submitted for analysis",
      });

      updateProcessingState(message.id, false);
    } catch (error) {
      console.error('Error retrying analysis:', error);
      
      // Update message with error state
      await updateMessageState(message.id, 'error' as ProcessingState, {
        error_message: error.message,
        processing_completed_at: new Date().toISOString(),
        last_error_at: new Date().toISOString()
      });

      // Log error
      await logMessageOperation('analyze', message.id, {
        correlationId,
        operation: 'reanalyze_failed',
        error: error.message
      });

      toast({
        title: "Analysis failed",
        description: error.message,
        variant: "destructive",
      });

      updateProcessingState(message.id, false, error.message);
    }
  }, [processingState, updateProcessingState, updateMessageState, toast]);

  /**
   * Saves a new caption for a message and triggers reanalysis
   */
  const handleSave = useCallback(async (message: Message, caption: string) => {
    if (processingState[message.id]?.isProcessing) return;
    
    const correlationId = crypto.randomUUID();
    updateProcessingState(message.id, true);
    
    try {
      // Log operation start
      await logMessageOperation('update', message.id, {
        correlationId,
        operation: 'save_caption_started',
        previousCaption: message.caption,
        newCaption: caption
      });

      // Update the caption directly in the database
      const { error } = await updateMessageState(message.id, 'pending' as ProcessingState, {
        caption
      });

      if (error) throw error;
      
      // Trigger reanalysis with the new caption
      await handleReanalyze({
        ...message,
        caption // Update with new caption
      });
      
      // Log successful operation
      await logMessageOperation('update', message.id, {
        correlationId,
        operation: 'save_caption_completed',
        success: true
      });

      toast({
        title: "Caption saved",
        description: "Caption has been updated and analysis triggered",
      });
      
      updateProcessingState(message.id, false);
    } catch (error) {
      console.error('Error saving caption:', error);
      
      // Log error
      await logMessageOperation('update', message.id, {
        correlationId,
        operation: 'save_caption_failed',
        error: error.message
      });

      toast({
        title: "Save failed",
        description: error.message,
        variant: "destructive",
      });
      
      updateProcessingState(message.id, false, error.message);
    }
  }, [processingState, updateProcessingState, handleReanalyze, updateMessageState, toast]);

  /**
   * Checks if a file needs redownload and attempts to redownload if necessary
   */
  const checkAndRedownloadFile = useCallback(async (message: Message) => {
    if (processingState[message.id]?.isProcessing) return;
    
    const correlationId = crypto.randomUUID();
    updateProcessingState(message.id, true);
    
    try {
      // Log operation start
      await logMessageOperation('analyze', message.id, {
        correlationId,
        operation: 'redownload_check_started',
        file_unique_id: message.file_unique_id
      });

      // Call the function to check file existence
      const { data: checkResult, error: checkError } = await supabase.functions.invoke('redownload-missing-files', {
        body: {
          messageIds: [message.id],
          limit: 1
        }
      });

      if (checkError) throw checkError;

      // Log result
      await logMessageOperation('analyze', message.id, {
        correlationId,
        operation: 'redownload_check_completed',
        result: checkResult
      });

      toast({
        title: checkResult.successful > 0 ? "File redownloaded" : "File check completed",
        description: checkResult.successful > 0 
          ? "Missing file was successfully redownloaded" 
          : checkResult.failed > 0 
            ? "Failed to redownload file, please try again later" 
            : "File already exists and is accessible",
        variant: checkResult.failed > 0 ? "destructive" : "default"
      });
      
      updateProcessingState(message.id, false);
      
      return checkResult;
    } catch (error) {
      console.error('Error checking/redownloading file:', error);
      
      // Log error
      await logMessageOperation('analyze', message.id, {
        correlationId,
        operation: 'redownload_check_failed',
        error: error.message
      });

      toast({
        title: "File check failed",
        description: error.message,
        variant: "destructive",
      });
      
      updateProcessingState(message.id, false, error.message);
      return { success: false, error: error.message };
    }
  }, [processingState, updateProcessingState, toast]);

  return {
    handleReanalyze,
    handleSave,
    checkAndRedownloadFile,
    isProcessing: Object.fromEntries(
      Object.entries(processingState).map(([id, state]) => [id, state.isProcessing])
    ),
    errors: Object.fromEntries(
      Object.entries(processingState).map(([id, state]) => [id, state.error])
    )
  };
}
