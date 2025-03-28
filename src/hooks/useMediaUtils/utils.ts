
/**
 * Helper utilities for media operations
 */

// Create the media processing state hooks
export function createMediaProcessingState() {
  const state = {
    isProcessing: false,
    processingMessageIds: {} as Record<string, boolean>
  };
  
  const actions = {
    setIsProcessing: (isProcessing: boolean) => {
      state.isProcessing = isProcessing;
    },
    
    addProcessingMessageId: (messageId: string) => {
      state.processingMessageIds[messageId] = true;
    },
    
    removeProcessingMessageId: (messageId: string) => {
      delete state.processingMessageIds[messageId];
    }
  };
  
  return [state, actions] as const;
}

/**
 * Execute an operation with retry logic
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: {
    maxAttempts: number;
    delay: number;
    retryableErrors?: string[];
  }
): Promise<T> {
  const { maxAttempts, delay, retryableErrors = [] } = options;
  let attempt = 0;
  let lastError: Error;
  
  while (attempt < maxAttempts) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      attempt++;
      
      // Check if we should retry based on the error message
      const shouldRetry = retryableErrors.length === 0 || 
        retryableErrors.some(errMsg => lastError.message.includes(errMsg));
      
      if (attempt >= maxAttempts || !shouldRetry) {
        throw lastError;
      }
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError!;
}
