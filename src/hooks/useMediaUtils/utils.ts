
import { useState, useCallback } from 'react';
import { MediaUtilsState } from './types';

/**
 * Create state management hooks for media operations
 */
export function createMediaProcessingState(): [
  MediaUtilsState,
  {
    setIsProcessing: (value: boolean) => void;
    addProcessingMessageId: (id: string) => void;
    removeProcessingMessageId: (id: string) => void;
  }
] {
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingMessageIds, setProcessingMessageIds] = useState<Record<string, boolean>>({});

  const addProcessingMessageId = useCallback((id: string) => {
    setProcessingMessageIds(prev => ({ ...prev, [id]: true }));
  }, []);

  const removeProcessingMessageId = useCallback((id: string) => {
    setProcessingMessageIds(prev => {
      const updated = { ...prev };
      delete updated[id];
      return updated;
    });
  }, []);

  return [
    { isProcessing, processingMessageIds },
    { setIsProcessing, addProcessingMessageId, removeProcessingMessageId }
  ];
}
