
import { useState, useCallback } from 'react';
import type { MessageData } from '../components/Messages/types';
import { supabase } from '@/integrations/supabase/client';
import { analyzedContentToJson } from '@/types';

interface ProcessingState {
  [key: string]: {
    isProcessing: boolean;
    error?: string;
  };
}

export function useMessageProcessing() {
  const [processingState, setProcessingState] = useState<ProcessingState>({});

  const updateProcessingState = useCallback((messageId: string, isProcessing: boolean, error?: string) => {
    setProcessingState(prev => ({
      ...prev,
      [messageId]: { isProcessing, error }
    }));
  }, []);

  const retryAnalysis = useCallback(async (message: MessageData) => {
    if (processingState[message.id]?.isProcessing) return;
    
    updateProcessingState(message.id, true);
    
    try {
      // First update message state to pending
      const { error: updateError } = await supabase
        .from('messages')
        .update({
          processing_state: 'pending',
          error_message: null,
          retry_count: (message.retry_count || 0) + 1,
          processing_started_at: new Date().toISOString(),
          processing_correlation_id: crypto.randomUUID()
        })
        .eq('id', message.id);

      if (updateError) throw updateError;

      // Trigger reanalysis
      const { error: invokeError } = await supabase.functions.invoke('parse-caption-with-ai', {
        body: { 
          messageId: message.id,
          media_group_id: message.media_group_id,
          caption: message.caption
        }
      });

      if (invokeError) throw invokeError;

      updateProcessingState(message.id, false);
    } catch (error) {
      console.error('Error retrying analysis:', error);
      
      // Update error state in database
      await supabase
        .from('messages')
        .update({
          processing_state: 'error',
          error_message: error.message,
          processing_completed_at: new Date().toISOString(),
          last_error_at: new Date().toISOString()
        })
        .eq('id', message.id);

      updateProcessingState(message.id, false, error.message);
    }
  }, [processingState, updateProcessingState]);

  const syncMediaGroup = useCallback(async (message: MessageData) => {
    if (!message.media_group_id || processingState[message.id]?.isProcessing) return;
    
    updateProcessingState(message.id, true);
    
    try {
      // Using direct SQL function call instead of RPC
      const { error: syncError } = await supabase.from('messages')
        .update({
          group_caption_synced: true,
          updated_at: new Date().toISOString()
        })
        .eq('media_group_id', message.media_group_id)
        .neq('id', message.id);

      if (syncError) throw syncError;

      // Update all messages in the group with the source message's content
      const { error: updateError } = await supabase.from('messages')
        .update({
          analyzed_content: analyzedContentToJson(message.analyzed_content || {}),
          processing_state: 'completed',
          processing_completed_at: new Date().toISOString(),
          is_original_caption: false,
          group_caption_synced: true,
          message_caption_id: message.id,
          updated_at: new Date().toISOString()
        })
        .eq('media_group_id', message.media_group_id)
        .neq('id', message.id);

      if (updateError) throw updateError;

      updateProcessingState(message.id, false);
    } catch (error) {
      console.error('Error syncing media group:', error);
      updateProcessingState(message.id, false, error.message);
      
      // Log the error
      await supabase.from('message_state_logs').insert({
        message_id: message.id,
        previous_state: 'completed',
        new_state: 'error',
        changed_at: new Date().toISOString(),
        error_message: error.message
      });
    }
  }, [processingState, updateProcessingState]);

  return {
    processing: Object.fromEntries(
      Object.entries(processingState).map(([id, state]) => [id, state.isProcessing])
    ),
    errors: Object.fromEntries(
      Object.entries(processingState).map(([id, state]) => [id, state.error])
    ),
    retryAnalysis,
    syncMediaGroup
  };
} 
