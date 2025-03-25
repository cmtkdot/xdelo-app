
import { supabase } from "@/integrations/supabase/client";

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

/**
 * Logs an event to the unified audit logs system
 */
export const logEvent = async (
  eventType: LogEventType | string,
  entityId: string,
  metadata: EventLogData = {}
) => {
  try {
    // Generate a correlation ID if none exists
    const correlationId = crypto.randomUUID();
    
    // Call the standard database function that handles UUID validation
    const { error } = await supabase.rpc(
      'xdelo_logprocessingevent',
      {
        p_event_type: String(eventType),
        p_entity_id: entityId,
        p_correlation_id: correlationId,
        p_metadata: {
          ...metadata,
          logged_at: new Date().toISOString(),
          source: 'client'
        }
      }
    );
    
    if (error) {
      console.warn("Failed to log event:", error.message);
      
      // Fallback to direct insert if the RPC fails
      try {
        const { error: insertError } = await supabase
          .from('unified_audit_logs')
          .insert({
            event_type: String(eventType),
            entity_id: crypto.randomUUID(),
            metadata: {
              ...metadata,
              original_entity_id: entityId,
              logged_at: new Date().toISOString(),
              source: 'client_fallback'
            },
            correlation_id: correlationId
          });
          
        if (insertError) {
          console.error("Failed to log event using fallback method:", insertError.message);
        }
      } catch (insertError) {
        console.error("Error in fallback logging:", insertError);
      }
    }
  } catch (error) {
    console.error("Error in logEvent:", error);
  }
};

export default {
  logEvent,
  LogEventType
};
