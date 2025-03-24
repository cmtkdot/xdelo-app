// Unified logger utility with correlation ID tracking and emoji support
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
  error(message: string, error: unknown = {}) {
    // Transform error into a suitable data object
    const errorData = this._formatError(error);
    this._log('ERROR', '🔴', message, errorData);
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
   * Format an error consistently
   */
  private _formatError(error: unknown): Record<string, any> {
    if (error instanceof Error) {
      return {
        message: error.message,
        stack: error.stack,
        name: error.name,
        ...this._extractErrorProperties(error)
      };
    } else if (typeof error === 'object' && error !== null) {
      return { ...this._extractErrorProperties(error as Record<string, any>) };
    } else if (typeof error === 'string') {
      return { message: error };
    } else {
      return { error };
    }
  }
  
  /**
   * Helper to extract properties from an error object
   */
  private _extractErrorProperties(error: Record<string, any>): Record<string, any> {
    const result: Record<string, any> = {};
    
    // Extract common error properties
    if ('code' in error) result.code = error.code;
    if ('status' in error) result.status = error.status;
    if ('statusCode' in error) result.statusCode = error.statusCode;
    if ('data' in error) result.data = error.data;
    
    return result;
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
   * Get the component name for this logger
   */
  getComponent(): string {
    return this.component;
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
 * Format a webhook event summary for quick understanding
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

/**
 * Convenience method to get a logger or fallback to console
 * This unified approach simplifies logger creation across functions
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
 * Log a message operation to both console and database
 * This is used by various handlers to keep a consistent log format
 */
export async function xdelo_logMessageOperation(
  eventType: string,
  entityId: string,
  correlationId: string,
  metadata: Record<string, any> = {},
  errorMessage?: string
): Promise<void> {
  try {
    // Create a formatted summary for the console
    const summary = formatWebhookSummary(
      eventType, 
      entityId, 
      !eventType.includes('error') && !eventType.includes('failed'),
      metadata
    );
    
    // Log to console
    console.log(summary, metadata);
    
    // Import supabase client
    const { supabaseClient } = await import('../supabase.ts');
    
    // Log to database
    const { error } = await supabaseClient.from('unified_audit_logs').insert({
      event_type: eventType,
      entity_id: entityId,
      correlation_id: correlationId || crypto.randomUUID(),
      metadata,
      error_message: errorMessage
    });
    
    if (error) {
      console.error(`Error logging operation ${eventType}:`, error);
    }
  } catch (e) {
    console.error(`Failed to log message operation ${eventType}:`, e);
  }
} 