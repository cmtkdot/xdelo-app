
import { supabase } from "@/integrations/supabase/client";

// Import directly from the shared utils
export enum LogEventType {
  // Message events
  MESSAGE_RECEIVED = "MESSAGE_RECEIVED",
  MESSAGE_PROCESSED = "MESSAGE_PROCESSED",
  MESSAGE_ERROR = "MESSAGE_ERROR",
  MEDIA_DOWNLOADED = "MEDIA_DOWNLOADED",
  MEDIA_UPLOAD_ERROR = "MEDIA_UPLOAD_ERROR",
  CAPTION_PARSED = "CAPTION_PARSED",
  MESSAGE_UPDATED = "MESSAGE_UPDATED",
  MESSAGE_DELETED = "MESSAGE_DELETED",
  
  // Sync events
  SYNC_OPERATION = "SYNC_OPERATION",
  SYNC_STARTED = "SYNC_STARTED",
  SYNC_COMPLETED = "SYNC_COMPLETED",
  SYNC_FAILED = "SYNC_FAILED",
  SYNC_PRODUCTS = "SYNC_PRODUCTS",
  
  // Product matching
  PRODUCT_MATCHING = "PRODUCT_MATCHING",
  
  // Media operations
  MEDIA_REUPLOAD_REQUESTED = "MEDIA_REUPLOAD_REQUESTED",
  MEDIA_REUPLOAD_SUCCESS = "MEDIA_REUPLOAD_SUCCESS",
  MEDIA_REUPLOAD_FAILED = "MEDIA_REUPLOAD_FAILED",
  
  // System events
  SYSTEM_EVENT = "SYSTEM_EVENT",
  SYSTEM_WARNING = "SYSTEM_WARNING",
  SYSTEM_ERROR = "SYSTEM_ERROR",
  
  // User events
  USER_ACTION = "USER_ACTION"
}

export interface EventLogData {
  [key: string]: any;
}

export class Logger {
  private namespace: string;
  
  constructor(namespace: string) {
    this.namespace = namespace;
  }
  
  async logEvent(
    eventType: LogEventType | string,
    entityId: string,
    metadata: EventLogData = {}
  ): Promise<void> {
    try {
      const correlationId = crypto.randomUUID().toString();
      
      // First attempt direct API call
      try {
        await supabase.functions.invoke('log-operation', {
          body: { 
            eventType,
            entityId,
            metadata: {
              ...metadata,
              namespace: this.namespace
            }
          }
        });
        return;
      } catch (apiError) {
        console.warn(`Edge function logging failed, falling back to RPC: ${apiError.message}`);
      }
      
      // Fallback: log to database via RPC
      await supabase.rpc('log_processing_event', {
        p_event_type: eventType,
        p_entity_id: entityId,
        p_correlation_id: correlationId,
        p_metadata: {
          ...metadata,
          namespace: this.namespace
        }
      });
    } catch (error) {
      console.error(`Error logging event: ${error}`);
    }
  }
  
  async logMediaOperation(
    operation: string,
    messageId: string,
    success: boolean,
    metadata: EventLogData = {}
  ): Promise<void> {
    const eventType = success 
      ? `MEDIA_${operation.toUpperCase()}_SUCCESS` 
      : `MEDIA_${operation.toUpperCase()}_FAILED`;
      
    await this.logEvent(eventType, messageId, {
      operation,
      success,
      ...metadata
    });
  }
}

// Helper function to create a logger
export function createLogger(namespace: string): Logger {
  return new Logger(namespace);
}

// Default logger for backward compatibility
const defaultLogger = createLogger('client-log');

/**
 * Logs an event to the unified audit logs system
 * Simplified version that uses the new Logger class
 */
export const logEvent = async (
  eventType: LogEventType | string,
  entityId: string,
  metadata: EventLogData = {}
) => {
  await defaultLogger.logEvent(eventType, entityId, metadata);
};

/**
 * Log a media operation
 */
export const logMediaOperation = async (
  operation: string,
  messageId: string,
  success: boolean,
  metadata: EventLogData = {}
) => {
  await defaultLogger.logMediaOperation(operation, messageId, success, metadata);
};

export default {
  logEvent,
  logMediaOperation,
  LogEventType
};
