/**
 * Utility functions for implementing retry logic in edge functions
 */

type RetryOptions = {
  maxRetries: number;
  initialDelayMs: number;
  backoffFactor: number;
  jitterFactor?: number;
  retryableErrors?: Array<string | RegExp>;
  onRetry?: (attempt: number, error: Error, nextDelayMs: number) => void;
  retryCondition?: (error: Error) => boolean;
};

const defaultRetryOptions: RetryOptions = {
  maxRetries: 3,
  initialDelayMs: 500,
  backoffFactor: 2,
  jitterFactor: 0.2,
  retryableErrors: [
    'ECONNRESET',
    'ETIMEDOUT',
    'ECONNREFUSED',
    'NETWORK_ERROR',
    'EHOSTUNREACH',
    'EPIPE', 
    'PROTOCOL_CONNECTION_LOST',
    /timeout/i,
    /network/i,
    /connection/i,
    /socket/i,
    /headers already sent/i,
    'AbortError',
    'FetchError'
  ]
};

/**
 * Checks if an error is retryable based on its properties and messages
 */
export function xdelo_isRetryableError(error: Error, options: RetryOptions = defaultRetryOptions): boolean {
  // If no error, it's not retryable
  if (!error) return false;
  
  // If custom retry condition is provided, use it
  if (options.retryCondition) {
    return options.retryCondition(error);
  }
  
  const { retryableErrors = [] } = options;

  // Get error code/message for checking
  const errorCode = (error as any).code || '';
  const errorMessage = error.message || '';
  
  // Check if error matches any in the retryable list
  return retryableErrors.some(pattern => {
    if (typeof pattern === 'string') {
      return errorCode.includes(pattern) || errorMessage.includes(pattern);
    } else {
      // RegExp pattern
      return pattern.test(errorCode) || pattern.test(errorMessage);
    }
  });
}

/**
 * Calculate delay for next retry with exponential backoff and jitter
 */
export function xdelo_calculateBackoff(
  attempt: number, 
  options: RetryOptions = defaultRetryOptions
): number {
  const { initialDelayMs, backoffFactor, jitterFactor = 0 } = options;
  
  // Exponential backoff: initialDelay * (backoffFactor ^ attempt)
  const exponentialDelay = initialDelayMs * Math.pow(backoffFactor, attempt);
  
  // Apply jitter: random value between -jitter% and +jitter% of the delay
  const jitterAmount = exponentialDelay * jitterFactor;
  const jitter = jitterAmount > 0 ? (Math.random() * 2 - 1) * jitterAmount : 0;
  
  return Math.max(0, Math.floor(exponentialDelay + jitter));
}

/**
 * Implements a retry mechanism for any async function
 */
export async function xdelo_withRetry<T>(
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<T> {
  // Merge with default options
  const retryOptions: RetryOptions = {
    ...defaultRetryOptions,
    ...options
  };
  
  const { maxRetries, onRetry } = retryOptions;
  let attempt = 0;
  
  while (true) {
    try {
      return await fn();
    } catch (error) {
      attempt++;
      
      // Check if we've reached max retries or if error isn't retryable
      if (attempt >= maxRetries || !xdelo_isRetryableError(error as Error, retryOptions)) {
        // Rethrow with additional retry context
        if (error instanceof Error) {
          (error as any).retryAttempts = attempt;
          (error as any).retryExhausted = attempt >= maxRetries;
        }
        throw error;
      }
      
      // Calculate backoff delay for next attempt
      const nextDelayMs = xdelo_calculateBackoff(attempt, retryOptions);
      
      // Call optional onRetry callback
      if (onRetry) {
        onRetry(attempt, error as Error, nextDelayMs);
      } else {
        console.log(`Retry attempt ${attempt}/${maxRetries} after ${nextDelayMs}ms due to error: ${(error as Error).message}`);
      }
      
      // Wait before next attempt
      await new Promise(resolve => setTimeout(resolve, nextDelayMs));
    }
  }
}

/**
 * Database operation retry wrapper with logging
 */
export async function xdelo_withDatabaseRetry<T>(
  operationName: string,
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<T> {
  const retryOpts = {
    maxRetries: 5, // Increased from 3 to 5 for database operations
    initialDelayMs: 300,
    backoffFactor: 1.5,
    retryableErrors: [
      ...defaultRetryOptions.retryableErrors || [],
      'PostgresError',
      'Connection terminated unexpectedly',
      'database connection error',
      /deadlock detected/i,
      /serialization failure/i,
      /too many clients/i,
      /connection pool timeout/i,
      /timeout/i, // Added explicit timeout regex
      /operation timed out/i, // Added specific timeout message pattern
      /timed out after \d+ms/i, // Match timeout with duration
      'PGRST', // PostgREST errors
      'JwtError'
    ],
    onRetry: (attempt: number, error: Error, nextDelayMs: number) => {
      // For timeouts, log more details
      if (error.message.includes('timeout') || error.message.includes('timed out')) {
        console.warn(`Database operation "${operationName}" timed out (attempt ${attempt}): ${error.message}. Retrying in ${nextDelayMs}ms...`);
      } else {
        console.warn(`Database operation "${operationName}" failed (attempt ${attempt}): ${error.message}. Retrying in ${nextDelayMs}ms...`);
      }
    },
    ...options
  };

  return xdelo_withRetry(fn, retryOpts);
}

/**
 * Network/API call retry wrapper with logging
 */
export async function xdelo_withNetworkRetry<T>(
  url: string,
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<T> {
  const retryOpts = {
    maxRetries: 4,
    initialDelayMs: 500,
    backoffFactor: 2,
    onRetry: (attempt: number, error: Error, nextDelayMs: number) => {
      console.warn(`Network request to "${url}" failed (attempt ${attempt}): ${error.message}. Retrying in ${nextDelayMs}ms...`);
    },
    ...options
  };

  return xdelo_withRetry(fn, retryOpts);
}
