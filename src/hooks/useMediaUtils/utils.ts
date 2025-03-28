
import { useState, useCallback } from 'react';
import { MediaProcessingState, MediaProcessingStateActions } from './types';

/**
 * Create state and actions for tracking media processing status
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
 * Retry an operation with configurable attempts and delay
 */
export async function withRetry<T>(operation: () => Promise<T>, options: {
  maxAttempts: number;
  delay: number;
  retryableErrors?: string[];
}): Promise<T> {
  const { maxAttempts, delay, retryableErrors = [] } = options;
  let attempt = 0;
  let lastError: Error | null = null;

  const execute = async (): Promise<T> => {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      attempt++;

      const shouldRetry = retryableErrors.length === 0 ||
        retryableErrors.some(errMsg => lastError?.message.includes(errMsg));

      if (attempt >= maxAttempts || !shouldRetry) {
        throw lastError;
      }

      await new Promise(resolve => setTimeout(resolve, delay));
      return execute();
    }
  };

  return execute();
}
