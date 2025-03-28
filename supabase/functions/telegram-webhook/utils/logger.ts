
/**
 * Logger utility for consistent log formatting
 */

export class Logger {
  private correlationId: string;
  private component: string;

  constructor(correlationId: string, component: string) {
    this.correlationId = correlationId;
    this.component = component;
  }

  /**
   * Formats a log message with standardized fields
   */
  private formatLog(level: string, message: string, details: Record<string, any> = {}): string {
    const timestamp = new Date().toISOString();
    const summary = `${this.getLogLevelEmoji(level)} [${level.toUpperCase()}] [${this.component}] ${message}`;
    
    const logObj = {
      summary,
      level,
      correlation_id: this.correlationId,
      component: this.component,
      message,
      timestamp,
      ...details
    };

    return JSON.stringify(logObj, null, 2);
  }

  /**
   * Gets an emoji for the log level
   */
  private getLogLevelEmoji(level: string): string {
    switch (level.toLowerCase()) {
      case 'error': return '🔴';
      case 'warn': return '🟠';
      case 'info': return '🔵';
      case 'debug': return '🟣';
      case 'success': return '🟢';
      default: return '⚪';
    }
  }

  /**
   * Logs an info message
   */
  info(message: string, details: Record<string, any> = {}): void {
    console.log(this.formatLog('info', message, details));
  }

  /**
   * Logs an error message
   */
  error(message: string, details: Record<string, any> = {}): void {
    console.error(this.formatLog('error', message, details));
  }

  /**
   * Logs a warning message
   */
  warn(message: string, details: Record<string, any> = {}): void {
    console.warn(this.formatLog('warn', message, details));
  }

  /**
   * Logs a debug message
   */
  debug(message: string, details: Record<string, any> = {}): void {
    console.debug(this.formatLog('debug', message, details));
  }

  /**
   * Logs a success message
   */
  success(message: string, details: Record<string, any> = {}): void {
    console.log(this.formatLog('success', message, details));
  }
}
