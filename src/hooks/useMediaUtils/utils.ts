
import { MediaProcessingState, MediaProcessingStateActions } from './types';

/**
 * Create a state manager for tracking processing messages
 */
export function createMediaProcessingState(): [
  MediaProcessingState,
  MediaProcessingStateActions
] {
  const state: MediaProcessingState = {
    isProcessing: false,
    processingMessageIds: {}
  };
  
  const actions: MediaProcessingStateActions = {
    setIsProcessing: (isProcessing: boolean) => {
      state.isProcessing = isProcessing;
    },
    
    addProcessingMessageId: (messageId: string) => {
      state.processingMessageIds[messageId] = true;
      state.isProcessing = true;
    },
    
    removeProcessingMessageId: (messageId: string) => {
      delete state.processingMessageIds[messageId];
      state.isProcessing = Object.keys(state.processingMessageIds).length > 0;
    }
  };
  
  return [state, actions];
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
  const { maxAttempts, delay, retryableErrors = ['timeout', 'connection', 'network'] } = options;
  let lastError: any;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      // Check if this error is retryable
      const errorString = String(error);
      const shouldRetry = retryableErrors.some(errType => errorString.includes(errType));
      
      if (!shouldRetry || attempt === maxAttempts) {
        throw error;
      }
      
      // Wait before retrying with exponential backoff
      const waitTime = delay * Math.pow(2, attempt - 1);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
  
  throw lastError;
}
