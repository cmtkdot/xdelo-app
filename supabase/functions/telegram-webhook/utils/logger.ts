import { supabaseClient } from '../../_shared/cors.ts';

/**
 * Simple logger class for telegram-webhook function
 */
export class Logger {
  private correlationId: string;
  private source: string;

  constructor(correlationId: string, source: string = 'telegram-webhook') {
    this.correlationId = correlationId;
    this.source = source;
  }

  /**
   * Log a debug message
   */
  debug(message: string, metadata: Record<string, any> = {}): void {
    console.debug(`[${this.source}][${this.correlationId}] ${message}`, metadata);
  }

  /**
   * Log an info message
   */
  info(message: string, metadata: Record<string, any> = {}): void {
    console.info(`[${this.source}][${this.correlationId}] ${message}`, metadata);
  }

  /**
   * Log a warning message
   */
  warn(message: string, metadata: Record<string, any> = {}): void {
    console.warn(`[${this.source}][${this.correlationId}] ${message}`, metadata);
  }

  /**
   * Log an error message
   */
  error(message: string, metadata: Record<string, any> = {}): void {
    console.error(`[${this.source}][${this.correlationId}] ${message}`, metadata);
    
    // Log to the database if possible
    try {
      void this.logToDatabase('error', message, metadata);
    } catch (err) {
      console.error(`Failed to log error to database: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /**
   * Log a message to the unified_audit_logs table
   */
  async logToDatabase(
    level: 'info' | 'warning' | 'error', 
    message: string, 
    metadata: Record<string, any> = {}
  ): Promise<void> {
    try {
      const eventType = `${this.source}_${level}`;
      
      // Generate a valid UUID if entity_id is missing or invalid
      let entityId = metadata.entity_id;
      
      // Validate UUID format using regex
      const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!entityId || !uuidPattern.test(entityId)) {
        // Generate a UUID v4 (random)
        entityId = crypto.randomUUID();
        console.log(`[${this.correlationId}] Generated new UUID for invalid entity_id: ${metadata.entity_id || 'undefined'}`);
      }
      
      await supabaseClient.from('unified_audit_logs').insert({
        event_type: eventType,
        entity_id: entityId,
        message,
        metadata: {
          ...metadata,
          source: this.source,
          logger: 'edge-function'
        },
        correlation_id: this.correlationId,
        event_timestamp: new Date().toISOString()
      });
    } catch (error) {
      // Don't recursively log errors from logging
      console.error(`[${this.correlationId}][logToDatabase] Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

/**
 * Helper function to log a message with correlation ID
 * 
 * @param correlationId - Correlation ID for request tracking
 * @param message - Message to log
 * @param level - Log level (default: 'info')
 * @param metadata - Additional metadata to include
 */
export function logWithCorrelation(
  correlationId: string, 
  message: string, 
  level: 'debug' | 'info' | 'warn' | 'error' = 'info',
  metadata: Record<string, any> = {}
): void {
  const logger = new Logger(correlationId);
  
  switch (level) {
    case 'debug':
      logger.debug(message, metadata);
      break;
    case 'warn':
      logger.warn(message, metadata);
      break;
    case 'error':
      logger.error(message, metadata);
      break;
    case 'info':
    default:
      logger.info(message, metadata);
      break;
  }
}
