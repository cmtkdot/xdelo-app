
import { createSupabaseClient } from "./supabase.ts";
import { logProcessingEvent } from "./consolidatedMessageUtils.ts";

/**
 * Configuration for retry operations
 */
export interface RetryConfig {
  maxRetries: number;
  initialDelay: number;
  maxDelay: number;
  backoffFactor: number;
  timeoutMs?: number;
}

/**
 * Default retry configuration
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelay: 200,
  maxDelay: 2000,
  backoffFactor: 2,
  timeoutMs: 20000,
};

/**
 * Execute a database operation with retry logic for handling timeouts and transient errors
 */
export async function xdelo_executeWithRetry<T>(
  operationName: string,
  operation: () => Promise<T>,
  config: Partial<RetryConfig> = {},
  correlationId?: string,
  entityId?: string
): Promise<T> {
  const retryConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  let lastError: Error | null = null;
  let delay = retryConfig.initialDelay;

  for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
    try {
      // On retry attempts, log the retry
      if (attempt > 0) {
        console.log(`Retry attempt ${attempt} for operation: ${operationName}`);
        
        // Log to audit system if correlation ID is provided
        if (correlationId && entityId) {
          await logProcessingEvent(
            "db_operation_retry",
            entityId,
            correlationId,
            {
              operation: operationName,
              attempt,
              delay,
              max_retries: retryConfig.maxRetries,
            }
          );
        }
      }

      // Execute the operation with a timeout if specified
      if (retryConfig.timeoutMs) {
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error(`Operation timed out after ${retryConfig.timeoutMs}ms`)), retryConfig.timeoutMs);
        });
        
        return await Promise.race([operation(), timeoutPromise]) as T;
      } else {
        return await operation();
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // Don't retry if we've reached max retries
      if (attempt >= retryConfig.maxRetries) {
        break;
      }
      
      // Only retry on specific error types that are likely transient
      const errorCode = (error as any)?.code;
      const isTimeoutError = errorCode === '57014' || 
                             lastError.message.includes('statement timeout') ||
                             lastError.message.includes('timed out');
      
      const isConnectionError = errorCode === '08006' || 
                               errorCode === '08001' ||
                               errorCode === '08004' ||
                               lastError.message.includes('connection');
      
      const isDeadlockError = errorCode === '40P01' ||
                             lastError.message.includes('deadlock');
      
      const isRetryableError = isTimeoutError || isConnectionError || isDeadlockError;
      
      if (!isRetryableError) {
        break;
      }
      
      // Wait before retrying with exponential backoff
      await new Promise(resolve => setTimeout(resolve, delay));
      
      // Increase delay for next retry with jitter to prevent thundering herd
      delay = Math.min(
        retryConfig.maxDelay, 
        delay * retryConfig.backoffFactor * (0.8 + Math.random() * 0.4)
      );
    }
  }
  
  // If we get here, all retries failed
  throw lastError || new Error(`Operation ${operationName} failed after ${retryConfig.maxRetries} retries`);
}

/**
 * Create a message with retry logic for handling database timeouts
 */
export async function xdelo_createMessageWithRetry(
  messageData: Record<string, any>,
  correlationId: string,
  logger?: any
): Promise<{ id?: string; success: boolean; error_message?: string }> {
  try {
    const supabase = createSupabaseClient({
      global: {
        headers: {
          'x-correlation-id': correlationId
        },
      },
    });
    
    // Set statement_timeout for this operation
    const timeoutMs = Deno.env.get('DB_STATEMENT_TIMEOUT') || '30000';
    await supabase.rpc('set_config', { 
      parameter: 'statement_timeout', 
      value: timeoutMs,
      is_local: true
    });
    
    if (logger) logger.info(`Creating message with timeout set to ${timeoutMs}ms`);
    
    // Execute with retry
    const result = await xdelo_executeWithRetry(
      'createMessage',
      async () => {
        const { data, error } = await supabase
          .from('messages')
          .insert(messageData)
          .select('id')
          .single();
          
        if (error) {
          if (logger) logger.error('Failed to create message record:', error);
          throw error;
        }
        
        return { id: data.id, success: true };
      },
      {
        maxRetries: 3,
        initialDelay: 500,
        maxDelay: 3000,
        timeoutMs: parseInt(timeoutMs),
      },
      correlationId,
      messageData.telegram_message_id?.toString()
    );
    
    return result;
  } catch (error) {
    if (logger) logger.error('Exception in createMessageWithRetry:', error);
    return { 
      success: false, 
      error_message: error instanceof Error ? error.message : String(error) 
    };
  }
}
