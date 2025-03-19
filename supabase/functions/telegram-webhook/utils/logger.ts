
// Logger utility for Telegram webhook with correlation ID tracking
export class Logger {
  private correlationId: string;
  private component: string;
  
  constructor(correlationId: string, component: string) {
    this.correlationId = correlationId;
    this.component = component;
  }
  
  /**
   * Log an informational message
   */
  info(message: string, data: Record<string, any> = {}) {
    this._log('INFO', message, data);
  }
  
  /**
   * Log a warning message
   */
  warn(message: string, data: Record<string, any> = {}) {
    this._log('WARN', message, data);
  }
  
  /**
   * Log an error message
   */
  error(message: string, data: Record<string, any> = {}) {
    this._log('ERROR', message, data);
  }
  
  /**
   * Log a debug message
   */
  debug(message: string, data: Record<string, any> = {}) {
    this._log('DEBUG', message, data);
  }
  
  /**
   * Internal logging function
   */
  private _log(level: string, message: string, data: Record<string, any> = {}) {
    console.log(JSON.stringify({
      level,
      correlation_id: this.correlationId,
      component: this.component,
      message,
      timestamp: new Date().toISOString(),
      ...data
    }, null, 2));
  }
}

/**
 * Create a child logger with a sub-component name
 */
export function createChildLogger(parentLogger: Logger, subComponent: string): Logger {
  // For now just return a new logger - in future we could track hierarchy
  return new Logger(
    // @ts-ignore - accessing private property
    parentLogger.correlationId,
    // @ts-ignore - accessing private property
    `${parentLogger.component}/${subComponent}`
  );
}
