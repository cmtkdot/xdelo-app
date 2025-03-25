
import { useState, useCallback } from 'react';

interface MediaProcessingState {
  isProcessing: boolean;
  processingMessageIds: string[];
}

interface MediaProcessingActions {
  setIsProcessing: (isProcessing: boolean) => void;
  addProcessingMessageId: (id: string) => void;
  removeProcessingMessageId: (id: string) => void;
}

/**
 * Create state management for media processing
 */
export function createMediaProcessingState(): [MediaProcessingState, MediaProcessingActions] {
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingMessageIds, setProcessingMessageIds] = useState<string[]>([]);

  const addProcessingMessageId = useCallback((id: string) => {
    setProcessingMessageIds(prev => {
      if (prev.includes(id)) return prev;
      return [...prev, id];
    });
  }, []);

  const removeProcessingMessageId = useCallback((id: string) => {
    setProcessingMessageIds(prev => prev.filter(messageId => messageId !== id));
  }, []);

  return [
    { isProcessing, processingMessageIds },
    { setIsProcessing, addProcessingMessageId, removeProcessingMessageId }
  ];
}
