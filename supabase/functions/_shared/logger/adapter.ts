import { Logger } from './index.ts';

/**
 * Consistent interface for logging operations
 */
export interface LoggerInterface {
  error: (message: string, error: unknown) => void;
  info?: (message: string, data?: unknown) => void;
  warn?: (message: string, data?: unknown) => void;
  debug?: (message: string, data?: unknown) => void;
  success?: (message: string, data?: unknown) => void;
}

/**
 * Create a standardized logger adapter that implements the LoggerInterface
 * This ensures we have a consistent logging approach across all handlers
 */
export function createLoggerAdapter(logger?: Logger, correlationId?: string): LoggerInterface {
  if (logger) {
    return {
      error: (message: string, error: unknown): void => {
        logger.error(message, error as Record<string, any>);
      },
      info: (message: string, data?: unknown): void => {
        logger.info(message, data as Record<string, any>);
      },
      warn: (message: string, data?: unknown): void => {
        logger.warn(message, data as Record<string, any>);
      },
      debug: (message: string, data?: unknown): void => {
        logger.debug(message, data as Record<string, any>);
      },
      success: (message: string, data?: unknown): void => {
        logger.success(message, data as Record<string, any>);
      }
    };
  }
  
  // Fallback to console if no logger is provided
  return {
    error: (message: string, error: unknown): void => console.error(message, error),
    info: (message: string, data?: unknown): void => console.info(message, data),
    warn: (message: string, data?: unknown): void => console.warn(message, data),
    debug: (message: string, data?: unknown): void => console.debug(message, data),
    success: (message: string, data?: unknown): void => console.log(`✅ ${message}`, data)
  };
}
