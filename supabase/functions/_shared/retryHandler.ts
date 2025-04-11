/// <reference types="https://esm.sh/@supabase/functions-js/edge-runtime.d.ts" />

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { Logger, createRetryLogger } from "../telegram-webhook/utils/logger.ts";

/**
 * Configuration for the RetryHandler
 */
export interface RetryConfig {
  /** Maximum number of retry attempts */
  maxRetries: number;
  
  /** Initial delay between retries in milliseconds */
  initialDelayMs: number;
  
  /** Maximum delay between retries in milliseconds */
  maxDelayMs: number;
  
  /** Backoff factor - how quickly the delay increases (2.0 is standard exponential backoff) */
  backoffFactor: number;
  
  /** Whether to add jitter (randomness) to the delay to prevent thundering herd problem */
  useJitter?: boolean;
}

/**
 * Options for executing a retryable operation
 */
export interface RetryExecuteOptions {
  /** Operation name for logging */
  operationName: string;
  
  /** Correlation ID for tracking the request across retries */
  correlationId: string;
  
  /** SupabaseClient for logging to unified_audit_logs */
  supabaseClient: SupabaseClient;
  
  /** Custom error category for logging (defaults to 'webhook_error') */
  errorCategory?: string;
  
  /** Context data to include in logs */
  contextData?: Record<string, any>;
  
  /** Optional timeout in milliseconds for each retry attempt */
  timeoutMs?: number;
}

/**
 * Result of a retry operation
 */
export interface RetryResult<T> {
  /** Whether the operation succeeded eventually */
  success: boolean;
  
  /** The result of the operation if successful */
  result?: T;
  
  /** The error that caused all retries to fail */
  error?: Error;
  
  /** Number of retry attempts made */
  attempts: number;
  
  /** Whether the maximum retry count was reached */
  maxRetriesReached: boolean;
  
  /** Total time spent in retries (ms) */
  totalTimeMs: number;
}

/**
 * A utility class that implements a robust retry mechanism with exponential backoff
 * for handling transient failures in network requests and other operations.
 */
export class RetryHandler {
  private config: RetryConfig;
  private logger?: Logger;
  
