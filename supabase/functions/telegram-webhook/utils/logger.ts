
/**
 * Simple Logger class for structured logging in Edge Functions
 */
export class Logger {
  private correlationId: string;
  private context: string;
  
  constructor(correlationId: string, context: string) {
    this.correlationId = correlationId;
    this.context = context;
  }
  
  /**
   * Log debug level information
   */
  debug(message: string, data?: Record<string, any>) {
    this.log('debug', message, data);
  }
  
  /**
   * Log info level information
   */
  info(message: string, data?: Record<string, any>) {
    this.log('info', message, data);
  }
  
  /**
   * Log warning level information
   */
  warn(message: string, data?: Record<string, any>) {
    this.log('warn', message, data);
  }
  
  /**
   * Log error level information
   */
  error(message: string, data?: Record<string, any>) {
    this.log('error', message, data);
  }
  
  /**
   * Internal log method with standardized format
   */
  private log(level: string, message: string, data?: Record<string, any>) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      context: this.context,
      correlationId: this.correlationId,
      message,
      ...data
    };
    
    // Use appropriate console method based on level
    switch (level) {
      case 'debug':
        console.debug(JSON.stringify(logEntry));
        break;
      case 'warn':
        console.warn(JSON.stringify(logEntry));
        break;
      case 'error':
        console.error(JSON.stringify(logEntry));
        break;
      default:
        console.log(JSON.stringify(logEntry));
    }
  }
}
