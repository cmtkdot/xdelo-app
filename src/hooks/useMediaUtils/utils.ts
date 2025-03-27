
import { useState } from 'react';
import { MediaProcessingState, MediaProcessingStateActions } from './types';

/**
 * Create a media processing state with actions to manipulate it
 */
export function createMediaProcessingState(): [MediaProcessingState, MediaProcessingStateActions] {
  const [state, setState] = useState<MediaProcessingState>({
    isProcessing: false,
    processingMessageIds: {}
  });

  const setIsProcessing = (isProcessing: boolean) => {
    setState(prev => ({ ...prev, isProcessing }));
  };

  const addProcessingMessageId = (messageId: string) => {
    setState(prev => ({
      ...prev,
      processingMessageIds: {
        ...prev.processingMessageIds,
        [messageId]: true
      }
    }));
  };

  const removeProcessingMessageId = (messageId: string) => {
    setState(prev => {
      const updatedIds = { ...prev.processingMessageIds };
      delete updatedIds[messageId];
      return {
        ...prev,
        processingMessageIds: updatedIds
      };
    });
  };

  const actions: MediaProcessingStateActions = {
    setIsProcessing,
    addProcessingMessageId,
    removeProcessingMessageId
  };

  return [state, actions];
}

/**
 * Retry a function with exponential backoff
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: { maxAttempts: number; delay: number; retryableErrors?: string[] }
): Promise<T> {
  const { maxAttempts, delay, retryableErrors = ['timeout', 'connection', 'network'] } = options;
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      const shouldRetry = 
        attempt < maxAttempts && 
        (retryableErrors.length === 0 || retryableErrors.some(errType => 
          lastError?.message?.toLowerCase().includes(errType.toLowerCase())
        ));
      
      if (!shouldRetry) {
        throw lastError;
      }
      
      // Exponential backoff with jitter
      const jitter = Math.random() * 0.3 + 0.7; // Random value between 0.7 and 1.0
      const waitTime = delay * Math.pow(1.5, attempt - 1) * jitter;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
  
  throw lastError;
}
