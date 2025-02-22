import { useState, useCallback } from 'react';
import type { Message, AnalyzedContent } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { analyzedContentToJson, AnalyzedContent as JsonAnalyzedContent } from '@/types';

interface ProcessingState {
  isProcessing: boolean;
  error?: string;
}

const convertAnalyzedContent = (content: AnalyzedContent | undefined): JsonAnalyzedContent => {
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
          processing_correlation_id: correlationId
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
          processing_state: 'error',
          error_message: error.message,
          processing_completed_at: new Date().toISOString(),
          last_error_at: new Date().toISOString()
        })
        .eq('id', message.id);

      updateProcessingState(message.id, false, error.message);
    }
  }, [processingState, updateProcessingState]);

  const handleSave = useCallback(async (message: Message, caption: string) => {
    // ... rest of the code
  }, []);

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
