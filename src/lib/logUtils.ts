
import { supabase } from "@/integrations/supabase/client";

export enum LogEventType {
  MESSAGE_RECEIVED = "MESSAGE_RECEIVED",
  MESSAGE_PROCESSED = "MESSAGE_PROCESSED",
  MESSAGE_ERROR = "MESSAGE_ERROR",
  MEDIA_DOWNLOADED = "MEDIA_DOWNLOADED",
  MEDIA_UPLOAD_ERROR = "MEDIA_UPLOAD_ERROR",
  CAPTION_PARSED = "CAPTION_PARSED",
  MESSAGE_UPDATED = "MESSAGE_UPDATED",
  MESSAGE_DELETED = "MESSAGE_DELETED",
  PRODUCT_MATCHING = "PRODUCT_MATCHING",
  SYNC_OPERATION = "SYNC_OPERATION",
  SYSTEM_EVENT = "SYSTEM_EVENT"
}

export interface EventLogData {
  [key: string]: any;
}

/**
 * Logs an event to the unified audit logs system
 */
export const logEvent = async (
  eventType: string | LogEventType,
  entityId: string,
  metadata: EventLogData = {}
) => {
  try {
    // First try with unified_audit_logs table (preferred)
    const { error: unifiedError } = await supabase
      .from('unified_audit_logs')
      .insert({
        event_type: eventType,
        entity_id: entityId,
        metadata
      });
    
    if (unifiedError) {
      console.warn("Could not log to unified_audit_logs:", unifiedError.message);
      
      // Fallback to event_logs if it exists
      try {
        const { error: legacyError } = await supabase.rpc('xdelo_log_event', {
          p_event_type: eventType,
          p_message_id: entityId,
          p_metadata: metadata
        });
        
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
