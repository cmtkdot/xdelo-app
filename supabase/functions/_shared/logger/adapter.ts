
import { Logger } from './index.ts';

/**
 * Consistent interface for logging operations
 */
export interface LoggerInterface {
  error: (message: string, error: unknown) => void;
  info: (message: string, data?: Record<string, any>) => void;
  warn: (message: string, data?: Record<string, any>) => void;
}

/**
 * Create a standardized logger adapter that implements the LoggerInterface
 * This ensures we have a consistent logging approach across all handlers
 */
export function createLoggerAdapter(logger?: Logger, correlationId?: string): LoggerInterface {
  if (logger) {
    return {
      error: (message: string, error: unknown): void => {
        logger.error(message, error);
      },
      info: (message: string, data?: Record<string, any>): void => {
        logger.info(message, data || {});
      },
      warn: (message: string, data?: Record<string, any>): void => {
        logger.warn(message, data || {});
      }
    };
  }
  
  // Fallback to console if no logger is provided
  return {
    error: (message: string, error: unknown): void => console.error(message, error),
    info: (message: string, data?: Record<string, any>): void => console.info(message, data || {}),
    warn: (message: string, data?: Record<string, any>): void => console.warn(message, data || {})
  };
}
