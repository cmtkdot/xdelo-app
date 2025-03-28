
import { useState } from 'react';
import { MediaProcessingState, MediaProcessingStateActions } from './types';

/**
 * Creates state and actions for tracking processing message IDs
 */
export function createMediaProcessingState(): [MediaProcessingState, MediaProcessingStateActions] {
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingMessageIds, setProcessingMessageIds] = useState<string[]>([]);

  const addProcessingMessageId = (messageId: string) => {
    setProcessingMessageIds(prev => {
      if (prev.includes(messageId)) return prev;
      return [...prev, messageId];
    });
  };

  const removeProcessingMessageId = (messageId: string) => {
    setProcessingMessageIds(prev => prev.filter(id => id !== messageId));
  };

  return [
    { isProcessing, processingMessageIds },
    { setIsProcessing, addProcessingMessageId, removeProcessingMessageId }
  ];
}

/**
 * Retry a function with exponential backoff
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxAttempts: number;
    delay: number;
    retryableErrors?: string[];
  }
): Promise<T> {
  const { maxAttempts, delay, retryableErrors } = options;
  
  let lastError: any;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      // Check if error is retryable
      if (retryableErrors) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const isRetryable = retryableErrors.some(retryText => 
          errorMessage.toLowerCase().includes(retryText.toLowerCase())
        );
        
        if (!isRetryable) {
          throw error;
        }
      }
      
      // Last attempt - don't wait, just throw
      if (attempt === maxAttempts) {
        throw error;
      }
      
      // Wait with exponential backoff before retrying
      const waitTime = delay * Math.pow(2, attempt - 1);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
  
  throw lastError; // This should never happen due to the checks above
}
