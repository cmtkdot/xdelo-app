
import { useState, useCallback } from 'react';
import type { Message } from '@/types';
import { supabase } from '@/integrations/supabase/client';

interface ProcessingState {
  isProcessing: boolean;
  error?: string;
}

export function useMessageProcessing() {
  const [processingState, setProcessingState] = useState<Record<string, ProcessingState>>({});

  const updateProcessingState = useCallback((messageId: string, isProcessing: boolean, error?: string) => {
    setProcessingState(prev => ({
      ...prev,
      [messageId]: { isProcessing, error }
    }));
  }, []);

  const handleReanalyze = useCallback(async (message: Message) => {
    if (processingState[message.id]?.isProcessing) return;
    
    updateProcessingState(message.id, true);
    
    try {
      const correlationId = crypto.randomUUID();
      
      // First update message state to pending
      const { error: updateError } = await supabase
        .from('messages')
        .update({
          processing_state: 'pending',
          error_message: null,
          retry_count: (message.retry_count || 0) + 1,
          processing_started_at: new Date().toISOString(),
          processing_correlation_id: correlationId,
          // Preserve existing storage path and public URL to prevent deletion
          storage_path: message.storage_path,
          public_url: message.public_url
        })
        .eq('id', message.id);

      if (updateError) throw updateError;

      // Trigger reanalysis
      const { error: invokeError } = await supabase.functions.invoke('parse-caption-with-ai', {
        body: { 
          messageId: message.id,
          media_group_id: message.media_group_id,
          caption: message.caption,
          correlationId
        }
      });

      if (invokeError) throw invokeError;

      updateProcessingState(message.id, false);
    } catch (error) {
      console.error('Error retrying analysis:', error);
      
      await supabase
        .from('messages')
        .update({
          processing_state: 'error' as const,
          error_message: error.message,
          processing_completed_at: new Date().toISOString(),
          last_error_at: new Date().toISOString(),
          // Preserve existing storage path and public URL to prevent deletion
          storage_path: message.storage_path,
          public_url: message.public_url
        })
        .eq('id', message.id);

      updateProcessingState(message.id, false, error.message);
    }
  }, [processingState, updateProcessingState]);

  const handleSave = useCallback(async (message: Message, caption: string) => {
    if (processingState[message.id]?.isProcessing) return;
    
    updateProcessingState(message.id, true);
    
    try {
      const { error } = await supabase
        .from('messages')
        .update({
          caption,
          processing_state: 'pending' as const,
          // Preserve existing storage path and public URL to prevent deletion
          storage_path: message.storage_path,
          public_url: message.public_url
        })
        .eq('id', message.id);

      if (error) throw error;
      
      await handleReanalyze(message);
      
      updateProcessingState(message.id, false);
    } catch (error) {
      console.error('Error saving caption:', error);
      updateProcessingState(message.id, false, error.message);
    }
  }, [processingState, updateProcessingState, handleReanalyze]);

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
