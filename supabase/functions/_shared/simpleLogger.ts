
/**
 * Simplified logger for edge functions
 */
export class EdgeLogger {
  private context: string;
  private correlationId: string;

  constructor(context: string, correlationId?: string) {
    this.context = context;
    this.correlationId = correlationId || crypto.randomUUID().toString();
  }

  /**
   * Log with a specific level
   */
  log(level: string, message: string, data: Record<string, any> = {}) {
    console.log(JSON.stringify({
      level,
      context: this.context,
      correlation_id: this.correlationId,
      message,
      timestamp: new Date().toISOString(),
      ...data
    }));
  }

  /**
   * Log levels
   */
  info(message: string, data: Record<string, any> = {}) {
    this.log('INFO', message, data);
  }

  warn(message: string, data: Record<string, any> = {}) {
    this.log('WARN', message, data);
  }

  error(message: string, error: unknown) {
    const errorData = {
      error_message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    };
    this.log('ERROR', message, errorData);
  }

  /**
   * Get the current correlation ID
   */
  getCorrelationId(): string {
    return this.correlationId;
  }
}

/**
 * Create a logger for edge functions
 */
export function createEdgeLogger(context: string, correlationId?: string): EdgeLogger {
  return new EdgeLogger(context, correlationId);
}
