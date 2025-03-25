
import { supabase } from "@/integrations/supabase/client";
import { Logger, createLogger } from "./logger";

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

export default {
  logEvent,
  LogEventType
};
