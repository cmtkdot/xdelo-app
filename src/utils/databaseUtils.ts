import { supabase } from '@/integrations/supabase/client';

/**
 * Performs a database operation with timeout and retry capability
 * @param operation - Function that performs the database operation
 * @param options - Configuration options
 */
export const executeWithTimeout = async <T>(
  operation: () => Promise<T>,
  options: {
    timeoutMs?: number;
    retries?: number;
    retryDelayMs?: number;
    operationName?: string;
  } = {}
): Promise<T> => {
  const {
    timeoutMs = 5000,
    retries = 2,
    retryDelayMs = 500,
    operationName = 'Database operation'
  } = options;
  
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      // Create a timeout promise that rejects after timeoutMs
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`${operationName} timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      });
      
      // Race between the operation and the timeout
      return await Promise.race([operation(), timeoutPromise]);
    } catch (error) {
      lastError = error as Error;
      
      // If this was the last attempt, throw the error
      if (attempt === retries) {
        console.error(`${operationName} failed after ${retries + 1} attempts:`, error);
        throw error;
      }
      
      // Otherwise, wait before retrying
      console.warn(`${operationName} attempt ${attempt + 1} failed, retrying in ${retryDelayMs}ms:`, error);
      await new Promise(resolve => setTimeout(resolve, retryDelayMs));
    }
  }
  
  // This should never happen due to the throw in the loop above
  throw lastError || new Error(`${operationName} failed for unknown reason`);
};

/**
 * Simple retry function for database operations
 */
export const retryOperation = async <T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 500
): Promise<T> => {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }
  
  throw lastError || new Error('Operation failed after multiple retries');
};
