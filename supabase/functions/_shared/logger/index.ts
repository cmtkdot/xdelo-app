
// Unified logger utility with correlation ID tracking
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
    return this; // For chaining
  }
  
  /**
   * Log a warning message
   */
  warn(message: string, data: Record<string, any> = {}) {
    this._log('WARN', message, data);
    return this; // For chaining
  }
  
  /**
   * Log an error message
   */
  error(message: string, error: unknown = {}) {
    // Transform error into a suitable data object
    const errorData = this._formatError(error);
    this._log('ERROR', message, errorData);
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
        name: error.name
      };
    } else if (typeof error === 'object' && error !== null) {
      return { ...(error as Record<string, any>) };
    } else if (typeof error === 'string') {
      return { message: error };
    } else {
      return { error };
    }
  }
  
  /**
   * Internal logging function with structured format
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
 * Log a message operation to both console and database
 */
export async function logMessageOperation(
  eventType: string,
  entityId: string,
  correlationId: string,
  metadata: Record<string, any> = {}
): Promise<void> {
  try {
    // Ensure correlation ID is a string
    const corrId = correlationId?.toString() || crypto.randomUUID();
    
    // ALWAYS generate a new UUID to avoid type errors with UUID columns
    const validEntityId = crypto.randomUUID();
    
    // Store original entity ID in metadata
    const enhancedMetadata = {
      ...metadata,
      original_entity_id: entityId
    };
    
    // Log to console
    console.log(`[${eventType}] [${corrId}] ${entityId}`, enhancedMetadata);
    
    // Import supabase client
    const { createSupabaseClient } = await import('../supabase.ts');
    const supabaseClient = createSupabaseClient();
    
    // Insert with guaranteed valid UUID
    await supabaseClient.rpc('xdelo_logprocessingevent', {
      p_event_type: eventType,
      p_entity_id: validEntityId,
      p_correlation_id: corrId,
      p_metadata: enhancedMetadata
    });
  } catch (e) {
    console.error(`Failed to log message operation ${eventType}:`, e);
  }
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
correlationId);
}
