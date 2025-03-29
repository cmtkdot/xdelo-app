
import { RetryHandler, shouldRetryOperation } from './retryHandler';

/**
 * Higher-order function to handle retrying operations with standardized error handling
 */
export const withRetry = async <T>(
  operation: () => Promise<T>,
  options = { maxAttempts: 3, baseDelayMs: 1000, maxDelayMs: 10000 }
): Promise<T> => {
  const retryHandler = new RetryHandler(options);
  
  try {
    return await retryHandler.execute(operation, shouldRetryOperation);
  } catch (error) {
    // Rethrow the error after retry attempts are exhausted
    throw error;
  }
};

/**
 * Check if a caption is valid and not empty
 */
export const hasValidCaption = (caption: string | null | undefined): boolean => {
  return !!caption && caption.trim().length > 0;
};

/**
 * Validate if a string is a valid UUID
 */
export const isValidUuid = (str: string): boolean => {
  if (!str) return false;
  
  // UUID regex pattern
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidPattern.test(str);
};
