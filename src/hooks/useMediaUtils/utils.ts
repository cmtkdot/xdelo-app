
import { useState } from 'react';
import { MediaProcessingState, MediaProcessingStateActions } from './types';

/**
 * Creates state management for tracking media processing operations
 */
export function createMediaProcessingState(): [MediaProcessingState, MediaProcessingStateActions] {
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingMessageIds, setProcessingMessageIds] = useState<string[]>([]);
  
  const addProcessingMessageId = (id: string) => {
    setProcessingMessageIds(prev => [...prev, id]);
  };
  
  const removeProcessingMessageId = (id: string) => {
    setProcessingMessageIds(prev => prev.filter(messageId => messageId !== id));
  };
  
  return [
    { isProcessing, processingMessageIds },
    { setIsProcessing, addProcessingMessageId, removeProcessingMessageId }
  ];
}

/**
 * Sleep utility for retry operations
 */
export const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Retry a function with exponential backoff
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
  
  let attempt = 0;
  let lastError: Error | undefined;
  
  while (attempt < maxAttempts) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      attempt++;
      
      // Check if we should retry
      const isRetryable = 
        retryableErrors.length === 0 || 
        retryableErrors.some(errMsg => lastError!.message.includes(errMsg));
      
      // If we've used all attempts or error is not retryable, throw
      if (attempt >= maxAttempts || !isRetryable) {
        throw lastError;
      }
      
      // Wait with exponential backoff
      const waitTime = delay * Math.pow(backoffFactor, attempt - 1);
      console.log(`Retry attempt ${attempt}/${maxAttempts} in ${waitTime}ms: ${lastError.message}`);
      await sleep(waitTime);
    }
  }
  
  throw lastError;
}
