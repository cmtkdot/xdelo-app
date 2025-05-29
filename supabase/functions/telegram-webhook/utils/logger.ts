// Import necessary dependencies
import { supabaseClient } from "../_shared/supabaseClient.ts";
/**
 * Logger class for telegram-webhook function with enhanced retry support
 */ export class Logger {
  correlationId;
  source;
  constructor(correlationId, source = "telegram-webhook"){
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
      void this.logToDatabase("error", message, metadata);
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
    this.info(`Retry attempt ${attemptNumber}/${maxRetries + 1} for operation: ${operationName}${errorMessage ? ` (Error: ${errorMessage})` : ""}`, {
      retry_operation: operationName,
      retry_attempt: attemptNumber,
      retry_max: maxRetries,
      retry_error: errorMessage,
      ...metadata
    });
    // Also log to database
    void this.logToDatabase("info", `Retry attempt ${attemptNumber}/${maxRetries + 1} for operation: ${operationName}`, {
      event_category: "webhook_retry",
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
    this.info(`Operation ${operationName} succeeded after ${attemptCount} ${attemptCount === 1 ? "attempt" : "attempts"} (${totalTimeMs}ms)`, {
      retry_operation: operationName,
      retry_attempts: attemptCount,
      retry_total_time_ms: totalTimeMs,
      retry_outcome: "success",
      ...metadata
    });
    // Also log to database
    void this.logToDatabase("info", `Operation ${operationName} succeeded after ${attemptCount} ${attemptCount === 1 ? "attempt" : "attempts"}`, {
      event_category: "webhook_retry_success",
      retry_operation: operationName,
      retry_attempts: attemptCount,
      retry_total_time_ms: totalTimeMs,
      retry_outcome: "success",
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
    this.error(`Operation ${operationName} failed after ${attemptCount} ${attemptCount === 1 ? "attempt" : "attempts"} (${totalTimeMs}ms): ${errorMessage}`, {
      retry_operation: operationName,
      retry_attempts: attemptCount,
      retry_total_time_ms: totalTimeMs,
      retry_outcome: "exhausted",
      retry_final_error: errorMessage,
      ...metadata
    });
    // Also log to database
    void this.logToDatabase("error", `Operation ${operationName} failed after ${attemptCount} ${attemptCount === 1 ? "attempt" : "attempts"}: ${errorMessage}`, {
      event_category: "webhook_retry_exhausted",
      retry_operation: operationName,
      retry_attempts: attemptCount,
      retry_total_time_ms: totalTimeMs,
      retry_outcome: "exhausted",
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
      // Note: Console statements are part of the logging functionality
      // Generate a valid UUID if entity_id is missing or invalid
      let entityId = metadata.entity_id;
      // Validate UUID format using regex
      const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!entityId || !uuidPattern.test(entityId)) {
        // Generate a UUID v4 (random) silently without logging
        entityId = crypto.randomUUID();
      }
      // Determine event type based on category if provided
      const eventType = metadata.event_category || `${this.source}_${level}`;
      delete metadata.event_category; // Remove to avoid duplication
      await supabaseClient.from("unified_audit_logs").insert({
        event_type: eventType,
        entity_id: entityId,
        message,
        metadata: {
          ...metadata,
          source: this.source,
          logger: "edge-function"
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
  return new Logger(correlationId, "retry-handler");
}
// Logger exports below
/**
 * Primary function to log processing events
 *
 * @param event_type - The type of event being logged
 * @param entity_id - The ID of the entity related to this log
 * @param correlation_id - Correlation ID for request tracking
 * @param metadata - Additional metadata to include
 * @param error - Optional error to log
 */ export async function logProcessingEvent(event_type, entity_id, correlation_id, metadata, error) {
  // First, log to console for immediate visibility
  const logPrefix = `[${metadata.source || "telegram-webhook"}][${correlation_id}]`;
  const message = metadata.message || "";
  if (error) {
    console.error(`${logPrefix} ${message}`, {
      ...metadata,
      error: error instanceof Error ? error.message : String(error)
    });
  } else {
    console.info(`${logPrefix} ${message}`, metadata);
  }
  // Then, log to the database
  try {
    const { error: dbError } = await supabaseClient.from("unified_audit_logs").insert({
      event_type: event_type,
      entity_id: entity_id,
      correlation_id: correlation_id,
      metadata: metadata,
      error_message: error ? error instanceof Error ? error.message : String(error) : null
    });
    if (dbError) {
      console.error(`${logPrefix} DB error logging processing event:`, dbError);
    }
  } catch (e) {
    console.error(`${logPrefix} Exception logging processing event:`, e);
  }
}
/**
 * Backward compatible wrapper for logWithCorrelation
 *
 * @param correlationId - Correlation ID for request tracking
 * @param message - Message to log
 * @param level - Log level (default: 'info')
 * @param source - Source of the log (default: 'telegram-webhook')
 * @param metadata - Additional metadata to include
 */ export function logWithCorrelation(correlationId, message, level = "info", source = "telegram-webhook", metadata = {}) {
  // Construct the event type from source and level
  const event_type = `${source}_${level}`;
  // Use entity_id from metadata or generate UUID
  const entity_id = metadata.entity_id || crypto.randomUUID();
  // Enhance metadata with additional context
  const enhanced_metadata = {
    message,
    source,
    level,
    ...metadata
  };
  // Call the new function without awaiting to maintain backward compatibility
  // with code that doesn't expect logWithCorrelation to be async
  void logProcessingEvent(event_type, entity_id, correlationId, enhanced_metadata, level === "error" ? message : undefined);
}
