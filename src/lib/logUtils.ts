
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
    // Check if entityId is a valid UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const isValidUuid = entityId && uuidRegex.test(entityId);
    
    // If not a valid UUID, create one and store original in metadata
    const validEntityId = isValidUuid ? entityId : crypto.randomUUID();
    const enhancedMetadata = {
      ...metadata,
      ...(isValidUuid ? {} : { original_entity_id: entityId }),
      logged_at: new Date().toISOString()
    };
    
    // First try with unified_audit_logs table (preferred)
    const { error: unifiedError } = await supabase
      .from('unified_audit_logs')
      .insert({
        event_type: String(eventType),
        entity_id: validEntityId,
        metadata: enhancedMetadata
      });
    
    if (unifiedError) {
      console.warn("Could not log to unified_audit_logs:", unifiedError.message);
      
      // Fallback to event_logs if it exists
      try {
        const { error: legacyError } = await supabase.rpc(
          'xdelo_log_event' as any,
          {
            p_event_type: String(eventType),
            p_message_id: entityId,
            p_metadata: enhancedMetadata
          }
        );
        
        if (legacyError) {
          console.error("Failed to log event using fallback method:", legacyError.message);
        }
      } catch (rpcError) {
        console.error("RPC function not available:", rpcError);
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
