
import { supabaseClient } from '../../_shared/supabase.ts';

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
      
      await supabaseClient.from('unified_audit_logs').insert({
        event_type: eventType,
        entity_id: metadata.entity_id || 'system',
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
      console.error(`Database logging error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
