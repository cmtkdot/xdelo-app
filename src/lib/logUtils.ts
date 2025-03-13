
import { supabase } from '@/integrations/supabase/client';
import { v4 as uuidv4 } from 'uuid';
import { LogEventType } from '@/types/api/LogEventType';

/**
 * Centralized logging function that logs events to the unified_audit_logs table
 */
export async function logEvent(
  eventType: LogEventType | string,
  entityId: string,
  metadata: Record<string, any> = {},
  previousState?: Record<string, any>,
  newState?: Record<string, any>,
  errorMessage?: string
): Promise<{ success: boolean; logId?: string }> {
  try {
    // Generate a correlation ID if not provided
    const correlationId = metadata?.correlationId || `log-${uuidv4()}`;
    
    // Add timestamp to metadata if not provided
    const enhancedMetadata = {
      ...metadata,
      timestamp: metadata.timestamp || new Date().toISOString()
    };
    
    // Insert the log entry
    const { data, error } = await supabase
      .from('unified_audit_logs')
      .insert({
        event_type: eventType,
        entity_id: entityId,
        metadata: enhancedMetadata,
        previous_state: previousState || null,
        new_state: newState || null,
        error_message: errorMessage || null,
        correlation_id: correlationId
      })
      .select('id')
      .single();
    
    if (error) {
      console.error('Error logging event:', error);
      return { success: false };
    }
    
    return { success: true, logId: data?.id };
  } catch (err) {
    console.error('Failed to log event:', err);
    return { success: false };
  }
}

/**
 * Specialized logging function for message-related events
 */
export async function logMessageEvent(
  eventType: LogEventType | string,
  messageId: string,
  metadata: Record<string, any> = {},
  previousState?: Record<string, any>,
  newState?: Record<string, any>
): Promise<{ success: boolean; logId?: string }> {
  // Enhance metadata with message-specific context
  const enhancedMetadata = {
    ...metadata,
    entity_type: 'message'
  };
  
  return logEvent(eventType, messageId, enhancedMetadata, previousState, newState);
}

/**
 * Specialized logging function for sync operations
 */
export async function logSyncOperation(
  operation: LogEventType | string,
  entityId: string,
  metadata: Record<string, any> = {},
  success: boolean = true,
  errorMessage?: string
): Promise<{ success: boolean; logId?: string }> {
  // Enhance metadata with sync-specific context
  const enhancedMetadata = {
    ...metadata,
    entity_type: 'sync',
    operation_success: success
  };
  
  return logEvent(operation, entityId, enhancedMetadata, null, null, errorMessage);
}

/**
 * Specialized logging function for system repair operations
 */
export async function logSystemRepair(
  operation: LogEventType | string,
  entityId: string,
  metadata: Record<string, any> = {},
  success: boolean = true,
  errorMessage?: string
): Promise<{ success: boolean; logId?: string }> {
  // Enhance metadata with repair-specific context
  const enhancedMetadata = {
    ...metadata,
    entity_type: 'system_repair',
    repair_success: success,
    timestamp: new Date().toISOString()
  };
  
  return logEvent(LogEventType.SYSTEM_REPAIR, entityId, enhancedMetadata, null, null, errorMessage);
}

export { LogEventType };
