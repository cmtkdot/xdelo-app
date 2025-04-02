/**
 * Simple logger utility that handles structured logging with correlation IDs
 */
export class Logger {
  private correlationId: string;
  private component: string;

  constructor(correlationId: string, component: string) {
    this.correlationId = correlationId;
    this.component = component;
  }

  /**
   * Format a log entry with metadata
   */
  private formatLog(level: string, message: string, data?: Record<string, any>): Record<string, any> {
    return {
      level,
      timestamp: new Date().toISOString(),
      component: this.component,
      correlationId: this.correlationId,
      message,
      ...(data || {})
    };
  }

  /**
   * Log debug level message
   */
  debug(message: string, data?: Record<string, any>): void {
    console.debug(JSON.stringify(this.formatLog('debug', message, data)));
  }

  /**
   * Log info level message
   */
  info(message: string, data?: Record<string, any>): void {
    console.info(JSON.stringify(this.formatLog('info', message, data)));
  }

  /**
   * Log warning level message
   */
  warn(message: string, data?: Record<string, any>): void {
    console.warn(JSON.stringify(this.formatLog('warn', message, data)));
  }

  /**
   * Log error level message
   */
  error(message: string, data?: Record<string, any>): void {
    console.error(JSON.stringify(this.formatLog('error', message, data)));
  }
} 