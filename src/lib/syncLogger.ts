
import { supabase } from "@/integrations/supabase/client";

export const logSyncOperation = async (
  operation: string,
  entityId: string,
  metadata: Record<string, any> = {}
): Promise<void> => {
  try {
    await supabase.from('unified_audit_logs').insert({
      id: crypto.randomUUID(),
      event_type: `sync_${operation}`,
      entity_id: entityId,
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
      id: crypto.randomUUID(),
      event_type: 'sync_warning',
      entity_id: entityId,
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
