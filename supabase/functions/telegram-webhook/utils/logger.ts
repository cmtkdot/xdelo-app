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
    try {
      return {
        level,
        timestamp: new Date().toISOString(),
        component: this.component,
        correlationId: this.correlationId,
        message,
        ...(data || {})
      };
    } catch (error) {
      // Fallback to a minimal log format if anything fails
      return {
        level,
        message: `${message} (error formatting full log: ${error.message})`,
        error_formatting: true
      };
    }
  }

  /**
   * Safely stringify log data with fallbacks
   */
  private safeStringify(data: any): string {
    try {
      return JSON.stringify(data);
    } catch (error) {
      return JSON.stringify({
        level: 'error',
        message: 'Failed to stringify log data',
        error: error.message
      });
    }
  }

  /**
   * Log debug level message
   */
  debug(message: string, data?: Record<string, any>): void {
    try {
      console.debug(this.safeStringify(this.formatLog('debug', message, data)));
    } catch (error) {
      // Fallback to simple logging if structured logging fails
      console.debug(`[DEBUG] ${message} (logging error: ${error.message})`);
    }
  }

  /**
   * Log info level message
   */
  info(message: string, data?: Record<string, any>): void {
    try {
      console.info(this.safeStringify(this.formatLog('info', message, data)));
    } catch (error) {
      // Fallback to simple logging if structured logging fails
      console.info(`[INFO] ${message} (logging error: ${error.message})`);
    }
  }

  /**
   * Log success level message
   */
  success(message: string, data?: Record<string, any>): void {
    try {
      console.info(this.safeStringify(this.formatLog('success', message, data)));
    } catch (error) {
      // Fallback to simple logging if structured logging fails
      console.info(`[SUCCESS] ${message} (logging error: ${error.message})`);
    }
  }

  /**
   * Log warning level message
   */
  warn(message: string, data?: Record<string, any>): void {
    try {
      console.warn(this.safeStringify(this.formatLog('warn', message, data)));
    } catch (error) {
      // Fallback to simple logging if structured logging fails
      console.warn(`[WARN] ${message} (logging error: ${error.message})`);
    }
  }

  /**
   * Log error level message
   */
  error(message: string, data?: Record<string, any>): void {
    try {
      console.error(this.safeStringify(this.formatLog('error', message, data)));
    } catch (error) {
      // Fallback to simple logging if structured logging fails
      console.error(`[ERROR] ${message} (logging error: ${error.message})`);
    }
  }
} 