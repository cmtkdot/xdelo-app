
import { supabase } from "@/integrations/supabase/client";

export type LogLevel = 'info' | 'warning' | 'error' | 'success' | 'debug';

export interface LogOptions {
  writeToDatabase?: boolean;
  useTimestamp?: boolean;
}

export class Logger {
  private name: string;
  private defaultOptions: LogOptions;

  constructor(name: string, options: LogOptions = {}) {
    this.name = name;
    this.defaultOptions = {
      writeToDatabase: true,
      useTimestamp: true,
      ...options
    };
  }

  /**
   * Log an informational message
   */
  info(message: string, data?: any, options?: LogOptions): void {
    this.log('info', message, data, options);
  }

  /**
   * Log a success message
   */
  success(message: string, data?: any, options?: LogOptions): void {
    this.log('success', message, data, options);
  }

  /**
   * Log a warning message
   */
  warn(message: string, data?: any, options?: LogOptions): void {
    this.log('warning', message, data, options);
  }

  /**
   * Log an error message
   */
  error(message: string, data?: any, options?: LogOptions): void {
    this.log('error', message, data, options);
  }

  /**
   * Log a debug message (only shown in development)
   */
  debug(message: string, data?: any, options?: LogOptions): void {
    if (process.env.NODE_ENV !== 'production') {
      this.log('debug', message, data, options);
    }
  }

  /**
   * Log an event to the unified audit logs system
   */
  async logEvent(
    eventType: string,
    entityId: string,
    metadata: Record<string, any> = {},
    errorMessage?: string
  ): Promise<void> {
    try {
      const enhancedMetadata = {
        ...metadata,
        timestamp: metadata.timestamp || new Date().toISOString(),
        logger: this.name,
        logged_from: 'client'
      };

      await supabase.from('unified_audit_logs').insert({
        event_type: eventType,
        entity_id: entityId,
        metadata: enhancedMetadata,
        error_message: errorMessage,
        event_timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error(`Error logging event: ${eventType}`, error);
    }
  }

  /**
   * Log a media operation
   */
  async logMediaOperation(
    operation: string,
    messageId: string,
    success: boolean,
    metadata: Record<string, any> = {}
  ): Promise<void> {
    const eventType = success ? 'media_operation_success' : 'media_operation_failed';
    
    await this.logEvent(eventType, messageId, {
      operation,
      ...metadata
    });
  }

  /**
   * Internal logging method
   */
  private log(level: LogLevel, message: string, data?: any, options?: LogOptions): void {
    const mergedOptions = { ...this.defaultOptions, ...options };
    const timestamp = mergedOptions.useTimestamp ? new Date().toISOString() : null;
    const prefix = `[${this.name}]${timestamp ? ` [${timestamp}]` : ''}`;
    
    // Format the message for console
    const formattedMessage = `${prefix} ${message}`;
    
    // Log to console with appropriate level
    switch (level) {
      case 'info':
        console.info(formattedMessage, data || '');
        break;
      case 'warning':
        console.warn(formattedMessage, data || '');
        break;
      case 'error':
        console.error(formattedMessage, data || '');
        break;
      case 'success':
        console.log(`%c${formattedMessage}`, 'color: green', data || '');
        break;
      case 'debug':
        console.debug(formattedMessage, data || '');
        break;
    }

    // Optionally write to database
    if (mergedOptions.writeToDatabase) {
      this.logToDatabase(level, message, data);
    }
  }

  /**
   * Write a log entry to the database
   */
  private async logToDatabase(level: LogLevel, message: string, data?: any): Promise<void> {
    try {
      await supabase.from('unified_audit_logs').insert({
        event_type: `client_${level}`,
        entity_id: 'system',
        metadata: {
          message,
          data,
          logger: this.name,
          timestamp: new Date().toISOString(),
          logged_from: 'client'
        },
        event_timestamp: new Date().toISOString()
      });
    } catch (error) {
      // Don't log this error to avoid infinite loops
      console.error(`Error writing log to database: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

/**
 * Create a new logger instance
 */
export function createLogger(name: string, options?: LogOptions): Logger {
  return new Logger(name, options);
}
