
import { useState } from 'react';
import { MediaProcessingState, MediaProcessingActions } from './types';

/**
 * Creates a state manager for tracking media processing state
 */
export function createMediaProcessingState(): [MediaProcessingState, MediaProcessingActions] {
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingMessageIds, setProcessingMessageIds] = useState<string[]>([]);
  
  const addProcessingMessageId = (id: string) => {
    setProcessingMessageIds(prev => {
      if (prev.includes(id)) return prev;
      return [...prev, id];
    });
  };
  
  const removeProcessingMessageId = (id: string) => {
    setProcessingMessageIds(prev => prev.filter(messageId => messageId !== id));
  };
  
  const resetProcessingMessageIds = () => {
    setProcessingMessageIds([]);
  };
  
  return [
    { isProcessing, processingMessageIds },
    { setIsProcessing, addProcessingMessageId, removeProcessingMessageId, resetProcessingMessageIds }
  ];
}

/**
 * Utility function to retry operations with exponential backoff
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: {
    maxAttempts?: number;
    delay?: number;
    backoffFactor?: number;
    retryableErrors?: string[];
  } = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    delay = 1000,
    backoffFactor = 2,
    retryableErrors = []
  } = options;
  
  let lastError: any;
  let currentDelay = delay;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (err: any) {
      lastError = err;
      
      // Check if error is retryable
      const errorMessage = err.message?.toLowerCase() || '';
      const isRetryable = retryableErrors.some(retryableErr => 
        errorMessage.includes(retryableErr.toLowerCase())
      );
      
      // Don't retry if this is the last attempt or error is not retryable
      if (attempt === maxAttempts || !isRetryable) {
        break;
      }
      
      // Wait before retry with exponential backoff
      await new Promise(resolve => setTimeout(resolve, currentDelay));
      currentDelay *= backoffFactor;
    }
  }
  
  throw lastError;
}
