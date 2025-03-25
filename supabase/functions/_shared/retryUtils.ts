
/**
 * Retry utilities for database operations
 */

/**
 * Execute a database operation with retry logic
 * 
 * @param operationName Name of the operation for logging
 * @param operation Function to execute with retry
 * @param options Retry options
 * @returns Result of the operation
 */
export async function xdelo_withDatabaseRetry<T>(
  operationName: string,
  operation: () => Promise<T>,
  options: { maxRetries?: number; delayMs?: number; } = {}
): Promise<T> {
  const maxRetries = options.maxRetries || 3;
  const delayMs = options.delayMs || 500;
  
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      
      console.error(`Database operation "${operationName}" failed (attempt ${attempt}/${maxRetries}):`, error.message);
      
      if (attempt < maxRetries) {
        // Exponential backoff with jitter
        const jitter = Math.random() * 200;
        const delay = (delayMs * Math.pow(2, attempt - 1)) + jitter;
        console.log(`Retrying in ${delay.toFixed(0)}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError || new Error(`Database operation "${operationName}" failed after ${maxRetries} attempts`);
}
