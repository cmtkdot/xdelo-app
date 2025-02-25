/**
 * Logger utility for consistent logging with correlation IDs
 */

export interface Logger {
  info(message: string, metadata?: Record<string, unknown>): void;
  warn(message: string, metadata?: Record<string, unknown>): void;
  error(message: string, metadata?: Record<string, unknown>): void;
}

/**
 * Creates a logger with a correlation ID for consistent logging
 * @param correlationId - The correlation ID to include in all log messages
 * @returns A logger object with info, warn, and error methods
 */
export function getLogger(correlationId: string): Logger {
  return {
    info(message: string, metadata: Record<string, unknown> = {}) {
      console.log(JSON.stringify({
        level: 'info',
        message,
        correlation_id: correlationId,
        timestamp: new Date().toISOString(),
        ...metadata
      }));
    },
    
    warn(message: string, metadata: Record<string, unknown> = {}) {
      console.warn(JSON.stringify({
        level: 'warn',
        message,
        correlation_id: correlationId,
        timestamp: new Date().toISOString(),
        ...metadata
      }));
    },
    
    error(message: string, metadata: Record<string, unknown> = {}) {
      console.error(JSON.stringify({
        level: 'error',
        message,
        correlation_id: correlationId,
        timestamp: new Date().toISOString(),
        ...metadata
      }));
    }
  };
}
