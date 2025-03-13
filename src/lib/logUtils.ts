
import { supabase } from "@/integrations/supabase/client";
import { LogEventType } from "@/types/api/LogEventType";
import { v4 as uuidv4 } from "uuid";

export interface LogMetadata {
  [key: string]: any;
  timestamp?: string;
  source?: string;
  user_id?: string;
  correlation_id?: string;
}

export interface LogEntry {
  eventType: LogEventType | string;
  entityId: string;
  previousState?: Record<string, any>;
  newState?: Record<string, any>;
  metadata?: LogMetadata;
  errorMessage?: string;
}

/**
 * Log an event to the unified_audit_logs table
 */
export async function logEvent(entry: LogEntry): Promise<{ success: boolean; logId?: string }> {
  try {
    // Ensure metadata always has a timestamp
    const enhancedMetadata = {
      ...(entry.metadata || {}),
      timestamp: entry.metadata?.timestamp || new Date().toISOString(),
      source: entry.metadata?.source || 'webapp'
    };

    // Generate a correlation ID if not provided
    const correlationId = enhancedMetadata.correlation_id || uuidv4();
    enhancedMetadata.correlation_id = correlationId;

    const { data, error } = await supabase
      .from('unified_audit_logs')
      .insert({
        event_type: entry.eventType,
        entity_id: entry.entityId,
        previous_state: entry.previousState,
        new_state: entry.newState,
        metadata: enhancedMetadata,
        error_message: entry.errorMessage,
        correlation_id: correlationId
      })
      .select('id')
      .single();

    if (error) {
      console.error('Error logging event:', error);
      return { success: false };
    }

    return { success: true, logId: data.id };
  } catch (error) {
    console.error('Error in logEvent:', error);
    return { success: false };
  }
}

/**
 * Log a message event with simplified parameters
 */
export async function logMessageEvent(
  eventType: LogEventType | string,
  messageId: string,
  metadata?: LogMetadata,
  previousState?: Record<string, any>,
  newState?: Record<string, any>,
  errorMessage?: string
): Promise<{ success: boolean; logId?: string }> {
  return logEvent({
    eventType,
    entityId: messageId,
    metadata,
    previousState,
    newState,
    errorMessage
  });
}

/**
 * Log user actions for auditing
 */
export async function logUserAction(
  action: string,
  entityId: string,
  userId?: string,
  metadata?: Record<string, any>
): Promise<{ success: boolean; logId?: string }> {
  return logEvent({
    eventType: LogEventType.USER_ACTION,
    entityId,
    metadata: {
      ...metadata,
      action,
      user_id: userId,
      timestamp: new Date().toISOString()
    }
  });
}

/**
 * Log system repair operations
 */
export async function logSystemRepair(
  operation: string,
  targetId: string,
  result: Record<string, any>,
  success: boolean,
  errorMessage?: string
): Promise<{ success: boolean; logId?: string }> {
  return logEvent({
    eventType: LogEventType.SYSTEM_REPAIR,
    entityId: targetId,
    metadata: {
      operation,
      result,
      status: success ? 'success' : 'error',
      timestamp: new Date().toISOString()
    },
    errorMessage: success ? undefined : errorMessage
  });
}

/**
 * Log sync operations
 */
export async function logSyncOperation(
  operation: string,
  entityId: string,
  details: Record<string, any>,
  success: boolean,
  errorMessage?: string
): Promise<{ success: boolean; logId?: string }> {
  const eventType = success ? LogEventType.SYNC_COMPLETED : LogEventType.SYNC_ERROR;

  return logEvent({
    eventType,
    entityId,
    metadata: {
      operation,
      ...details,
      timestamp: new Date().toISOString()
    },
    errorMessage: success ? undefined : errorMessage
  });
}

// Log to the Edge Function unified logging API
export async function logToEdgeFunction(entry: LogEntry): Promise<{ success: boolean; correlationId?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke('log-operation', {
      body: {
        eventType: entry.eventType,
        entityId: entry.entityId, 
        previousState: entry.previousState,
        newState: entry.newState,
        metadata: entry.metadata,
        errorMessage: entry.errorMessage
      }
    });

    if (error) {
      console.error('Error calling log-operation edge function:', error);
      return { success: false };
    }

    return { 
      success: true, 
      correlationId: data.correlationId 
    };
  } catch (error) {
    console.error('Error in logToEdgeFunction:', error);
    return { success: false };
  }
}

// Export the event types
export { LogEventType };
