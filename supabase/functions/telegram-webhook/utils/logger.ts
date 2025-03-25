
/**
 * Enhanced Logger for Edge Functions
 * 
 * This logger provides structured logging with correlation IDs,
 * component labels, and severity levels.
 */

// Log levels with color codes for console output
const LOG_LEVELS = {
  DEBUG: { value: 0, color: '\x1b[34m', emoji: '🔍', prefix: 'DEBUG' },
  INFO: { value: 1, color: '\x1b[32m', emoji: 'ℹ️', prefix: 'INFO' },
  SUCCESS: { value: 1, color: '\x1b[32m', emoji: '✅', prefix: 'SUCCESS' },
  WARN: { value: 2, color: '\x1b[33m', emoji: '⚠️', prefix: 'WARN' },
  ERROR: { value: 3, color: '\x1b[31m', emoji: '🔴', prefix: 'ERROR' },
  FATAL: { value: 4, color: '\x1b[41m', emoji: '💀', prefix: 'FATAL' }
};

// Reset color code for console
const RESET = '\x1b[0m';

// Minimum log level to display (can be configured)
const MIN_LOG_LEVEL = LOG_LEVELS.DEBUG.value;

export class Logger {
  private component: string;
  private correlationId: string;

  constructor(correlationId: string, component: string) {
    this.correlationId = correlationId;
    this.component = component;
  }

  /**
   * Format a log message with metadata
   */
  private formatLogMessage(level: any, message: string, data?: any): string {
    const timestamp = new Date().toISOString();
    const logData = {
      summary: `${level.emoji} [${level.prefix}] [${this.component}] ${message}`,
      level: level.prefix,
      correlation_id: this.correlationId,
      component: this.component,
      message,
      timestamp,
      ...data
    };
    
    return JSON.stringify(logData, null, 2);
  }

  /**
   * Generic log method
   */
  private log(level: any, message: string, data?: any): void {
    if (level.value >= MIN_LOG_LEVEL) {
      const formattedMessage = this.formatLogMessage(level, message, data);
      console.log(`${level.color}${formattedMessage}${RESET}`);
    }
  }

  /**
   * Log a debug message
   */
  debug(message: string, data?: any): void {
    this.log(LOG_LEVELS.DEBUG, message, data);
  }

  /**
   * Log an informational message
   */
  info(message: string, data?: any): void {
    this.log(LOG_LEVELS.INFO, message, data);
  }

  /**
   * Log a success message
   */
  success(message: string, data?: any): void {
    this.log(LOG_LEVELS.SUCCESS, message, data);
  }

  /**
   * Log a warning message
   */
  warn(message: string, data?: any): void {
    this.log(LOG_LEVELS.WARN, message, data);
  }

  /**
   * Log an error message
   */
  error(message: string, data?: any): void {
    this.log(LOG_LEVELS.ERROR, message, data);
  }

  /**
   * Log a fatal error message
   */
  fatal(message: string, data?: any): void {
    this.log(LOG_LEVELS.FATAL, message, data);
  }
}

/**
 * Create a new logger instance
 */
export function createLogger(component: string, correlationId?: string): Logger {
  return new Logger(correlationId || crypto.randomUUID(), component);
}
