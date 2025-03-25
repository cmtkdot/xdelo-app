
/**
 * Simple logger interface for use in Telegram webhook handlers
 */
export interface Logger {
  debug(message: string, metadata?: Record<string, any>): void;
  info(message: string, metadata?: Record<string, any>): void;
  warn(message: string, metadata?: Record<string, any>): void;
  error(message: string, metadata?: Record<string, any>, errorMessage?: string): void;
  success(message: string, metadata?: Record<string, any>): void;
}

/**
 * Create a simple console logger
 */
export function createLogger(component: string, correlationId: string): Logger {
  return {
    debug(message: string, metadata: Record<string, any> = {}) {
      console.log(JSON.stringify({
        level: 'DEBUG',
        component,
        correlation_id: correlationId,
        message,
        ...metadata,
        timestamp: new Date().toISOString()
      }));
    },
    
    info(message: string, metadata: Record<string, any> = {}) {
      console.log(JSON.stringify({
        level: 'INFO',
        component,
        correlation_id: correlationId,
        message,
        ...metadata,
        timestamp: new Date().toISOString()
      }));
    },
    
    warn(message: string, metadata: Record<string, any> = {}) {
      console.log(JSON.stringify({
        level: 'WARN',
        component,
        correlation_id: correlationId,
        message,
        ...metadata,
        timestamp: new Date().toISOString()
      }));
    },
    
    error(message: string, metadata: Record<string, any> = {}, errorMessage?: string) {
      console.error(JSON.stringify({
        level: 'ERROR',
        component,
        correlation_id: correlationId,
        message,
        ...metadata,
        error: errorMessage,
        timestamp: new Date().toISOString()
      }));
    },
    
    success(message: string, metadata: Record<string, any> = {}) {
      console.log(JSON.stringify({
        level: 'SUCCESS',
        component,
        correlation_id: correlationId,
        message,
        ...metadata,
        timestamp: new Date().toISOString()
      }));
    }
  };
}
