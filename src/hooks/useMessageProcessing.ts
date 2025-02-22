
import { useState, useCallback } from 'react';
import type { MessageData, AnalyzedContent as MessageAnalyzedContent } from '../components/Messages/types';
import { supabase } from '@/integrations/supabase/client';
import { analyzedContentToJson, AnalyzedContent as JsonAnalyzedContent } from '@/types';

interface ProcessingState {
  [key: string]: {
    isProcessing: boolean;
    error?: string;
  };
}

const convertAnalyzedContent = (content: MessageAnalyzedContent | undefined): JsonAnalyzedContent => {
  if (!content) return {};
  
  return {
    product_name: content.product_name,
    product_code: content.product_code,
    vendor_uid: content.vendor_uid,
    purchase_date: content.purchase_date,
    quantity: content.quantity,
    notes: content.notes,
    parsing_metadata: content.parsing_metadata ? {
      method: content.parsing_metadata.method === 'hybrid' ? 'ai' : content.parsing_metadata.method,
      confidence: content.parsing_metadata.confidence,
      timestamp: content.parsing_metadata.timestamp
    } : undefined,
    sync_metadata: {
      sync_source_message_id: content.sync_metadata?.sync_source_message_id,
      media_group_id: content.sync_metadata?.media_group_id
    }
  };
};

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
      const correlationId = crypto.randomUUID();
      
      // First update message state to pending
      const { error: updateError } = await supabase
        .from('messages')
        .update({
          processing_state: 'pending',
          error_message: null,
          retry_count: (message.retry_count || 0) + 1,
          processing_started_at: new Date().toISOString(),
          processing_correlation_id: correlationId
        })
        .eq('id', message.id);

      if (updateError) throw updateError;

      // Log state change in webhook_logs
      await supabase.from('webhook_logs').insert({
        event_type: 'message_state_change',
        message_id: message.id,
        metadata: {
          previous_state: message.processing_state,
          new_state: 'pending',
          retry_count: (message.retry_count || 0) + 1
        }
      });

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
          processing_state: 'error',
          error_message: error.message,
          processing_completed_at: new Date().toISOString(),
          last_error_at: new Date().toISOString()
        })
        .eq('id', message.id);

      // Log error in webhook_logs
      await supabase.from('webhook_logs').insert({
        event_type: 'message_processing_error',
        message_id: message.id,
        error_message: error.message
      });

      updateProcessingState(message.id, false, error.message);
    }
  }, [processingState, updateProcessingState]);

  const syncMediaGroup = useCallback(async (message: MessageData) => {
    if (!message.media_group_id || processingState[message.id]?.isProcessing) return;
    
    updateProcessingState(message.id, true);
    
    try {
      // Add sync metadata to the analyzed content
      const analyzedContentWithSync = {
        ...message.analyzed_content,
        sync_metadata: {
          sync_source_message_id: message.id,
          media_group_id: message.media_group_id
        }
      };

      // Update all messages in the group with the source message's content
      const { error: updateError } = await supabase.from('messages')
        .update({
          analyzed_content: analyzedContentToJson(convertAnalyzedContent(analyzedContentWithSync)),
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
      
      // Log the error with metadata
      await supabase.from('message_state_logs').insert({
        message_id: message.id,
        previous_state: 'completed',
        new_state: 'error',
        changed_at: new Date().toISOString(),
        error_message: error.message,
        metadata: {
          sync_source_message_id: message.id,
          media_group_id: message.media_group_id
        }
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
