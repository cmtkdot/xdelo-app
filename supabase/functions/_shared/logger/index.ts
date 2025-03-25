// Logger utility for Telegram webhook with correlation ID tracking and emoji support
export class Logger {
  private correlationId: string;
  private component: string;
  
  constructor(correlationId: string, component: string) {
    this.correlationId = correlationId;
    this.component = component;
  }
  
  /**
   * Log an informational message with emoji
   */
  info(message: string, data: Record<string, any> = {}) {
    this._log('INFO', '🔵', message, data);
    return this; // For chaining
  }
  
  /**
   * Log a warning message with emoji
   */
  warn(message: string, data: Record<string, any> = {}) {
    this._log('WARN', '🟠', message, data);
    return this; // For chaining
  }
  
  /**
   * Log an error message with emoji
   */
  error(message: string, data: Record<string, any> = {}) {
    // If data is an Error object, extract useful properties
    if (data instanceof Error) {
      data = {
        message: data.message,
        stack: data.stack,
        name: data.name
      };
    }
    
    this._log('ERROR', '🔴', message, data);
    return this; // For chaining
  }
  
  /**
   * Log a debug message with emoji
   */
  debug(message: string, data: Record<string, any> = {}) {
    this._log('DEBUG', '🟣', message, data);
    return this; // For chaining
  }
  
  /**
   * Log a success message with emoji
   */
  success(message: string, data: Record<string, any> = {}) {
    this._log('SUCCESS', '🟢', message, data);
    return this; // For chaining
  }
  
  /**
   * Internal logging function with enhanced formatting
   */
  private _log(level: string, emoji: string, message: string, data: Record<string, any> = {}) {
    // Create a summary line that's easy to scan
    const summary = `${emoji} [${level}] [${this.component}] ${message}`;
    
    // Format the detailed log with indentation for better readability
    console.log(JSON.stringify({
      summary,
      level,
      correlation_id: this.correlationId,
      component: this.component,
      message,
      timestamp: new Date().toISOString(),
      ...data
    }, null, 2));
  }

  /**
   * Get the correlation ID for this logger
   */
  getCorrelationId(): string {
    return this.correlationId;
  }

  /**
   * Create a child logger with a sub-component name
   */
  createChild(subComponent: string): Logger {
    return new Logger(
      this.correlationId,
      `${this.component}/${subComponent}`
    );
  }
}

/**
 * Create a logger with a generated correlation ID if none is provided
 */
export function createLogger(component: string, correlationId?: string): Logger {
  const corrId = correlationId || crypto.randomUUID().toString();
  return new Logger(corrId, component);
}

/**
 * Convenience method to get a logger or create one
 */
export function getLogger(componentOrLogger?: string | Logger | null, correlationId?: string): Logger {
  // If given a Logger, return it directly
  if (componentOrLogger instanceof Logger) {
    return componentOrLogger;
  }
  
  // If given a component name (string), create a new logger
  if (typeof componentOrLogger === 'string') {
    return createLogger(componentOrLogger, correlationId);
  }
  
  // Default to a generic logger
  return createLogger('generic', correlationId);
}

/**
 * Format a webhook event summary for quick understanding
 * @param eventType Type of event
 * @param entityId The entity being processed
 * @param isSuccess Whether the operation was successful
 * @param metadata Additional context
 * @returns Formatted summary string
 */
export function formatWebhookSummary(
  eventType: string,
  entityId: string | number,
  isSuccess: boolean = true,
  metadata: Record<string, any> = {}
): string {
  // Select appropriate emoji based on event and success
  let emoji = '📋';
  
  if (eventType.includes('error') || eventType.includes('failed')) {
    emoji = '❌';
  } else if (eventType.includes('success') || eventType.includes('completed')) {
    emoji = '✅';
  } else if (eventType.includes('warning')) {
    emoji = '⚠️';
  } else if (eventType.includes('received')) {
    emoji = '📥';
  } else if (eventType.includes('processing')) {
    emoji = '⚙️';
  } else if (eventType.includes('media')) {
    emoji = '🖼️';
  } else if (eventType.includes('text')) {
    emoji = '💬';
  }
  
  // Override with success/failure emoji if specified
  if (!isSuccess) {
    emoji = '❌';
  }
  
  // Build a concise summary
  let summary = `${emoji} ${eventType.replace(/_/g, ' ')}`;
  
  // Add entity information
  if (entityId) {
    // Truncate IDs that are too long
    const displayId = typeof entityId === 'string' && entityId.length > 8 
      ? `${entityId.substring(0, 8)}...` 
      : entityId;
    summary += ` [ID: ${displayId}]`;
  }
  
  // Add important context if available
  if (metadata.chat_id) {
    summary += ` | Chat: ${metadata.chat_id}`;
  }
  
  if (metadata.message_id) {
    summary += ` | Msg: ${metadata.message_id}`;
  }
  
  if (metadata.duration_ms) {
    summary += ` | Duration: ${metadata.duration_ms}ms`;
  }
  
  return summary;
}
