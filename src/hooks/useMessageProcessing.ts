
import { useState, useCallback } from 'react';
import { Message } from '@/types';
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
    state: string, 
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
      const { error: updateError } = await updateMessageState(message.id, 'pending', {
        error_message: null,
        retry_count: (message.retry_count || 0) + 1,
        processing_started_at: new Date().toISOString(),
        processing_correlation_id: correlationId,
        // Preserve existing storage path and public URL to prevent deletion
        storage_path: message.storage_path,
        public_url: message.public_url
      });

      if (updateError) throw updateError;

      // Trigger reanalysis directly with database function to avoid cross-db reference error
      const { data: invokeData, error: invokeError } = await supabase.rpc('xdelo_analyze_message_caption', {
        p_message_id: message.id,
        p_correlation_id: correlationId,
        p_caption: message.caption,
        p_media_group_id: message.media_group_id
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
      await updateMessageState(message.id, 'error', {
        error_message: error.message,
        processing_completed_at: new Date().toISOString(),
        last_error_at: new Date().toISOString(),
        // Preserve existing storage path and public URL to prevent deletion
        storage_path: message.storage_path,
        public_url: message.public_url
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
      const { error } = await updateMessageState(message.id, 'pending', {
        caption,
        // Preserve existing storage path and public URL to prevent deletion
        storage_path: message.storage_path,
        public_url: message.public_url
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

  return {
    handleReanalyze,
    handleSave,
    isProcessing: Object.fromEntries(
      Object.entries(processingState).map(([id, state]) => [id, state.isProcessing])
    ),
    errors: Object.fromEntries(
      Object.entries(processingState).map(([id, state]) => [id, state.error])
    )
  };
}