  /**
   * Creates a new RetryHandler with the specified configuration
   * 
   * @param config - Configuration for the retry behavior
   */
  constructor(config: Partial<RetryConfig> = {}) {
    // Default configuration
    this.config = {
      maxRetries: 3,
      initialDelayMs: 30000, // 30 seconds
      maxDelayMs: 300000, // 5 minutes
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
   */
  private withTimeout<T>(fn: () => Promise<T>, timeoutMs: number): () => Promise<T> {
    return async () => {
      return new Promise<T>(async (resolve, reject) => {
        const timeoutId = setTimeout(() => {
          reject(new Error(`Operation timed out after ${timeoutMs}ms`));
        }, timeoutMs);
        
        try {
          const result = await fn();
          clearTimeout(timeoutId);
          resolve(result);
        } catch (error) {
          clearTimeout(timeoutId);
          reject(error);
        }
      });
    };
  }

  /**
   * Executes a function with retry logic
   * 
   * @param fn - The function to execute with retry logic
   * @param options - Options for the retry operation
   * @returns A promise that resolves to the result of the function or rejects after all retries fail
   */
  async execute<T>(
    fn: () => Promise<T>,
    options: RetryExecuteOptions
  ): Promise<RetryResult<T>> {
    // Add a timeout if specified in the options
    const wrappedFn = options.timeoutMs ? this.withTimeout(fn, options.timeoutMs) : fn;
    const { 
      operationName,
      correlationId,
      supabaseClient,
      errorCategory = 'webhook_error',
      contextData = {}
    } = options;

    let attempts = 0;
    let lastError: Error | undefined;
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
      this.logger.retryAttempt(
        operationName,
        attempts,
        this.config.maxRetries,
        lastError,
        contextData
      );
      
      // Also log to unified_audit_logs
      await this.logToUnifiedAuditLogs(
        supabaseClient,
        errorCategory,
        correlationId,
        operationName,
        lastError.message,
        contextData
      );
    }
    
    // Retry loop
    while (attempts <= this.config.maxRetries) {
      // Calculate delay with exponential backoff
      const delay = this.calculateBackoffDelay(attempts);
      
      // Log that we're waiting to retry using enhanced logger
      if (this.logger) {
        this.logger.info(
          `Waiting ${delay}ms before retry ${attempts + 1} of ${this.config.maxRetries + 1}`,
          {
            retry_operation: operationName,
            retry_attempt: attempts,
            retry_next_attempt: attempts + 1,
            retry_delay_ms: delay,
            operationName,
            contextData
          }
        );
      }
      
      // Wait for the calculated delay
      await new Promise(resolve => setTimeout(resolve, delay));
      
      // Also log to unified_audit_logs
      await this.logToUnifiedAuditLogs(
        supabaseClient,
        'webhook_retry_attempt',
        correlationId,
        operationName,
        `Retry attempt ${attempts} of ${this.config.maxRetries + 1}`,
        { attempt: attempts, maxRetries: this.config.maxRetries, ...contextData }
      );
      
      try {
        // Attempt the operation again
        const result = await fn();
        
        // Log successful retry using enhanced logger
        const totalTime = Date.now() - startTime;
        
        if (this.logger) {
          this.logger.retrySuccess(
            operationName,
            attempts,
            totalTime,
            contextData
          );
        }
        
        // Also log to unified_audit_logs
        await this.logToUnifiedAuditLogs(
          supabaseClient,
          'webhook_retry_success',
          correlationId,
          operationName,
          `${operationName} succeeded after ${attempts} ${attempts === 1 ? 'retry' : 'retries'}`,
          { totalAttempts: attempts, totalTimeMs: totalTime, ...contextData }
        );
        
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
          this.logger.retryAttempt(
            operationName,
            attempts,
            this.config.maxRetries,
            lastError,
            { remainingRetries: this.config.maxRetries - attempts, ...contextData }
          );
        }
        
        // Also log to unified_audit_logs
        await this.logToUnifiedAuditLogs(
          supabaseClient,
          errorCategory,
          correlationId,
          operationName,
          `Retry ${attempts} failed: ${lastError.message}`,
          { 
            attempt: attempts,
            error: lastError.message,
            remainingRetries: this.config.maxRetries - attempts,
            ...contextData
          }
        );
      }
    }
    
    // All retries exhausted - log final failure using enhanced logger
    const totalTime = Date.now() - startTime;
    
    if (this.logger && lastError) {
      this.logger.retryExhausted(
        operationName,
        attempts,
        totalTime,
        lastError,
        contextData
      );
    }
    
    // Also log to unified_audit_logs
    await this.logToUnifiedAuditLogs(
      supabaseClient,
      'webhook_retry_exhausted',
      correlationId,
      operationName,
      `${operationName} failed after ${attempts} ${attempts === 1 ? 'attempt' : 'attempts'}, giving up`,
      {
        totalAttempts: attempts,
        finalError: lastError?.message,
        totalTimeMs: totalTime,
        ...contextData
      }
    );
    
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
   */
  private calculateBackoffDelay(attempt: number): number {
    // Calculate exponential backoff: initialDelay * (backoffFactor ^ attempt)
    let delay = this.config.initialDelayMs * Math.pow(this.config.backoffFactor, attempt);
    
    // Cap at maximum delay
    delay = Math.min(delay, this.config.maxDelayMs);
    
    // Add jitter if enabled (±15% randomness)
    if (this.config.useJitter) {
      const jitterRange = delay * 0.15; // 15% jitter
      delay = delay - jitterRange + (Math.random() * 2 * jitterRange);
    }
    
    return Math.floor(delay);
  }
  
  /**
   * Categorizes errors for better logging and monitoring
   * 
   * @param error - The error to categorize
   * @returns A string category for the error
   */
  private categorizeError(error?: Error): string {
    if (!error) return 'unknown';
    
    // Check for network errors
    if (
      error.message.includes('fetch failed') ||
      error.message.includes('network') ||
      error.message.includes('ECONNREFUSED') ||
      error.message.includes('ETIMEDOUT')
    ) {
      return 'network';
    }
    
    // Check for timeout errors
    if (
      error.message.includes('timeout') ||
      error.message.includes('timed out')
    ) {
      return 'timeout';
    }
    
    // Check for database errors
    if (
      error.message.includes('database') ||
      error.message.includes('SQL') ||
      error.message.includes('query') ||
      error.message.includes('constraint')
    ) {
      return 'database';
    }
    
    // Check for permission errors
    if (
      error.message.includes('permission') ||
      error.message.includes('unauthorized') ||
      error.message.includes('access denied') ||
      error.message.includes('forbidden')
    ) {
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
   */
  private async logToUnifiedAuditLogs(
    supabaseClient: SupabaseClient,
    eventType: string,
    correlationId: string,
    operationName: string,
    message: string,
    data: Record<string, any> = {}
  ): Promise<void> {
    try {
      const { error } = await supabaseClient
        .from('unified_audit_logs')
        .insert({
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
 */
export function createRetryHandler(config: Partial<RetryConfig> = {}): RetryHandler {
  return new RetryHandler(config);
}
