
/**
 * Improved Logger utility with correlation ID tracking
 * and structured logging output
 */
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
    }));
  }
  
  /**
   * Create a child logger with a sub-component name
   */
  child(subComponent: string): Logger {
    return new Logger(
      this.correlationId,
      `${this.component}/${subComponent}`
    );
  }
}

/**
 * Create a request-scoped logger
 */
export function createRequestLogger(
  req: Request, 
  component: string
): Logger {
  // Get correlation ID from header or generate a new one
  const correlationId = req.headers.get('x-correlation-id') || crypto.randomUUID();
  return new Logger(correlationId, component);
}

/**
 * Create a logger for a specific component with a new correlation ID
 */
export function createComponentLogger(component: string): Logger {
  return new Logger(crypto.randomUUID(), component);
}
