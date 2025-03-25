
import { xdelo_logProcessingEvent } from './databaseOperations.ts';
import { corsHeaders } from './cors.ts';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'success';

/**
 * Logger class for consistent logging across the application
 * with database integration
 */
export class Logger {
  private correlationId: string;
  private component: string;
  
  constructor(correlationId: string, component: string) {
    this.correlationId = correlationId;
    this.component = component;
  }
  
  /**
   * Log a debug message
   */
  debug(message: string, metadata: Record<string, any> = {}): void {
    this.log('DEBUG', message, metadata);
  }
  
  /**
   * Log an info message
   */
  info(message: string, metadata: Record<string, any> = {}): void {
    this.log('INFO', message, metadata);
  }
  
  /**
   * Log a warning message
   */
  warn(message: string, metadata: Record<string, any> = {}): void {
    this.log('WARN', message, metadata);
  }
  
  /**
   * Log an error message
   */
  error(message: string, metadata: Record<string, any> = {}, errorMessage?: string): void {
    this.log('ERROR', message, metadata, errorMessage);
  }
  
  /**
   * Log a success message
   */
  success(message: string, metadata: Record<string, any> = {}): void {
    this.log('SUCCESS', message, metadata);
  }
  
  /**
   * Internal logging function
   */
  private log(level: string, message: string, metadata: Record<string, any> = {}, errorMessage?: string): void {
    // Format for console logging
    const logData = {
      summary: `${this.getLogLevelEmoji(level)} [${level}] [${this.component}] ${message}`,
      level,
      correlation_id: this.correlationId,
      component: this.component,
      message,
      timestamp: new Date().toISOString(),
      ...metadata
    };
    
    // Output to console
    console.log(JSON.stringify(logData, null, 2));
    
    // For errors and warnings, also log to database
    if (level === 'ERROR' || level === 'WARN') {
      try {
        xdelo_logProcessingEvent(
          `log_${level.toLowerCase()}`,
          metadata.message_id || metadata.entity_id || 'system',
          this.correlationId,
          { ...metadata, log_message: message, component: this.component },
          errorMessage || (level === 'ERROR' ? message : undefined)
        ).catch(err => {
          console.error(`Failed to log to database: ${err.message}`);
        });
      } catch (error) {
        console.error(`Failed to log to database: ${error.message}`);
      }
    }
  }
  
  /**
   * Get an emoji for the log level
   */
  private getLogLevelEmoji(level: string): string {
    switch (level) {
      case 'DEBUG': return '🔍';
      case 'INFO': return 'ℹ️';
      case 'WARN': return '⚠️';
      case 'ERROR': return '❌';
      case 'SUCCESS': return '✅';
      default: return '📝';
    }
  }
  
  /**
   * Helper to log message routing decisions
   */
  logRouting(messageId: number, routeType: string, hasMedia: boolean, isEdit: boolean): void {
    this.info(`Routing message to ${routeType} handler`, {
      message_id: messageId,
      has_media: hasMedia,
      is_edit: isEdit,
      routing_decision: routeType
    });
  }
}

/**
 * Create a logger with the error response wrapper
 */
export function createLoggerWithErrorHandling(correlationId: string, component: string) {
  const logger = new Logger(correlationId, component);
  
  return {
    logger,
    handleError: (error: Error, statusCode: number = 500, extraData: Record<string, any> = {}) => {
      // Log the error
      logger.error(error.message, {
        ...extraData,
        stack: error.stack,
      });
      
      // Return a standardized error response
      return new Response(
        JSON.stringify({
          error: error.message,
          ...extraData,
          correlationId
        }),
        {
          status: statusCode,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        }
      );
    }
  };
}
