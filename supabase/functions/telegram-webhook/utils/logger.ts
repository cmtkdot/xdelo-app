import { supabaseClient } from '../../_shared/cors.ts';

/**
 * Logger class for telegram-webhook function with enhanced retry support
 */
export class Logger {
  private correlationId: string;
  private source: string;

  constructor(correlationId: string, source: string = 'telegram-webhook') {
    this.correlationId = correlationId;
    this.source = source;
  }

  /**
   * Log a debug message
   */
  debug(message: string, metadata: Record<string, any> = {}): void {
    console.debug(`[${this.source}][${this.correlationId}] ${message}`, metadata);
  }

  /**
   * Log an info message
   */
  info(message: string, metadata: Record<string, any> = {}): void {
    console.info(`[${this.source}][${this.correlationId}] ${message}`, metadata);
  }

  /**
   * Log a warning message
   */
  warn(message: string, metadata: Record<string, any> = {}): void {
    console.warn(`[${this.source}][${this.correlationId}] ${message}`, metadata);
  }

  /**
   * Log an error message
   */
  error(message: string, metadata: Record<string, any> = {}): void {
    console.error(`[${this.source}][${this.correlationId}] ${message}`, metadata);
    
    // Log to the database if possible
    try {
      void this.logToDatabase('error', message, metadata);
    } catch (err) {
      console.error(`Failed to log error to database: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /**
   * Log a message to the unified_audit_logs table
   */
  /**
   * Log a retry event
   * 
   * @param operationName - The name of the operation being retried
   * @param attemptNumber - The attempt number (1-based)
   * @param maxRetries - The maximum number of retries
   * @param error - The error that caused the retry (if any)
   * @param metadata - Additional metadata
   */
  retryAttempt(
    operationName: string,
    attemptNumber: number,
    maxRetries: number,
    error?: Error | string,
    metadata: Record<string, any> = {}
  ): void {
    const errorMessage = error instanceof Error ? error.message : error;
    
    this.info(
      `Retry attempt ${attemptNumber}/${maxRetries + 1} for operation: ${operationName}${errorMessage ? ` (Error: ${errorMessage})` : ''}`,
      {
        retry_operation: operationName,
        retry_attempt: attemptNumber,
        retry_max: maxRetries,
        retry_error: errorMessage,
        ...metadata
      }
    );
    
    // Also log to database
    void this.logToDatabase(
      'info',
      `Retry attempt ${attemptNumber}/${maxRetries + 1} for operation: ${operationName}`,
      {
        event_category: 'webhook_retry',
        retry_operation: operationName,
        retry_attempt: attemptNumber,
        retry_max: maxRetries,
        retry_error: errorMessage,
        ...metadata
      }
    );
  }

  /**
   * Log a retry success
   * 
   * @param operationName - The name of the operation that succeeded
   * @param attemptCount - The number of attempts it took to succeed
   * @param totalTimeMs - The total time it took to succeed
   * @param metadata - Additional metadata
   */
  retrySuccess(
    operationName: string,
    attemptCount: number,
    totalTimeMs: number,
    metadata: Record<string, any> = {}
  ): void {
    this.info(
      `Operation ${operationName} succeeded after ${attemptCount} ${attemptCount === 1 ? 'attempt' : 'attempts'} (${totalTimeMs}ms)`,
      {
        retry_operation: operationName,
        retry_attempts: attemptCount,
        retry_total_time_ms: totalTimeMs,
        retry_outcome: 'success',
        ...metadata
      }
    );
    
    // Also log to database
    void this.logToDatabase(
      'info',
      `Operation ${operationName} succeeded after ${attemptCount} ${attemptCount === 1 ? 'attempt' : 'attempts'}`,
      {
        event_category: 'webhook_retry_success',
        retry_operation: operationName,
        retry_attempts: attemptCount,
        retry_total_time_ms: totalTimeMs,
        retry_outcome: 'success',
        ...metadata
      }
    );
  }

  /**
   * Log a retry failure when all retries are exhausted
   * 
   * @param operationName - The name of the operation that failed
   * @param attemptCount - The number of attempts made
   * @param totalTimeMs - The total time spent retrying
   * @param finalError - The final error that caused the operation to fail
   * @param metadata - Additional metadata
   */
  retryExhausted(
    operationName: string,
    attemptCount: number,
    totalTimeMs: number,
    finalError: Error | string,
    metadata: Record<string, any> = {}
  ): void {
    const errorMessage = finalError instanceof Error ? finalError.message : finalError;
    
    this.error(
      `Operation ${operationName} failed after ${attemptCount} ${attemptCount === 1 ? 'attempt' : 'attempts'} (${totalTimeMs}ms): ${errorMessage}`,
      {
        retry_operation: operationName,
        retry_attempts: attemptCount,
        retry_total_time_ms: totalTimeMs,
        retry_outcome: 'exhausted',
        retry_final_error: errorMessage,
        ...metadata
      }
    );
    
    // Also log to database
    void this.logToDatabase(
      'error',
      `Operation ${operationName} failed after ${attemptCount} ${attemptCount === 1 ? 'attempt' : 'attempts'}: ${errorMessage}`,
      {
        event_category: 'webhook_retry_exhausted',
        retry_operation: operationName,
        retry_attempts: attemptCount,
        retry_total_time_ms: totalTimeMs,
        retry_outcome: 'exhausted',
        retry_final_error: errorMessage,
        ...metadata
      }
    );
  }

  /**
   * Log a message to the unified_audit_logs table
   * 
   * @param level - Log level
   * @param message - Message to log
   * @param metadata - Additional metadata to include
   */
  async logToDatabase(
    level: 'info' | 'warning' | 'error', 
    message: string, 
    metadata: Record<string, any> = {}
  ): Promise<void> {
    try {
      const eventType = `${this.source}_${level}`;
      
      // Generate a valid UUID if entity_id is missing or invalid
      let entityId = metadata.entity_id;
      
      // Validate UUID format using regex
      const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!entityId || !uuidPattern.test(entityId)) {
        // Generate a UUID v4 (random)
        entityId = crypto.randomUUID();
        console.log(`[${this.correlationId}] Generated new UUID for invalid entity_id: ${metadata.entity_id || 'undefined'}`);
      }
      
      // Determine event type based on category if provided
      const eventCategory = metadata.event_category || `${this.source}_${level}`;
      delete metadata.event_category; // Remove to avoid duplication
      
      await supabaseClient.from('unified_audit_logs').insert({
        event_type: eventCategory,
        entity_id: entityId,
        message,
        metadata: {
          ...metadata,
          source: this.source,
          logger: 'edge-function'
        },
        correlation_id: this.correlationId,
        event_timestamp: new Date().toISOString()
      });
    } catch (error) {
      // Don't recursively log errors from logging
      console.error(`[${this.correlationId}][logToDatabase] Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

/**
 * Creates a Logger instance specifically for retry operations
 * 
 * @param correlationId - Correlation ID for request tracking
 * @returns A configured Logger instance for retry operations
 */
export function createRetryLogger(correlationId: string): Logger {
  return new Logger(correlationId, 'retry-handler');
}

/**
 * Helper function to log a message with correlation ID
 * 
 * @param correlationId - Correlation ID for request tracking
 * @param message - Message to log
 * @param level - Log level (default: 'info')
 * @param metadata - Additional metadata to include
 */
export function logWithCorrelation(
  correlationId: string, 
  message: string, 
  level: 'debug' | 'info' | 'warn' | 'error' = 'info',
  source: string = 'telegram-webhook',
  metadata: Record<string, any> = {}
): void {
  const logger = new Logger(correlationId, source);
  
  switch (level) {
    case 'debug':
      logger.debug(message, metadata);
      break;
    case 'warn':
      logger.warn(message, metadata);
      break;
    case 'error':
      logger.error(message, metadata);
      break;
    case 'info':
    default:
      logger.info(message, metadata);
      break;
  }
}
