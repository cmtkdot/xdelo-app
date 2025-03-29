
/**
 * Utility class to handle retry logic for operations
 */
export class RetryHandler {
  private maxAttempts: number;
  private baseDelayMs: number;
  private maxDelayMs: number;
  private retryableErrors: any[];
  private delay?: number; // Added delay option

  constructor(options: {
    maxAttempts: number;
    baseDelayMs: number;
    maxDelayMs: number;
    retryableErrors: any[];
    delay?: number; // Added delay option
  }) {
    this.maxAttempts = options.maxAttempts || 3;
    this.baseDelayMs = options.baseDelayMs || 1000;
    this.maxDelayMs = options.maxDelayMs || 10000;
    this.retryableErrors = options.retryableErrors || [];
    this.delay = options.delay; // Store the delay option
  }

  /**
   * Execute an operation with retry logic
   */
  async execute<T>(
    operation: () => Promise<T>,
    shouldRetry: (error: any) => boolean
  ): Promise<T> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
      try {
        // Attempt the operation
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        // Check if we should retry
        if (attempt >= this.maxAttempts || !shouldRetry(error)) {
          break;
        }
        
        // Calculate delay with exponential backoff or use fixed delay if provided
        const delay = this.delay || Math.min(
          this.baseDelayMs * Math.pow(2, attempt - 1),
          this.maxDelayMs
        );
        
        // Add jitter to prevent thundering herd
        const jitter = Math.random() * 0.2 * delay;
        const totalDelay = delay + jitter;
        
        console.log(`Retry attempt ${attempt}/${this.maxAttempts} after ${Math.round(totalDelay)}ms delay`);
        
        // Wait before next attempt
        await new Promise(resolve => setTimeout(resolve, totalDelay));
      }
    }
    
    // If we got here, we've exhausted our retries
    throw lastError || new Error('Operation failed after multiple retries');
  }
}

/**
 * Default predicate to determine if an operation should be retried
 */
export function shouldRetryOperation(error: any): boolean {
  // Network errors
  if (error?.message?.includes('network') ||
      error?.message?.includes('timeout') ||
      error?.message?.includes('connection')) {
    return true;
  }
  
  // Rate limiting (429) or server errors (5xx)
  const statusCode = error?.status || error?.statusCode;
  if (statusCode === 429 || (statusCode >= 500 && statusCode < 600)) {
    return true;
  }
  
  // Specific Supabase error codes that are retryable
  const errorCode = error?.code;
  const retryableCodes = ['40001', '40197', '10928', '10929']; // Transaction conflicts, throttling
  if (retryableCodes.includes(errorCode)) {
    return true;
  }

  // Custom check for media processing retriable errors
  if (error?.message?.includes('media group sync already in progress') ||
      error?.message?.includes('temporary failure') ||
      error?.message?.includes('try again')) {
    return true;
  }
  
  return false;
}
