
import { supabase } from "@/integrations/supabase/client";

// Event types for logging operations
export type SyncEventType = 
  | "sync_started" 
  | "sync_completed" 
  | "sync_error" 
  | "sync_warning"
  | "sync_message_processed"
  | "sync_message_skipped";

// Add missing functions that are referenced in other files
export const logDeletion = async (
  entityId: string,
  metadata: Record<string, any> = {}
): Promise<void> => {
  try {
    await supabase.from('unified_audit_logs').insert({
      entity_id: entityId,
      event_type: "message_deleted",
      metadata: {
        ...metadata,
        timestamp: new Date().toISOString(),
        source: 'web_client'
      }
    });
  } catch (error) {
    console.error('Error logging deletion:', error);
  }
};

export const logMessageOperation = async (
  operation: string,
  entityId: string,
  metadata: Record<string, any> = {}
): Promise<void> => {
  try {
    await supabase.from('unified_audit_logs').insert({
      entity_id: entityId,
      event_type: `message_${operation}`,
      metadata: {
        ...metadata,
        timestamp: new Date().toISOString(),
        source: 'web_client'
      }
    });
  } catch (error) {
    console.error('Error logging message operation:', error);
  }
};

export const logSyncOperation = async (
  operation: string,
  entityId: string,
  metadata: Record<string, any> = {}
): Promise<void> => {
  try {
    // Use a valid event_type from the allowed list
    const eventType: SyncEventType = `sync_${operation}` as SyncEventType;
    
    await supabase.from('unified_audit_logs').insert({
      entity_id: entityId,
      event_type: eventType,
      metadata: {
        ...metadata,
        timestamp: new Date().toISOString(),
        source: 'web_client'
      }
    });
  } catch (error) {
    console.error('Error logging sync operation:', error);
  }
};

export const logSyncWarning = async (
  entityId: string,
  message: string,
  metadata: Record<string, any> = {}
): Promise<void> => {
  try {
    await supabase.from('unified_audit_logs').insert({
      entity_id: entityId,
      event_type: "sync_warning" as SyncEventType,
      metadata: {
        message,
        ...metadata,
        timestamp: new Date().toISOString(),
        source: 'web_client'
      }
    });
  } catch (error) {
    console.error('Error logging sync warning:', error);
  }
};
