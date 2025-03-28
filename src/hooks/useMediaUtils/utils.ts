
import { useState, useCallback } from 'react';
import { MediaProcessingState, MediaProcessingStateActions } from './types';

/**
 * Creates a state object and actions for tracking message processing state
 */
export function createMediaProcessingState(): [MediaProcessingState, MediaProcessingStateActions] {
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingMessageIds, setProcessingMessageIds] = useState<Record<string, boolean>>({});

  const addProcessingMessageId = useCallback((messageId: string) => {
    setProcessingMessageIds(prev => ({ ...prev, [messageId]: true }));
  }, []);

  const removeProcessingMessageId = useCallback((messageId: string) => {
    setProcessingMessageIds(prev => {
      const newState = { ...prev };
      delete newState[messageId];
      return newState;
    });
  }, []);

  return [
    { isProcessing, processingMessageIds },
    { setIsProcessing, addProcessingMessageId, removeProcessingMessageId }
  ];
}

/**
 * Retry helper for API calls
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxAttempts?: number;
    delay?: number;
    retryableErrors?: string[];
  } = {}
): Promise<T> {
  const { maxAttempts = 3, delay = 1000, retryableErrors = [] } = options;
  let lastError: any;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      
      // Check if we should retry based on error type
      const shouldRetry = attempt < maxAttempts && (
        retryableErrors.length === 0 || // Retry all errors if no specific errors provided
        retryableErrors.some(errType => 
          error.message?.toLowerCase().includes(errType) || 
          error.code?.toLowerCase().includes(errType)
        )
      );
      
      if (shouldRetry) {
        // Add exponential backoff
        const backoff = delay * Math.pow(2, attempt - 1);
        console.log(`Retry attempt ${attempt}/${maxAttempts} after ${backoff}ms`);
        await new Promise(resolve => setTimeout(resolve, backoff));
      } else {
        break;
      }
    }
  }
  
  throw lastError;
}
