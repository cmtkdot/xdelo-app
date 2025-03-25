
import { supabase } from "@/integrations/supabase/client";
import { LogEventType } from "./logUtils";

/**
 * Simplified logger for both client and server use
 */
export class Logger {
  private context: string;
  private correlationId: string;

  constructor(context: string, correlationId?: string) {
    this.context = context;
    this.correlationId = correlationId || crypto.randomUUID().toString();
  }

  /**
   * Log an event with standardized format
   */
  async logEvent(
    eventType: LogEventType | string,
    entityId: string,
    metadata: Record<string, any> = {}
  ): Promise<void> {
    try {
      // Ensure we have a valid UUID for database storage
      const validEntityId = this.ensureValidUuid(entityId);
      
      // Add standard metadata
      const enhancedMetadata = {
        ...metadata,
        context: this.context,
        timestamp: new Date().toISOString(),
        original_entity_id: entityId !== validEntityId ? entityId : undefined
      };
      
      // Clean up undefined values
      Object.keys(enhancedMetadata).forEach(key => {
        if (enhancedMetadata[key] === undefined) {
          delete enhancedMetadata[key];
        }
      });

      // Log to console for debugging
      console.log(`[${eventType}] [${this.context}] ${entityId}`, enhancedMetadata);
      
      // Log to database using the RPC function that handles UUID validation
      await supabase.rpc('xdelo_logprocessingevent', {
        p_event_type: String(eventType),
        p_entity_id: validEntityId,
        p_correlation_id: this.correlationId,
        p_metadata: enhancedMetadata
      });
    } catch (error) {
      // Fallback to console if database logging fails
      console.error(`Error logging event: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Ensure we have a valid UUID, generating one if needed
   */
  private ensureValidUuid(id: string): string {
    try {
      // Try to validate if it's already a UUID
      const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (uuidPattern.test(id)) {
        return id;
      }
      
      // Generate a new UUID if not valid
      return crypto.randomUUID().toString();
    } catch {
      return crypto.randomUUID().toString();
    }
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
   * Log convenience methods
   */
  async info(message: string, entityId: string, metadata: Record<string, any> = {}): Promise<void> {
    await this.logEvent(`info:${message}`, entityId, metadata);
  }

  async error(message: string, entityId: string, error: unknown, metadata: Record<string, any> = {}): Promise<void> {
    const errorData = {
      ...metadata,
      error_message: error instanceof Error ? error.message : String(error),
      error_stack: error instanceof Error ? error.stack : undefined
    };
    await this.logEvent(`error:${message}`, entityId, errorData);
  }

  async warn(message: string, entityId: string, metadata: Record<string, any> = {}): Promise<void> {
    await this.logEvent(`warning:${message}`, entityId, metadata);
  }

  async success(message: string, entityId: string, metadata: Record<string, any> = {}): Promise<void> {
    await this.logEvent(`success:${message}`, entityId, metadata);
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
