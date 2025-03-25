
import { supabase } from '@/integrations/supabase/client';
import { LogEventType } from '@/types/api/LogEventType';

// Re-export LogEventType for direct imports
export { LogEventType };

/**
 * Logs an event to the unified_audit_logs table
 */
export async function logEvent(
  eventType: LogEventType | string,
  entityId: string,
  metadata: Record<string, any> = {},
  previousState?: Record<string, any>,
  newState?: Record<string, any>
) {
  try {
    const { error } = await supabase
      .from('unified_audit_logs')
      .insert({
        event_type: eventType,
        entity_id: entityId,
        metadata,
        previous_state: previousState,
        new_state: newState,
      });
    
    if (error) {
      console.error('Error logging event:', error);
    }
    
    return !error;
  } catch (err) {
    console.error('Error in logEvent:', err);
    return false;
  }
}

/**
 * Logs a user action to the console and optionally to the database
 */
export function logUserAction(
  action: string,
  data: Record<string, any> = {},
  entityId?: string
) {
  // Always log to console
  console.log(`User action: ${action}`, data);
  
  // If we have an entity ID, log to database
  if (entityId) {
    logEvent(
      LogEventType.USER_ACTION,
      entityId,
      {
        action,
        ...data
      }
    );
  }
}

// Add logSyncOperation for compatibility
export async function logSyncOperation(
  eventType: LogEventType | string,
  entityId: string,
  metadata: Record<string, any> = {},
  includeTimestamp: boolean = true
) {
  if (includeTimestamp) {
    metadata.timestamp = new Date().toISOString();
  }
  
  return logEvent(eventType, entityId, metadata);
}
