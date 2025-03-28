
/**
 * Utility functions for database operation retries and error handling
 */

/**
 * Options for database retry operations
 */
export interface RetryOptions {
  maxAttempts?: number;
  initialDelayMs?: number;
  timeoutMs?: number;
  jitter?: boolean;
  onRetry?: (attempt: number, error: Error, delay: number) => void;
}

/**
 * Default retry options
 */
const defaultRetryOptions: RetryOptions = {
  maxAttempts: 3,
  initialDelayMs: 500,
  timeoutMs: 30000,
  jitter: true,
  onRetry: undefined,
};

/**
 * Adds jitter to the delay to prevent thundering herd problem
 */
function addJitter(delay: number): number {
  const jitterFactor = 0.2; // 20% jitter
  const randomJitter = Math.random() * jitterFactor * delay;
  return delay + randomJitter;
}

/**
 * Sleep for a specified duration
 */
async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retries a database operation with exponential backoff
 * @param operation The async operation to retry
 * @param options Retry options
 * @returns The result of the operation
 */
export async function retryDbOperation<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const config = { ...defaultRetryOptions, ...options };
  let attempt = 0;
  let lastError: Error | null = null;
  let delay = config.initialDelayMs || 500;

  while (attempt < (config.maxAttempts || 3)) {
    attempt++;
    
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (attempt >= (config.maxAttempts || 3)) {
        break;
      }
      
      // Apply jitter if configured
      const delayWithJitter = config.jitter ? addJitter(delay) : delay;
      
      // Call onRetry callback if provided
      if (config.onRetry) {
        config.onRetry(attempt, lastError, delayWithJitter);
      }
      
      // Wait before retrying
      await sleep(delayWithJitter);
      
      // Exponential backoff
      delay *= 2;
    }
  }
  
  // If we've reached here, all attempts failed
  throw lastError || new Error('Operation failed after multiple retries');
}

/**
 * Types of database operations that can fail
 */
export enum DbOperationType {
  INSERT = 'insert',
  UPDATE = 'update',
  DELETE = 'delete',
  SELECT = 'select',
  RPC = 'rpc',
}

/**
 * Records a database operation failure in the audit log
 */
export async function logDbOperationFailure(
  client: any,
  operationType: DbOperationType,
  error: Error,
  entityId?: string,
  correlationId?: string,
  metadata: Record<string, any> = {}
): Promise<void> {
  try {
    // Build event type based on operation
    const eventType = `database_${operationType}_error`;
    
    // Extract detailed error info
    const errorDetails = {
      message: error.message,
      stack: error.stack,
      name: error.name,
      ...metadata,
    };
    
    // Log to audit table
    await client.from('unified_audit_logs').insert({
      event_type: eventType,
      entity_id: entityId,
      correlation_id: correlationId || crypto.randomUUID(),
      error_message: error.message,
      metadata: errorDetails,
      event_timestamp: new Date().toISOString(),
    });
  } catch (logError) {
    // Just console log if audit logging itself fails
    console.error('Failed to log database error:', logError);
    console.error('Original error:', error);
  }
}
