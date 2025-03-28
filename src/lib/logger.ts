
import { supabase } from "@/integrations/supabase/client";
import { LogEventType } from "@/types/api/LogEventType";

/**
 * Unified logger for client and server use
 */
export class Logger {
  private context: string;
  private correlationId: string;

  constructor(context: string, correlationId?: string) {
    this.context = context;
    this.correlationId = correlationId || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : this.generateFallbackUUID());
  }

  /**
   * Log an event with standardized format
   */
  async logEvent(
    eventType: LogEventType | string,
    entityId: string,
    metadata: Record<string, unknown> = {}
  ): Promise<void> {
    try {
      // Add standard metadata
      const enhancedMetadata: Record<string, unknown> = {
        ...metadata,
        context: this.context,
        timestamp: new Date().toISOString(),
        client_version: process.env.APP_VERSION || 'unknown'
      };

      // Ensure we have a valid UUID for the entity_id
      const safeEntityId = this.validateEntityId(entityId);
      if (safeEntityId !== entityId) {
        // Add the original entity ID to the metadata
        enhancedMetadata.original_entity_id = entityId;
      }

      // Log to console for debugging in development
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[${eventType}] [${this.context}] ${entityId}`, enhancedMetadata);
      }

      // Log to database
      await supabase.rpc('xdelo_logprocessingevent', {
        p_event_type: String(eventType),
        p_entity_id: safeEntityId,
        p_correlation_id: this.correlationId,
        p_metadata: enhancedMetadata
      });
    } catch (error) {
      // Fallback to console if database logging fails
      console.error(`Error logging event: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Validate or generate a UUID
   */
  private validateEntityId(id: string): string {
    try {
      // Check for valid UUID format
      const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

      if (uuidPattern.test(id)) {
        return id;
      }

      // Generate a new UUID if not valid
      return typeof crypto !== 'undefined' && crypto.randomUUID ?
        crypto.randomUUID().toString() :
        this.generateFallbackUUID();
    } catch {
      return this.generateFallbackUUID();
    }
  }

  /**
   * Fallback UUID generation when crypto.randomUUID is not available
   */
  private generateFallbackUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  /**
   * Get the current correlation ID
   */
  getCorrelationId(): string {
    return this.correlationId;
  }

  /**
   * Create a child logger with the same correlation ID
   */
  createChildLogger(childContext: string): Logger {
    return new Logger(`${this.context}:${childContext}`, this.correlationId);
  }

  /**
   * Convenience methods for common log levels
   */
  async info(message: string, entityId: string, metadata: Record<string, unknown> = {}): Promise<void> {
    await this.logEvent(`info:${message}`, entityId, metadata);
  }

  async error(message: string, entityId: string, error: unknown, metadata: Record<string, unknown> = {}): Promise<void> {
    const errorData = {
      ...metadata,
      error_message: error instanceof Error ? error.message : String(error),
      error_stack: error instanceof Error ? error.stack : undefined
    };
    await this.logEvent(`error:${message}`, entityId, errorData);
  }

  async warn(message: string, entityId: string, metadata: Record<string, unknown> = {}): Promise<void> {
    await this.logEvent(`warning:${message}`, entityId, metadata);
  }

  async success(message: string, entityId: string, metadata: Record<string, unknown> = {}): Promise<void> {
    await this.logEvent(`success:${message}`, entityId, metadata);
  }

  /**
   * Log media processing operations
   */
  async logMediaOperation(
    operation: string,
    messageId: string,
    success: boolean,
    metadata: Record<string, unknown> = {}
  ): Promise<void> {
    const eventType = success ? `media_${operation}_success` : `media_${operation}_failed`;
    await this.logEvent(eventType, messageId, metadata);
  }
}

/**
 * Create a logger instance
 */
export function createLogger(context: string, correlationId?: string): Logger {
  return new Logger(context, correlationId);
}

/**
 * Get a singleton logger for the current context
 */
export function getLogger(context: string, correlationId?: string): Logger {
  return createLogger(context, correlationId);
}
