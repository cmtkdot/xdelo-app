
import { useState } from 'react';
import { MediaProcessingState, MediaProcessingActions } from './types';

export function createMediaProcessingState(): [MediaProcessingState, MediaProcessingActions] {
  const [state, setState] = useState<MediaProcessingState>({
    isProcessing: false,
    processingMessageIds: []
  });

  const setIsProcessing = (isProcessing: boolean) => {
    setState(prevState => ({ ...prevState, isProcessing }));
  };

  const addProcessingMessageId = (messageId: string) => {
    setState(prevState => ({
      ...prevState,
      processingMessageIds: [...prevState.processingMessageIds, messageId]
    }));
  };

  const removeProcessingMessageId = (messageId: string) => {
    setState(prevState => ({
      ...prevState,
      processingMessageIds: prevState.processingMessageIds.filter(id => id !== messageId)
    }));
  };

  return [
    state,
    { setIsProcessing, addProcessingMessageId, removeProcessingMessageId }
  ];
}
