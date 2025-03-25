// Logger utility for Telegram webhook with correlation ID tracking and emoji support
import { supabaseClient } from '../../_shared/supabase.ts';

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
  }
  
  /**
   * Log a warning message with emoji
   */
  warn(message: string, data: Record<string, any> = {}) {
    this._log('WARN', '🟠', message, data);
  }
  
  /**
   * Log an error message with emoji
   */
  error(message: string, data: Record<string, any> = {}) {
    this._log('ERROR', '🔴', message, data);
  }
  
  /**
   * Log a debug message with emoji
   */
  debug(message: string, data: Record<string, any> = {}) {
    this._log('DEBUG', '🟣', message, data);
  }
  
  /**
   * Log a success message with emoji
   */
  success(message: string, data: Record<string, any> = {}) {
    this._log('SUCCESS', '🟢', message, data);
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

/**
 * Log a message operation to both console and database
 * This is used by various handlers to keep a consistent log format
 */
export async function logMessageOperation(
  eventType: string,
  entityId: string,
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
    
    // Use the imported supabaseClient directly instead of dynamic import
    // Log to database
    const { error } = await supabaseClient.from('unified_audit_logs').insert({
      event_type: eventType,
      entity_id: entityId,
      correlation_id: metadata.correlation_id || crypto.randomUUID(),
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
