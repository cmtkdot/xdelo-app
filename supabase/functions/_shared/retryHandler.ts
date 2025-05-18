/// <reference types="https://esm.sh/@supabase/functions-js/edge-runtime.d.ts" />
import { supabaseClient } from './cors.ts';
/**
 * A utility class that implements a robust retry mechanism with exponential backoff
 * for handling transient failures in network requests and other operations.
 */ export class RetryHandler {
  config;
  logger;
  /**
   * Creates a new RetryHandler with the specified configuration
   *
   * @param config - Configuration for the retry behavior
   */ constructor(config = {}){
    // Default configuration
    this.config = {
      maxRetries: 3,
      initialDelayMs: 30000,
      maxDelayMs: 300000,
      backoffFactor: 2.0,
      useJitter: true,
      ...config
    };
  }
  /**
   * Wraps a function with a timeout
   *
   * @param fn - The function to wrap
   * @param timeoutMs - Timeout in milliseconds
   * @returns A promise that rejects if the function doesn't complete within the timeout
   */ withTimeout(fn, timeoutMs) {
    return async ()=>{
      return new Promise((resolve, reject)=>{
        const timeoutId = setTimeout(()=>{
          reject(new Error(`Operation timed out after ${timeoutMs}ms`));
        }, timeoutMs);
        fn().then((result)=>{
          clearTimeout(timeoutId);
          resolve(result);
        }).catch((error)=>{
          clearTimeout(timeoutId);
          reject(error);
        });
      });
    };
  }
  /**
   * Executes a function with retry logic
   *
   * @param fn - The function to execute with retry logic
   * @param options - Options for the retry operation
   * @returns A promise that resolves to the result of the function or rejects after all retries fail
   */ async execute(fn, options) {
    // Add a timeout if specified in the options
    const wrappedFn = options.timeoutMs ? this.withTimeout(fn, options.timeoutMs) : fn;
    const { operationName, correlationId, supabaseClient, errorCategory = 'webhook_error', contextData = {} } = options;
    let attempts = 0;
    let lastError;
    const startTime = Date.now();
    // Initialize logger
    this.logger = createRetryLogger(correlationId);
    // First attempt (not counted as a retry)
    try {
      const result = await wrappedFn();
      // Log successful first attempt
      this.logger.retrySuccess(operationName, 1, Date.now() - startTime, contextData);
      return {
        success: true,
        result,
        attempts: 1,
        maxRetriesReached: false,
        totalTimeMs: Date.now() - startTime
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      attempts = 1;
      // Log the initial failure with structured retry logging
      this.logger.retryAttempt(operationName, attempts, this.config.maxRetries, lastError, contextData);
      // Also log to unified_audit_logs
      await this.logToUnifiedAuditLogs(supabaseClient, errorCategory, correlationId, operationName, lastError.message, contextData);
    }
    // Retry loop
    while(attempts <= this.config.maxRetries){
      // Calculate delay with exponential backoff
      const delay = this.calculateBackoffDelay(attempts);
      // Log that we're waiting to retry using enhanced logger
      if (this.logger) {
        this.logger.info(`Waiting ${delay}ms before retry ${attempts + 1} of ${this.config.maxRetries + 1}`, {
          retry_operation: operationName,
          retry_attempt: attempts,
          retry_next_attempt: attempts + 1,
          retry_delay_ms: delay,
          operationName,
          contextData
        });
      }
      // Wait for the calculated delay
      await new Promise((resolve)=>setTimeout(resolve, delay));
      // Also log to unified_audit_logs
      await this.logToUnifiedAuditLogs(supabaseClient, 'webhook_retry_attempt', correlationId, operationName, `Retry attempt ${attempts} of ${this.config.maxRetries + 1}`, {
        attempt: attempts,
        maxRetries: this.config.maxRetries,
        ...contextData
      });
      try {
        // Attempt the operation again
        const result = await fn();
        // Log successful retry using enhanced logger
        const totalTime = Date.now() - startTime;
        if (this.logger) {
          this.logger.retrySuccess(operationName, attempts, totalTime, contextData);
        }
        // Also log to unified_audit_logs
        await this.logToUnifiedAuditLogs(supabaseClient, 'webhook_retry_success', correlationId, operationName, `${operationName} succeeded after ${attempts} ${attempts === 1 ? 'retry' : 'retries'}`, {
          totalAttempts: attempts,
          totalTimeMs: totalTime,
          ...contextData
        });
        // Return success result
        return {
          success: true,
          result,
          attempts,
          maxRetriesReached: false,
          totalTimeMs: Date.now() - startTime
        };
      } catch (error) {
        // Update last error
        lastError = error instanceof Error ? error : new Error(String(error));
        // Log retry failure using enhanced logger
        if (this.logger) {
          this.logger.retryAttempt(operationName, attempts, this.config.maxRetries, lastError, {
            remainingRetries: this.config.maxRetries - attempts,
            ...contextData
          });
        }
        // Also log to unified_audit_logs
        await this.logToUnifiedAuditLogs(supabaseClient, errorCategory, correlationId, operationName, `Retry ${attempts} failed: ${lastError.message}`, {
          attempt: attempts,
          error: lastError.message,
          remainingRetries: this.config.maxRetries - attempts,
          ...contextData
        });
      }
    }
    // All retries exhausted - log final failure using enhanced logger
    const totalTime = Date.now() - startTime;
    if (this.logger && lastError) {
      this.logger.retryExhausted(operationName, attempts, totalTime, lastError, contextData);
    }
    // Also log to unified_audit_logs
    await this.logToUnifiedAuditLogs(supabaseClient, 'webhook_retry_exhausted', correlationId, operationName, `${operationName} failed after ${attempts} ${attempts === 1 ? 'attempt' : 'attempts'}, giving up`, {
      totalAttempts: attempts,
      finalError: lastError?.message,
      totalTimeMs: totalTime,
      ...contextData
    });
    // Return failure result
    return {
      success: false,
      error: lastError,
      attempts,
      maxRetriesReached: true,
      totalTimeMs: Date.now() - startTime
    };
  }
  /**
   * Calculates the delay for the next retry attempt using exponential backoff
   *
   * @param attempt - The current attempt number (0-based)
   * @returns The delay in milliseconds
   */ calculateBackoffDelay(attempt) {
    // Calculate exponential backoff: initialDelay * (backoffFactor ^ attempt)
    let delay = this.config.initialDelayMs * Math.pow(this.config.backoffFactor, attempt);
    // Cap at maximum delay
    delay = Math.min(delay, this.config.maxDelayMs);
    // Add jitter if enabled (±15% randomness)
    if (this.config.useJitter) {
      const jitterRange = delay * 0.15; // 15% jitter
      delay = delay - jitterRange + Math.random() * 2 * jitterRange;
    }
    return Math.floor(delay);
  }
  /**
   * Categorizes errors for better logging and monitoring
   *
   * @param error - The error to categorize
   * @returns A string category for the error
   */ categorizeError(error) {
    if (!error) return 'unknown';
    // Check for network errors
    if (error.message.includes('fetch failed') || error.message.includes('network') || error.message.includes('ECONNREFUSED') || error.message.includes('ETIMEDOUT')) {
      return 'network';
    }
    // Check for timeout errors
    if (error.message.includes('timeout') || error.message.includes('timed out')) {
      return 'timeout';
    }
    // Check for database errors
    if (error.message.includes('database') || error.message.includes('SQL') || error.message.includes('query') || error.message.includes('constraint')) {
      return 'database';
    }
    // Check for permission errors
    if (error.message.includes('permission') || error.message.includes('unauthorized') || error.message.includes('access denied') || error.message.includes('forbidden')) {
      return 'permission';
    }
    // Default to generic error
    return 'application';
  }
  /**
   * Logs directly to the unified_audit_logs table
   * This is a simplified version used alongside the enhanced Logger class
   *
   * @param supabaseClient - The Supabase client
   * @param eventType - The event type
   * @param correlationId - The correlation ID
   * @param operationName - The operation name
   * @param message - The log message
   * @param data - Additional data to log
   */ async logToUnifiedAuditLogs(supabaseClient, eventType, correlationId, operationName, message, data = {}) {
    try {
      const { error } = await supabaseClient.from('unified_audit_logs').insert({
        event_type: eventType,
        event_data: {
          operation: operationName,
          retry_data: data
        },
        correlation_id: correlationId,
        event_message: message,
        entity_id: crypto.randomUUID() // Generate a valid UUID for each log entry
      });
      if (error) {
        console.error(`Failed to log to unified_audit_logs: ${error.message}`);
      }
    } catch (error) {
      // If logging fails, output to console but don't throw (don't fail the retry because logging failed)
      console.error(`Error logging to unified_audit_logs: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
/**
 * Creates a RetryHandler with default configuration
 *
 * @returns A configured RetryHandler instance
 */ export function createRetryHandler(config = {}) {
  return new RetryHandler(config);
}
/**
 * Logger class for telegram-webhook function with enhanced retry support
 */ export class Logger {
  correlationId;
  source;
  constructor(correlationId, source = 'telegram-webhook'){
    this.correlationId = correlationId;
    this.source = source;
  }
  /**
   * Log a debug message
   */ debug(message, metadata = {}) {
    console.debug(`[${this.source}][${this.correlationId}] ${message}`, metadata);
  }
  /**
   * Log an info message
   */ info(message, metadata = {}) {
    console.info(`[${this.source}][${this.correlationId}] ${message}`, metadata);
  }
  /**
   * Log a warning message
   */ warn(message, metadata = {}) {
    console.warn(`[${this.source}][${this.correlationId}] ${message}`, metadata);
  }
  /**
   * Log an error message
   */ error(message, metadata = {}) {
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
   */ /**
   * Log a retry event
   *
   * @param operationName - The name of the operation being retried
   * @param attemptNumber - The attempt number (1-based)
   * @param maxRetries - The maximum number of retries
   * @param error - The error that caused the retry (if any)
   * @param metadata - Additional metadata
   */ retryAttempt(operationName, attemptNumber, maxRetries, error, metadata = {}) {
    const errorMessage = error instanceof Error ? error.message : error;
    this.info(`Retry attempt ${attemptNumber}/${maxRetries + 1} for operation: ${operationName}${errorMessage ? ` (Error: ${errorMessage})` : ''}`, {
      retry_operation: operationName,
      retry_attempt: attemptNumber,
      retry_max: maxRetries,
      retry_error: errorMessage,
      ...metadata
    });
    // Also log to database
    void this.logToDatabase('info', `Retry attempt ${attemptNumber}/${maxRetries + 1} for operation: ${operationName}`, {
      event_category: 'webhook_retry',
      retry_operation: operationName,
      retry_attempt: attemptNumber,
      retry_max: maxRetries,
      retry_error: errorMessage,
      ...metadata
    });
  }
  /**
   * Log a retry success
   *
   * @param operationName - The name of the operation that succeeded
   * @param attemptCount - The number of attempts it took to succeed
   * @param totalTimeMs - The total time it took to succeed
   * @param metadata - Additional metadata
   */ retrySuccess(operationName, attemptCount, totalTimeMs, metadata = {}) {
    this.info(`Operation ${operationName} succeeded after ${attemptCount} ${attemptCount === 1 ? 'attempt' : 'attempts'} (${totalTimeMs}ms)`, {
      retry_operation: operationName,
      retry_attempts: attemptCount,
      retry_total_time_ms: totalTimeMs,
      retry_outcome: 'success',
      ...metadata
    });
    // Also log to database
    void this.logToDatabase('info', `Operation ${operationName} succeeded after ${attemptCount} ${attemptCount === 1 ? 'attempt' : 'attempts'}`, {
      event_category: 'webhook_retry_success',
      retry_operation: operationName,
      retry_attempts: attemptCount,
      retry_total_time_ms: totalTimeMs,
      retry_outcome: 'success',
      ...metadata
    });
  }
  /**
   * Log a retry failure when all retries are exhausted
   *
   * @param operationName - The name of the operation that failed
   * @param attemptCount - The number of attempts made
   * @param totalTimeMs - The total time spent retrying
   * @param finalError - The final error that caused the operation to fail
   * @param metadata - Additional metadata
   */ retryExhausted(operationName, attemptCount, totalTimeMs, finalError, metadata = {}) {
    const errorMessage = finalError instanceof Error ? finalError.message : finalError;
    this.error(`Operation ${operationName} failed after ${attemptCount} ${attemptCount === 1 ? 'attempt' : 'attempts'} (${totalTimeMs}ms): ${errorMessage}`, {
      retry_operation: operationName,
      retry_attempts: attemptCount,
      retry_total_time_ms: totalTimeMs,
      retry_outcome: 'exhausted',
      retry_final_error: errorMessage,
      ...metadata
    });
    // Also log to database
    void this.logToDatabase('error', `Operation ${operationName} failed after ${attemptCount} ${attemptCount === 1 ? 'attempt' : 'attempts'}: ${errorMessage}`, {
      event_category: 'webhook_retry_exhausted',
      retry_operation: operationName,
      retry_attempts: attemptCount,
      retry_total_time_ms: totalTimeMs,
      retry_outcome: 'exhausted',
      retry_final_error: errorMessage,
      ...metadata
    });
  }
  /**
   * Log a message to the unified_audit_logs table
   *
   * @param level - Log level
   * @param message - Message to log
   * @param metadata - Additional metadata to include
   */ async logToDatabase(level, message, metadata = {}) {
    try {
      // Event type prefix is constructed from source and level
      const _eventType = `${this.source}_${level}`;
      // Generate a valid UUID if entity_id is missing or invalid
      let entityId = metadata.entity_id;
      // Validate UUID format using regex
      const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!entityId || !uuidPattern.test(entityId)) {
        // Generate a UUID v4 (random) silently without logging
        entityId = crypto.randomUUID();
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
 */ export function createRetryLogger(correlationId) {
  return new Logger(correlationId, 'retry-handler');
}
/**
 * Helper function to log a message with correlation ID
 *
 * @param correlationId - Correlation ID for request tracking
 * @param message - Message to log
 * @param level - Log level (default: 'info')
 * @param metadata - Additional metadata to include
 */ export function logWithCorrelation(correlationId, message, level = 'info', source = 'telegram-webhook', metadata = {}) {
  const logger = new Logger(correlationId, source);
  switch(level){
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
